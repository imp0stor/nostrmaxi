import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMuteSettings } from '../hooks/useMuteSettings';
import { MuteWordsSettings } from '../components/MuteWordsSettings';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { MutedWordsManager } from '../components/settings/MutedWordsManager';
import { ContentFiltersManager } from '../components/settings/ContentFiltersManager';
import { NotificationSettings } from '../components/settings/NotificationSettings';
import { SubscriptionSettings } from '../components/settings/SubscriptionSettings';
import { addBlossomServer, getBlossomConfig, removeBlossomServer, setBlossomConfig, type BlossomServer } from '../lib/blossom';

export function SettingsPage() {
  const { user } = useAuth();
  const { settings: muteSettings, setSettings: setMuteSettings, syncNow, syncState } = useMuteSettings(user?.pubkey);
  const [tab, setTab] = useState<'muted-words' | 'blossom'>('muted-words');
  const [blossom, setBlossom] = useState(getBlossomConfig());
  const [newServer, setNewServer] = useState<BlossomServer>({ url: '', name: '', priority: 99, requiresAuth: false });

  useEffect(() => {
    setBlossom(getBlossomConfig());
  }, []);

  const runSync = async () => {
    const ok = await syncNow();
    if (!ok) {
      alert('Failed to sync mute list with Nostr.');
      return;
    }
    alert('Mute list synced.');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="cy-card cinematic-card p-5">
        <p className="cy-kicker">PROFILE SETTINGS</p>
        <h1 className="cy-title">Privacy & Safety</h1>
        <p className="text-blue-200 mt-2 text-sm">Compress controls by default and expand only what you need.</p>
        <div className="mt-4 flex items-center gap-2">
          <button
            className={`cy-chip text-sm ${tab === 'muted-words' ? 'border-cyan-300 text-cyan-100' : ''}`}
            onClick={() => setTab('muted-words')}
          >
            Muted words
          </button>
          <button
            className={`cy-chip text-sm ${tab === 'blossom' ? 'border-cyan-300 text-cyan-100' : ''}`}
            onClick={() => setTab('blossom')}
          >
            Blossom media
          </button>
        </div>
      </header>

      {tab === 'muted-words' ? (
        <>
          <CollapsibleSection
            id="settings-muted-words"
            title="Muted Words Controls"
            subtitle="Manage noise reduction for your feed"
            summary={`Rules active: ${muteSettings.rules.length} • Sync: ${syncState}`}
            defaultOpen={false}
          >
            <MutedWordsManager />
            <div className="pt-4 border-t border-swordfish-muted/30">
              <MuteWordsSettings
                settings={muteSettings}
                onChange={setMuteSettings}
                onSync={runSync}
                syncStatus={syncState}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="settings-content-filters"
            title="Encrypted Content Filters"
            subtitle="Discover and manage all available filter types"
            summary="Muted words, accounts, hashtags, and threads"
            defaultOpen
          >
            <ContentFiltersManager />
          </CollapsibleSection>

          <CollapsibleSection
            id="settings-subscriptions"
            title="Subscription Settings"
            subtitle="Positive-match subscriptions for highlights and alerts"
            summary="Topic + user subscriptions"
            defaultOpen={false}
          >
            <SubscriptionSettings />
          </CollapsibleSection>

          <CollapsibleSection
            id="settings-notification-prefs"
            title="Notification Preferences"
            subtitle="Control alert behavior, quiet hours, and zap thresholds"
            summary="Event toggles, quiet hours, minimum zap amount"
            defaultOpen={false}
          >
            <NotificationSettings />
          </CollapsibleSection>
        </>
      ) : null}

      {tab === 'blossom' ? (
        <section className="cy-card p-5 space-y-4">
          <div>
            <p className="cy-kicker">BLOSSOM CONFIG</p>
            <h2 className="text-lg text-cyan-100 font-semibold">Media Upload Servers</h2>
            <p className="text-sm text-slate-300 mt-1">Manage upload fallback order, type limits, and preferred server.</p>
          </div>

          <label className="text-sm text-cyan-200 block">
            Max file size (MB)
            <input
              className="cy-input mt-1"
              type="number"
              min={1}
              value={Math.round(blossom.maxFileSize / (1024 * 1024))}
              onChange={(e) => {
                const next = { ...blossom, maxFileSize: Math.max(1, Number(e.target.value || 1)) * 1024 * 1024 };
                setBlossom(next);
                setBlossomConfig({ maxFileSize: next.maxFileSize });
              }}
            />
          </label>

          <label className="text-sm text-cyan-200 block">
            Allowed MIME prefixes (comma-separated)
            <input
              className="cy-input mt-1"
              value={blossom.allowedTypes.join(',')}
              onChange={(e) => {
                const allowedTypes = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
                const next = { ...blossom, allowedTypes };
                setBlossom(next);
                setBlossomConfig({ allowedTypes });
              }}
            />
          </label>

          <div className="space-y-2">
            {blossom.servers.map((server) => (
              <div key={server.url} className="rounded border border-slate-700 p-3 flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <p className="text-sm text-cyan-100">{server.name} <span className="text-slate-400">({server.url})</span></p>
                  <p className="text-xs text-slate-400">Priority: {server.priority} {server.requiresAuth ? '• Auth required' : '• No auth required'}</p>
                </div>
                <div className="flex gap-2">
                  <button className="cy-btn-secondary text-xs" onClick={() => {
                    setBlossomConfig({ preferredServer: server.url });
                    setBlossom(getBlossomConfig());
                  }}>Set preferred</button>
                  <button className="cy-btn-secondary text-xs" onClick={() => {
                    removeBlossomServer(server.url);
                    setBlossom(getBlossomConfig());
                  }}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded border border-cyan-500/20 p-3 grid md:grid-cols-2 gap-2">
            <input className="cy-input" placeholder="Server name" value={newServer.name} onChange={(e) => setNewServer((prev) => ({ ...prev, name: e.target.value }))} />
            <input className="cy-input" placeholder="https://server.example" value={newServer.url} onChange={(e) => setNewServer((prev) => ({ ...prev, url: e.target.value }))} />
            <input className="cy-input" type="number" placeholder="Priority" value={newServer.priority} onChange={(e) => setNewServer((prev) => ({ ...prev, priority: Number(e.target.value || 99) }))} />
            <label className="text-sm text-cyan-200 flex items-center gap-2">
              <input type="checkbox" checked={newServer.requiresAuth} onChange={(e) => setNewServer((prev) => ({ ...prev, requiresAuth: e.target.checked }))} />
              Requires auth
            </label>
            <button className="cy-btn text-sm md:col-span-2" onClick={() => {
              if (!newServer.url.trim() || !newServer.name.trim()) return;
              addBlossomServer({ ...newServer, url: newServer.url.trim(), name: newServer.name.trim() });
              setBlossom(getBlossomConfig());
              setNewServer({ url: '', name: '', priority: 99, requiresAuth: false });
            }}>Add server</button>
          </div>

          <p className="text-xs text-emerald-300">Preferred server: {blossom.preferredServer || 'none'}</p>
        </section>
      ) : null}
    </div>
  );
}
