import { useCallback, useEffect, useState } from 'react';
import { publishEvent, signEvent } from '../lib/nostr';
import { loadMuteSettings, publishMuteSettingsToNostr, saveMuteSettings, syncMuteSettingsFromNostr, type MuteSettings } from '../lib/muteWords';

export type MuteSyncState = 'idle' | 'syncing' | 'ok' | 'error';

export function useMuteSettings(pubkey?: string) {
  const [settings, setSettings] = useState<MuteSettings>(() => loadMuteSettings(pubkey));
  const [syncState, setSyncState] = useState<MuteSyncState>('idle');

  useEffect(() => {
    setSettings(loadMuteSettings(pubkey));
    setSyncState('idle');
  }, [pubkey]);

  useEffect(() => {
    saveMuteSettings(settings, pubkey);
  }, [settings, pubkey]);

  const syncNow = useCallback(async () => {
    if (!pubkey) return false;
    setSyncState('syncing');
    try {
      if (settings.privacyMode !== 'local') {
        const published = await publishMuteSettingsToNostr(settings, pubkey, signEvent, publishEvent);
        if (!published) {
          setSyncState('error');
          return false;
        }
      }

      const remote = await syncMuteSettingsFromNostr(pubkey);
      if (remote) setSettings((prev) => ({ ...prev, ...remote }));
      setSyncState('ok');
      return true;
    } catch {
      setSyncState('error');
      return false;
    }
  }, [pubkey, settings]);

  return { settings, setSettings, syncNow, syncState };
}
