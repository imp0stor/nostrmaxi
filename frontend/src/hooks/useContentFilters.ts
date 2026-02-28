import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CONTENT_FILTERS, loadFilters, loadLocalFilters, saveFilters, saveLocalFilters, type ContentFilters } from '../lib/contentFilter';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[a-f0-9]{64}$/i.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export type ContentFilterSyncState = 'idle' | 'syncing' | 'ok' | 'error';

export function useContentFilters(pubkey?: string) {
  const [filters, setFilters] = useState<ContentFilters>(() => loadLocalFilters(pubkey));
  const [syncState, setSyncState] = useState<ContentFilterSyncState>('idle');

  const privateKey = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const nsecHex = sessionStorage.getItem('nostrmaxi_nsec_hex') || '';
    return hexToBytes(nsecHex);
  }, [pubkey]);

  useEffect(() => {
    setFilters(loadLocalFilters(pubkey));
    setSyncState('idle');
  }, [pubkey]);

  useEffect(() => {
    saveLocalFilters(filters, pubkey);
  }, [filters, pubkey]);

  const syncNow = useCallback(async () => {
    if (!pubkey || !privateKey) return false;
    setSyncState('syncing');
    try {
      const remote = await loadFilters(pubkey, privateKey, DEFAULT_RELAYS);
      setFilters(remote || DEFAULT_CONTENT_FILTERS);
      setSyncState('ok');
      return true;
    } catch {
      setSyncState('error');
      return false;
    }
  }, [pubkey, privateKey]);

  const saveNow = useCallback(async (next: ContentFilters) => {
    setFilters(next);
    if (!privateKey) return false;
    setSyncState('syncing');
    try {
      await saveFilters(next, privateKey, DEFAULT_RELAYS);
      setSyncState('ok');
      return true;
    } catch {
      setSyncState('error');
      return false;
    }
  }, [privateKey]);

  return { filters, setFilters, saveNow, syncNow, syncState, hasSignerKey: Boolean(privateKey) };
}
