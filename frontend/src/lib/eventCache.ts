/**
 * Event Cache Layer
 * 
 * Three-tier caching strategy:
 * 1. Redis (hot, fast, 5min TTL)
 * 2. Local relay (warm, persistent)
 * 3. Remote relays (cold, network fetch)
 * 
 * All fetched events are automatically cached in local relay + Redis.
 */

import { SimplePool, type Event as NostrEvent } from 'nostr-tools';

export interface CacheConfig {
  localRelayUrl?: string;
  sourceRelays?: string[];
  redisTtlSeconds?: number;
  enableLocalRelay?: boolean;
}

const DEFAULT_CONFIG: Required<CacheConfig> = {
  localRelayUrl: 'ws://localhost:7777',
  sourceRelays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.primal.net',
  ],
  redisTtlSeconds: 300, // 5 minutes
  enableLocalRelay: false, // Enable when local relay is available
};

// In-memory cache (client-side Redis equivalent)
const memoryCache = new Map<string, { events: NostrEvent[]; expiresAt: number }>();

function getCacheKey(filter: any): string {
  return JSON.stringify({
    kinds: filter.kinds?.sort() || [],
    authors: filter.authors?.sort().slice(0, 5) || [],
    tags: Object.keys(filter).filter((k) => k.startsWith('#')).sort(),
    since: filter.since,
    limit: filter.limit,
  });
}

function getMemoryCache(key: string): NostrEvent[] | null {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  
  if (Date.now() > cached.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  
  return cached.events;
}

function setMemoryCache(key: string, events: NostrEvent[], ttlMs: number): void {
  memoryCache.set(key, {
    events,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Query events with three-tier caching
 */
export async function queryEventsCached(
  filters: any[],
  config: CacheConfig = {},
): Promise<NostrEvent[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const pool = new SimplePool();
  
  try {
    // Step 1: Check memory cache (client-side "Redis")
    const cacheKey = getCacheKey(filters[0]); // Use first filter as cache key
    const memCached = getMemoryCache(cacheKey);
    if (memCached) {
      return memCached;
    }

    // Step 2: Try local relay (if enabled)
    let events: NostrEvent[] = [];
    if (cfg.enableLocalRelay) {
      try {
        const localEvents = await pool.querySync([cfg.localRelayUrl], filters as any);
        events = localEvents as NostrEvent[];
        
        if (events.length > 0) {
          // Cache in memory and return
          setMemoryCache(cacheKey, events, cfg.redisTtlSeconds * 1000);
          return events;
        }
      } catch (error) {
        console.warn('Local relay query failed, falling back to remote:', error);
      }
    }

    // Step 3: Query remote relays
    const remoteEvents = await pool.querySync(cfg.sourceRelays, filters as any);
    events = remoteEvents as NostrEvent[];

    // Step 4: Write back to local relay (if enabled)
    if (cfg.enableLocalRelay && events.length > 0) {
      // Fire and forget - don't wait for local relay writes
      Promise.allSettled(
        events.map((evt) => pool.publish([cfg.localRelayUrl], evt as any))
      );
    }

    // Step 5: Cache in memory
    setMemoryCache(cacheKey, events, cfg.redisTtlSeconds * 1000);

    return events;
  } finally {
    pool.close([...cfg.sourceRelays, cfg.localRelayUrl]);
  }
}

/**
 * Subscribe to events with caching
 * 
 * Returns existing cached events immediately, then streams new events.
 */
export function subscribeEventsCached(params: {
  filters: any[];
  onEvent: (event: NostrEvent) => void;
  config?: CacheConfig;
}): () => void {
  const cfg = { ...DEFAULT_CONFIG, ...params.config };
  const pool = new SimplePool();
  const seen = new Set<string>();

  // First, return cached events immediately
  const cacheKey = getCacheKey(params.filters[0]);
  const cached = getMemoryCache(cacheKey);
  if (cached) {
    cached.forEach((evt) => {
      seen.add(evt.id);
      params.onEvent(evt);
    });
  }

  // Then subscribe for new events
  const relays = cfg.enableLocalRelay
    ? [cfg.localRelayUrl, ...cfg.sourceRelays]
    : cfg.sourceRelays;

  const sub = pool.subscribeMany(relays, params.filters as any, {
    onevent(event: NostrEvent) {
      if (seen.has(event.id)) return;
      seen.add(event.id);

      // Write to local relay if enabled
      if (cfg.enableLocalRelay) {
        Promise.allSettled(pool.publish([cfg.localRelayUrl], event as any));
      }

      params.onEvent(event);
    },
  });

  return () => {
    sub.close();
    pool.close(relays);
  };
}

/**
 * Clear all memory cache
 */
export function clearCache(): void {
  memoryCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return {
    entries: memoryCache.size,
    totalEvents: Array.from(memoryCache.values()).reduce(
      (sum, entry) => sum + entry.events.length,
      0
    ),
  };
}
