import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
  WinnerResult,
} from './auction.types';

const MIN_INCREMENT_RATE = 0.1;
const SNIPE_WINDOW_SECONDS = 5 * 60;
const SNIPE_EXTENSION_SECONDS = 10 * 60;

@Injectable()
export class AuctionService {
  private readonly auctions = new Map<string, AuctionListing>();
  private readonly bidsByAuction = new Map<string, Bid[]>();

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

  ingestZapBid(auctionId: string, zapReceipt: NostrEventLike): Bid {
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
