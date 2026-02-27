import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MuteWordsSettings } from '../components/MuteWordsSettings';
import { loadMuteSettings, publishMuteSettingsToNostr, saveMuteSettings, syncMuteSettingsFromNostr, type MuteSettings } from '../lib/muteWords';
import { publishEvent, signEvent } from '../lib/nostr';

export function SettingsPage() {
  const { user } = useAuth();
  const [muteSettings, setMuteSettings] = useState<MuteSettings>(() => loadMuteSettings(user?.pubkey));

  useEffect(() => {
    setMuteSettings(loadMuteSettings(user?.pubkey));
  }, [user?.pubkey]);

  useEffect(() => {
    saveMuteSettings(muteSettings, user?.pubkey);
  }, [muteSettings, user?.pubkey]);

  const syncNow = async () => {
    if (!user?.pubkey) return;
    if (muteSettings.privacyMode !== 'local') {
      const ok = await publishMuteSettingsToNostr(muteSettings, user.pubkey, signEvent, publishEvent);
      if (!ok) {
        alert('Failed to publish mute list event.');
        return;
      }
    }
    const remote = await syncMuteSettingsFromNostr(user.pubkey);
    if (remote) {
      setMuteSettings((prev) => ({ ...prev, ...remote }));
      alert('Mute list synced from Nostr.');
    } else {
      alert('Mute list synced to Nostr.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="cy-card p-5">
        <p className="cy-kicker">SETTINGS</p>
        <h1 className="cy-title">Feed Controls</h1>
      </header>
      <MuteWordsSettings settings={muteSettings} onChange={setMuteSettings} onSync={syncNow} />
    </div>
  );
}
