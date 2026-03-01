import { useEffect, useMemo, useState } from 'react';
import { formatSats, loadMarketplaceListings, placeAuctionBid, buyListing, timeRemaining, type MarketplaceAuction, type MarketplaceData, type MarketplaceListing } from '../lib/marketplace';
import { api } from '../lib/api';

export function MarketplacePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MarketplaceData>({ auctions: [], flatListings: [], resaleListings: [] });
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'auctions' | 'premium' | 'resale'>('auctions');
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const next = await loadMarketplaceListings(search || undefined, 'all');
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const currentItems = useMemo(() => {
    if (activeTab === 'auctions') return data.auctions;
    if (activeTab === 'premium') return data.flatListings;
    return data.resaleListings;
  }, [activeTab, data]);

  const handleBid = async (auction: MarketplaceAuction) => {
    const raw = bidAmounts[auction.id];
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return;
    try {
      await placeAuctionBid(auction.id, amount, api.getToken() || '');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bid failed');
    }
  };

  const handleBuy = async (listing: MarketplaceListing) => {
    try {
      await buyListing(listing.id, api.getToken() || '');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="cy-card p-5">
        <p className="cy-kicker">NIP-05 MARKETPLACE</p>
        <h1 className="cy-title">Auctions, Premium Names, and User Resale</h1>
        <p className="cy-muted mt-2">Bid on high-demand names, purchase curated premium names, or buy resale listings with escrow + 5% platform fee.</p>
      </header>

      <section className="cy-card p-4 flex gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search names..." className="cy-input flex-1 min-w-[220px]" />
        <button onClick={() => void load()} className="cy-chip">Search</button>
        <button onClick={() => setActiveTab('auctions')} className={`cy-chip ${activeTab === 'auctions' ? 'bg-cyan-500/20' : ''}`}>Auctions</button>
        <button onClick={() => setActiveTab('premium')} className={`cy-chip ${activeTab === 'premium' ? 'bg-cyan-500/20' : ''}`}>Premium Flat Price</button>
        <button onClick={() => setActiveTab('resale')} className={`cy-chip ${activeTab === 'resale' ? 'bg-cyan-500/20' : ''}`}>User Resale</button>
      </section>

      {error ? <section className="cy-card p-4 text-red-300">{error}</section> : null}
      {loading ? <section className="cy-card p-6">Loading marketplace…</section> : null}

      {!loading && currentItems.length === 0 ? <section className="cy-card p-6 text-cyan-100">No items found.</section> : null}

      {!loading && activeTab === 'auctions' && data.auctions.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.auctions.map((auction) => (
            <article key={auction.id} className="rounded-xl border border-cyan-400/25 bg-slate-950/85 p-4">
              <h2 className="text-cyan-100 font-semibold text-lg">{auction.name}@{auction.domain}</h2>
              <p className="text-sm text-slate-300 mt-1">Current bid: <span className="text-fuchsia-200">{formatSats(auction.currentBidSats ?? auction.startingBidSats)}</span></p>
              <p className="text-sm text-slate-300">Min increment: {formatSats(auction.minIncrementSats)}</p>
              <p className="text-sm text-slate-300">Bid count: {auction.bidCount}</p>
              <p className="text-sm text-orange-300">Time remaining: {timeRemaining(auction.endsAt)}</p>

              <div className="mt-3 flex gap-2">
                <input
                  className="cy-input"
                  value={bidAmounts[auction.id] || ''}
                  onChange={(e) => setBidAmounts((prev) => ({ ...prev, [auction.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder={`≥ ${(auction.currentBidSats ?? auction.startingBidSats) + auction.minIncrementSats}`}
                />
                <button className="cy-chip" onClick={() => void handleBid(auction)}>Place bid</button>
              </div>
              {auction.bids?.length ? (
                <div className="mt-3 text-xs text-slate-300">
                  <p className="font-semibold mb-1">Bid history</p>
                  <ul className="space-y-1">
                    {auction.bids.slice(0, 5).map((bid) => <li key={bid.id}>• {formatSats(bid.amountSats)} by {bid.bidderPubkey.slice(0, 10)}…</li>)}
                  </ul>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {!loading && activeTab !== 'auctions' ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(activeTab === 'premium' ? data.flatListings : data.resaleListings).map((listing) => (
            <article key={listing.id} className="rounded-xl border border-cyan-400/25 bg-slate-950/85 p-4">
              <h2 className="text-cyan-100 font-semibold text-lg">{listing.name}@{listing.domain}</h2>
              <p className="text-sm text-slate-300 mt-1">Price: <span className="text-fuchsia-200">{formatSats(listing.fixedPriceSats)}</span></p>
              <p className="text-sm text-slate-300">Type: {listing.listingType} · Sale mode: {listing.saleMode}</p>
              {listing.saleMode === 'lease_remainder' && listing.leaseEndsAt ? <p className="text-sm text-slate-400">Lease ends: {new Date(listing.leaseEndsAt).toLocaleDateString()}</p> : null}
              <button className="cy-chip mt-3" onClick={() => void handleBuy(listing)}>Buy now</button>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
