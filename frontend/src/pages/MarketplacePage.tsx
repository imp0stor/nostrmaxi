import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadMarketplaceListings, filterMarketplaceListings, type MarketplaceListing } from '../lib/marketplace';

function formatPrice(listing: MarketplaceListing): string {
  if (listing.price == null) return 'Price on request';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: listing.currency || 'USD', maximumFractionDigits: 2 }).format(listing.price);
}

export function MarketplacePage() {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [search, setSearch] = useState('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [tag, setTag] = useState<string>('all');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const next = await loadMarketplaceListings();
      if (mounted) {
        setListings(next);
        setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const tags = useMemo(() => ['all', ...new Set(listings.flatMap((l) => l.tags))], [listings]);

  const filtered = useMemo(() => filterMarketplaceListings(listings, {
    query: search,
    maxPrice: maxPrice ? Number(maxPrice) : null,
    tag,
  }), [listings, search, maxPrice, tag]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="cy-card p-5">
        <p className="cy-kicker">MARKETPLACE</p>
        <h1 className="cy-title">Shop via Nostr Listings</h1>
        <p className="cy-muted mt-2">Browse commerce events from relays with identity-first seller cards.</p>
      </header>

      <section className="cy-card p-4 grid md:grid-cols-4 gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items, seller, tags..."
          className="md:col-span-2 cy-input"
        />
        <input
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="Max price"
          className="cy-input"
        />
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="cy-input">
          {tags.map((value) => <option key={value} value={value}>{value === 'all' ? 'All tags' : value}</option>)}
        </select>
      </section>

      {loading ? <section className="cy-card p-6">Loading marketplace listings…</section> : null}

      {!loading && filtered.length === 0 ? (
        <section className="cy-card p-6 text-cyan-100">No listings match these filters yet.</section>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((listing) => (
            <article key={listing.id} className="rounded-xl border border-cyan-400/25 bg-slate-950/85 p-4 shadow-[0_0_18px_rgba(34,211,238,0.12)]">
              <Link to={`/marketplace/${encodeURIComponent(listing.listingKey)}`} className="block">
                {listing.image ? <img src={listing.image} alt={listing.title} className="w-full h-44 object-cover rounded-lg border border-slate-700" /> : <div className="w-full h-44 rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-center text-sm text-slate-400">No media</div>}
                <h2 className="mt-3 text-cyan-100 font-semibold text-lg leading-tight">{listing.title}</h2>
                <p className="text-sm text-slate-300 mt-1 line-clamp-2">{listing.summary || listing.description}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <p className="text-fuchsia-200 font-semibold">{formatPrice(listing)}</p>
                  <p className="text-cyan-300 truncate max-w-[60%] text-right" title={listing.sellerIdentity}>{listing.sellerIdentity}</p>
                </div>
                {listing.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {listing.tags.slice(0, 4).map((tagValue) => <span key={`${listing.id}-${tagValue}`} className="text-[11px] px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-200">#{tagValue}</span>)}
                  </div>
                ) : null}
              </Link>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
