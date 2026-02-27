import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMuteSettings } from '../hooks/useMuteSettings';
import { MuteWordsSettings } from '../components/MuteWordsSettings';

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
      <header className="cy-card p-5">
        <p className="cy-kicker">PROFILE SETTINGS</p>
        <h1 className="cy-title">Privacy & Safety</h1>
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
        <MuteWordsSettings
          settings={muteSettings}
          onChange={setMuteSettings}
          onSync={runSync}
          syncStatus={syncState}
        />
      ) : null}
    </div>
  );
}
