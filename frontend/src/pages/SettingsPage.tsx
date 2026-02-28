import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMuteSettings } from '../hooks/useMuteSettings';
import { MuteWordsSettings } from '../components/MuteWordsSettings';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { MutedWordsManager } from '../components/settings/MutedWordsManager';

export function SettingsPage() {
  const { user } = useAuth();
  const { settings: muteSettings, setSettings: setMuteSettings, syncNow, syncState } = useMuteSettings(user?.pubkey);
  const [tab, setTab] = useState<'muted-words'>('muted-words');

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
        </div>
      </header>

      {tab === 'muted-words' ? (
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
      ) : null}
    </div>
  );
}
