import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMarketplaceListingByKey, loadMarketplaceListings, type MarketplaceListing } from '../lib/marketplace';

function formatPrice(listing: MarketplaceListing): string {
  if (listing.price == null) return 'Price on request';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: listing.currency || 'USD', maximumFractionDigits: 2 }).format(listing.price);
}

export function MarketplaceListingPage() {
  const { listingId } = useParams();
  const listingLookup = decodeURIComponent(listingId || '');
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const items = await loadMarketplaceListings();
      if (mounted) {
        setListings(items);
        setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const listing = useMemo(() => getMarketplaceListingByKey(listings, listingLookup), [listings, listingLookup]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><div className="cy-card p-6">Loading listing…</div></div>;
  if (!listing) return <div className="max-w-4xl mx-auto px-4 py-8"><div className="cy-card p-6">Listing not found. <Link className="text-cyan-300" to="/marketplace">Back to marketplace</Link></div></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link to="/marketplace" className="cy-chip inline-flex">← Back to marketplace</Link>
      <article className="cy-card p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            {listing.image ? <img src={listing.image} alt={listing.title} className="w-full h-72 object-cover rounded-lg border border-slate-700" /> : <div className="w-full h-72 rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-center text-sm text-slate-400">No media</div>}
            {listing.images.length > 1 ? (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {listing.images.slice(1, 5).map((img, idx) => <img key={`${listing.id}-${idx}`} src={img} alt={`${listing.title} ${idx + 2}`} className="h-16 w-full rounded border border-slate-700 object-cover" />)}
              </div>
            ) : null}
          </div>
          <div>
            <p className="cy-kicker">NOSTR LISTING</p>
            <h1 className="cy-title">{listing.title}</h1>
            <p className="text-fuchsia-200 text-xl font-semibold mt-2">{formatPrice(listing)}</p>
            <p className="text-sm text-cyan-300 mt-3">Seller: {listing.sellerIdentity}</p>
            <p className="cy-mono text-xs text-slate-400 mt-1 break-all">{listing.sellerNpub}</p>
            <p className="text-sm text-slate-300 mt-3 whitespace-pre-wrap">{listing.description || listing.summary}</p>
            {listing.location ? <p className="text-sm text-slate-400 mt-3">Ships from: {listing.location}</p> : null}
            {listing.quantity != null ? <p className="text-sm text-slate-400 mt-1">Quantity available: {listing.quantity}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {listing.tags.map((tagValue) => <span key={`${listing.id}-tag-${tagValue}`} className="text-[11px] px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-200">#{tagValue}</span>)}
            </div>
            <div className="mt-5 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 p-3 text-sm text-fuchsia-100">
              Checkout/payments are next sprint. This MVP ships browse + listing detail + identity context.
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
