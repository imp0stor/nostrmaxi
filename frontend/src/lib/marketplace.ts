export interface MarketplaceAuctionBid {
  id: string;
  bidderPubkey: string;
  amountSats: number;
  createdAt: string;
}

export interface MarketplaceAuction {
  id: string;
  name: string;
  domain: string;
  startsAt: string;
  endsAt: string;
  startingBidSats: number;
  reservePriceSats?: number;
  minIncrementSats: number;
  currentBidSats?: number;
  currentBidderPubkey?: string;
  bidCount: number;
  status: string;
  bids?: MarketplaceAuctionBid[];
}

export interface MarketplaceListing {
  id: string;
  name: string;
  domain: string;
  listingType: 'flat' | 'resale';
  sellerPubkey: string;
  fixedPriceSats: number | null;
  saleMode: 'lifetime' | 'lease_remainder';
  leaseEndsAt?: string | null;
  status: string;
  createdAt: string;
}

export interface MarketplaceData {
  auctions: MarketplaceAuction[];
  flatListings: MarketplaceListing[];
  resaleListings: MarketplaceListing[];
}

// Legacy NIP-15 adapter compatibility for tests and fallback rendering.
export interface LegacyMarketplaceListing {
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
  createdAt: number;
  tags: string[];
  source: 'nostr' | 'seed';
}

function sats(value?: number | null): string {
  if (value == null) return '—';
  return `${new Intl.NumberFormat().format(value)} sats`;
}

export function formatMarketplacePrice(price: number | null, currency = 'SAT'): string {
  if (price == null) return '—';
  const normalized = currency.toUpperCase();
  if (normalized === 'SAT' || normalized === 'SATS') {
    return `${new Intl.NumberFormat().format(price)} SAT`;
  }
  return `${new Intl.NumberFormat().format(price)} ${normalized}`;
}

export function formatSats(price?: number | null): string {
  return sats(price);
}

export function timeRemaining(endsAt: string): string {
  const remaining = new Date(endsAt).getTime() - Date.now();
  if (remaining <= 0) return 'Ended';
  const minutes = Math.floor(remaining / 60000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export async function loadMarketplaceListings(q?: string, type = 'all'): Promise<MarketplaceData> {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  query.set('type', type);
  const response = await fetch(`/api/v1/nip05/marketplace?${query.toString()}`);
  if (!response.ok) throw new Error('Failed to load marketplace');
  return response.json();
}

export async function placeAuctionBid(auctionId: string, amountSats: number, token: string): Promise<any> {
  const response = await fetch(`/api/v1/nip05/marketplace/auctions/${encodeURIComponent(auctionId)}/bid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amountSats }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Bid failed');
  return data;
}

export async function buyListing(listingId: string, token: string): Promise<any> {
  const response = await fetch(`/api/v1/nip05/marketplace/listings/${encodeURIComponent(listingId)}/buy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Purchase failed');
  return data;
}

export function adaptMarketplaceEvent(event: any): LegacyMarketplaceListing | null {
  let content: any = {};
  try { content = JSON.parse(event.content || '{}'); } catch { content = {}; }
  const getTag = (key: string) => event.tags?.find((t: string[]) => t[0] === key)?.[1];
  const dTag = getTag('d') || content.id || event.id;
  const title = getTag('title') || getTag('name') || content.name || content.title;
  if (!title) return null;
  const currencyRaw = String(content.currency || 'USD').trim().toUpperCase();
  const currency = ['SATS', 'SATOSHI', 'SATOSHIS'].includes(currencyRaw) ? 'SAT' : currencyRaw;
  const images = Array.isArray(content.images) ? content.images.filter((v: unknown) => typeof v === 'string') : [];
  return {
    id: event.id,
    eventId: event.id,
    listingKey: `${event.pubkey}:${dTag}`,
    dTag,
    stallId: content.stall_id || undefined,
    kind: event.kind,
    title,
    summary: String(content.summary || '').trim() || String(content.description || '').slice(0, 120),
    description: String(content.description || '').trim() || title,
    price: Number.isFinite(Number(content.price)) ? Number(content.price) : null,
    currency,
    sellerPubkey: event.pubkey,
    sellerIdentity: event.pubkey,
    sellerNpub: event.pubkey,
    image: images[0] || null,
    images,
    createdAt: Number(event.created_at || 0),
    tags: (event.tags || []).filter((t: string[]) => t[0] === 't' && t[1]).map((t: string[]) => String(t[1]).toLowerCase()),
    source: 'nostr',
  };
}

export function filterMarketplaceListings(listings: LegacyMarketplaceListing[], opts: { query?: string; maxPrice?: number | null; tag?: string }): LegacyMarketplaceListing[] {
  const q = opts.query?.trim().toLowerCase() || '';
  return listings.filter((listing) => {
    if (q) {
      const match = listing.title.toLowerCase().includes(q)
        || listing.summary.toLowerCase().includes(q)
        || listing.description.toLowerCase().includes(q)
        || listing.sellerIdentity.toLowerCase().includes(q)
        || listing.tags.some((tag) => tag.includes(q));
      if (!match) return false;
    }
    if (opts.maxPrice != null && listing.price != null && listing.price > opts.maxPrice) return false;
    if (opts.tag && opts.tag !== 'all' && !listing.tags.includes(opts.tag.toLowerCase())) return false;
    return true;
  });
}

export function getMarketplaceListingByKey(listings: LegacyMarketplaceListing[], listingKey: string): LegacyMarketplaceListing | undefined {
  return listings.find((item) => item.listingKey === listingKey || item.id === listingKey || item.dTag === listingKey);
}
