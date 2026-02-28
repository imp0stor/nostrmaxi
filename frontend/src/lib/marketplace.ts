import { SimplePool } from 'nostr-tools';
import type { NostrEvent } from '../types';
import { fetchProfilesBatchCached, isValidNip05, profileDisplayName } from './profileCache';
import { toNpub } from './social';
import { truncateNpub } from './nostr';

const MARKETPLACE_RELAYS = [
  'wss://relay.damus.io',
  'wss://nostr.mom',
  'wss://relay.snort.social',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
];

// NIP-15: 30017 (stall), 30018 (product). Keep legacy listing kinds for compatibility.
const MARKETPLACE_KINDS = [30017, 30018, 30402, 30023, 30403];

interface MarketplaceStall {
  id: string;
  name: string;
  currency?: string;
  sellerPubkey: string;
}

export interface MarketplaceListing {
  id: string;
  eventId: string;
  listingKey: string;
  dTag: string;
  stallId?: string;
  kind: number;
  title: string;
  summary: string;
  description: string;
  price: number | null;
  currency: string;
  sellerPubkey: string;
  sellerIdentity: string;
  sellerNpub: string;
  image: string | null;
  images: string[];
  location?: string;
  quantity?: number;
  createdAt: number;
  tags: string[];
  source: 'nostr' | 'seed';
}

function parseContentJson(event: NostrEvent): Record<string, unknown> {
  try {
    const parsed = JSON.parse(event.content || '{}');
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function firstTag(event: NostrEvent, key: string): string | undefined {
  const match = event.tags.find((t) => t[0] === key && t[1]);
  return match?.[1];
}

function collectTags(event: NostrEvent, key: string): string[] {
  return event.tags.filter((t) => t[0] === key && t[1]).map((t) => t[1].trim().toLowerCase());
}

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!normalized) return 'USD';
  if (normalized === 'SATS' || normalized === 'SATOSHI' || normalized === 'SATOSHIS') return 'SAT';
  return normalized;
}

function parsePrice(event: NostrEvent, content: Record<string, unknown>, stallCurrency?: string): { amount: number | null; currency: string } {
  const tag = event.tags.find((t) => t[0] === 'price');
  if (tag?.[1]) {
    const amount = Number.parseFloat(tag[1]);
    return {
      amount: Number.isFinite(amount) ? amount : null,
      currency: normalizeCurrency(tag[2] || String(content.currency ?? stallCurrency ?? 'USD')),
    };
  }

  const contentPrice = Number.parseFloat(String(content.price ?? content.amount ?? ''));
  return {
    amount: Number.isFinite(contentPrice) ? contentPrice : null,
    currency: normalizeCurrency(String(content.currency ?? stallCurrency ?? 'USD')),
  };
}

export function formatMarketplacePrice(price: number | null, currency: string): string {
  if (price == null) return 'Price on request';
  const normalized = normalizeCurrency(currency);
  if (/^[A-Z]{3}$/.test(normalized)) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: normalized, maximumFractionDigits: 2 }).format(price);
    } catch {
      // Fall through to generic formatting for non-ISO or unknown currency codes.
    }
  }

  return `${new Intl.NumberFormat().format(price)} ${normalized}`;
}

function coalesceListingId(event: NostrEvent, content: Record<string, unknown>): string {
  const dTag = firstTag(event, 'd');
  const contentId = String(content.id ?? '').trim();
  return dTag || contentId || event.id;
}

function adaptStallEvent(event: NostrEvent): MarketplaceStall | null {
  const content = parseContentJson(event);
  const id = firstTag(event, 'd') || String(content.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    name: String(content.name ?? '').trim() || `Stall ${id.slice(0, 6)}`,
    currency: String(content.currency ?? '').trim().toUpperCase() || undefined,
    sellerPubkey: event.pubkey,
  };
}

export function adaptMarketplaceEvent(event: NostrEvent, stallMap?: Map<string, MarketplaceStall>): MarketplaceListing | null {
  const content = parseContentJson(event);
  const dTag = coalesceListingId(event, content);
  const title = firstTag(event, 'title') || firstTag(event, 'name') || String(content.name ?? content.title ?? '').trim();
  if (!title) return null;

  const stallId = String(content.stall_id ?? '').trim() || firstTag(event, 'a')?.split(':')[2] || undefined;
  const stall = stallId ? stallMap?.get(`${event.pubkey}:${stallId}`) : undefined;

  const summary = firstTag(event, 'summary') || String(content.summary ?? content.short_description ?? '').trim();
  const description = firstTag(event, 'description') || String(content.description ?? summary ?? '').trim();
  const imageFromTags = firstTag(event, 'image') || firstTag(event, 'thumb') || firstTag(event, 'url');
  const contentImages = Array.isArray(content.images) ? content.images.filter((v): v is string => typeof v === 'string') : [];
  const tags = collectTags(event, 't');
  const { amount, currency } = parsePrice(event, content, stall?.currency);
  const sellerNpub = toNpub(event.pubkey);

  const listingKey = `${event.pubkey}:${dTag}`;

  return {
    id: event.id,
    eventId: event.id,
    listingKey,
    dTag,
    stallId,
    kind: event.kind,
    title,
    summary: summary || (description.length > 140 ? `${description.slice(0, 137)}...` : description),
    description: description || summary || title,
    price: amount,
    currency,
    sellerPubkey: event.pubkey,
    sellerIdentity: truncateNpub(sellerNpub, 8),
    sellerNpub,
    image: imageFromTags || contentImages[0] || null,
    images: [...new Set([imageFromTags, ...contentImages].filter((v): v is string => Boolean(v)))],
    location: firstTag(event, 'location') || String(content.location ?? '').trim() || undefined,
    quantity: Number.isFinite(Number(content.quantity)) ? Number(content.quantity) : undefined,
    createdAt: event.created_at,
    tags,
    source: 'nostr',
  };
}

const SEED_LISTINGS: MarketplaceListing[] = [
  {
    id: 'seed-zap-hat',
    eventId: 'seed-zap-hat',
    listingKey: 'seed_pubkey_1:zap-hat',
    dTag: 'zap-hat',
    kind: 30018,
    title: 'Lightning Zap Hat',
    summary: 'Handmade cap with reflective ⚡ stitchwork.',
    description: 'Streetwear cap designed for Nostr meetups. Includes NFC sticker link to your profile.',
    price: 49,
    currency: 'USD',
    sellerPubkey: 'seed_pubkey_1',
    sellerIdentity: 'ops@nostrmaxi.io',
    sellerNpub: 'npub1seedzap000000000000000000000000000000000000000000000000000',
    image: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=1200&q=80'],
    createdAt: Math.floor(Date.now() / 1000) - 3600,
    tags: ['apparel', 'lightning'],
    source: 'seed',
  },
  {
    id: 'seed-hardware-wallet-case',
    eventId: 'seed-hardware-wallet-case',
    listingKey: 'seed_pubkey_2:wallet-sleeve',
    dTag: 'wallet-sleeve',
    kind: 30018,
    title: 'Titan Wallet Sleeve',
    summary: 'Minimal sleeve for hardware wallet carry.',
    description: 'Vegetable-tanned leather sleeve sized for popular Bitcoin hardware wallets.',
    price: 72,
    currency: 'USD',
    sellerPubkey: 'seed_pubkey_2',
    sellerIdentity: 'craft@mesh.market',
    sellerNpub: 'npub1seedcraft00000000000000000000000000000000000000000000000000',
    image: 'https://images.unsplash.com/photo-1601599561213-832382fd07ba?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1601599561213-832382fd07ba?auto=format&fit=crop&w=1200&q=80'],
    createdAt: Math.floor(Date.now() / 1000) - 7200,
    tags: ['hardware', 'leather'],
    source: 'seed',
  },
];

function dedupeReplaceableListings(listings: MarketplaceListing[]): MarketplaceListing[] {
  const deduped = new Map<string, MarketplaceListing>();
  for (const listing of listings) {
    const existing = deduped.get(listing.listingKey);
    if (!existing || listing.createdAt > existing.createdAt) deduped.set(listing.listingKey, listing);
  }
  return [...deduped.values()];
}

export async function loadMarketplaceListings(relays: string[] = MARKETPLACE_RELAYS): Promise<MarketplaceListing[]> {
  const pool = new SimplePool();
  try {
    const since = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const events = await Promise.race([
      pool.querySync(relays, { kinds: MARKETPLACE_KINDS, limit: 400, since }),
      new Promise<NostrEvent[]>((resolve) => setTimeout(() => resolve([]), 5000)),
    ]);

    const stalls = events
      .filter((event) => event.kind === 30017)
      .map((event) => adaptStallEvent(event as NostrEvent))
      .filter((event): event is MarketplaceStall => Boolean(event));

    const stallMap = new Map(stalls.map((stall) => [`${stall.sellerPubkey}:${stall.id}`, stall]));

    const listings = dedupeReplaceableListings(
      events
        .filter((event) => event.kind !== 30017)
        .map((event) => adaptMarketplaceEvent(event as NostrEvent, stallMap))
        .filter((event): event is MarketplaceListing => Boolean(event)),
    ).sort((a, b) => b.createdAt - a.createdAt);

    if (listings.length === 0) return SEED_LISTINGS;

    const profileMap = await fetchProfilesBatchCached([...new Set(listings.map((l) => l.sellerPubkey))], relays);

    return listings.map((listing) => {
      const profile = profileMap.get(listing.sellerPubkey);
      return {
        ...listing,
        sellerIdentity: (isValidNip05(profile?.nip05) ? profile?.nip05 : undefined)
          || profileDisplayName(listing.sellerPubkey, profile)
          || truncateNpub(listing.sellerNpub, 8),
      };
    });
  } catch {
    return SEED_LISTINGS;
  } finally {
    pool.close(relays);
  }
}

export function filterMarketplaceListings(listings: MarketplaceListing[], opts: { query?: string; maxPrice?: number | null; tag?: string }): MarketplaceListing[] {
  const q = opts.query?.trim().toLowerCase() || '';
  return listings.filter((listing) => {
    if (q) {
      const matches = listing.title.toLowerCase().includes(q)
        || listing.summary.toLowerCase().includes(q)
        || listing.description.toLowerCase().includes(q)
        || listing.sellerIdentity.toLowerCase().includes(q)
        || listing.tags.some((tag) => tag.toLowerCase().includes(q));
      if (!matches) return false;
    }

    if (opts.maxPrice != null && listing.price != null && listing.price > opts.maxPrice) return false;
    if (opts.tag && opts.tag !== 'all' && !listing.tags.includes(opts.tag.toLowerCase())) return false;
    return true;
  });
}

export function getMarketplaceListingByKey(listings: MarketplaceListing[], listingKey: string): MarketplaceListing | undefined {
  return listings.find((item) => item.listingKey === listingKey || item.id === listingKey || item.dTag === listingKey);
}
