import { adaptMarketplaceEvent, filterMarketplaceListings, formatMarketplacePrice, getMarketplaceListingByKey } from '../../frontend/src/lib/marketplace';
import type { NostrEvent } from '../../frontend/src/types';

describe('marketplace adapter', () => {
  it('adapts NIP-15 product event with d tag and stall_id', () => {
    const event: NostrEvent = {
      id: 'evt-1',
      sig: 'f'.repeat(128),
      pubkey: 'a'.repeat(64),
      created_at: 1700000000,
      kind: 30018,
      content: JSON.stringify({ id: 'wallet-1', stall_id: 'stall-abc', description: 'Titanium card wallet', images: ['https://img.example/1.jpg'], currency: 'usd', price: 99 }),
      tags: [
        ['d', 'wallet-1'],
        ['title', 'Titanium Card Wallet'],
        ['t', 'hardware'],
        ['t', 'wallet'],
      ],
    };

    const listing = adaptMarketplaceEvent(event);
    expect(listing).not.toBeNull();
    expect(listing?.dTag).toBe('wallet-1');
    expect(listing?.listingKey).toContain(':wallet-1');
    expect(listing?.stallId).toBe('stall-abc');
    expect(listing?.title).toBe('Titanium Card Wallet');
    expect(listing?.price).toBe(99);
    expect(listing?.currency).toBe('USD');
    expect(listing?.images[0]).toContain('https://img.example/1.jpg');
    expect(listing?.tags).toEqual(['hardware', 'wallet']);
  });

  it('filters by query and max price', () => {
    const listings = [
      {
        id: '1', eventId: '1', listingKey: 'x:1', dTag: '1', kind: 30018, title: 'Zap Hat', summary: 'hat', description: 'hat', price: 40, currency: 'USD', sellerPubkey: 'x', sellerIdentity: 'ops@nostrmaxi.io', sellerNpub: 'npub1x', image: null, images: [], createdAt: 1, tags: ['apparel'], source: 'seed' as const,
      },
      {
        id: '2', eventId: '2', listingKey: 'y:2', dTag: '2', kind: 30018, title: 'Wallet Sleeve', summary: 'sleeve', description: 'sleeve', price: 90, currency: 'USD', sellerPubkey: 'y', sellerIdentity: 'maker@shop.io', sellerNpub: 'npub1y', image: null, images: [], createdAt: 2, tags: ['hardware'], source: 'seed' as const,
      },
    ];

    const result = filterMarketplaceListings(listings, { query: 'zap', maxPrice: 60, tag: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('finds listing by listingKey, event id, or d tag', () => {
    const listings = [
      {
        id: 'evt123', eventId: 'evt123', listingKey: 'pub:wallet-1', dTag: 'wallet-1', kind: 30018, title: 'Wallet', summary: 's', description: 'd', price: 1, currency: 'USD', sellerPubkey: 'pub', sellerIdentity: 'seller', sellerNpub: 'npub1', image: null, images: [], createdAt: 1, tags: [], source: 'seed' as const,
      },
    ];

    expect(getMarketplaceListingByKey(listings, 'pub:wallet-1')?.id).toBe('evt123');
    expect(getMarketplaceListingByKey(listings, 'evt123')?.id).toBe('evt123');
    expect(getMarketplaceListingByKey(listings, 'wallet-1')?.id).toBe('evt123');
  });

  it('normalizes SATS currency and formats safely for non-ISO currencies', () => {
    const event: NostrEvent = {
      id: 'evt-sat',
      sig: 'f'.repeat(128),
      pubkey: 'b'.repeat(64),
      created_at: 1700000000,
      kind: 30018,
      content: JSON.stringify({ id: 'sat-item', name: 'SAT Item', currency: 'sats', price: 2800 }),
      tags: [['d', 'sat-item']],
    };

    const listing = adaptMarketplaceEvent(event);
    expect(listing).not.toBeNull();
    expect(listing?.currency).toBe('SAT');
    expect(formatMarketplacePrice(listing?.price ?? null, listing?.currency ?? 'USD')).toContain('SAT');
  });
});
