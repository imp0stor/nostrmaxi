/**
 * Relay Configuration
 * 
 * Global configuration for local relay usage + user relay discovery.
 */

import { SimplePool } from 'nostr-tools';

export interface RelayConfig {
  localRelayUrl: string;
  enabled: boolean;
}

const DEFAULT_LOCAL_RELAY_URL = 'ws://localhost:7777';

// Expanded fallback relays - mix of large public relays
export const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://purplepag.es',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.nostr.info',
  'wss://nostr-pub.wellorder.net',
  'wss://offchain.pub',
];

// Cache user relay lists
const userRelayCache = new Map<string, { relays: string[]; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Enable local relay caching
 */
export function setupLocalRelay(config?: Partial<RelayConfig>): void {
  if (typeof window === 'undefined') return;

  const cfg: RelayConfig = {
    localRelayUrl: config?.localRelayUrl || DEFAULT_LOCAL_RELAY_URL,
    enabled: config?.enabled ?? false,
  };

  (window as any).__NOSTRMAXI_LOCAL_RELAY_URL__ = cfg.localRelayUrl;
  (window as any).__NOSTRMAXI_LOCAL_RELAY_ENABLED__ = cfg.enabled;

  console.log(
    `[RelayConfig] Local relay ${cfg.enabled ? 'enabled' : 'disabled'}: ${cfg.localRelayUrl}`
  );
}

/**
 * Check if local relay is available
 */
export async function checkLocalRelayAvailable(
  url: string = DEFAULT_LOCAL_RELAY_URL
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 2000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

/**
 * Auto-detect and setup local relay
 */
export async function autoSetupLocalRelay(): Promise<boolean> {
  const available = await checkLocalRelayAvailable();
  setupLocalRelay({ enabled: available });
  return available;
}

/**
 * Get current relay config
 */
export function getRelayConfig(): RelayConfig {
  if (typeof window === 'undefined') {
    return { localRelayUrl: DEFAULT_LOCAL_RELAY_URL, enabled: false };
  }

  return {
    localRelayUrl: (window as any).__NOSTRMAXI_LOCAL_RELAY_URL__ || DEFAULT_LOCAL_RELAY_URL,
    enabled: (window as any).__NOSTRMAXI_LOCAL_RELAY_ENABLED__ === true,
  };
}

/**
 * Parse relay list from kind:10002 event
 */
export function parseRelayListEvent(event: { tags: string[][] }): string[] {
  return event.tags
    .filter((t) => t[0] === 'r' && t[1] && /^wss?:\/\//i.test(t[1]))
    .map((t) => t[1]);
}

/**
 * Fetch user's configured relays from kind:10002
 */
export async function getUserRelays(pubkey: string, pool?: SimplePool): Promise<string[]> {
  const cached = userRelayCache.get(pubkey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.relays;
  }

  const ownPool = !pool;
  const p = pool || new SimplePool();
  
  try {
    const events = await Promise.race([
      p.querySync(FALLBACK_RELAYS.slice(0, 5), { kinds: [10002], authors: [pubkey], limit: 1 }),
      new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 5000)),
    ]);

    if (events.length > 0) {
      const relays = parseRelayListEvent(events[0]);
      if (relays.length > 0) {
        userRelayCache.set(pubkey, { relays, fetchedAt: Date.now() });
        return relays;
      }
    }
  } catch {
    // Ignore errors, return empty
  } finally {
    if (ownPool) p.close(FALLBACK_RELAYS.slice(0, 5));
  }

  return [];
}

/**
 * Get relays for a specific user - their relays + fallbacks
 */
export async function getRelaysForUser(pubkey: string, pool?: SimplePool): Promise<string[]> {
  const userRelays = await getUserRelays(pubkey, pool);
  const merged = [...new Set([...userRelays, ...FALLBACK_RELAYS])];
  return merged.slice(0, 8); // Max 8 relays
}

/**
 * Get default relays for general queries
 */
export function getDefaultRelays(): string[] {
  return FALLBACK_RELAYS.slice(0, 6);
}
