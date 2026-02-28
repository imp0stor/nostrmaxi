import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

type TabKey = 'identities' | 'names' | 'auctions' | 'sales';

type Identity = {
  id: string;
  username: string;
  domain: string;
  pubkey: string;
  tier: string;
  created: string;
  expires: string | null;
  status: 'active' | 'suspended';
};

const tabs: TabKey[] = ['identities', 'names', 'auctions', 'sales'];

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = api.getToken();
  const response = await fetch(`/api/v1/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Admin request failed (${response.status})`);
  }
  return response.json();
}

export function AdminPage() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<TabKey>('identities');
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  if (!isAuthenticated) return <div className="max-w-3xl mx-auto px-4 py-8"><div className="cy-card p-6">Login required.</div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      {toast ? <div className="cy-card p-2 text-cyan-200">{toast}</div> : null}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button key={t} className={`cy-chip ${tab === t ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'identities' ? <IdentitiesTab notify={notify} /> : null}
      {tab === 'names' ? <NamesTab notify={notify} /> : null}
      {tab === 'auctions' ? <AuctionsTab notify={notify} /> : null}
      {tab === 'sales' ? <SalesTab /> : null}
    </div>
  );
}

function IdentitiesTab({ notify }: { notify: (msg: string) => void }) {
  const [rows, setRows] = useState<Identity[]>([]);
  const [search, setSearch] = useState({ username: '', pubkey: '', domain: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Identity | null>(null);
  const [editTier, setEditTier] = useState('FREE');
  const [extendDays, setExtendDays] = useState(30);
  const [transferPubkey, setTransferPubkey] = useState('');

  const load = async () => {
    const query = new URLSearchParams({
      page: String(page),
      limit: '20',
      username: search.username,
      pubkey: search.pubkey,
      domain: search.domain,
    });
    const data = await adminFetch<{ data: Identity[]; totalPages: number }>(`/nip05?${query.toString()}`);
    setRows(data.data);
    setTotalPages(data.totalPages || 1);
  };

  useEffect(() => { void load(); }, [page]);

  const applySearch = () => { setPage(1); void load(); };

  return (
    <div className="space-y-3">
      <div className="cy-card p-3 flex gap-2 flex-wrap">
        <input className="cy-input" placeholder="username" value={search.username} onChange={(e) => setSearch((s) => ({ ...s, username: e.target.value }))} />
        <input className="cy-input" placeholder="pubkey" value={search.pubkey} onChange={(e) => setSearch((s) => ({ ...s, pubkey: e.target.value }))} />
        <input className="cy-input" placeholder="domain" value={search.domain} onChange={(e) => setSearch((s) => ({ ...s, domain: e.target.value }))} />
        <button className="cy-chip" onClick={applySearch}>Search</button>
      </div>

      <div className="cy-card p-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Username</th><th>Domain</th><th>Pubkey</th><th>Tier</th><th>Created</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td>{r.username}</td><td>{r.domain}</td><td className="font-mono text-xs">{r.pubkey.slice(0, 16)}…</td><td>{r.tier}</td>
                <td>{new Date(r.created).toLocaleDateString()}</td><td>{r.expires ? new Date(r.expires).toLocaleDateString() : '—'}</td><td>{r.status}</td>
                <td className="space-x-1">
                  <button className="cy-chip" onClick={() => { setSelected(r); setEditTier(r.tier); }}>View</button>
                  <button className="cy-chip" onClick={async () => { await adminFetch(`/nip05/${r.id}/suspend`, { method: 'POST', body: JSON.stringify({ suspended: r.status === 'active' }) }); notify('Status updated'); await load(); }}>{r.status === 'active' ? 'Suspend' : 'Unsuspend'}</button>
                  <button className="cy-chip" onClick={async () => { if (!confirm('Delete identity?')) return; await adminFetch(`/nip05/${r.id}`, { method: 'DELETE' }); notify('Identity deleted'); await load(); }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button className="cy-chip" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span className="text-sm">Page {page} / {totalPages}</span>
        <button className="cy-chip" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
      </div>

      {selected ? (
        <div className="cy-card p-4 space-y-2">
          <div className="font-semibold">Identity Details</div>
          <div>{selected.username}@{selected.domain}</div>
          <div className="flex gap-2 items-center">
            <select className="cy-input" value={editTier} onChange={(e) => setEditTier(e.target.value)}>
              <option>FREE</option><option>PRO</option><option>BUSINESS</option><option>LIFETIME</option>
            </select>
            <input className="cy-input" type="number" value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))} />
            <button className="cy-chip" onClick={async () => { await adminFetch(`/nip05/${selected.id}`, { method: 'PUT', body: JSON.stringify({ tier: editTier, extendDays }) }); notify('Identity updated'); await load(); }}>Save</button>
          </div>
          <div className="flex gap-2 items-center">
            <input className="cy-input" placeholder="New pubkey" value={transferPubkey} onChange={(e) => setTransferPubkey(e.target.value)} />
            <button className="cy-chip" onClick={async () => { await adminFetch(`/nip05/${selected.id}/transfer`, { method: 'POST', body: JSON.stringify({ pubkey: transferPubkey }) }); notify('Identity transferred'); await load(); }}>Transfer</button>
          </div>
          <button className="cy-chip" onClick={() => setSelected(null)}>Close</button>
        </div>
      ) : null}
    </div>
  );
}

function NamesTab({ notify }: { notify: (msg: string) => void }) {
  const [listType, setListType] = useState<'reserved' | 'premium' | 'blocked'>('reserved');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', reason: '', minimumPrice: '' });
  const [importText, setImportText] = useState('');

  const load = async () => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    const data = await adminFetch<any[]>(`/names/${listType}${q}`);
    setRows(data);
  };
  useEffect(() => { void load(); }, [listType]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['reserved', 'premium', 'blocked'] as const).map((t) => <button key={t} className={`cy-chip ${listType === t ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => setListType(t)}>{t}</button>)}
      </div>
      <div className="cy-card p-3 flex gap-2 flex-wrap">
        <input className="cy-input" placeholder="Search name" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="cy-chip" onClick={() => void load()}>Search</button>
        <button className="cy-chip" onClick={async () => {
          const data = await adminFetch<any>(`/names/export/${listType}?format=json`);
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `${listType}.json`; a.click(); URL.revokeObjectURL(url);
        }}>Export JSON</button>
      </div>

      <div className="cy-card p-3 space-y-2">
        <div className="font-semibold">Add Name</div>
        <div className="flex gap-2 flex-wrap">
          <input className="cy-input" placeholder="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="cy-input" placeholder="reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          {listType === 'premium' ? <input className="cy-input" placeholder="minimum price sats" value={form.minimumPrice} onChange={(e) => setForm((f) => ({ ...f, minimumPrice: e.target.value }))} /> : null}
          <button className="cy-chip" onClick={async () => { await adminFetch(`/names/${listType}`, { method: 'POST', body: JSON.stringify({ name: form.name, reason: form.reason, minimumPrice: form.minimumPrice ? Number(form.minimumPrice) : undefined }) }); notify('Name added'); setForm({ name: '', reason: '', minimumPrice: '' }); await load(); }}>Add</button>
        </div>
      </div>

      <div className="cy-card p-3 space-y-2">
        <div className="font-semibold">Import (JSON array or CSV text)</div>
        <textarea className="cy-input w-full min-h-[90px]" value={importText} onChange={(e) => setImportText(e.target.value)} />
        <div className="flex gap-2">
          <button className="cy-chip" onClick={async () => { await adminFetch('/names/import', { method: 'POST', body: JSON.stringify({ list: listType, format: 'json', content: importText }) }); notify('Imported JSON'); await load(); }}>Import JSON</button>
          <button className="cy-chip" onClick={async () => { await adminFetch('/names/import', { method: 'POST', body: JSON.stringify({ list: listType, format: 'csv', content: importText }) }); notify('Imported CSV'); await load(); }}>Import CSV</button>
        </div>
      </div>

      <div className="cy-card p-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Name</th><th>Reason</th><th>Minimum Price</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td>{r.name}</td><td>{r.reason || '—'}</td><td>{r.minimumPrice || '—'}</td><td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td><button className="cy-chip" onClick={async () => { if (!confirm('Remove name?')) return; await adminFetch(`/names/${listType}/${encodeURIComponent(r.name)}`, { method: 'DELETE' }); notify('Removed'); await load(); }}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuctionsTab({ notify }: { notify: (msg: string) => void }) {
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bids, setBids] = useState<any[]>([]);

  const load = async () => {
    const q = new URLSearchParams({ page: String(page), limit: '20', ...(status ? { status } : {}) }).toString();
    const data = await adminFetch<{ data: any[]; totalPages: number }>(`/auctions?${q}`);
    setRows(data.data);
    setTotalPages(data.totalPages || 1);
  };
  useEffect(() => { void load(); }, [page, status]);

  const openDetails = async (id: string) => {
    setSelectedId(id);
    const b = await adminFetch<any[]>(`/auctions/${id}/bids`);
    setBids(b);
  };

  return (
    <div className="space-y-3">
      <div className="cy-card p-3 flex gap-2">
        <select className="cy-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="UPCOMING">UPCOMING</option><option value="LIVE">LIVE</option><option value="ENDED">ENDED</option><option value="SETTLED">SETTLED</option><option value="FAILED">FAILED</option>
        </select>
      </div>
      <div className="cy-card p-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Name</th><th>Status</th><th>Current Bid</th><th>Top Bidder</th><th>Start</th><th>End</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td>{r.name}</td><td>{r.status}</td><td>{r.currentBid}</td><td className="font-mono text-xs">{r.topBidder ? `${String(r.topBidder).slice(0, 12)}…` : '—'}</td>
                <td>{new Date(r.startTime * 1000).toLocaleString()}</td><td>{new Date(r.endTime * 1000).toLocaleString()}</td>
                <td className="space-x-1">
                  <button className="cy-chip" onClick={() => void openDetails(r.id)}>Details</button>
                  <button className="cy-chip" onClick={async () => { await adminFetch(`/auctions/${r.id}/extend`, { method: 'POST', body: JSON.stringify({ extendSeconds: 3600 }) }); notify('Auction extended 1h'); await load(); }}>Extend</button>
                  <button className="cy-chip" onClick={async () => { await adminFetch(`/auctions/${r.id}/cancel`, { method: 'POST' }); notify('Auction cancelled'); await load(); }}>Cancel</button>
                  <button className="cy-chip" onClick={async () => { await adminFetch(`/auctions/${r.id}/finalize`, { method: 'POST' }); notify('Auction finalized'); await load(); }}>Finalize</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button className="cy-chip" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span className="text-sm">Page {page}/{totalPages}</span>
        <button className="cy-chip" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>

      {selectedId ? (
        <div className="cy-card p-3">
          <div className="font-semibold mb-2">Bids for {selectedId}</div>
          <table className="w-full text-sm"><thead><tr className="text-left"><th>Bidder</th><th>Amount</th><th>Timestamp</th></tr></thead>
            <tbody>{bids.map((b) => <tr key={b.id} className="border-t border-white/10"><td className="font-mono text-xs">{b.bidderPubkey}</td><td>{b.bidAmountSats}</td><td>{new Date(b.createdAt * 1000).toLocaleString()}</td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function SalesTab() {
  const [summary, setSummary] = useState<any>(null);
  const [revenueSeries, setRevenueSeries] = useState<Array<{ date: string; revenue: number }>>([]);

  useEffect(() => {
    void (async () => {
      const [s, r] = await Promise.all([adminFetch('/sales/summary'), adminFetch('/sales/revenue?days=30')]);
      setSummary(s);
      setRevenueSeries(r as Array<{ date: string; revenue: number }>);
    })();
  }, []);

  const tierData = useMemo(() => {
    const rows = summary?.revenueByTier || [];
    return rows.map((r: any) => ({ name: r.tier, value: r._count }));
  }, [summary]);

  if (!summary) return <div className="cy-card p-4">Loading sales…</div>;

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-3 gap-3">
        <div className="cy-card p-3">All-time revenue: <strong>{summary.totalRevenue}</strong> sats</div>
        <div className="cy-card p-3">This month: <strong>{summary.revenueThisMonth}</strong> sats</div>
        <div className="cy-card p-3">This week: <strong>{summary.revenueThisWeek}</strong> sats</div>
        <div className="cy-card p-3">Active subscriptions: <strong>{summary.activeSubscriptions}</strong></div>
        <div className="cy-card p-3">NIP-05 registrations: <strong>{summary.registrations}</strong></div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="cy-card p-3 h-72">
          <div className="mb-2">Revenue over time</div>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={revenueSeries}><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2} /></LineChart>
          </ResponsiveContainer>
        </div>
        <div className="cy-card p-3 h-72">
          <div className="mb-2">Tier distribution</div>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart><Tooltip /><Pie data={tierData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} fill="#22d3ee" label /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="cy-card p-3 overflow-x-auto">
        <div className="mb-2 font-semibold">Recent Transactions</div>
        <table className="w-full text-sm"><thead><tr className="text-left"><th>ID</th><th>Method</th><th>Status</th><th>Amount sats</th><th>Date</th></tr></thead>
          <tbody>
            {(summary.recentTransactions || []).map((t: any) => (
              <tr key={t.id} className="border-t border-white/10"><td className="font-mono text-xs">{t.id}</td><td>{t.method}</td><td>{t.status}</td><td>{t.amountSats || Math.round((t.amountUsd || 0) * 10)}</td><td>{new Date(t.createdAt).toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
