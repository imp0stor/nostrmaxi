import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Tab = 'names' | 'auctions' | 'listings' | 'transfers';
type NameCategory = 'reserved' | 'premium' | 'blocked';

async function adminMarketplaceFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = api.getToken();
  const response = await fetch(`/api/v1/admin/marketplace${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

export function AdminMarketplacePage() {
  const [tab, setTab] = useState<Tab>('names');
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  return (
    <div className="min-h-screen bg-black text-orange-100 px-4 py-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <header className="rounded-xl border border-orange-500/40 bg-[#0a0a0a] p-4">
          <h1 className="text-2xl font-semibold text-orange-400">Marketplace Admin</h1>
          <p className="text-sm text-orange-200/70 mt-1">Drillable operations panel: list left, details right, inline edits and one-click actions.</p>
        </header>

        <div className="flex gap-2 flex-wrap">
          {(['names', 'auctions', 'listings', 'transfers'] as Tab[]).map((t) => (
            <button key={t} className={`cy-chip ${tab === t ? 'border-orange-500 text-orange-300 bg-[#0a0a0a]' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        {toast ? <div className="cy-card p-2 text-orange-300">{toast}</div> : null}

        {tab === 'names' ? <NamesPanel notify={notify} /> : null}
        {tab === 'auctions' ? <AuctionsPanel notify={notify} /> : null}
        {tab === 'listings' ? <ListingsPanel notify={notify} /> : null}
        {tab === 'transfers' ? <TransfersPanel /> : null}
      </div>
    </div>
  );
}

function NamesPanel({ notify }: { notify: (msg: string) => void }) {
  const [category, setCategory] = useState<NameCategory>('reserved');
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [minimumPrice, setMinimumPrice] = useState('');
  const [bulk, setBulk] = useState('');

  const path = useMemo(() => `/${category}-names`, [category]);

  const load = async () => {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    const data = await adminMarketplaceFetch<any[]>(`${path}${query}`);
    setRows(data);
    if (selected) {
      setSelected(data.find((x) => x.id === selected.id) || null);
    }
  };

  useEffect(() => { void load(); }, [category]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-3">
      <section className="cy-card p-3 space-y-2 bg-[#0a0a0a]">
        <div className="flex gap-2 flex-wrap">
          {(['reserved', 'premium', 'blocked'] as NameCategory[]).map((item) => (
            <button key={item} className={`cy-chip ${category === item ? 'border-orange-500 text-orange-300' : ''}`} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
        <input className="cy-input" placeholder="Filter names…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="cy-chip" onClick={() => void load()}>Apply filter</button>
        <div className="max-h-[60vh] overflow-auto border border-orange-500/20 rounded-lg">
          {rows.map((row) => (
            <button key={row.id} className={`w-full text-left px-3 py-2 border-b border-orange-500/10 ${selected?.id === row.id ? 'bg-orange-500/10' : 'hover:bg-orange-500/5'}`} onClick={() => setSelected(row)}>
              <div className="font-mono text-sm">{row.name}</div>
              <div className="text-xs text-orange-200/60">{row.reason || 'No reason'}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="cy-card p-4 bg-[#0a0a0a] space-y-3">
        <h2 className="text-lg font-semibold text-orange-300">Details</h2>
        {selected ? (
          <div className="space-y-2">
            <div className="text-sm">{selected.name}</div>
            <input className="cy-input" value={selected.reason || ''} onChange={(e) => setSelected({ ...selected, reason: e.target.value })} placeholder="Reason" />
            {category === 'premium' ? (
              <input className="cy-input" value={selected.minimumPrice ?? ''} onChange={(e) => setSelected({ ...selected, minimumPrice: Number(e.target.value || '0') })} placeholder="Minimum sats" />
            ) : null}
            <div className="flex gap-2">
              <button className="cy-chip" onClick={async () => {
                await adminMarketplaceFetch(`${path}/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ reason: selected.reason, minimumPrice: selected.minimumPrice }) });
                notify('Saved');
                await load();
              }}>Save</button>
              <button className="cy-chip" onClick={async () => {
                await adminMarketplaceFetch(`${path}/${selected.id}`, { method: 'DELETE' });
                setSelected(null);
                notify('Deleted');
                await load();
              }}>Delete</button>
            </div>
          </div>
        ) : <div className="text-sm text-orange-200/60">Select a name to edit.</div>}

        <div className="border-t border-orange-500/20 pt-3 space-y-2">
          <div className="font-medium text-orange-300">Add name</div>
          <input className="cy-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="name" />
          <input className="cy-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason" />
          {category === 'premium' ? <input className="cy-input" value={minimumPrice} onChange={(e) => setMinimumPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="minimum price sats" /> : null}
          <button className="cy-chip" onClick={async () => {
            await adminMarketplaceFetch(path, { method: 'POST', body: JSON.stringify({ name, reason, minimumPrice: minimumPrice ? Number(minimumPrice) : undefined }) });
            setName(''); setReason(''); setMinimumPrice('');
            notify('Created');
            await load();
          }}>Create</button>
        </div>

        <div className="border-t border-orange-500/20 pt-3 space-y-2">
          <div className="font-medium text-orange-300">Bulk import (paste list / CSV)</div>
          <textarea className="cy-input min-h-[110px]" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="alice,bob\ncharlie" />
          <button className="cy-chip" onClick={async () => {
            const result = await adminMarketplaceFetch<{ imported: number }>(`/names/bulk-import`, { method: 'POST', body: JSON.stringify({ category, content: bulk }) });
            notify(`Imported ${result.imported}`);
            setBulk('');
            await load();
          }}>Import</button>
        </div>
      </section>
    </div>
  );
}

function AuctionsPanel({ notify }: { notify: (msg: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [status, setStatus] = useState('all');
  const [form, setForm] = useState({ name: '', startsAt: '', endsAt: '', startingBidSats: '100000', reservePriceSats: '0', minIncrementSats: '1000' });

  const load = async () => {
    const query = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`;
    const data = await adminMarketplaceFetch<any[]>(`/auctions${query}`);
    setRows(data);
  };

  useEffect(() => { void load(); }, [status]);

  return <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-3">
    <section className="cy-card p-3 bg-[#0a0a0a] space-y-2">
      <div className="flex gap-2 flex-wrap">
        {['all', 'scheduled', 'live', 'ended', 'cancelled', 'settled'].map((s) => (
          <button key={s} className={`cy-chip ${status === s ? 'border-orange-500 text-orange-300' : ''}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      <div className="max-h-[65vh] overflow-auto border border-orange-500/20 rounded-lg">
        {rows.map((row) => <button key={row.id} className={`w-full text-left px-3 py-2 border-b border-orange-500/10 ${selected?.id === row.id ? 'bg-orange-500/10' : 'hover:bg-orange-500/5'}`} onClick={() => setSelected(row)}>
          <div className="font-mono text-sm">{row.name}@{row.domain}</div>
          <div className="text-xs text-orange-200/60">{row.status} · bids {row.bidCount}</div>
        </button>)}
      </div>
    </section>
    <section className="cy-card p-4 bg-[#0a0a0a] space-y-3">
      <h2 className="text-lg font-semibold text-orange-300">Auction details</h2>
      {selected ? <>
        <div className="text-sm">{selected.name}@{selected.domain}</div>
        <input className="cy-input" value={selected.reservePriceSats ?? ''} onChange={(e) => setSelected({ ...selected, reservePriceSats: Number(e.target.value || '0') })} placeholder="Reserve sats" />
        <input className="cy-input" value={selected.minIncrementSats ?? ''} onChange={(e) => setSelected({ ...selected, minIncrementSats: Number(e.target.value || '0') })} placeholder="Min increment sats" />
        <div className="flex gap-2 flex-wrap">
          <button className="cy-chip" onClick={async () => { await adminMarketplaceFetch(`/auctions/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ reservePriceSats: selected.reservePriceSats, minIncrementSats: selected.minIncrementSats }) }); notify('Saved'); await load(); }}>Save</button>
          <button className="cy-chip" onClick={async () => { await adminMarketplaceFetch(`/auctions/${selected.id}/cancel`, { method: 'POST' }); notify('Cancelled'); await load(); }}>Cancel</button>
          <button className="cy-chip" onClick={async () => { await adminMarketplaceFetch(`/auctions/${selected.id}/settle`, { method: 'POST' }); notify('Settled'); await load(); }}>Settle</button>
        </div>
        <div className="text-xs text-orange-200/70">Bid history</div>
        <ul className="text-xs space-y-1 max-h-40 overflow-auto">
          {(selected.bids || []).map((b: any) => <li key={b.id} className="font-mono">{b.amountSats} sats · {b.bidderPubkey.slice(0, 14)}…</li>)}
        </ul>
      </> : <div className="text-sm text-orange-200/60">Select an auction.</div>}

      <div className="border-t border-orange-500/20 pt-3 space-y-2">
        <div className="font-medium text-orange-300">Create auction</div>
        <input className="cy-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="name" />
        <input className="cy-input" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
        <input className="cy-input" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
        <input className="cy-input" value={form.startingBidSats} onChange={(e) => setForm({ ...form, startingBidSats: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Starting bid sats" />
        <input className="cy-input" value={form.reservePriceSats} onChange={(e) => setForm({ ...form, reservePriceSats: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Reserve sats" />
        <input className="cy-input" value={form.minIncrementSats} onChange={(e) => setForm({ ...form, minIncrementSats: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Min increment sats" />
        <button className="cy-chip" onClick={async () => {
          await adminMarketplaceFetch('/auctions', { method: 'POST', body: JSON.stringify({ ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), startingBidSats: Number(form.startingBidSats), reservePriceSats: Number(form.reservePriceSats), minIncrementSats: Number(form.minIncrementSats) }) });
          notify('Auction created');
          await load();
        }}>Create</button>
      </div>
    </section>
  </div>;
}

function ListingsPanel({ notify }: { notify: (msg: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', fixedPriceSats: '100000', sellerPubkey: '' });

  const load = async () => setRows(await adminMarketplaceFetch<any[]>('/listings?status=all'));
  useEffect(() => { void load(); }, []);

  return <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-3">
    <section className="cy-card p-3 bg-[#0a0a0a]">
      <div className="max-h-[65vh] overflow-auto border border-orange-500/20 rounded-lg">
        {rows.map((row) => <button key={row.id} className={`w-full text-left px-3 py-2 border-b border-orange-500/10 ${selected?.id === row.id ? 'bg-orange-500/10' : 'hover:bg-orange-500/5'}`} onClick={() => setSelected(row)}>
          <div className="font-mono text-sm">{row.name}@{row.domain}</div>
          <div className="text-xs text-orange-200/60">{row.status} · {row.fixedPriceSats || 0} sats</div>
        </button>)}
      </div>
    </section>
    <section className="cy-card p-4 bg-[#0a0a0a] space-y-3">
      <h2 className="text-lg font-semibold text-orange-300">Listing details</h2>
      {selected ? <>
        <input className="cy-input" value={selected.fixedPriceSats ?? ''} onChange={(e) => setSelected({ ...selected, fixedPriceSats: Number(e.target.value || '0') })} />
        <input className="cy-input" value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value })} />
        <div className="flex gap-2">
          <button className="cy-chip" onClick={async () => { await adminMarketplaceFetch(`/listings/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ fixedPriceSats: selected.fixedPriceSats, status: selected.status }) }); notify('Saved'); await load(); }}>Save</button>
          <button className="cy-chip" onClick={async () => { await adminMarketplaceFetch(`/listings/${selected.id}`, { method: 'DELETE' }); setSelected(null); notify('Deleted'); await load(); }}>Delete</button>
        </div>
      </> : <div className="text-sm text-orange-200/60">Select a listing.</div>}

      <div className="border-t border-orange-500/20 pt-3 space-y-2">
        <div className="font-medium text-orange-300">Create listing</div>
        <input className="cy-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="name" />
        <input className="cy-input" value={form.sellerPubkey} onChange={(e) => setForm({ ...form, sellerPubkey: e.target.value })} placeholder="seller pubkey" />
        <input className="cy-input" value={form.fixedPriceSats} onChange={(e) => setForm({ ...form, fixedPriceSats: e.target.value.replace(/[^0-9]/g, '') })} placeholder="price sats" />
        <button className="cy-chip" onClick={async () => { await adminMarketplaceFetch('/listings', { method: 'POST', body: JSON.stringify({ name: form.name, sellerPubkey: form.sellerPubkey, fixedPriceSats: Number(form.fixedPriceSats), listingType: 'flat' }) }); notify('Created'); await load(); }}>Create</button>
      </div>
    </section>
  </div>;
}

function TransfersPanel() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    void adminMarketplaceFetch<any[]>('/transfers?status=all').then(setRows);
  }, []);

  return (
    <section className="cy-card p-3 bg-[#0a0a0a]">
      <h2 className="text-lg font-semibold text-orange-300 mb-3">Transfers</h2>
      <div className="overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="text-left"><th>Source</th><th>Buyer</th><th>Seller</th><th>Amount</th><th>Status</th><th>Escrow</th><th>Created</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id} className="border-t border-orange-500/20"><td>{row.sourceType}:{row.sourceId.slice(0, 8)}</td><td className="font-mono text-xs">{row.buyerPubkey.slice(0, 14)}…</td><td className="font-mono text-xs">{row.sellerPubkey?.slice(0, 14) || '-'}…</td><td>{row.amountSats}</td><td>{row.transferStatus}</td><td>{row.escrowStatus}</td><td>{new Date(row.createdAt).toLocaleString()}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
