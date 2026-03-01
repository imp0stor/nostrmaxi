import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { RelaySyncDebugPanel } from '../components/admin/RelaySyncDebugPanel';

type AdminSectionKey = 'overview' | 'users' | 'moderation' | 'relayConfig' | 'systemHealth' | 'audit' | 'names';
type OverviewTabKey = 'identities' | 'sales';

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

type AuditLogRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorPubkey: string | null;
  details?: unknown;
  createdAt: string;
};

type AdminUser = {
  id: string;
  pubkey: string;
  npub: string;
  tier: string;
  isAdmin: boolean;
  nip05s: string[];
  wotScore: number;
  createdAt: string;
};

type RelayConfigRow = {
  key: string;
  value: unknown;
  type: string;
  category: string;
  description: string;
};

const adminSections: Array<{ key: AdminSectionKey; label: string; description: string }> = [
  { key: 'overview', label: 'Overview', description: 'Identity operations and sales pulse with drillable controls.' },
  { key: 'users', label: 'User Actions', description: 'User lookup, trust context, and identity ownership drill-down.' },
  { key: 'moderation', label: 'Moderation', description: 'Auction intervention controls with explicit safety confirmations.' },
  { key: 'relayConfig', label: 'Relay Config', description: 'Manage relay and blossom configuration, plus discovery actions.' },
  { key: 'systemHealth', label: 'System Health', description: 'Live service health and relay sync telemetry.' },
  { key: 'audit', label: 'Audit Logs', description: 'Review all sensitive changes in reverse chronological order.' },
  { key: 'names', label: 'Name Controls', description: 'Reserved, premium, and blocked naming policy controls.' },
];

const overviewTabs: Array<{ key: OverviewTabKey; label: string }> = [
  { key: 'identities', label: 'Identity Ops' },
  { key: 'sales', label: 'Sales Pulse' },
];

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

async function authenticatedFetch<T>(path: string): Promise<T> {
  const token = api.getToken();
  const response = await fetch(path, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

function confirmDangerAction(title: string, message: string): boolean {
  return window.confirm(`${title}\n\n${message}\n\nThis action is logged in the admin audit trail.`);
}

async function runConfirmedAction(args: { title: string; message: string; onConfirm: () => Promise<void> }) {
  if (!confirmDangerAction(args.title, args.message)) return;
  await args.onConfirm();
}

export function AdminPage() {
  const { isAuthenticated } = useAuth();
  const [section, setSection] = useState<AdminSectionKey>('overview');
  const [overviewTab, setOverviewTab] = useState<OverviewTabKey>('identities');
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  if (!isAuthenticated) {
    return <div className="max-w-3xl mx-auto px-4 py-8"><div className="cy-card p-6">Login required.</div></div>;
  }

  const activeSection = adminSections.find((item) => item.key === section);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-4" aria-label="Admin console">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-orange-100">Admin Console</h1>
          <Link to="/admin/marketplace" className="cy-chip">Open Marketplace Panel</Link>
        </div>
        <p className="text-sm text-orange-200/80">Isolated operations surface for platform safety, reliability, and intervention.</p>
      </header>

      {toast ? <div className="cy-card p-2 text-orange-200" role="status" aria-live="polite">{toast}</div> : null}

      <section className="cy-card p-3 space-y-2" aria-labelledby="admin-sections-label">
        <div id="admin-sections-label" className="text-xs uppercase tracking-wide text-orange-200/70">Admin IA</div>
        <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Admin sections">
          {adminSections.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={section === item.key}
              aria-controls={`section-panel-${item.key}`}
              className={`cy-chip ${section === item.key ? 'border-orange-300/80 text-orange-100 shadow-[0_0_16px_rgba(249,115,22,0.22)]' : ''}`}
              onClick={() => setSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {activeSection ? <p className="text-xs text-orange-200/75">{activeSection.description}</p> : null}
      </section>

      <section id={`section-panel-${section}`} role="tabpanel" aria-label={activeSection?.label} className="space-y-3">
        {section === 'overview' ? (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Overview tools">
              {overviewTabs.map((item) => (
                <button
                  key={item.key}
                  role="tab"
                  aria-selected={overviewTab === item.key}
                  className={`cy-chip ${overviewTab === item.key ? 'border-orange-300/80 text-orange-100 shadow-[0_0_16px_rgba(249,115,22,0.22)]' : ''}`}
                  onClick={() => setOverviewTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {overviewTab === 'identities' ? <IdentitiesTab notify={notify} /> : null}
            {overviewTab === 'sales' ? <SalesTab /> : null}
          </div>
        ) : null}

        {section === 'users' ? <UserActionsTab notify={notify} /> : null}
        {section === 'moderation' ? <AuctionsTab notify={notify} /> : null}
        {section === 'relayConfig' ? <RelayConfigTab notify={notify} /> : null}
        {section === 'systemHealth' ? <SystemHealthTab /> : null}
        {section === 'audit' ? <AuditTrailTab /> : null}
        {section === 'names' ? <NamesTab notify={notify} /> : null}
      </section>
    </div>
  );
}

function UserActionsTab({ notify }: { notify: (msg: string) => void }) {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPubkey, setSelectedPubkey] = useState('');
  const [identityRows, setIdentityRows] = useState<Identity[]>([]);

  const loadUsers = async () => {
    const data = await adminFetch<{ users: AdminUser[]; totalPages: number }>(`/users?page=${page}&limit=20`);
    setRows(data.users || []);
    setTotalPages(data.totalPages || 1);
  };

  const loadUserIdentities = async (pubkey: string) => {
    const data = await adminFetch<{ data: Identity[]; totalPages: number }>(`/nip05?page=1&limit=25&pubkey=${encodeURIComponent(pubkey)}`);
    setIdentityRows(data.data || []);
  };

  useEffect(() => {
    void loadUsers();
  }, [page]);

  return (
    <div className="space-y-3">
      <div className="cy-card p-3 text-sm text-orange-200/80">
        User actions are drill-through by design: inspect trust/tier posture here, then jump to Identity Ops for state-changing actions.
      </div>
      <div className="cy-card p-3 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-left"><th>Pubkey</th><th>Npub</th><th>Tier</th><th>Admin</th><th>WoT</th><th>NIP-05</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id} className="border-t border-white/10">
                <td className="font-mono text-xs">{user.pubkey.slice(0, 16)}…</td>
                <td className="font-mono text-xs">{user.npub.slice(0, 16)}…</td>
                <td>{user.tier}</td>
                <td>{user.isAdmin ? 'yes' : 'no'}</td>
                <td>{user.wotScore}</td>
                <td>{user.nip05s.length || 0}</td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="space-x-1">
                  <button
                    className="cy-chip"
                    onClick={async () => {
                      setSelectedPubkey(user.pubkey);
                      await loadUserIdentities(user.pubkey);
                    }}
                  >
                    Drill identities
                  </button>
                  <button
                    className="cy-chip"
                    onClick={async () => {
                      await navigator.clipboard.writeText(user.pubkey);
                      notify('Pubkey copied');
                    }}
                  >
                    Copy pubkey
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 items-center">
        <button className="cy-chip" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span className="text-sm">Page {page}/{totalPages}</span>
        <button className="cy-chip" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>

      {selectedPubkey ? (
        <div className="cy-card p-3 space-y-2">
          <div className="font-semibold">Identity ownership for {selectedPubkey.slice(0, 16)}…</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>Identity</th><th>Tier</th><th>Status</th><th>Expires</th></tr></thead>
            <tbody>
              {identityRows.map((idn) => (
                <tr key={idn.id} className="border-t border-white/10">
                  <td>{idn.username}@{idn.domain}</td>
                  <td>{idn.tier}</td>
                  <td>{idn.status}</td>
                  <td>{idn.expires ? new Date(idn.expires).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
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

  const applySearch = () => {
    setPage(1);
    void load();
  };

  return (
    <div className="space-y-3">
      <div className="cy-card p-3 flex gap-2 flex-wrap">
        <input className="cy-input" aria-label="Search by username" placeholder="username" value={search.username} onChange={(e) => setSearch((s) => ({ ...s, username: e.target.value }))} />
        <input className="cy-input" aria-label="Search by pubkey" placeholder="pubkey" value={search.pubkey} onChange={(e) => setSearch((s) => ({ ...s, pubkey: e.target.value }))} />
        <input className="cy-input" aria-label="Search by domain" placeholder="domain" value={search.domain} onChange={(e) => setSearch((s) => ({ ...s, domain: e.target.value }))} />
        <button className="cy-chip" onClick={applySearch}>Search</button>
      </div>

      <div className="cy-card p-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Username</th><th>Domain</th><th>Pubkey</th><th>Tier</th><th>Created</th><th>Expires</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td>{r.username}</td><td>{r.domain}</td><td className="font-mono text-xs">{r.pubkey.slice(0, 16)}…</td><td>{r.tier}</td>
                <td>{new Date(r.created).toLocaleDateString()}</td><td>{r.expires ? new Date(r.expires).toLocaleDateString() : '—'}</td><td>{r.status}</td>
                <td className="space-x-1">
                  <button className="cy-chip" onClick={() => { setSelected(r); setEditTier(r.tier); }}>View</button>
                  <button
                    className="cy-chip"
                    onClick={async () => {
                      const nextState = r.status === 'active' ? 'suspend' : 'restore';
                      await runConfirmedAction({
                        title: `${nextState === 'suspend' ? 'Suspend' : 'Restore'} identity ${r.username}@${r.domain}?`,
                        message: nextState === 'suspend' ? 'This prevents the identity from being active until restored.' : 'This reactivates the identity and restores its availability.',
                        onConfirm: async () => {
                          await adminFetch(`/nip05/${r.id}/suspend`, { method: 'POST', body: JSON.stringify({ suspended: r.status === 'active' }) });
                          notify('Identity status updated');
                          await load();
                        },
                      });
                    }}
                  >
                    {r.status === 'active' ? 'Suspend' : 'Unsuspend'}
                  </button>
                  <button
                    className="cy-chip"
                    onClick={async () => {
                      await runConfirmedAction({
                        title: `Delete identity ${r.username}@${r.domain}?`,
                        message: 'This permanently removes the registration.',
                        onConfirm: async () => {
                          await adminFetch(`/nip05/${r.id}`, { method: 'DELETE' });
                          notify('Identity deleted');
                          await load();
                        },
                      });
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 items-center">
        <button className="cy-chip" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span className="text-sm">Page {page} / {totalPages}</span>
        <button className="cy-chip" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
      </div>

      {selected ? (
        <div className="cy-card p-4 space-y-3" aria-label="Identity details">
          <div className="font-semibold">Identity Details</div>
          <div>{selected.username}@{selected.domain}</div>
          <div className="flex gap-2 items-center flex-wrap">
            <select className="cy-input" value={editTier} onChange={(e) => setEditTier(e.target.value)} aria-label="Select tier">
              <option>FREE</option><option>PRO</option><option>BUSINESS</option><option>LIFETIME</option>
            </select>
            <input className="cy-input" type="number" value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))} aria-label="Extend subscription by days" />
            <button
              className="cy-chip"
              onClick={async () => {
                await runConfirmedAction({
                  title: `Apply account changes to ${selected.username}@${selected.domain}?`,
                  message: `Tier -> ${editTier}, extension -> ${extendDays} day(s).`,
                  onConfirm: async () => {
                    await adminFetch(`/nip05/${selected.id}`, { method: 'PUT', body: JSON.stringify({ tier: editTier, extendDays }) });
                    notify('Identity updated');
                    await load();
                  },
                });
              }}
            >
              Save
            </button>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input className="cy-input" placeholder="New pubkey" value={transferPubkey} onChange={(e) => setTransferPubkey(e.target.value)} aria-label="Transfer to new pubkey" />
            <button
              className="cy-chip"
              onClick={async () => {
                if (!transferPubkey.trim()) return;
                await runConfirmedAction({
                  title: 'Transfer identity ownership?',
                  message: `Move ${selected.username}@${selected.domain} to a new pubkey.`,
                  onConfirm: async () => {
                    await adminFetch(`/nip05/${selected.id}/transfer`, { method: 'POST', body: JSON.stringify({ pubkey: transferPubkey }) });
                    notify('Identity transferred');
                    setTransferPubkey('');
                    await load();
                  },
                });
              }}
            >
              Transfer
            </button>
          </div>
          <button className="cy-chip" onClick={() => setSelected(null)}>Close</button>
        </div>
      ) : null}
    </div>
  );
}

function RelayConfigTab({ notify }: { notify: (msg: string) => void }) {
  const [relayConfig, setRelayConfig] = useState<string>('[]');
  const [blossomConfig, setBlossomConfig] = useState<string>('[]');
  const [rows, setRows] = useState<RelayConfigRow[]>([]);

  const load = async () => {
    const relays = await adminFetch<RelayConfigRow[]>('/config/relays');
    const blossom = await adminFetch<RelayConfigRow[]>('/config/blossom');
    setRows([...(relays || []), ...(blossom || [])]);

    const relayEntry = (relays || []).find((r) => r.key === 'relays.discovery');
    const blossomEntry = (blossom || []).find((r) => r.key === 'blossom.servers');

    setRelayConfig(JSON.stringify(relayEntry?.value || [], null, 2));
    setBlossomConfig(JSON.stringify(blossomEntry?.value || [], null, 2));
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-3">
      <RelaySyncDebugPanel />

      <div className="cy-card p-3 space-y-2">
        <div className="font-semibold">Relay discovery list (relays.discovery)</div>
        <textarea className="cy-input w-full min-h-[110px] font-mono text-xs" value={relayConfig} onChange={(e) => setRelayConfig(e.target.value)} aria-label="Relay discovery config JSON" />
        <div className="flex gap-2 flex-wrap">
          <button className="cy-chip" onClick={async () => {
            await runConfirmedAction({
              title: 'Save relay discovery config?',
              message: 'This overwrites relays.discovery and impacts feed relay fanout.',
              onConfirm: async () => {
                await adminFetch('/config/relays.discovery', { method: 'PUT', body: JSON.stringify({ value: JSON.parse(relayConfig), type: 'array', category: 'relays', description: 'Admin-managed relay discovery list' }) });
                notify('Relay config saved');
                await load();
              },
            });
          }}>Save relays.discovery</button>
          <button className="cy-chip" onClick={async () => {
            await runConfirmedAction({
              title: 'Auto-discover relay list?',
              message: 'This replaces relays.discovery using current relay popularity snapshot.',
              onConfirm: async () => {
                await adminFetch('/discover/relays', { method: 'POST' });
                notify('Relay discovery refreshed');
                await load();
              },
            });
          }}>Discover relays</button>
        </div>
      </div>

      <div className="cy-card p-3 space-y-2">
        <div className="font-semibold">Blossom servers (blossom.servers)</div>
        <textarea className="cy-input w-full min-h-[110px] font-mono text-xs" value={blossomConfig} onChange={(e) => setBlossomConfig(e.target.value)} aria-label="Blossom server config JSON" />
        <div className="flex gap-2 flex-wrap">
          <button className="cy-chip" onClick={async () => {
            await runConfirmedAction({
              title: 'Save blossom server config?',
              message: 'This overwrites blossom.servers for media upload and retrieval.',
              onConfirm: async () => {
                await adminFetch('/config/blossom.servers', { method: 'PUT', body: JSON.stringify({ value: JSON.parse(blossomConfig), type: 'array', category: 'blossom', description: 'Admin-managed blossom server list' }) });
                notify('Blossom config saved');
                await load();
              },
            });
          }}>Save blossom.servers</button>
          <button className="cy-chip" onClick={async () => {
            await runConfirmedAction({
              title: 'Auto-discover blossom servers?',
              message: 'This replaces blossom.servers from ecosystem infrastructure entries.',
              onConfirm: async () => {
                await adminFetch('/discover/blossom', { method: 'POST' });
                notify('Blossom discovery refreshed');
                await load();
              },
            });
          }}>Discover blossom</button>
        </div>
      </div>

      <div className="cy-card p-3 overflow-x-auto">
        <div className="font-semibold mb-2">Tracked configuration keys</div>
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-left"><th>Key</th><th>Category</th><th>Type</th><th>Description</th><th>Value</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-white/10 align-top">
                <td className="font-mono text-xs">{r.key}</td>
                <td>{r.category || '—'}</td>
                <td>{r.type || '—'}</td>
                <td>{r.description || '—'}</td>
                <td className="font-mono text-[11px] break-all">{JSON.stringify(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SystemHealthTab() {
  const [serviceHealth, setServiceHealth] = useState<any>(null);
  const [relayStatus, setRelayStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [health, relay, adminStats] = await Promise.all([
          authenticatedFetch('/health'),
          authenticatedFetch('/api/v1/relay-sync/status').catch(() => null),
          adminFetch('/stats').catch(() => null),
        ]);
        setServiceHealth(health);
        setRelayStatus(relay);
        setStats(adminStats);
      } catch (err) {
        setError((err as Error).message || 'Failed to load health signals');
      }
    })();
  }, []);

  if (error) return <div className="cy-card p-4">{error}</div>;
  if (!serviceHealth) return <div className="cy-card p-4">Loading system health…</div>;

  const healthState = String(serviceHealth.status || '').toLowerCase();
  const accent = healthState === 'healthy' ? 'text-orange-200' : 'text-orange-300';

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-3 gap-3">
        <div className="cy-card p-3">
          <div className="text-xs uppercase text-orange-200/65">Service status</div>
          <div className={`text-lg font-semibold ${accent}`}>{serviceHealth.status}</div>
          <div className="text-xs text-orange-200/70">{serviceHealth.timestamp}</div>
        </div>
        <div className="cy-card p-3">
          <div className="text-xs uppercase text-orange-200/65">Database</div>
          <div className="text-lg font-semibold text-orange-200">{serviceHealth.services?.database || 'unknown'}</div>
          <div className="text-xs text-orange-200/70">version {serviceHealth.version || 'n/a'}</div>
        </div>
        <div className="cy-card p-3">
          <div className="text-xs uppercase text-orange-200/65">Relay sync</div>
          <div className="text-lg font-semibold text-orange-200">{relayStatus?.running ? 'running' : 'idle'}</div>
          <div className="text-xs text-orange-200/70">queue {relayStatus?.queueSize ?? 'n/a'} / processed {relayStatus?.processedCount ?? 'n/a'}</div>
        </div>
      </div>

      {stats ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="cy-card p-3">Users: <strong>{stats.totalUsers}</strong></div>
          <div className="cy-card p-3">NIP-05 Active: <strong>{stats.totalNip05s}</strong></div>
          <div className="cy-card p-3">Paid Subs: <strong>{stats.paidSubscriptions}</strong></div>
          <div className="cy-card p-3">New users (7d): <strong>{stats.newUsersLast7Days}</strong></div>
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
      <div className="flex gap-2" role="tablist" aria-label="Name list types">
        {(['reserved', 'premium', 'blocked'] as const).map((t) => (
          <button key={t} className={`cy-chip ${listType === t ? 'border-orange-300/80 text-orange-100 shadow-[0_0_16px_rgba(249,115,22,0.22)]' : ''}`} onClick={() => setListType(t)} role="tab" aria-selected={listType === t}>
            {t}
          </button>
        ))}
      </div>
      <div className="cy-card p-3 flex gap-2 flex-wrap">
        <input className="cy-input" placeholder="Search name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search name" />
        <button className="cy-chip" onClick={() => void load()}>Search</button>
        <button
          className="cy-chip"
          onClick={async () => {
            const data = await adminFetch<any>(`/names/export/${listType}?format=json`);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${listType}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export JSON
        </button>
      </div>

      <div className="cy-card p-3 space-y-2">
        <div className="font-semibold">Add Name</div>
        <div className="flex gap-2 flex-wrap">
          <input className="cy-input" placeholder="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} aria-label="Name" />
          <input className="cy-input" placeholder="reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} aria-label="Reason" />
          {listType === 'premium' ? <input className="cy-input" placeholder="minimum price sats" value={form.minimumPrice} onChange={(e) => setForm((f) => ({ ...f, minimumPrice: e.target.value }))} aria-label="Minimum price sats" /> : null}
          <button
            className="cy-chip"
            onClick={async () => {
              await runConfirmedAction({
                title: `Add ${form.name || 'name'} to ${listType} list?`,
                message: 'This immediately affects registration policy checks.',
                onConfirm: async () => {
                  await adminFetch(`/names/${listType}`, { method: 'POST', body: JSON.stringify({ name: form.name, reason: form.reason, minimumPrice: form.minimumPrice ? Number(form.minimumPrice) : undefined }) });
                  notify('Name added');
                  setForm({ name: '', reason: '', minimumPrice: '' });
                  await load();
                },
              });
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="cy-card p-3 space-y-2">
        <div className="font-semibold">Import (JSON array or CSV text)</div>
        <textarea className="cy-input w-full min-h-[90px]" value={importText} onChange={(e) => setImportText(e.target.value)} aria-label="Import names text" />
        <div className="flex gap-2">
          <button
            className="cy-chip"
            onClick={async () => {
              await runConfirmedAction({
                title: 'Import JSON list?',
                message: 'This may insert many records into the selected list.',
                onConfirm: async () => {
                  await adminFetch('/names/import', { method: 'POST', body: JSON.stringify({ list: listType, format: 'json', content: importText }) });
                  notify('Imported JSON');
                  await load();
                },
              });
            }}
          >
            Import JSON
          </button>
          <button
            className="cy-chip"
            onClick={async () => {
              await runConfirmedAction({
                title: 'Import CSV list?',
                message: 'This may insert many records into the selected list.',
                onConfirm: async () => {
                  await adminFetch('/names/import', { method: 'POST', body: JSON.stringify({ list: listType, format: 'csv', content: importText }) });
                  notify('Imported CSV');
                  await load();
                },
              });
            }}
          >
            Import CSV
          </button>
        </div>
      </div>

      <div className="cy-card p-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Name</th><th>Reason</th><th>Minimum Price</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td>{r.name}</td><td>{r.reason || '—'}</td><td>{r.minimumPrice || '—'}</td><td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    className="cy-chip"
                    onClick={async () => {
                      await runConfirmedAction({
                        title: `Remove ${r.name}?`,
                        message: 'This deletes the name entry from the current list.',
                        onConfirm: async () => {
                          await adminFetch(`/names/${listType}/${encodeURIComponent(r.name)}`, { method: 'DELETE' });
                          notify('Removed');
                          await load();
                        },
                      });
                    }}
                  >
                    Remove
                  </button>
                </td>
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
        <select className="cy-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter moderation items by status">
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
                  <button className="cy-chip" onClick={async () => {
                    await runConfirmedAction({
                      title: `Extend auction ${r.name}?`,
                      message: 'Adds one hour to end time.',
                      onConfirm: async () => {
                        await adminFetch(`/auctions/${r.id}/extend`, { method: 'POST', body: JSON.stringify({ extendSeconds: 3600 }) });
                        notify('Auction extended 1h');
                        await load();
                      },
                    });
                  }}>Extend</button>
                  <button className="cy-chip" onClick={async () => {
                    await runConfirmedAction({
                      title: `Cancel auction ${r.name}?`,
                      message: 'This marks the auction as failed.',
                      onConfirm: async () => {
                        await adminFetch(`/auctions/${r.id}/cancel`, { method: 'POST' });
                        notify('Auction cancelled');
                        await load();
                      },
                    });
                  }}>Cancel</button>
                  <button className="cy-chip" onClick={async () => {
                    await runConfirmedAction({
                      title: `Finalize auction ${r.name}?`,
                      message: 'This attempts settlement with current winner and bids.',
                      onConfirm: async () => {
                        await adminFetch(`/auctions/${r.id}/finalize`, { method: 'POST' });
                        notify('Auction finalized');
                        await load();
                      },
                    });
                  }}>Finalize</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 items-center">
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

function AuditTrailTab() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminFetch<{ logs: AuditLogRow[] }>('/audit?page=1&limit=50');
        setRows(data.logs || []);
      } catch (err) {
        setError((err as Error).message || 'Failed to load audit trail');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="cy-card p-4">Loading audit trail…</div>;
  }

  if (error) {
    return <div className="cy-card p-4">{error}</div>;
  }

  if (!rows.length) {
    return <div className="cy-card p-4">No audit entries yet.</div>;
  }

  return (
    <div className="cy-card p-3 overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="text-left">
            <th>Time</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Entity ID</th>
            <th>Actor</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/10 align-top">
              <td>{new Date(row.createdAt).toLocaleString()}</td>
              <td>{row.action}</td>
              <td>{row.entity}</td>
              <td className="font-mono text-xs">{row.entityId || '—'}</td>
              <td className="font-mono text-xs">{row.actorPubkey ? `${row.actorPubkey.slice(0, 16)}…` : 'system'}</td>
              <td className="font-mono text-[11px] text-orange-200/80 break-all">{row.details ? JSON.stringify(row.details) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
            <LineChart data={revenueSeries}><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} /></LineChart>
          </ResponsiveContainer>
        </div>
        <div className="cy-card p-3 h-72">
          <div className="mb-2">Tier distribution</div>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart><Tooltip /><Pie data={tierData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} fill="#ea580c" label /></PieChart>
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
