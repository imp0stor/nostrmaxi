import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserProfile } from '../components/profile/UserProfile';
import { ServiceStatus } from '../components/status/ServiceStatus';
import { SubscriptionManager } from '../components/subscription/SubscriptionManager';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

type TabId = 'overview' | 'subscription' | 'sessions' | 'api-keys';

interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
}

interface Nip05Row {
  id: string;
  address: string;
  pubkey: string;
  domain: string;
  status: 'active' | 'pending' | 'unverified';
}

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const { user, isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Dashboard' },
    { id: 'subscription', label: 'Subscriptions' },
    { id: 'sessions', label: 'Sessions' },
    ...(user?.tier === 'BUSINESS' ? [{ id: 'api-keys' as TabId, label: 'API Keys' }] : []),
  ];

  useEffect(() => {
    setSearchParams(activeTab === 'overview' ? {} : { tab: activeTab });
  }, [activeTab, setSearchParams]);

  useEffect(() => {
    if (activeTab === 'sessions' && isAuthenticated) {
      setSessionsLoading(true);
      api.getSessions()
        .then(setSessions)
        .finally(() => setSessionsLoading(false));
    }
  }, [activeTab, isAuthenticated]);

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Revoke this session? The device will be logged out.')) return;

    try {
      await api.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (error) {
      alert('Failed to revoke session');
    }
  };

  const nip05Rows: Nip05Row[] = user?.nip05s?.length
    ? user.nip05s.map((nip05) => ({
        id: nip05.id,
        address: `${nip05.localPart}@${nip05.domain}`,
        pubkey: user.npub,
        domain: nip05.domain,
        status: nip05.isActive ? 'active' : 'unverified',
      }))
    : [];

  return (
    <div className="ui-app">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
          <aside className="ui-rail h-fit">
            <div className="mb-6">
              <p className="ui-label">Workspace</p>
              <h2 className="text-xl font-semibold text-white">NostrMaxi</h2>
            </div>
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="ui-rail-item w-full"
                  data-active={activeTab === tab.id}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
              <div className="ui-divider my-4" />
              {[
                { label: 'NIP-05 Identities', value: 'NIP05' },
                { label: 'Web of Trust', value: 'WoT' },
                { label: 'Payments', value: 'Payments' },
                { label: 'API Keys', value: 'API' },
                { label: 'Admin', value: 'Admin' },
              ].map((item) => (
                <div key={item.value} className="ui-rail-item">
                  <span className="text-xs uppercase tracking-[0.2em] ui-muted">{item.label}</span>
                </div>
              ))}
            </nav>
          </aside>

          <section className="space-y-6">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="ui-label">Identity + Trust + Lightning</p>
                <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
                <p className="ui-muted mt-2">
                  Enterprise-grade NIP-05 management with Web of Trust signal and Lightning-ready billing.
                </p>
              </div>
              <button className="ui-cta">Create NIP05</button>
            </header>

            {activeTab === 'overview' && (
              <>
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="ui-kpi">
                    <p className="ui-muted text-sm">Active identities</p>
                    <p className="text-3xl font-semibold mt-2">{user?.nip05s.length || 0}</p>
                    <p className="ui-muted-2 text-xs mt-2">Free tier limit: {user?.tier === 'FREE' ? '1' : 'Custom'}</p>
                  </div>
                  <div className="ui-kpi">
                    <p className="ui-muted text-sm">WoT score</p>
                    <p className="text-3xl font-semibold mt-2">{user?.wotScore || 0}</p>
                    <p className="ui-muted-2 text-xs mt-2">score source: live account reputation</p>
                  </div>
                  <div className="ui-kpi">
                    <p className="ui-muted text-sm">Subscription</p>
                    <p className="text-2xl font-semibold mt-2">{user?.tier || 'FREE'}</p>
                    <p className="ui-muted-2 text-xs mt-2">Upgrade for custom domains</p>
                  </div>
                  <div className="ui-kpi">
                    <p className="ui-muted text-sm">API requests (24h)</p>
                    <p className="text-2xl font-semibold mt-2">—</p>
                    <p className="ui-muted-2 text-xs mt-2">See API key limits in your tier settings</p>
                  </div>
                </div>

                <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
                  <div className="ui-card space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold">NIP-05 identities</h3>
                      <p className="ui-muted text-sm">Live data from your account where available.</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="ui-table">
                        <thead>
                          <tr>
                            <th>Address</th>
                            <th>Pubkey</th>
                            <th>Domain</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nip05Rows.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="ui-muted text-center py-8">No identities yet</td>
                            </tr>
                          ) : nip05Rows.map((row) => (
                            <tr key={row.id}>
                              <td>{row.address}</td>
                              <td className="ui-muted">{row.pubkey}</td>
                              <td>{row.domain}</td>
                              <td>
                                <span className="ui-status" data-variant={row.status}>
                                  {row.status === 'active' ? 'ACTIVE' : row.status === 'pending' ? 'PENDING DNS' : 'UNVERIFIED'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="ui-card-subtle">
                        <p className="ui-muted text-sm mb-2">Quick verify</p>
                        <p className="ui-muted-2 text-xs mb-3">Check your domain’s /.well-known/nostr.json mapping</p>
                        <input className="ui-input" placeholder="yourdomain.com" />
                        <button className="ui-cta mt-4 w-full">Run Verify</button>
                      </div>
                      <div className="ui-card-subtle">
                        <p className="ui-muted text-sm mb-2">Payment</p>
                        <p className="ui-muted-2 text-xs mb-3">Upgrade to PRO for higher limits and custom domains</p>
                        <div className="ui-card-subtle">
                          <p className="text-sm">Lightning invoice generated at checkout</p>
                          <p className="ui-muted-2 text-xs">Status updates in real time after invoice creation</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="ui-card space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold">Web of Trust snapshot</h3>
                      <p className="ui-muted text-sm">Trust trend based on connected account signals</p>
                    </div>
                    <div className="bg-[#0f172a] rounded-2xl p-4">
                      <svg width="100%" height="120" viewBox="0 0 260 120" role="img" aria-label="Web of Trust trend">
                        <defs>
                          <linearGradient id="uiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#7c3aed" />
                            <stop offset="100%" stopColor="#c084fc" />
                          </linearGradient>
                        </defs>
                        <polyline className="ui-chart-line" points="10,90 60,60 110,70 160,35 210,20 250,40" />
                        <circle className="ui-chart-dot" cx="210" cy="20" r="4" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="ui-muted">Trust depth</span>
                        <span className="ui-highlight">2</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="ui-muted">Score source</span>
                        <span className="ui-muted-2">live scoring pipeline</span>
                      </div>
                    </div>
                    <div className="ui-divider" />
                    <div>
                      <p className="ui-label mb-3">System health</p>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: 'API', status: 'healthy', variant: 'active' },
                          { label: 'DB', status: 'healthy', variant: 'active' },
                          { label: 'LNbits', status: 'connected', variant: 'info' },
                          { label: 'WoT relay/query', status: 'active', variant: 'pending' },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between">
                            <span className="ui-muted">{item.label}</span>
                            <span className="ui-status" data-variant={item.variant}>
                              {item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'subscription' && (
              <div className="ui-card">
                <SubscriptionManager />
              </div>
            )}

            {activeTab === 'sessions' && (
              <div className="ui-card">
                <h2 className="text-xl font-bold text-white mb-4">Active Sessions</h2>
                <p className="ui-muted text-sm mb-6">
                  Manage devices that are logged into your account.
                </p>

                {sessionsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="ui-muted text-center py-8">No active sessions</p>
                ) : (
                  <div className="space-y-4">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-4 bg-[#0f172a] rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">
                              {session.userAgent?.split(' ')[0] || 'Unknown Device'}
                            </p>
                            <p className="ui-muted text-xs">
                              {session.ipAddress || 'Unknown IP'} • Last active {new Date(session.lastUsedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          className="text-red-400 hover:text-red-300 text-sm font-medium"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'api-keys' && (
              <div className="ui-card">
                <ApiKeysManager />
              </div>
            )}

            {activeTab === 'overview' && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="ui-card">
                  <UserProfile />
                </div>
                <div className="ui-card">
                  <ServiceStatus />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// API Keys Manager Component
function ApiKeysManager() {
  const [keys, setKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    api.listApiKeys()
      .then(setKeys)
      .finally(() => setIsLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;

    try {
      const key = await api.createApiKey(newKeyName);
      setCreatedKey(key.key || null);
      setKeys((prev) => [key, ...prev]);
      setNewKeyName('');
    } catch (error) {
      alert('Failed to create API key');
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;

    try {
      await api.revokeApiKey(keyId);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (error) {
      alert('Failed to revoke key');
    }
  };

  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">API Keys</h2>
          <p className="ui-muted text-sm">Manage programmatic access to your account</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="ui-cta"
        >
          Create Key
        </button>
      </div>

      {createdKey && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-green-400 font-medium mb-2">Key created! Copy it now - you won't see it again.</p>
          <code className="block p-3 bg-nostr-darker rounded text-sm text-white font-mono break-all">
            {createdKey}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(createdKey);
              setCreatedKey(null);
            }}
            className="mt-2 text-green-400 hover:underline text-sm"
          >
            Copy and dismiss
          </button>
        </div>
      )}

      {showCreate && (
        <div className="mb-6 p-4 bg-nostr-darker rounded-lg">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., Production API)"
            className="ui-input mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="ui-cta"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="ui-button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : keys.length === 0 ? (
        <p className="ui-muted text-center py-8">No API keys yet</p>
      ) : (
        <div className="space-y-4">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-4 bg-[#0f172a] rounded-lg"
            >
              <div>
                <p className="text-white font-medium">{key.name}</p>
                <p className="ui-muted text-sm font-mono">{key.keyPrefix}...</p>
                <p className="ui-muted-2 text-xs">
                  Created {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                className="text-red-400 hover:text-red-300 text-sm font-medium"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
