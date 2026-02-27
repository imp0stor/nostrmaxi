import { SimplePool } from 'nostr-tools';
import type { NostrProfile } from '../types';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
];

const PROFILE_TTL_MS = 10 * 60 * 1000;

type CacheEntry = {
  profile: NostrProfile | null;
  expiresAt: number;
};

const profileCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<NostrProfile | null>>();

function isValidDomain(domain: string): boolean {
  if (!domain || domain.includes(' ')) return false;
  if (!domain.includes('.')) return false;

  // RFC-compatible-enough domain validation for NIP-05 lookups.
  // Requires at least one dot and valid DNS labels.
  return /^(?=.{1,253}$)(?!.*\.\.)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9-]{2,63}$/.test(domain);
}

export function isValidNip05(value?: string | null): boolean {
  if (!value) return false;

  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(' ')) return false;

  if (trimmed.includes('@')) {
    const parts = trimmed.split('@');
    if (parts.length !== 2) return false;
    const [name, domain] = parts;
    if (!name) return false;
    return isValidDomain(domain);
  }

  // Root-domain format per NIP-05, equivalent to _@domain.tld.
  return isValidDomain(trimmed);
}

function normalizeProfile(profile: NostrProfile | null): NostrProfile | null {
  if (!profile) return null;
  const normalized = { ...profile };
  if (!isValidNip05(normalized.nip05)) {
    delete (normalized as any).nip05;
  }
  return normalized;
}

function isFresh(entry: CacheEntry | undefined): boolean {
  return Boolean(entry && entry.expiresAt > Date.now());
}

function setCache(pubkey: string, profile: NostrProfile | null): NostrProfile | null {
  const normalizedProfile = normalizeProfile(profile);
  profileCache.set(pubkey, {
    profile: normalizedProfile,
    expiresAt: Date.now() + PROFILE_TTL_MS,
  });
  return normalizedProfile;
}

export function getCachedProfile(pubkey: string): NostrProfile | null | undefined {
  const entry = profileCache.get(pubkey);
  if (!isFresh(entry)) return undefined;
  return entry?.profile;
}

export async function fetchProfileCached(pubkey: string, relays: string[] = DEFAULT_RELAYS): Promise<NostrProfile | null> {
  const cached = getCachedProfile(pubkey);
  if (cached !== undefined) {
    if (typeof console !== 'undefined') {
      console.info('[profileCache] cache hit', {
        pubkey,
        hasProfile: Boolean(cached),
        nip05: cached?.nip05 ?? null,
        nip05Valid: isValidNip05(cached?.nip05),
      });
    }
    return cached;
  }

  const existing = inflight.get(pubkey);
  if (existing) {
    if (typeof console !== 'undefined') {
      console.info('[profileCache] inflight hit', { pubkey });
    }
    return existing;
  }

  if (typeof console !== 'undefined') {
    console.info('[profileCache] cache miss; fetching from relays', { pubkey, relays });
  }

  const task = (async () => {
    const pool = new SimplePool();
    try {
      const event = await pool.get(relays, { kinds: [0], authors: [pubkey] });
      if (!event) {
        if (typeof console !== 'undefined') {
          console.info('[profileCache] no kind:0 event found', { pubkey });
        }
        return setCache(pubkey, null);
      }
      try {
        const parsed = JSON.parse(event.content) as NostrProfile;
        const normalized = setCache(pubkey, parsed);
        if (typeof console !== 'undefined') {
          console.info('[profileCache] fetched profile', {
            pubkey,
            eventId: event.id,
            createdAt: event.created_at,
            rawNip05: parsed?.nip05 ?? null,
            normalizedNip05: normalized?.nip05 ?? null,
            nip05Valid: isValidNip05(parsed?.nip05),
          });
        }
        return normalized;
      } catch {
        if (typeof console !== 'undefined') {
          console.warn('[profileCache] failed to parse kind:0 content', { pubkey, eventId: event.id });
        }
        return setCache(pubkey, null);
      }
    } finally {
      pool.close(relays);
      inflight.delete(pubkey);
    }
  })();

  inflight.set(pubkey, task);
  return task;
}

export async function fetchProfilesBatchCached(pubkeys: string[], relays: string[] = DEFAULT_RELAYS): Promise<Map<string, NostrProfile | null>> {
  const uniquePubkeys = [...new Set(pubkeys.filter(Boolean))];
  const result = new Map<string, NostrProfile | null>();

  const toFetch: string[] = [];
  for (const pubkey of uniquePubkeys) {
    const cached = getCachedProfile(pubkey);
    if (cached !== undefined) result.set(pubkey, cached);
    else toFetch.push(pubkey);
  }

  if (toFetch.length > 0) {
    const pool = new SimplePool();
    try {
      const events = await pool.querySync(relays, { kinds: [0], authors: toFetch, limit: Math.max(250, toFetch.length * 2) });
      const latest = new Map<string, { created_at: number; content: string }>();

      for (const event of events) {
        const prev = latest.get(event.pubkey);
        if (!prev || event.created_at > prev.created_at) {
          latest.set(event.pubkey, { created_at: event.created_at, content: event.content });
        }
      }

      for (const pubkey of toFetch) {
        const data = latest.get(pubkey);
        if (!data) {
          result.set(pubkey, setCache(pubkey, null));
          continue;
        }

        try {
          result.set(pubkey, setCache(pubkey, JSON.parse(data.content) as NostrProfile));
        } catch {
          result.set(pubkey, setCache(pubkey, null));
        }
      }
    } finally {
      pool.close(relays);
    }
  }

  return result;
}

export function profileDisplayName(pubkey: string, profile?: NostrProfile | null): string {
  return (isValidNip05(profile?.nip05) ? profile?.nip05 : undefined) || profile?.display_name || profile?.name || `${pubkey.slice(0, 8)}…${pubkey.slice(-8)}`;
}

export function invalidateProfileCache(pubkey?: string): void {
  if (pubkey) {
    profileCache.delete(pubkey);
    inflight.delete(pubkey);
    return;
  }
  profileCache.clear();
  inflight.clear();
}
