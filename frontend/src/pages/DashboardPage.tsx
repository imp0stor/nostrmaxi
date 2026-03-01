import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SubscriptionManager } from '../components/subscription/SubscriptionManager';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { CollapsibleSection } from '../components/CollapsibleSection';

type TabId = 'overview' | 'subscription' | 'sessions' | 'api-keys';
interface Session { id: string; userAgent: string | null; ipAddress: string | null; lastUsedAt: string; }

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const { user, isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => { setSearchParams(activeTab === 'overview' ? {} : { tab: activeTab }); }, [activeTab, setSearchParams]);
  useEffect(() => {
    if (activeTab !== 'sessions' || !isAuthenticated) return;

    setSessionsLoading(true);
    setSessionsError(null);

    api.getSessions()
      .then(setSessions)
      .catch(() => {
        setSessions([]);
        setSessionsError('Could not load active sessions right now. Please try again.');
      })
      .finally(() => setSessionsLoading(false));
  }, [activeTab, isAuthenticated]);

  const tabs = [
    { id: 'overview' as TabId, label: 'Manage' },
    { id: 'subscription' as TabId, label: 'Subscription' },
    { id: 'sessions' as TabId, label: 'Sessions' },
    ...(user?.tier === 'BUSINESS' ? [{ id: 'api-keys' as TabId, label: 'API Keys' }] : []),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[230px_minmax(0,1fr)] gap-6">
      <aside className="cy-card cinematic-card p-4 h-fit">
        <p className="cy-kicker">IDENTITY OPS</p>
        <div className="space-y-2 mt-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full min-h-11 text-left px-3 py-2 border rounded-md ${activeTab === tab.id ? 'border-cyan-400 text-cyan-100 bg-cyan-500/10' : 'border-neutral-800 text-neutral-300'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-5">
        {activeTab === 'overview' && (
          <>
            <div className="cy-card cinematic-card p-5">
              <p className="cy-kicker">MANAGE DASHBOARD</p>
              <h1 className="cy-title">Account + NIP-05 + Trust</h1>
              <p className="text-neutral-300 mt-2">Core account controls are grouped into collapsible sections to reduce visual noise.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="cy-panel p-4"><p className="cy-kicker">TIER</p><p className="text-2xl text-cyan-300 font-semibold">{user?.tier || 'FREE'}</p></div>
              <div className="cy-panel p-4"><p className="cy-kicker">NIP-05</p><p className="text-2xl text-green-300 font-semibold">{user?.nip05s?.length || 0}</p></div>
              <div className="cy-panel p-4"><p className="cy-kicker">WOT SCORE</p><p className="text-2xl text-orange-300 font-semibold">{user?.wotScore ?? 0}</p></div>
            </div>

            <CollapsibleSection
              id="dashboard-identities"
              title="Identity Inventory"
              subtitle="Manage all linked NIP-05 identities"
              summary={`${user?.nip05s?.length || 0} identities provisioned`}
              defaultOpen={false}
            >
              {!user?.nip05s?.length ? <p className="text-gray-400">No NIP-05 identities provisioned.</p> : (
                <div className="space-y-2">
                  {user.nip05s.map((n) => (
                    <div key={n.id} className="cy-panel p-3 flex justify-between gap-3 text-sm">
                      <span className="break-all">{n.localPart}@{n.domain}</span>
                      <span className="text-green-400">{n.isActive ? 'active' : 'inactive'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-3 flex-wrap">
                <Link className="cy-btn" to="/nip05">Manage Identity</Link>
                <Link className="cy-btn-secondary" to="/pricing">Get NIP-05 + Lightning Address</Link>
                <Link className="cy-btn-secondary" to="/feed">Open feed</Link>
              </div>
            </CollapsibleSection>
          </>
        )}

        {activeTab === 'subscription' && (
          <CollapsibleSection id="dashboard-subscription" title="Subscription Management" subtitle="Plans, billing, and renewal controls" defaultOpen={true}>
            <SubscriptionManager />
          </CollapsibleSection>
        )}

        {activeTab === 'sessions' && (
          <CollapsibleSection
            id="dashboard-sessions"
            title="Active Sessions"
            subtitle="Review where your account is currently active"
            summary={sessions.length === 0 ? 'No active sessions' : `${sessions.length} active sessions`}
            defaultOpen={false}
          >
            {sessionsLoading ? (
              <div className="space-y-2">
                <div className="nm-skeleton h-12 w-full" />
                <div className="nm-skeleton h-12 w-full" />
              </div>
            ) : sessionsError ? (
              <p className="text-red-300 text-sm">{sessionsError}</p>
            ) : sessions.length === 0 ? (
              <p className="text-gray-400">No active sessions.</p>
            ) : sessions.map((s) => (
              <div className="cy-panel p-3 text-sm" key={s.id}>
                {s.userAgent || 'Unknown'} • {s.ipAddress || 'n/a'} • {new Date(s.lastUsedAt).toLocaleString()}
              </div>
            ))}
          </CollapsibleSection>
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
    <CollapsibleSection
      id="dashboard-api-keys"
      title="API Keys"
      subtitle="Create and review keys for automation"
      summary={`${keys.length} keys`}
      defaultOpen={false}
    >
      <div className="mt-1 flex gap-2 flex-wrap">
        <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="cy-input" placeholder="Key name" />
        <button className="cy-btn" onClick={async () => { const k = await api.createApiKey(newKeyName); setKeys((prev) => [k, ...prev]); setCreatedKey(k.key || null); }}>Create</button>
      </div>
      {createdKey ? <pre className="cy-panel p-3 mt-3 overflow-x-auto text-xs">{createdKey}</pre> : null}
      <div className="space-y-2 mt-3">{keys.map((k) => <div className="cy-panel p-3 text-sm" key={k.id}>{k.name} ({k.keyPrefix}...)</div>)}</div>
    </CollapsibleSection>
  );
}
