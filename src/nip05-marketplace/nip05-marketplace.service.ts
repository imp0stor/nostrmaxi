import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { canDirectlyRegisterName, quoteNamePrice } from '../config/name-pricing';
import { SplitPaymentService } from '../payments/split-payment.service';

@Injectable()
export class Nip05MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly splitPaymentService: SplitPaymentService,
  ) {}

  async checkAvailability(localPart: string, domain: string) {
    const normalized = localPart.trim().toLowerCase();
    const normalizedDomain = domain.trim().toLowerCase();

    if (!normalized) throw new BadRequestException('Name is required');

    const directPolicy = canDirectlyRegisterName(normalized);
    if (!directPolicy.allowed) {
      return {
        available: false,
        reason: directPolicy.message,
        policy: directPolicy.quote,
      };
    }

    const [reserved, active, auction, listing] = await Promise.all([
      (this.prisma as any).reservedName.findUnique({ where: { name: normalized } }),
      this.prisma.nip05.findFirst({ where: { localPart: normalized, domain: normalizedDomain, isActive: true } }),
      (this.prisma as any).nip05Auction.findFirst({ where: { name: normalized, status: { in: ['scheduled', 'live'] } } }),
      (this.prisma as any).nip05Listing.findFirst({ where: { name: normalized, status: 'active' } }),
    ]);

    if (reserved || active || auction || listing) {
      return {
        available: false,
        reason: reserved
          ? `"${normalized}" is reserved and cannot be directly registered`
          : active
          ? `${normalized}@${normalizedDomain} is already taken`
          : auction
          ? `"${normalized}" is currently in auction`
          : `"${normalized}" is listed in marketplace`,
        policy: quoteNamePrice(normalized),
      };
    }

    return {
      available: true,
      reason: null,
      policy: quoteNamePrice(normalized),
    };
  }

  async listMarketplace(params: { q?: string; type?: string }) {
    const q = params.q?.trim().toLowerCase();
    const type = params.type || 'all';

    const whereName = q ? { contains: q, mode: 'insensitive' as const } : undefined;

    const [auctions, flatListings, resaleListings] = await Promise.all([
      type === 'all' || type === 'auctions'
        ? (this.prisma as any).nip05Auction.findMany({
            where: { status: { in: ['scheduled', 'live', 'ended'] }, ...(whereName ? { name: whereName } : {}) },
            include: { bids: { orderBy: { amountSats: 'desc' }, take: 10 } },
            orderBy: { endsAt: 'asc' },
          })
        : [],
      type === 'all' || type === 'premium'
        ? (this.prisma as any).nip05Listing.findMany({
            where: { listingType: 'flat', status: 'active', ...(whereName ? { name: whereName } : {}) },
            orderBy: { fixedPriceSats: 'asc' },
          })
        : [],
      type === 'all' || type === 'resale'
        ? (this.prisma as any).nip05Listing.findMany({
            where: { listingType: 'resale', status: 'active', ...(whereName ? { name: whereName } : {}) },
            orderBy: { createdAt: 'desc' },
          })
        : [],
    ]);

    return { auctions, flatListings, resaleListings };
  }

  async createAuction(input: any) {
    return (this.prisma as any).nip05Auction.create({
      data: {
        name: input.name.toLowerCase(),
        domain: input.domain || 'nostrmaxi.com',
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        startingBidSats: input.startingBidSats,
        reservePriceSats: input.reservePriceSats,
        minIncrementSats: input.minIncrementSats ?? Math.max(1000, Math.ceil(input.startingBidSats * 0.1)),
        status: new Date(input.startsAt).getTime() > Date.now() ? 'scheduled' : 'live',
      },
    });
  }

  async placeBid(input: { auctionId: string; bidderPubkey: string; amountSats: number }) {
    const auction = await (this.prisma as any).nip05Auction.findUnique({
      where: { id: input.auctionId },
      include: { bids: { orderBy: [{ amountSats: 'desc' }, { createdAt: 'asc' }], take: 1 } },
    });
    if (!auction) throw new NotFoundException('Auction not found');

    if (new Date(auction.endsAt).getTime() <= Date.now()) throw new BadRequestException('Auction has ended');

    const current = auction.bids[0];
    const minAllowed = current ? current.amountSats + auction.minIncrementSats : auction.startingBidSats;
    if (input.amountSats < minAllowed) {
      throw new BadRequestException(`Minimum bid is ${minAllowed} sats`);
    }

    const bid = await (this.prisma as any).nip05Bid.create({
      data: {
        auctionId: auction.id,
        bidderPubkey: input.bidderPubkey,
        amountSats: input.amountSats,
      },
    });

    await (this.prisma as any).nip05Auction.update({
      where: { id: auction.id },
      data: {
        currentBidSats: input.amountSats,
        currentBidderPubkey: input.bidderPubkey,
        bidCount: { increment: 1 },
        status: 'live',
      },
    });

    return {
      bid,
      outbidPubkey: current && current.bidderPubkey !== input.bidderPubkey ? current.bidderPubkey : null,
      minNextBidSats: input.amountSats + auction.minIncrementSats,
    };
  }

  async finalizeAuction(auctionId: string) {
    const auction = await (this.prisma as any).nip05Auction.findUnique({
      where: { id: auctionId },
      include: { bids: { orderBy: { amountSats: 'desc' }, take: 1 } },
    });
    if (!auction) throw new NotFoundException('Auction not found');

    const winningBid = auction.bids[0];
    if (!winningBid) {
      await (this.prisma as any).nip05Auction.update({ where: { id: auctionId }, data: { status: 'ended' } });
      return { settled: false, reason: 'No bids' };
    }

    if (auction.reservePriceSats && winningBid.amountSats < auction.reservePriceSats) {
      await (this.prisma as any).nip05Auction.update({ where: { id: auctionId }, data: { status: 'ended' } });
      return { settled: false, reason: 'Reserve not met' };
    }

    return this.splitPaymentService.createAuctionSettlementInvoice(auctionId, winningBid.bidderPubkey);
  }

  async createListing(input: any) {
    const listingType = input.listingType || 'resale';
    const seller = await this.prisma.user.findUnique({ where: { pubkey: input.sellerPubkey } });
    if (!seller?.lightningAddress) {
      throw new BadRequestException('Seller must set lightningAddress before creating listings');
    }

    return (this.prisma as any).nip05Listing.create({
      data: {
        name: input.name.toLowerCase(),
        domain: input.domain || 'nostrmaxi.com',
        listingType,
        sellerPubkey: input.sellerPubkey,
        fixedPriceSats: input.fixedPriceSats,
        saleMode: input.saleMode || 'lifetime',
        leaseEndsAt: input.leaseEndsAt ? new Date(input.leaseEndsAt) : null,
        status: 'active',
      },
    });
  }

  async buyListing(input: { listingId: string; buyerPubkey: string }) {
    return this.splitPaymentService.createMarketplaceInvoice(input.listingId, input.buyerPubkey);
  }

  async setSellerLightningAddress(pubkey: string, lightningAddress: string) {
    return this.splitPaymentService.setSellerLightningAddress(pubkey, lightningAddress);
  }

  async adminRetryPayout(transactionId: string) {
    return this.splitPaymentService.adminRetryPayout(transactionId);
  }

  async getMarketplaceTransactionHistory(limit = 100) {
    return this.splitPaymentService.getMarketplaceTransactionHistory(limit);
  }

  async listReservedNames() {
    return (this.prisma as any).reservedName.findMany({ orderBy: { name: 'asc' } });
  }
}
