import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SubscriptionManager } from '../components/subscription/SubscriptionManager';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

type TabId = 'overview' | 'subscription' | 'sessions' | 'api-keys';
interface Session { id: string; userAgent: string | null; ipAddress: string | null; lastUsedAt: string; }

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const { user, isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => { setSearchParams(activeTab === 'overview' ? {} : { tab: activeTab }); }, [activeTab, setSearchParams]);
  useEffect(() => { if (activeTab === 'sessions' && isAuthenticated) api.getSessions().then(setSessions); }, [activeTab, isAuthenticated]);

  const tabs = [
    { id: 'overview' as TabId, label: 'Manage' },
    { id: 'subscription' as TabId, label: 'Subscription' },
    { id: 'sessions' as TabId, label: 'Sessions' },
    ...(user?.tier === 'BUSINESS' ? [{ id: 'api-keys' as TabId, label: 'API Keys' }] : []),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[220px_minmax(0,1fr)] gap-6">
      <aside className="cy-card p-4 h-fit">
        <p className="cy-kicker">IDENTITY OPS</p>
        <div className="space-y-2 mt-3">{tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full text-left px-3 py-2 border ${activeTab === tab.id ? 'border-cyan-400 text-cyan-200' : 'border-blue-950 text-blue-200'}`}>{tab.label}</button>)}</div>
      </aside>

      <section className="space-y-5">
        {activeTab === 'overview' && (
          <>
            <div className="cy-card p-5">
              <p className="cy-kicker">MANAGE DASHBOARD</p>
              <h1 className="cy-title">Account + NIP-05 + Trust</h1>
              <p className="text-gray-300 mt-2">No placeholder metrics. Only live account records.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="cy-panel p-4"><p className="cy-kicker">TIER</p><p className="text-2xl text-cyan-300">{user?.tier || 'FREE'}</p></div>
              <div className="cy-panel p-4"><p className="cy-kicker">NIP-05</p><p className="text-2xl text-green-300">{user?.nip05s?.length || 0}</p></div>
              <div className="cy-panel p-4"><p className="cy-kicker">WOT SCORE</p><p className="text-2xl text-blue-300">{user?.wotScore ?? 0}</p></div>
            </div>

            <div className="cy-card p-5">
              <h2 className="text-cyan-300 font-semibold mb-3">Identities</h2>
              {!user?.nip05s?.length ? <p className="text-gray-400">No NIP-05 identities provisioned.</p> : (
                <div className="space-y-2">
                  {user.nip05s.map((n) => <div key={n.id} className="cy-panel p-3 flex justify-between"><span>{n.localPart}@{n.domain}</span><span className="text-green-400">{n.isActive ? 'active' : 'inactive'}</span></div>)}
                </div>
              )}
              <div className="mt-4 flex gap-3"><Link className="cy-btn" to="/nip05">Manage Identity</Link><Link className="cy-btn-secondary" to="/pricing">Get NIP-05 + Lightning Address</Link><Link className="cy-btn-secondary" to="/feed">Open feed</Link></div>
            </div>
          </>
        )}

        {activeTab === 'subscription' && <div className="cy-card p-5"><SubscriptionManager /></div>}

        {activeTab === 'sessions' && (
          <div className="cy-card p-5 space-y-3">
            <h2 className="text-cyan-300 font-semibold">Active sessions</h2>
            {sessions.length === 0 ? <p className="text-gray-400">No active sessions.</p> : sessions.map((s) => <div className="cy-panel p-3" key={s.id}>{s.userAgent || 'Unknown'} • {s.ipAddress || 'n/a'} • {new Date(s.lastUsedAt).toLocaleString()}</div>)}
          </div>
        )}

        {activeTab === 'api-keys' && <ApiKeysManager />}
      </section>
    </div>
  );
}

function ApiKeysManager() {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  useEffect(() => { api.listApiKeys().then(setKeys); }, []);

  return (
    <div className="cy-card p-5">
      <h2 className="text-cyan-300 font-semibold">API Keys</h2>
      <div className="mt-3 flex gap-2"><input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="cy-input" placeholder="Key name" /><button className="cy-btn" onClick={async () => { const k = await api.createApiKey(newKeyName); setKeys((prev) => [k, ...prev]); setCreatedKey(k.key || null); }}>Create</button></div>
      {createdKey ? <pre className="cy-panel p-3 mt-3 overflow-x-auto">{createdKey}</pre> : null}
      <div className="space-y-2 mt-3">{keys.map((k) => <div className="cy-panel p-3" key={k.id}>{k.name} ({k.keyPrefix}...)</div>)}</div>
    </div>
  );
}
