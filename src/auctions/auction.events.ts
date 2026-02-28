import { createHash } from 'crypto';
import { Bid, ParsedBidResult } from './auction.types';

export const NOSTR_KIND_AUCTION_LISTING = 30311;
export const NOSTR_KIND_ZAP_RECEIPT = 9735;

export interface NostrEventLike {
  id: string;
  pubkey: string;
  kind: number;
  created_at: number;
  content: string;
  tags: string[][];
}

export interface AuctionListingEventContent {
  name: string;
  auctionPubkey: string;
  startingPriceSats: number;
  reservePriceSats: number;
  startsAt: number;
  endsAt: number;
}

export function createAuctionDTag(name: string, startsAt: number, endsAt: number): string {
  return `${name.toLowerCase()}:${startsAt}:${endsAt}`;
}

export function buildAuctionListingEventTemplate(input: AuctionListingEventContent): Pick<NostrEventLike, 'kind' | 'content' | 'tags'> {
  const dTag = createAuctionDTag(input.name, input.startsAt, input.endsAt);
  return {
    kind: NOSTR_KIND_AUCTION_LISTING,
    content: JSON.stringify(input),
    tags: [
      ['d', dTag],
      ['name', input.name],
      ['starting_price_sats', String(input.startingPriceSats)],
      ['reserve_price_sats', String(input.reservePriceSats)],
      ['starts_at', String(input.startsAt)],
      ['ends_at', String(input.endsAt)],
      ['auction_pubkey', input.auctionPubkey],
    ],
  };
}

function findTagValue(tags: string[][], key: string): string | undefined {
  const found = tags.find((tag) => tag[0] === key);
  return found?.[1];
}

function parseZapAmountSats(event: NostrEventLike): number {
  const millisats = findTagValue(event.tags, 'amount');
  const value = Number(millisats);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value / 1000);
}

function parseMemoBidAndIdentity(content: string): { bidAmountSats?: number; memoNpub?: string } {
  const value = (content || '').trim();
  if (!value) return {};

  const bidOnly = /^bid\s*:\s*(\d+)$/i.exec(value);
  if (bidOnly) {
    return { bidAmountSats: Number(bidOnly[1]) };
  }

  const numberOnly = /^(\d+)$/.exec(value);
  if (numberOnly) {
    return { bidAmountSats: Number(numberOnly[1]) };
  }

  const npubAmount = /^(npub1[023456789acdefghjklmnpqrstuvwxyz]+)\s*:\s*(\d+)$/i.exec(value);
  if (npubAmount) {
    const npub = npubAmount[1];
    return {
      bidAmountSats: Number(npubAmount[2]),
      memoNpub: npub,
    };
  }

  const bidAmountNpub = /^bid\s*:\s*(\d+)\s*:\s*(npub1[023456789acdefghjklmnpqrstuvwxyz]+)$/i.exec(value);
  if (bidAmountNpub) {
    const npub = bidAmountNpub[2];
    return {
      bidAmountSats: Number(bidAmountNpub[1]),
      memoNpub: npub,
    };
  }

  return {};
}

function extractSenderPubkey(event: NostrEventLike, memoNpub?: string): string | undefined {
  const senderFromTag = findTagValue(event.tags, 'P') || findTagValue(event.tags, 'sender_pubkey');
  if (senderFromTag) return senderFromTag;

  if (memoNpub) return memoNpub;

  if (/^[a-f0-9]{64}$/i.test(event.pubkey)) {
    return event.pubkey;
  }

  return undefined;
}

export function parseZapReceiptToBid(event: NostrEventLike, auctionEventId: string): ParsedBidResult {
  if (event.kind !== NOSTR_KIND_ZAP_RECEIPT) {
    return { reason: `unexpected kind ${event.kind}` };
  }

  const referencedEventId = findTagValue(event.tags, 'e');
  if (!referencedEventId || referencedEventId !== auctionEventId) {
    return { reason: 'zap does not reference auction event id' };
  }

  const zapAmountSats = parseZapAmountSats(event);
  const memoParsed = parseMemoBidAndIdentity(event.content);
  const bidAmountSats = memoParsed.bidAmountSats && memoParsed.bidAmountSats > 0
    ? memoParsed.bidAmountSats
    : zapAmountSats;

  if (!Number.isFinite(bidAmountSats) || bidAmountSats <= 0) {
    return { reason: 'invalid bid amount' };
  }

  const bidderPubkey = extractSenderPubkey(event, memoParsed.memoNpub);
  if (!bidderPubkey) {
    return { reason: 'unable to identify bidder from zap receipt tags or memo npub' };
  }

  const bid: Bid = {
    id: createHash('sha256').update(`${event.id}:${auctionEventId}:${bidAmountSats}`).digest('hex').slice(0, 24),
    auctionEventId,
    zapReceiptId: event.id,
    bidderPubkey,
    bidAmountSats,
    zapAmountSats,
    memo: event.content || undefined,
    createdAt: event.created_at,
  };

  return { bid };
}
