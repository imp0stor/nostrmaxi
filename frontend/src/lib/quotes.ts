import { SimplePool, nip19 } from 'nostr-tools';
import type { NostrEvent, NostrProfile } from '../types';
import { isValidNip05 } from './profileCache';

const LOCAL_RELAY = 'ws://10.1.10.143:7777';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://offchain.pub',
  'wss://purplepag.es',
  'wss://nostr.wine',
  'wss://relay.nostr.net',
];

const QUOTE_CACHE_KEY = 'nostrmaxi.quotes.cache.v1';
const QUOTE_CACHE_TTL_MS = 30 * 60 * 1000;
const QUOTE_NEGATIVE_CACHE_TTL_MS = 2 * 60 * 1000;
const QUOTE_FETCH_TIMEOUT_MS = 15_000;
const PER_RELAY_TIMEOUT_MS = 8_000;
const LOCAL_RELAY_CHECK_TIMEOUT_MS = 3_000;
const quoteCache = new Map<string, { event: NostrEvent | null; at: number }>();

let localRelayAvailable = true;
let localRelayChecked = false;
let localRelayCheckPromise: Promise<boolean> | null = null;

export interface ResolveQuotedEventsOptions {
  relayHintsById?: Map<string, string[]>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRelayUrl(value: string | undefined): value is string {
  return Boolean(value && /^wss?:\/\//i.test(value));
}

function readQuoteCacheFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(QUOTE_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, { event: NostrEvent | null; at: number }>;
    const now = Date.now();
    for (const [id, entry] of Object.entries(parsed)) {
      if (!entry) continue;
      const ttl = entry.event ? QUOTE_CACHE_TTL_MS : QUOTE_NEGATIVE_CACHE_TTL_MS;
      if ((now - entry.at) > ttl) continue;
      quoteCache.set(id, entry);
    }
  } catch {
    // ignore cache parse failures
  }
}

function persistQuoteCacheToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const out: Record<string, { event: NostrEvent | null; at: number }> = {};
    for (const [id, entry] of quoteCache.entries()) {
      const ttl = entry.event ? QUOTE_CACHE_TTL_MS : QUOTE_NEGATIVE_CACHE_TTL_MS;
      if ((now - entry.at) > ttl) continue;
      out[id] = entry;
    }
    window.localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify(out));
  } catch {
    // ignore storage failures
  }
}

let quoteCacheHydrated = false;
function hydrateQuoteCacheOnce(): void {
  if (quoteCacheHydrated) return;
  quoteCacheHydrated = true;
  readQuoteCacheFromStorage();
}

async function checkLocalRelay(): Promise<boolean> {
  const pool = new SimplePool();
  try {
    await Promise.race([
      pool.querySync([LOCAL_RELAY], { kinds: [0], limit: 1 } as any),
      sleep(LOCAL_RELAY_CHECK_TIMEOUT_MS).then(() => {
        throw new Error('timeout');
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    try {
      pool.close([LOCAL_RELAY]);
    } catch {
      // ignore close failures
    }
  }
}

async function ensureLocalRelayAvailability(): Promise<boolean> {
  if (localRelayChecked) return localRelayAvailable;
  if (!localRelayCheckPromise) {
    localRelayCheckPromise = checkLocalRelay()
      .then((available) => {
        localRelayAvailable = available;
        localRelayChecked = true;
        return available;
      })
      .finally(() => {
        localRelayCheckPromise = null;
      });
  }
  return localRelayCheckPromise;
}

async function queryRelaysParallel(pool: SimplePool, relays: string[], filter: any): Promise<NostrEvent[]> {
  const results: NostrEvent[] = [];
  const seen = new Set<string>();

  await Promise.allSettled(
    relays.map(async (relay) => {
      try {
        const events = await Promise.race([
          pool.querySync([relay], filter),
          sleep(PER_RELAY_TIMEOUT_MS).then(() => [] as any[]),
        ]);

        for (const evt of events as any[]) {
          if (!evt?.id || seen.has(evt.id)) continue;
          seen.add(evt.id);
          results.push(evt as NostrEvent);
        }
      } catch {
        // Individual relay failures should not break quote resolution.
      }
    }),
  );

  return results;
}

export function parseQuotedEventRefs(event: Pick<NostrEvent, 'tags' | 'content'>): string[] {
  const ids = new Set<string>();
  for (const tag of event.tags || []) {
    if (tag[0] === 'e' && tag[1]) ids.add(tag[1]);
  }

  const matches = event.content.match(/nostr:(note1[0-9a-z]+|nevent1[0-9a-z]+)/gi) || [];
  for (const raw of matches) {
    const value = raw.replace(/^nostr:/i, '');
    try {
      const decoded = nip19.decode(value);
      if (decoded.type === 'note') ids.add(decoded.data as string);
      if (decoded.type === 'nevent') {
        const d = decoded.data as any;
        if (d?.id) ids.add(d.id);
      }
    } catch {
      // ignore invalid refs
    }
  }

  return [...ids];
}

function mergeRelayCandidates(
  relays: string[],
  unresolved: string[],
  hints?: Map<string, string[]>,
): string[] {
  const merged: string[] = [];

  for (const id of unresolved) {
    for (const relay of hints?.get(id) || []) {
      if (isRelayUrl(relay) && relay !== LOCAL_RELAY && !merged.includes(relay)) merged.push(relay);
    }
  }

  for (const relay of relays) {
    if (isRelayUrl(relay) && relay !== LOCAL_RELAY && !merged.includes(relay)) merged.push(relay);
  }

  for (const relay of DEFAULT_RELAYS) {
    if (isRelayUrl(relay) && relay !== LOCAL_RELAY && !merged.includes(relay)) merged.push(relay);
  }

  return merged;
}

export async function resolveQuotedEvents(
  ids: string[],
  relays: string[] = DEFAULT_RELAYS,
  options?: ResolveQuotedEventsOptions,
): Promise<Map<string, NostrEvent>> {
  hydrateQuoteCacheOnce();
  const uniq = [...new Set(ids.filter(Boolean))].slice(0, 60);
  if (uniq.length === 0) return new Map();

  const now = Date.now();
  const out = new Map<string, NostrEvent>();
  let unresolved = uniq.filter((id) => {
    const cached = quoteCache.get(id);
    if (!cached) return true;
    const ttl = cached.event ? QUOTE_CACHE_TTL_MS : QUOTE_NEGATIVE_CACHE_TTL_MS;
    if ((now - cached.at) > ttl) return true;
    if (cached.event) out.set(id, cached.event);
    return false;
  });

  if (unresolved.length === 0) return out;

  const pool = new SimplePool();
  try {
    const canUseLocalRelay = await ensureLocalRelayAvailability();

    if (canUseLocalRelay && unresolved.length > 0) {
      const localEvents = await Promise.race([
        pool.querySync([LOCAL_RELAY], {
          kinds: [1, 30023],
          ids: unresolved,
          limit: Math.max(unresolved.length * 2, 20),
        } as any),
        sleep(QUOTE_FETCH_TIMEOUT_MS).then(() => [] as any[]),
      ]);

      const localResolved = new Set<string>();
      for (const evt of localEvents as any[]) {
        const prev = out.get(evt.id);
        if (!prev || evt.created_at > prev.created_at) out.set(evt.id, evt as NostrEvent);
        localResolved.add(evt.id);
        quoteCache.set(evt.id, { event: evt as NostrEvent, at: Date.now() });
      }
      unresolved = unresolved.filter((id) => !localResolved.has(id));
    }

    const attempts = 3;
    for (let attempt = 0; attempt < attempts && unresolved.length > 0; attempt += 1) {
      const relayPool = mergeRelayCandidates(relays, unresolved, options?.relayHintsById);
      if (relayPool.length === 0) break;

      const events = await Promise.race([
        queryRelaysParallel(pool, relayPool, {
          kinds: [1, 30023],
          ids: unresolved,
          limit: Math.max(unresolved.length * 2, 20),
        } as any),
        sleep(QUOTE_FETCH_TIMEOUT_MS).then(() => [] as NostrEvent[]),
      ]);

      const resolved = new Set<string>();
      for (const evt of events) {
        const prev = out.get(evt.id);
        if (!prev || evt.created_at > prev.created_at) out.set(evt.id, evt);
        resolved.add(evt.id);
        quoteCache.set(evt.id, { event: evt, at: Date.now() });

        if (canUseLocalRelay) {
          try {
            void pool.publish([LOCAL_RELAY], evt as any);
          } catch {
            // fire-and-forget sync failures should not block quote resolution
          }
        }
      }

      unresolved = unresolved.filter((id) => !resolved.has(id));
      if (unresolved.length > 0 && attempt < attempts - 1) {
        await sleep(250 * Math.pow(2, attempt));
      }
    }

    for (const id of unresolved) {
      quoteCache.set(id, { event: null, at: Date.now() });
    }
    persistQuoteCacheToStorage();

    return out;
  } finally {
    const relayPool = [LOCAL_RELAY, ...mergeRelayCandidates(relays, uniq, options?.relayHintsById)];
    pool.close(relayPool);
  }
}

export function quotedIdentity(pubkey: string, profile?: NostrProfile | null): string {
  if (isValidNip05(profile?.nip05)) return profile!.nip05!;
  return profile?.display_name || profile?.name || `${pubkey.slice(0, 8)}…${pubkey.slice(-8)}`;
}
