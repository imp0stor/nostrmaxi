/**
 * Profile Data Hydration
 * 
 * Comprehensive fetching of all user-related events for analytics.
 * Queries multiple relays to build complete dataset.
 */

import { SimplePool } from 'nostr-tools';
import type { NostrEvent } from '../types';

export interface HydrationResult {
  profiles: NostrEvent[]; // kind 0 (profile metadata history)
  notes: NostrEvent[]; // kind 1 (user's posts)
  contacts: NostrEvent[]; // kind 3 (follow lists)
  reactions: NostrEvent[]; // kind 7 (reactions user received)
  zaps: NostrEvent[]; // kind 9735 (zap receipts user received)
  lists: NostrEvent[]; // kind 30000/30001 (user's lists)
  relays: NostrEvent[]; // kind 10002 (relay list)
  reposts: NostrEvent[]; // kind 6 (reposts of user's content)
  replies: NostrEvent[]; // kind 1 (replies to user's content)
  quotes: NostrEvent[]; // kind 1 with 'q' tag (quotes of user's content)
}

export interface HydrationOptions {
  pubkey: string;
  relays?: string[];
  since?: number; // Unix timestamp, defaults to 21 days ago
  noteLimit?: number; // Max notes to fetch, default 1000
  reactionLimit?: number; // Max reactions to fetch, default 1500
  zapLimit?: number; // Max zaps to fetch, default 1500
}

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.mom',
];

const DAY = 24 * 60 * 60;

/**
 * Hydrate comprehensive profile data from relays
 * 
 * Fetches ALL relevant events for a user profile to enable accurate analytics.
 * Queries are batched and parallelized for performance.
 */
export async function hydrateUserProfile(options: HydrationOptions): Promise<HydrationResult> {
  const {
    pubkey,
    relays = DEFAULT_RELAYS,
    since = Math.floor(Date.now() / 1000) - (21 * DAY),
    noteLimit = 1000,
    reactionLimit = 1500,
    zapLimit = 1500,
  } = options;

  const pool = new SimplePool();

  try {
    // Batch 1: User's own content (authored by user)
    const [profiles, notes, contacts, lists, relayList] = await Promise.all([
      // Profile history (kind 0) - all versions
      pool.querySync(relays, {
        kinds: [0],
        authors: [pubkey],
        limit: 50, // Keep recent profile changes
      } as any),

      // User's notes (kind 1)
      pool.querySync(relays, {
        kinds: [1],
        authors: [pubkey],
        since,
        limit: noteLimit,
      } as any),

      // Follow lists (kind 3) - get latest
      pool.querySync(relays, {
        kinds: [3],
        authors: [pubkey],
        limit: 5, // Recent follow list changes
      } as any),

      // User's lists (kind 30000/30001)
      pool.querySync(relays, {
        kinds: [30000, 30001],
        authors: [pubkey],
        limit: 100,
      } as any),

      // Relay list (kind 10002)
      pool.querySync(relays, {
        kinds: [10002],
        authors: [pubkey],
        limit: 5,
      } as any),
    ]);

    // Batch 2: Engagement user received (tagged with user's pubkey or event ids)
    const noteIds = notes.map((n: NostrEvent) => n.id);
    
    // Split noteIds into chunks to avoid oversized queries
    const NOTE_CHUNK_SIZE = 200;
    const noteIdChunks: string[][] = [];
    for (let i = 0; i < noteIds.length; i += NOTE_CHUNK_SIZE) {
      noteIdChunks.push(noteIds.slice(i, i + NOTE_CHUNK_SIZE));
    }

    // Query engagement in parallel batches
    const engagementBatches = await Promise.all([
      // Reactions to user's notes
      ...noteIdChunks.map((chunk) =>
        pool.querySync(relays, {
          kinds: [7],
          '#e': chunk,
          since,
          limit: Math.ceil(reactionLimit / noteIdChunks.length),
        } as any)
      ),

      // Reactions to user's profile (tagged with #p)
      pool.querySync(relays, {
        kinds: [7],
        '#p': [pubkey],
        since,
        limit: reactionLimit,
      } as any),

      // Zaps to user's notes
      ...noteIdChunks.map((chunk) =>
        pool.querySync(relays, {
          kinds: [9735],
          '#e': chunk,
          since,
          limit: Math.ceil(zapLimit / noteIdChunks.length),
        } as any)
      ),

      // Zaps to user's profile
      pool.querySync(relays, {
        kinds: [9735],
        '#p': [pubkey],
        since,
        limit: zapLimit,
      } as any),

      // Reposts of user's notes
      ...noteIdChunks.map((chunk) =>
        pool.querySync(relays, {
          kinds: [6],
          '#e': chunk,
          since,
          limit: 200,
        } as any)
      ),

      // Replies to user's notes (kind 1 with 'e' tag)
      ...noteIdChunks.map((chunk) =>
        pool.querySync(relays, {
          kinds: [1],
          '#e': chunk,
          since,
          limit: 300,
        } as any)
      ),

      // Quotes of user's notes (kind 1 with 'q' tag)
      ...noteIdChunks.map((chunk) =>
        pool.querySync(relays, {
          kinds: [1],
          '#q': chunk,
          since,
          limit: 200,
        } as any)
      ),
    ]);

    // Flatten and dedupe
    const allEngagement = engagementBatches.flat();
    const seen = new Set<string>();
    const reactions: NostrEvent[] = [];
    const zaps: NostrEvent[] = [];
    const reposts: NostrEvent[] = [];
    const replies: NostrEvent[] = [];
    const quotes: NostrEvent[] = [];

    for (const evt of allEngagement) {
      if (seen.has(evt.id)) continue;
      seen.add(evt.id);

      const nostrEvt = evt as NostrEvent;
      if (nostrEvt.kind === 7) reactions.push(nostrEvt);
      else if (nostrEvt.kind === 9735) zaps.push(nostrEvt);
      else if (nostrEvt.kind === 6) reposts.push(nostrEvt);
      else if (nostrEvt.kind === 1) {
        const hasQuote = nostrEvt.tags.some((t) => t[0] === 'q');
        if (hasQuote) quotes.push(nostrEvt);
        else replies.push(nostrEvt);
      }
    }

    return {
      profiles: profiles as NostrEvent[],
      notes: notes as NostrEvent[],
      contacts: contacts as NostrEvent[],
      reactions,
      zaps,
      lists: lists as NostrEvent[],
      relays: relayList as NostrEvent[],
      reposts,
      replies,
      quotes,
    };
  } finally {
    pool.close(relays);
  }
}

/**
 * Cache hydration results locally (optional)
 * 
 * Store hydrated data in localStorage with TTL for faster subsequent loads.
 */
export function cacheHydrationResult(pubkey: string, result: HydrationResult, ttlSeconds: number = 300): void {
  if (typeof window === 'undefined') return;
  
  try {
    const cached = {
      ...result,
      cachedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    window.localStorage.setItem(`nostrmaxi.hydration.${pubkey}`, JSON.stringify(cached));
  } catch {
    // Storage full or unavailable - best effort
  }
}

/**
 * Get cached hydration result if still valid
 */
export function getCachedHydrationResult(pubkey: string): HydrationResult | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(`nostrmaxi.hydration.${pubkey}`);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);
    
    if (cached.expiresAt && cached.expiresAt < now) {
      // Expired - remove it
      window.localStorage.removeItem(`nostrmaxi.hydration.${pubkey}`);
      return null;
    }

    // Remove cache metadata before returning
    delete cached.cachedAt;
    delete cached.expiresAt;
    return cached as HydrationResult;
  } catch {
    return null;
  }
}

/**
 * Hydrate with cache fallback
 * 
 * Tries cache first, falls back to network fetch.
 * Automatically caches fresh results.
 */
export async function hydrateUserProfileCached(options: HydrationOptions): Promise<HydrationResult> {
  // Try cache first
  const cached = getCachedHydrationResult(options.pubkey);
  if (cached) {
    return cached;
  }

  // Fetch fresh
  const result = await hydrateUserProfile(options);
  
  // Cache for 5 minutes
  cacheHydrationResult(options.pubkey, result, 300);
  
  return result;
}
