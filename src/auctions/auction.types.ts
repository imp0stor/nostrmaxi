export enum AuctionState {
  UPCOMING = 'UPCOMING',
  LIVE = 'LIVE',
  ENDED = 'ENDED',
  SETTLED = 'SETTLED',
  FAILED = 'FAILED',
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
  settlementInvoiceId?: string;
  settlementDeadlineAt?: number;
  failedAt?: number;
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

export interface SecondChanceOffer {
  auctionId: string;
  bidderPubkey: string;
  amount: number;
  offeredAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  settlementInvoiceId?: string;
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
  state: AuctionState.SETTLED | AuctionState.ENDED | AuctionState.FAILED;
  reserveMet: boolean;
  winnerPubkey?: string;
  winningBidSats?: number;
  deedIssued: boolean;
  reason?: string;
  awaitingPayment?: boolean;
  settlementInvoiceId?: string;
  settlementDeadlineAt?: number;
  secondChanceOffer?: SecondChanceOffer;
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
