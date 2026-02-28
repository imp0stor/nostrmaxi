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

// Server's local relay via Caddy WSS proxy (avoids mixed content blocking)
const SERVER_RELAY_URL = 'wss://10.1.10.143:3401/relay';
const DEFAULT_LOCAL_RELAY_URL = SERVER_RELAY_URL;

// Expanded fallback relays - server relay first, then reliable public relays
// Auto-discovered from user relay lists (kind:10002) + manually verified
export const FALLBACK_RELAYS = [
  SERVER_RELAY_URL,  // Our local cache via WSS proxy - fast, no rate limits
  'wss://relay.damus.io',
  'wss://relay.primal.net', 
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.momostr.pink',   // Popular from user data
  'wss://relay.ditto.pub',      // Popular from user data
  'wss://nostr.oxtr.dev',       // Good connectivity
  'wss://nostr.mom',            // Good connectivity
  'wss://nostr.land',           // Good connectivity
  'wss://nostr.bitcoiner.social',
  'wss://nostr-pub.wellorder.net',
  'wss://offchain.pub',
  'wss://purplepag.es',
];

// Dynamic relay discovery cache
let discoveredRelays: string[] = [];
let discoveryTimestamp = 0;
const DISCOVERY_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Discover popular relays from user relay lists (kind:10002)
 */
export async function discoverRelaysFromNetwork(seedRelays: string[] = FALLBACK_RELAYS.slice(0, 5)): Promise<string[]> {
  // Return cached if fresh
  if (discoveredRelays.length > 0 && Date.now() - discoveryTimestamp < DISCOVERY_TTL_MS) {
    return discoveredRelays;
  }

  const pool = new SimplePool();
  try {
    const events = await Promise.race([
      pool.querySync(seedRelays, { kinds: [10002], limit: 200 }),
      new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 8000)),
    ]);

    const relayCount = new Map<string, number>();
    events.forEach((evt) => {
      evt.tags.forEach((tag) => {
        if (tag[0] === 'r' && tag[1]) {
          const url = tag[1].toLowerCase().replace(/\/+$/, '');
          if (url.startsWith('wss://')) {
            relayCount.set(url, (relayCount.get(url) || 0) + 1);
          }
        }
      });
    });

    // Sort by popularity, take top 20
    const sorted = [...relayCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([url]) => url);

    discoveredRelays = sorted;
    discoveryTimestamp = Date.now();
    console.log(`[RelayConfig] Discovered ${sorted.length} relays from network`);
    return sorted;
  } catch {
    return discoveredRelays; // Return stale cache on error
  } finally {
    pool.close(seedRelays);
  }
}

/**
 * Get best relays - combines fallback + discovered
 */
export async function getBestRelays(maxCount: number = 8): Promise<string[]> {
  const discovered = await discoverRelaysFromNetwork();
  const combined = [...new Set([...FALLBACK_RELAYS, ...discovered])];
  return combined.slice(0, maxCount);
}

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
