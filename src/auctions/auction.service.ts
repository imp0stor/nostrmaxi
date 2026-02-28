import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { bech32 } from 'bech32';
import { createHash, randomUUID } from 'crypto';
import { getReservedNameMeta } from '../config/reserved-names';
import {
  NostrEventLike,
  buildAuctionListingEventTemplate,
  parseZapReceiptToBid,
} from './auction.events';
import {
  AuctionCreateInput,
  AuctionDetail,
  AuctionListing,
  AuctionSettlement,
  AuctionState,
  Bid,
  PaymentVerification,
  TrackedInvoiceStatus,
  WinnerResult,
} from './auction.types';

const MIN_INCREMENT_RATE = 0.1;
const SNIPE_WINDOW_SECONDS = 5 * 60;
const SNIPE_EXTENSION_SECONDS = 10 * 60;
const BOLT11_SIGNATURE_WORDS = 104;
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

type LightningInvoiceVerifier = (paymentHash: string, bolt11: string) => Promise<boolean>;

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);
  private readonly auctions = new Map<string, AuctionListing>();
  private readonly bidsByAuction = new Map<string, Bid[]>();
  private readonly invoicesByPaymentHash = new Map<string, TrackedInvoiceStatus>();
  private lightningInvoiceVerifier?: LightningInvoiceVerifier;

  createAuction(input: AuctionCreateInput): { auction: AuctionListing; eventTemplate: ReturnType<typeof buildAuctionListingEventTemplate> } {
    this.validateAuctionInput(input);

    const normalizedName = input.name.toLowerCase();
    const reservedMeta = getReservedNameMeta(normalizedName);

    if (!reservedMeta?.auctionOnly) {
      throw new BadRequestException(
        `Name ${normalizedName} is not configured as auction-only; use fixed-price marketplace flow instead.`,
      );
    }

    const eventTemplate = buildAuctionListingEventTemplate({
      name: normalizedName,
      auctionPubkey: input.auctionPubkey,
      startingPriceSats: input.startingPriceSats,
      reservePriceSats: input.reservePriceSats,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    const eventId = randomUUID();
    const listing: AuctionListing = {
      id: randomUUID(),
      eventId,
      dTag: eventTemplate.tags.find((t) => t[0] === 'd')?.[1] ?? eventId,
      name: normalizedName,
      auctionPubkey: input.auctionPubkey,
      startingPriceSats: input.startingPriceSats,
      reservePriceSats: input.reservePriceSats,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdAt: Math.floor(Date.now() / 1000),
      state: this.calculateState(input.startsAt, input.endsAt),
    };

    this.auctions.set(listing.id, listing);
    this.bidsByAuction.set(listing.id, []);

    return { auction: listing, eventTemplate };
  }

  listAuctions(): AuctionListing[] {
    return [...this.auctions.values()].map((auction) => ({
      ...auction,
      state: this.calculateState(auction.startsAt, auction.endsAt, auction.state),
    }));
  }

  listActiveAuctions(): AuctionListing[] {
    return this.listAuctions().filter(
      (auction) => auction.state === AuctionState.UPCOMING || auction.state === AuctionState.LIVE,
    );
  }

  getAuction(auctionId: string): AuctionDetail {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    const bids = this.getBids(auctionId);
    const highestBid = bids[0];

    return {
      auction: {
        ...auction,
        state: this.calculateState(auction.startsAt, auction.endsAt, auction.state),
      },
      bids,
      highestBid,
    };
  }

  getBids(auctionId: string): Bid[] {
    const bids = this.bidsByAuction.get(auctionId);
    if (!bids) {
      throw new NotFoundException('Auction not found');
    }

    return [...bids].sort((a, b) => {
      if (b.bidAmountSats !== a.bidAmountSats) return b.bidAmountSats - a.bidAmountSats;
      return a.createdAt - b.createdAt;
    });
  }

  setLightningInvoiceVerifier(verifier: LightningInvoiceVerifier): void {
    this.lightningInvoiceVerifier = verifier;
  }

  trackInvoice(input: {
    paymentHash: string;
    auctionId: string;
    bidderPubkey: string;
    amountSats: number;
    bolt11?: string;
    paid?: boolean;
  }): void {
    const paymentHash = input.paymentHash.toLowerCase();
    this.invoicesByPaymentHash.set(paymentHash, {
      paymentHash,
      auctionId: input.auctionId,
      bidderPubkey: input.bidderPubkey,
      amountSats: input.amountSats,
      bolt11: input.bolt11,
      paid: !!input.paid,
      paidAt: input.paid ? Math.floor(Date.now() / 1000) : undefined,
    });
  }

  markInvoicePaid(paymentHash: string): void {
    const normalized = paymentHash.toLowerCase();
    const tracked = this.invoicesByPaymentHash.get(normalized);
    if (!tracked) return;

    tracked.paid = true;
    tracked.paidAt = Math.floor(Date.now() / 1000);
    this.invoicesByPaymentHash.set(normalized, tracked);
  }

  async ingestZapBid(auctionId: string, zapReceipt: NostrEventLike): Promise<Bid> {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    const state = this.calculateState(auction.startsAt, auction.endsAt, auction.state);
    if (state !== AuctionState.LIVE) {
      throw new BadRequestException(`Auction is not live (${state})`);
    }

    const parsed = parseZapReceiptToBid(zapReceipt, auction.eventId);
    if (!parsed.bid) {
      throw new BadRequestException(parsed.reason || 'Unable to parse bid from zap receipt');
    }

    const paymentVerification = await this.verifyZapPayment(zapReceipt, auction.id, parsed.bid.bidderPubkey);
    if (!paymentVerification.paid) {
      this.logger.warn(
        `Rejected unpaid bid for auction ${auction.id} (zap=${zapReceipt.id}, method=${paymentVerification.method}, reason=${paymentVerification.reason || 'unknown'})`,
      );
      throw new BadRequestException(paymentVerification.reason || 'Zap payment is not verified as settled');
    }

    const currentHighest = this.getBids(auctionId)[0];
    const minimumAllowed = this.calculateMinimumBid(auction, currentHighest);

    if (parsed.bid.bidAmountSats < minimumAllowed) {
      throw new BadRequestException(`Bid too low; minimum allowed is ${minimumAllowed} sats`);
    }

    const snipeThreshold = auction.endsAt - SNIPE_WINDOW_SECONDS;
    if (parsed.bid.createdAt >= snipeThreshold) {
      auction.endsAt += SNIPE_EXTENSION_SECONDS;
    }

    const bid: Bid = {
      ...parsed.bid,
      auctionEventId: auction.eventId,
      id: randomUUID(),
    };

    const bids = this.bidsByAuction.get(auctionId) || [];
    bids.push(bid);
    this.bidsByAuction.set(auctionId, bids);

    return bid;
  }

  determineWinner(auctionId: string): WinnerResult {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    const bids = this.getBids(auctionId).filter((bid) => bid.createdAt <= auction.endsAt);
    const highestBid = bids[0];

    if (!highestBid) {
      return { reserveMet: false };
    }

    const reserveMet = highestBid.bidAmountSats >= auction.reservePriceSats;
    if (!reserveMet) {
      return { highestBid, reserveMet: false };
    }

    return {
      highestBid,
      reserveMet: true,
      winnerPubkey: highestBid.bidderPubkey,
      winningBidSats: highestBid.bidAmountSats,
    };
  }

  settleAuction(auctionId: string): AuctionSettlement {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    const state = this.calculateState(auction.startsAt, auction.endsAt, auction.state);
    if (state === AuctionState.UPCOMING || state === AuctionState.LIVE) {
      throw new BadRequestException('Auction has not ended yet');
    }

    if (auction.state === AuctionState.SETTLED) {
      return {
        auctionId,
        state: AuctionState.SETTLED,
        reserveMet: !!auction.winnerPubkey,
        winnerPubkey: auction.winnerPubkey,
        winningBidSats: auction.winningBidSats,
        deedIssued: !!auction.winnerPubkey,
      };
    }

    const winner = this.determineWinner(auctionId);
    if (!winner.reserveMet || !winner.highestBid) {
      auction.state = AuctionState.ENDED;
      return {
        auctionId,
        state: AuctionState.ENDED,
        reserveMet: false,
        deedIssued: false,
        reason: 'Reserve not met or no valid bids',
      };
    }

    auction.state = AuctionState.SETTLED;
    auction.settledAt = Math.floor(Date.now() / 1000);
    auction.winnerPubkey = winner.winnerPubkey;
    auction.winningBidSats = winner.winningBidSats;

    return {
      auctionId,
      state: AuctionState.SETTLED,
      reserveMet: true,
      winnerPubkey: winner.winnerPubkey,
      winningBidSats: winner.winningBidSats,
      deedIssued: true,
    };
  }

  private async verifyZapPayment(
    zapReceipt: NostrEventLike,
    auctionId: string,
    bidderPubkey: string,
  ): Promise<PaymentVerification> {
    const bolt11 = this.getTagValue(zapReceipt, 'bolt11');
    if (!bolt11) {
      return {
        paid: false,
        method: 'failed',
        reason: 'Zap receipt missing bolt11 invoice',
      };
    }

    const paymentHash = this.extractPaymentHashFromBolt11(bolt11);
    if (!paymentHash) {
      return {
        paid: false,
        method: 'failed',
        reason: 'Unable to extract payment hash from bolt11 invoice',
      };
    }

    const normalizedPaymentHash = paymentHash.toLowerCase();
    const preimage = this.getTagValue(zapReceipt, 'preimage');
    if (preimage) {
      const preimageValid = this.validatePreimage(preimage, normalizedPaymentHash);
      if (!preimageValid) {
        return {
          paid: false,
          method: 'failed',
          paymentHash: normalizedPaymentHash,
          reason: 'Invalid zap preimage for invoice payment hash',
        };
      }

      this.trackInvoice({
        paymentHash: normalizedPaymentHash,
        auctionId,
        bidderPubkey,
        amountSats: this.extractZapAmountSats(zapReceipt),
        bolt11,
        paid: true,
      });

      return {
        paid: true,
        method: 'preimage',
        paymentHash: normalizedPaymentHash,
      };
    }

    const tracked = this.invoicesByPaymentHash.get(normalizedPaymentHash);
    if (tracked?.paid) {
      return {
        paid: true,
        method: 'invoice-tracker',
        paymentHash: normalizedPaymentHash,
      };
    }

    if (this.lightningInvoiceVerifier) {
      const settled = await this.lightningInvoiceVerifier(normalizedPaymentHash, bolt11);
      if (settled) {
        this.trackInvoice({
          paymentHash: normalizedPaymentHash,
          auctionId,
          bidderPubkey,
          amountSats: this.extractZapAmountSats(zapReceipt),
          bolt11,
          paid: true,
        });

        return {
          paid: true,
          method: 'lightning-node',
          paymentHash: normalizedPaymentHash,
        };
      }
    }

    return {
      paid: false,
      method: 'failed',
      paymentHash: normalizedPaymentHash,
      reason: 'Invoice is not settled (missing valid preimage and no paid invoice status)',
    };
  }

  private getTagValue(event: NostrEventLike, key: string): string | undefined {
    const tag = event.tags.find((entry) => entry[0]?.toLowerCase() === key.toLowerCase());
    return tag?.[1];
  }

  private extractZapAmountSats(event: NostrEventLike): number {
    const amountMsat = Number(this.getTagValue(event, 'amount') || 0);
    if (!Number.isFinite(amountMsat) || amountMsat <= 0) return 0;
    return Math.floor(amountMsat / 1000);
  }

  private validatePreimage(preimage: string, paymentHash: string): boolean {
    const normalizedPreimage = preimage.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalizedPreimage)) {
      return false;
    }

    const preimageHash = createHash('sha256')
      .update(Buffer.from(normalizedPreimage, 'hex'))
      .digest('hex');

    return preimageHash === paymentHash;
  }

  private extractPaymentHashFromBolt11(bolt11: string): string | undefined {
    try {
      const normalized = bolt11.trim().toLowerCase();
      const decoded = bech32.decode(normalized, 5000);
      const words = decoded.words;
      let cursor = 7; // 35-bit timestamp

      while (cursor < words.length - BOLT11_SIGNATURE_WORDS) {
        const tagCode = words[cursor++];
        const dataLength = (words[cursor++] << 5) + words[cursor++];

        const maxFieldEnd = words.length - BOLT11_SIGNATURE_WORDS;
        if (cursor + dataLength > maxFieldEnd) {
          return undefined;
        }

        const tag = BECH32_CHARSET[tagCode];
        const dataWords = words.slice(cursor, cursor + dataLength);
        cursor += dataLength;

        if (tag !== 'p') {
          continue;
        }

        const bytes = Buffer.from(bech32.fromWords(dataWords));
        return bytes.toString('hex');
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private validateAuctionInput(input: AuctionCreateInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestException('Auction name is required');
    }

    if (input.startingPriceSats <= 0 || input.reservePriceSats <= 0) {
      throw new BadRequestException('Prices must be positive');
    }

    if (input.reservePriceSats < input.startingPriceSats) {
      throw new BadRequestException('Reserve price must be >= starting price');
    }

    if (input.endsAt <= input.startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  private calculateMinimumBid(auction: AuctionListing, highestBid?: Bid): number {
    if (!highestBid) {
      return auction.startingPriceSats;
    }

    return Math.ceil(highestBid.bidAmountSats * (1 + MIN_INCREMENT_RATE));
  }

  private calculateState(startsAt: number, endsAt: number, explicitState?: AuctionState): AuctionState {
    if (explicitState === AuctionState.SETTLED) {
      return AuctionState.SETTLED;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < startsAt) return AuctionState.UPCOMING;
    if (now <= endsAt) return AuctionState.LIVE;
    return AuctionState.ENDED;
  }
}
