export enum AuctionState {
  UPCOMING = 'UPCOMING',
  LIVE = 'LIVE',
  ENDED = 'ENDED',
  SETTLED = 'SETTLED',
}

export interface AuctionListing {
  id: string;
  eventId: string;
  dTag: string;
  name: string;
  auctionPubkey: string;
  startingPriceSats: number;
  reservePriceSats: number;
  startsAt: number;
  endsAt: number;
  createdAt: number;
  state: AuctionState;
  settledAt?: number;
  winnerPubkey?: string;
  winningBidSats?: number;
}

export interface Bid {
  id: string;
  auctionEventId: string;
  zapReceiptId: string;
  bidderPubkey: string;
  bidAmountSats: number;
  zapAmountSats: number;
  memo?: string;
  createdAt: number;
}

export interface AuctionCreateInput {
  name: string;
  auctionPubkey: string;
  startingPriceSats: number;
  reservePriceSats: number;
  startsAt: number;
  endsAt: number;
}

export interface AuctionDetail {
  auction: AuctionListing;
  bids: Bid[];
  highestBid?: Bid;
}

export interface AuctionSettlement {
  auctionId: string;
  state: AuctionState.SETTLED | AuctionState.ENDED;
  reserveMet: boolean;
  winnerPubkey?: string;
  winningBidSats?: number;
  deedIssued: boolean;
  reason?: string;
}

export interface WinnerResult {
  highestBid?: Bid;
  reserveMet: boolean;
  winnerPubkey?: string;
  winningBidSats?: number;
}

export interface ParsedBidResult {
  bid?: Bid;
  reason?: string;
}

export interface TrackedInvoiceStatus {
  auctionId: string;
  bidderPubkey: string;
  amountSats: number;
  paid: boolean;
  paymentHash: string;
  bolt11?: string;
  paidAt?: number;
}

export interface PaymentVerification {
  paid: boolean;
  method: 'preimage' | 'invoice-tracker' | 'lightning-node' | 'failed';
  paymentHash?: string;
  reason?: string;
}
