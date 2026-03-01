import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type NameCategory = 'reserved' | 'premium' | 'blocked';

@Injectable()
export class AdminMarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeName(name: string): string {
    const normalized = (name || '').trim().toLowerCase();
    if (!normalized) throw new BadRequestException('name is required');
    return normalized;
  }

  async listNames(category: NameCategory, q?: string) {
    const search = q?.trim();
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : undefined;
    if (category === 'reserved') return (this.prisma as any).reservedName.findMany({ where, orderBy: { name: 'asc' } });
    if (category === 'premium') return (this.prisma as any).premiumName.findMany({ where, orderBy: [{ minimumPrice: 'asc' }, { name: 'asc' }] });
    return (this.prisma as any).blockedName.findMany({ where, orderBy: { name: 'asc' } });
  }

  async createName(category: NameCategory, body: any) {
    const name = this.normalizeName(body.name);
    if (category === 'reserved') return (this.prisma as any).reservedName.create({ data: { name, reason: body.reason || null } });
    if (category === 'premium') return (this.prisma as any).premiumName.create({ data: { name, reason: body.reason || null, minimumPrice: body.minimumPrice ?? null } });
    return (this.prisma as any).blockedName.create({ data: { name, reason: body.reason || null } });
  }

  async updateName(category: NameCategory, id: string, body: any) {
    if (category === 'reserved') return (this.prisma as any).reservedName.update({ where: { id }, data: { reason: body.reason } });
    if (category === 'premium') {
      return (this.prisma as any).premiumName.update({ where: { id }, data: { reason: body.reason, minimumPrice: body.minimumPrice } });
    }
    return (this.prisma as any).blockedName.update({ where: { id }, data: { reason: body.reason } });
  }

  async deleteName(category: NameCategory, id: string) {
    if (category === 'reserved') return (this.prisma as any).reservedName.delete({ where: { id } });
    if (category === 'premium') return (this.prisma as any).premiumName.delete({ where: { id } });
    return (this.prisma as any).blockedName.delete({ where: { id } });
  }

  async bulkImport(body: { category: NameCategory; content: string; minimumPrice?: number; reason?: string }) {
    const rows = body.content
      .split(/\r?\n/)
      .flatMap((line) => line.split(','))
      .map((v) => this.normalizeName(v))
      .filter(Boolean);

    const unique = [...new Set(rows)];
    if (!unique.length) return { imported: 0 };

    if (body.category === 'reserved') {
      const result = await (this.prisma as any).reservedName.createMany({
        data: unique.map((name) => ({ name, reason: body.reason || null })),
        skipDuplicates: true,
      });
      return { imported: result.count };
    }
    if (body.category === 'premium') {
      const result = await (this.prisma as any).premiumName.createMany({
        data: unique.map((name) => ({ name, reason: body.reason || null, minimumPrice: body.minimumPrice ?? null })),
        skipDuplicates: true,
      });
      return { imported: result.count };
    }
    const result = await (this.prisma as any).blockedName.createMany({
      data: unique.map((name) => ({ name, reason: body.reason || null })),
      skipDuplicates: true,
    });
    return { imported: result.count };
  }

  async listAuctions(status?: string) {
    const where = status && status !== 'all' ? { status } : undefined;
    return (this.prisma as any).nip05Auction.findMany({
      where,
      include: { bids: { orderBy: [{ amountSats: 'desc' }, { createdAt: 'desc' }], take: 100 } },
      orderBy: [{ endsAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAuction(body: any) {
    return (this.prisma as any).nip05Auction.create({
      data: {
        name: this.normalizeName(body.name),
        domain: body.domain || 'nostrmaxi.com',
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        startingBidSats: body.startingBidSats,
        reservePriceSats: body.reservePriceSats ?? null,
        minIncrementSats: body.minIncrementSats ?? 1000,
        status: body.status || (new Date(body.startsAt).getTime() > Date.now() ? 'scheduled' : 'live'),
      },
    });
  }

  async patchAuction(id: string, body: any) {
    return (this.prisma as any).nip05Auction.update({
      where: { id },
      data: {
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        reservePriceSats: body.reservePriceSats,
        minIncrementSats: body.minIncrementSats,
        status: body.status,
        winnerPubkey: body.winnerPubkey,
        winningBidSats: body.winningBidSats,
      },
    });
  }

  async cancelAuction(id: string) {
    return (this.prisma as any).nip05Auction.update({ where: { id }, data: { status: 'cancelled' } });
  }

  async settleAuction(id: string, winnerPubkey?: string) {
    const auction = await (this.prisma as any).nip05Auction.findUnique({ where: { id }, include: { bids: { orderBy: { amountSats: 'desc' }, take: 1 } } });
    if (!auction) throw new NotFoundException('Auction not found');

    const winning = winnerPubkey ? { bidderPubkey: winnerPubkey, amountSats: auction.currentBidSats || 0 } : auction.bids[0];
    if (!winning) throw new BadRequestException('No winning bid available');

    return (this.prisma as any).nip05Auction.update({
      where: { id },
      data: {
        status: 'settled',
        winnerPubkey: winning.bidderPubkey,
        winningBidSats: winning.amountSats,
      },
    });
  }

  async listListings(status?: string) {
    return (this.prisma as any).nip05Listing.findMany({
      where: status && status !== 'all' ? { status } : undefined,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createListing(body: any) {
    return (this.prisma as any).nip05Listing.create({
      data: {
        name: this.normalizeName(body.name),
        domain: body.domain || 'nostrmaxi.com',
        listingType: body.listingType || 'flat',
        sellerPubkey: body.sellerPubkey,
        fixedPriceSats: body.fixedPriceSats,
        saleMode: body.saleMode || 'lifetime',
        status: body.status || 'active',
      },
    });
  }

  async patchListing(id: string, body: any) {
    return (this.prisma as any).nip05Listing.update({ where: { id }, data: body });
  }

  async deleteListing(id: string) {
    return (this.prisma as any).nip05Listing.delete({ where: { id } });
  }

  async listTransfers(status?: string) {
    return (this.prisma as any).nip05Transfer.findMany({
      where: status && status !== 'all' ? { transferStatus: status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
