import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatSats, loadMarketplaceListings, timeRemaining } from '../lib/marketplace';

export function MarketplaceListingPage() {
  const { listingId } = useParams();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const data = await loadMarketplaceListings(undefined, 'all');
      if (!mounted) return;
      setItems([...data.auctions, ...data.flatListings, ...data.resaleListings]);
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const listing = useMemo(() => items.find((item) => item.id === listingId), [items, listingId]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><div className="cy-card p-6">Loading listing…</div></div>;
  if (!listing) return <div className="max-w-4xl mx-auto px-4 py-8"><div className="cy-card p-6">Listing not found. <Link className="text-cyan-300" to="/marketplace">Back to marketplace</Link></div></div>;

  const isAuction = !!listing.startingBidSats;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link to="/marketplace" className="cy-chip inline-flex">← Back to marketplace</Link>
      <article className="cy-card p-5 space-y-4">
        <p className="cy-kicker">{isAuction ? 'AUCTION' : 'LISTING'}</p>
        <h1 className="cy-title">{listing.name}@{listing.domain}</h1>
        {isAuction ? (
          <>
            <p className="text-fuchsia-200 text-xl font-semibold">Current bid: {formatSats(listing.currentBidSats ?? listing.startingBidSats)}</p>
            <p className="text-sm text-slate-300">Time remaining: {timeRemaining(listing.endsAt)}</p>
            <p className="text-sm text-slate-300">Minimum increment: {formatSats(listing.minIncrementSats)}</p>
            <p className="text-sm text-slate-300">Bid count: {listing.bidCount}</p>
          </>
        ) : (
          <>
            <p className="text-fuchsia-200 text-xl font-semibold">Price: {formatSats(listing.fixedPriceSats)}</p>
            <p className="text-sm text-slate-300">Sale mode: {listing.saleMode}</p>
            <p className="text-sm text-slate-300">Escrow transfer with 5% platform fee.</p>
          </>
        )}
      </article>
    </div>
  );
}
