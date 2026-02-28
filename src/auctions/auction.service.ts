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
  SecondChanceOffer,
  TrackedInvoiceStatus,
  WinnerResult,
} from './auction.types';
import { Invoice, PaymentProvider } from '../payments/payment-provider.interface';

const MIN_INCREMENT_RATE = 0.1;
const SNIPE_WINDOW_SECONDS = 5 * 60;
const SNIPE_EXTENSION_SECONDS = 10 * 60;
const BOLT11_SIGNATURE_WORDS = 104;
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const WINNER_PAYMENT_WINDOW_SECONDS = 48 * 60 * 60;
const SECOND_CHANCE_WINDOW_SECONDS = 24 * 60 * 60;

type LightningInvoiceVerifier = (paymentHash: string, bolt11: string) => Promise<boolean>;

interface PendingBidInvoice {
  auctionId: string;
  bidderPubkey: string;
  amountSats: number;
  invoice: Invoice;
  status: 'pending' | 'paid';
}

interface SettlementInvoice {
  auctionId: string;
  bidderPubkey: string;
  amountSats: number;
  invoice: Invoice;
  expiresAt: number;
  status: 'pending' | 'paid' | 'expired';
  source: 'winner' | 'second_chance';
}

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);
  private readonly auctions = new Map<string, AuctionListing>();
  private readonly bidsByAuction = new Map<string, Bid[]>();
  private readonly invoicesByPaymentHash = new Map<string, TrackedInvoiceStatus>();
  private readonly pendingBidInvoices = new Map<string, PendingBidInvoice>();
  private readonly settlementInvoices = new Map<string, SettlementInvoice>();
  private readonly secondChanceOffersByAuction = new Map<string, SecondChanceOffer[]>();
  private paymentProvider?: PaymentProvider;
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

  getSecondChanceOffers(auctionId: string): SecondChanceOffer[] {
    return [...(this.secondChanceOffersByAuction.get(auctionId) || [])];
  }

  setLightningInvoiceVerifier(verifier: LightningInvoiceVerifier): void {
    this.lightningInvoiceVerifier = verifier;
  }

  setPaymentProvider(provider: PaymentProvider): void {
    this.paymentProvider = provider;
    provider.subscribeToPayments((payment) => {
      if (payment.status === 'paid') {
        this.handlePaymentReceived(payment.invoiceId).catch((error) => {
          this.logger.error(`Failed to process payment callback: ${error?.message || error}`);
        });
      }
    });
  }

  async createBidInvoice(auctionId: string, bidderPubkey: string, amount: number): Promise<Invoice> {
    const auction = this.auctions.get(auctionId);
    if (!auction) throw new NotFoundException('Auction not found');

    const state = this.calculateState(auction.startsAt, auction.endsAt, auction.state);
    if (state !== AuctionState.LIVE) {
      throw new BadRequestException(`Auction is not live (${state})`);
    }

    const provider = this.requirePaymentProvider();
    const invoice = await provider.createInvoice(amount, `Bid for ${auction.name}`, {
      auctionId,
      bidderPubkey,
      type: 'bid',
    });

    this.pendingBidInvoices.set(invoice.id, {
      auctionId,
      bidderPubkey,
      amountSats: amount,
      invoice,
      status: 'pending',
    });

    return invoice;
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

  async handlePaymentReceived(invoiceId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const pendingBid = this.pendingBidInvoices.get(invoiceId);
    if (pendingBid && pendingBid.status !== 'paid') {
      pendingBid.status = 'paid';
      this.pendingBidInvoices.set(invoiceId, pendingBid);

      const bid: Bid = {
        id: randomUUID(),
        auctionEventId: this.auctions.get(pendingBid.auctionId)?.eventId || pendingBid.auctionId,
        zapReceiptId: `invoice:${invoiceId}`,
        bidderPubkey: pendingBid.bidderPubkey,
        bidAmountSats: pendingBid.amountSats,
        zapAmountSats: pendingBid.amountSats,
        memo: 'invoice-payment',
        createdAt: now,
      };

      const bids = this.bidsByAuction.get(pendingBid.auctionId) || [];
      bids.push(bid);
      this.bidsByAuction.set(pendingBid.auctionId, bids);
      return;
    }

    const settlement = this.settlementInvoices.get(invoiceId);
    if (!settlement) {
      this.logger.warn(`Received payment for unknown invoice ${invoiceId}`);
      return;
    }

    settlement.status = 'paid';
    this.settlementInvoices.set(invoiceId, settlement);

    const auction = this.auctions.get(settlement.auctionId);
    if (!auction) return;

    auction.state = AuctionState.SETTLED;
    auction.winnerPubkey = settlement.bidderPubkey;
    auction.winningBidSats = settlement.amountSats;
    auction.settledAt = now;
    this.auctions.set(auction.id, auction);

    const offers = this.secondChanceOffersByAuction.get(settlement.auctionId) || [];
    offers.forEach((offer) => {
      if (offer.settlementInvoiceId === invoiceId) offer.status = 'accepted';
      else if (offer.status === 'pending') offer.status = 'declined';
    });
    this.secondChanceOffersByAuction.set(settlement.auctionId, offers);
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

    const paymentVerification = await this.verifyZapPayment(
      zapReceipt,
      auction.id,
      parsed.bid.bidderPubkey,
      parsed.bid.bidAmountSats,
    );
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

  async settleAuction(auctionId: string): Promise<AuctionSettlement> {
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

    const invoice = await this.requirePaymentProvider().createInvoice(
      winner.winningBidSats!,
      `Settlement for ${auction.name}`,
      {
        auctionId,
        bidderPubkey: winner.winnerPubkey,
        type: 'auction_settlement',
      },
    );

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + WINNER_PAYMENT_WINDOW_SECONDS;

    this.settlementInvoices.set(invoice.id, {
      auctionId,
      bidderPubkey: winner.winnerPubkey!,
      amountSats: winner.winningBidSats!,
      invoice,
      expiresAt,
      status: 'pending',
      source: 'winner',
    });

    auction.state = AuctionState.ENDED;
    auction.winnerPubkey = winner.winnerPubkey;
    auction.winningBidSats = winner.winningBidSats;
    auction.settlementInvoiceId = invoice.id;
    auction.settlementDeadlineAt = expiresAt;
    this.auctions.set(auction.id, auction);

    return {
      auctionId,
      state: AuctionState.ENDED,
      reserveMet: true,
      deedIssued: false,
      awaitingPayment: true,
      settlementInvoiceId: invoice.id,
      settlementDeadlineAt: expiresAt,
      winnerPubkey: winner.winnerPubkey,
      winningBidSats: winner.winningBidSats,
      reason: 'Awaiting winner settlement payment',
    };
  }

  async processSecondChance(auctionId: string): Promise<AuctionSettlement> {
    const auction = this.auctions.get(auctionId);
    if (!auction) throw new NotFoundException('Auction not found');

    if (auction.state === AuctionState.SETTLED) {
      return {
        auctionId,
        state: AuctionState.SETTLED,
        reserveMet: true,
        deedIssued: true,
        winnerPubkey: auction.winnerPubkey,
        winningBidSats: auction.winningBidSats,
      };
    }

    const now = Math.floor(Date.now() / 1000);
    if (auction.settlementInvoiceId) {
      const currentSettlement = this.settlementInvoices.get(auction.settlementInvoiceId);
      if (currentSettlement?.status === 'pending' && now <= currentSettlement.expiresAt) {
        return {
          auctionId,
          state: AuctionState.ENDED,
          reserveMet: true,
          deedIssued: false,
          awaitingPayment: true,
          settlementInvoiceId: currentSettlement.invoice.id,
          settlementDeadlineAt: currentSettlement.expiresAt,
          reason: 'Current settlement invoice is still active',
        };
      }

      if (currentSettlement?.status === 'pending' && now > currentSettlement.expiresAt) {
        currentSettlement.status = 'expired';
        this.settlementInvoices.set(auction.settlementInvoiceId, currentSettlement);
      }
    }

    const sortedBids = this.getBids(auctionId);
    const offers = this.secondChanceOffersByAuction.get(auctionId) || [];

    for (const offer of offers) {
      if (offer.status === 'pending' && offer.expiresAt.getTime() <= now * 1000) {
        offer.status = 'expired';
      }
    }

    const alreadyOffered = new Set(offers.map((offer) => offer.bidderPubkey));
    const currentWinner = auction.winnerPubkey;
    const activeSettlementBidder = auction.settlementInvoiceId
      ? this.settlementInvoices.get(auction.settlementInvoiceId)?.bidderPubkey
      : undefined;
    const nextBid = sortedBids.find(
      (bid) =>
        bid.bidderPubkey !== currentWinner &&
        bid.bidderPubkey !== activeSettlementBidder &&
        !alreadyOffered.has(bid.bidderPubkey),
    );

    if (!nextBid) {
      auction.state = AuctionState.FAILED;
      auction.failedAt = now;
      this.auctions.set(auction.id, auction);
      return {
        auctionId,
        state: AuctionState.FAILED,
        reserveMet: true,
        deedIssued: false,
        reason: 'No second chance bidders left',
      };
    }

    const invoice = await this.requirePaymentProvider().createInvoice(
      nextBid.bidAmountSats,
      `Second chance for ${auction.name}`,
      {
        auctionId,
        bidderPubkey: nextBid.bidderPubkey,
        type: 'second_chance_settlement',
      },
    );

    const expiresAt = now + SECOND_CHANCE_WINDOW_SECONDS;
    this.settlementInvoices.set(invoice.id, {
      auctionId,
      bidderPubkey: nextBid.bidderPubkey,
      amountSats: nextBid.bidAmountSats,
      invoice,
      expiresAt,
      status: 'pending',
      source: 'second_chance',
    });

    const secondChanceOffer: SecondChanceOffer = {
      auctionId,
      bidderPubkey: nextBid.bidderPubkey,
      amount: nextBid.bidAmountSats,
      offeredAt: new Date(now * 1000),
      expiresAt: new Date(expiresAt * 1000),
      status: 'pending',
      settlementInvoiceId: invoice.id,
    };

    offers.push(secondChanceOffer);
    this.secondChanceOffersByAuction.set(auctionId, offers);

    auction.winnerPubkey = nextBid.bidderPubkey;
    auction.winningBidSats = nextBid.bidAmountSats;
    auction.settlementInvoiceId = invoice.id;
    auction.settlementDeadlineAt = expiresAt;
    this.auctions.set(auction.id, auction);

    return {
      auctionId,
      state: AuctionState.ENDED,
      reserveMet: true,
      deedIssued: false,
      awaitingPayment: true,
      settlementInvoiceId: invoice.id,
      settlementDeadlineAt: expiresAt,
      secondChanceOffer,
      reason: 'Second chance offer created',
      winnerPubkey: nextBid.bidderPubkey,
      winningBidSats: nextBid.bidAmountSats,
    };
  }

  private async verifyZapPayment(
    zapReceipt: NostrEventLike,
    auctionId: string,
    bidderPubkey: string,
    bidAmountSats: number,
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
    if (preimage && !this.validatePreimage(preimage, normalizedPaymentHash)) {
      return {
        paid: false,
        method: 'failed',
        paymentHash: normalizedPaymentHash,
        reason: 'Invalid zap preimage for invoice payment hash',
      };
    }

    let tracked = this.invoicesByPaymentHash.get(normalizedPaymentHash);

    if (!tracked && this.lightningInvoiceVerifier) {
      const settled = await this.lightningInvoiceVerifier(normalizedPaymentHash, bolt11);
      if (settled) {
        this.trackInvoice({
          paymentHash: normalizedPaymentHash,
          auctionId,
          bidderPubkey,
          amountSats: bidAmountSats,
          bolt11,
          paid: true,
        });
        tracked = this.invoicesByPaymentHash.get(normalizedPaymentHash);
      }
    }

    if (!tracked) {
      return {
        paid: false,
        method: 'failed',
        paymentHash: normalizedPaymentHash,
        reason: 'Invoice is not registered in our payment tracker',
      };
    }

    if (tracked.auctionId !== auctionId) {
      return {
        paid: false,
        method: 'failed',
        paymentHash: normalizedPaymentHash,
        reason: 'Invoice does not belong to this auction',
      };
    }

    if (tracked.bidderPubkey !== bidderPubkey) {
      return {
        paid: false,
        method: 'failed',
        paymentHash: normalizedPaymentHash,
        reason: 'Invoice bidder pubkey mismatch',
      };
    }

    if (tracked.amountSats !== bidAmountSats) {
      return {
        paid: false,
        method: 'failed',
        paymentHash: normalizedPaymentHash,
        reason: 'Invoice amount mismatch for bid',
      };
    }

    if (!tracked.paid) {
      return {
        paid: false,
        method: 'failed',
        paymentHash: normalizedPaymentHash,
        reason: 'Invoice exists but is not yet marked paid',
      };
    }

    return {
      paid: true,
      method: tracked.paidAt ? 'invoice-tracker' : 'lightning-node',
      paymentHash: normalizedPaymentHash,
    };
  }

  private getTagValue(event: NostrEventLike, key: string): string | undefined {
    const tag = event.tags.find((entry) => entry[0]?.toLowerCase() === key.toLowerCase());
    return tag?.[1];
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
      let cursor = 7;

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
    if (explicitState === AuctionState.SETTLED || explicitState === AuctionState.FAILED) {
      return explicitState;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < startsAt) return AuctionState.UPCOMING;
    if (now <= endsAt) return AuctionState.LIVE;
    return AuctionState.ENDED;
  }

  private requirePaymentProvider(): PaymentProvider {
    if (this.paymentProvider) {
      return this.paymentProvider;
    }

    const { BTCPayProvider } = require('../payments/btcpay.provider');
    this.paymentProvider = new BTCPayProvider({
      url: process.env.BTCPAY_URL || '',
      apiKey: process.env.BTCPAY_API_KEY || '',
      storeId: process.env.BTCPAY_STORE_ID || '',
      webhookSecret: process.env.BTCPAY_WEBHOOK_SECRET,
    }) as PaymentProvider;

    return this.paymentProvider;
  }
}
