import { useCallback, useMemo, useRef, useState } from 'react';
import { NostrConnectClient } from '../lib/nostrConnect';
import { useAuth } from './useAuth';

export type NostrConnectStatus = 'idle' | 'waiting' | 'connected' | 'signing' | 'done' | 'error';

const DEFAULT_RELAYS = ['wss://relay.nsec.app', 'wss://relay.damus.io'];

export function useNostrConnect() {
  const loginWithNostrConnect = useAuth((state) => state.loginWithNostrConnect);
  const clearAuthError = useAuth((state) => state.clearError);
  const [status, setStatus] = useState<NostrConnectStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [connectionUri, setConnectionUri] = useState<string>('');
  const clientRef = useRef<NostrConnectClient | null>(null);

  const runAuthWithClient = useCallback(async (client: NostrConnectClient) => {
    try {
      const remotePubkey = await client.getUserPubkey();
      setStatus('connected');
      setStatus('signing');
      const ok = await loginWithNostrConnect(remotePubkey, (unsignedEvent) => client.signEvent(unsignedEvent));
      if (!ok) {
        throw new Error('Signer authenticated but backend verification failed');
      }
      setStatus('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect signer';
      setError(message);
      setStatus('error');
    }
  }, [loginWithNostrConnect]);

  const start = useCallback(async () => {
    clearAuthError();
    setError(null);
    setStatus('waiting');

    const client = new NostrConnectClient();
    clientRef.current = client;

    const uri = client.initialize({
      relays: DEFAULT_RELAYS,
      metadata: {
        name: 'NostrMaxi',
        url: window.location.origin,
        description: 'NostrMaxi mobile signer login',
      },
    });
    setConnectionUri(uri);

    await runAuthWithClient(client);
  }, [clearAuthError, runAuthWithClient]);

  const startWithBunkerUri = useCallback(async (bunkerUri: string) => {
    clearAuthError();
    setError(null);
    setConnectionUri('');
    setStatus('waiting');

    const client = new NostrConnectClient();
    clientRef.current = client;

    try {
      client.initializeFromBunkerUri(bunkerUri, {
        metadata: {
          name: 'NostrMaxi',
          url: window.location.origin,
          description: 'NostrMaxi bunker signer login',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid bunker URI';
      setError(message);
      setStatus('error');
      return;
    }

    await runAuthWithClient(client);
  }, [clearAuthError, runAuthWithClient]);

  const cancel = useCallback(() => {
    clientRef.current?.cleanup();
    clientRef.current = null;
    setStatus('idle');
    setError(null);
    setConnectionUri('');
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return useMemo(
    () => ({ status, error, connectionUri, start, startWithBunkerUri, cancel, reset }),
    [status, error, connectionUri, start, startWithBunkerUri, cancel, reset]
  );
}
