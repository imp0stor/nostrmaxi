import { SimplePool, nip19 } from 'nostr-tools';
import type { NostrEvent, NostrProfile } from '../types';
import { fetchProfileCached, fetchProfilesBatchCached } from './profileCache';
import { applyContentFilters, type ContentFilters } from './contentFilter';
import { getDefaultRelays, getRelaysForUser, FALLBACK_RELAYS } from './relayConfig';

const DEFAULT_RELAYS = getDefaultRelays();

export interface FeedItem extends NostrEvent {
  profile?: NostrProfile;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export async function loadFollowing(pubkey: string, relays: string[] = DEFAULT_RELAYS): Promise<string[]> {
  const pool = new SimplePool();
  try {
    const contacts = await pool.querySync(relays, { kinds: [3], authors: [pubkey], limit: 20 });
    if (contacts.length === 0) return [];
    const latest = contacts.sort((a, b) => b.created_at - a.created_at)[0];
    return unique(latest.tags.filter((t) => t[0] === 'p' && t[1]).map((t) => t[1]));
  } finally {
    pool.close(relays);
  }
}

export interface RelayStatus {
  relay: string;
  ok: boolean;
  error?: string;
}

export type FeedMode = 'firehose' | 'following' | 'wot' | 'high-signal';

export interface FeedDiagnostics {
  mode: FeedMode;
  followingCount: number;
  authorCount: number;
  relayStatuses: RelayStatus[];
  eventCount: number;
  hasMore: boolean;
}

export interface FeedQuery {
  mode: FeedMode;
  cursor?: number;
  limit?: number;
}

export interface FeedResult {
  items: FeedItem[];
  diagnostics: FeedDiagnostics;
  nextCursor?: number;
}

export interface CustomFeedDefinition {
  id: string;
  title: string;
  description?: string;
  hashtags: string[];
  authors: string[];
  includeReplies: boolean;
  sourceEventId?: string;
  ownerPubkey?: string;
}

function parseCustomFeedFromEvent(event: NostrEvent): CustomFeedDefinition | null {
  const dTag = event.tags.find((t) => t[0] === 'd' && t[1]);
  if (!dTag?.[1]) return null;
  const title = event.tags.find((t) => t[0] === 'title' && t[1])?.[1] || dTag[1];
  const description = event.tags.find((t) => t[0] === 'description' && t[1])?.[1] || '';
  const hashtags = unique(event.tags.filter((t) => t[0] === 't' && t[1]).map((t) => t[1].toLowerCase()));
  const authors = unique(event.tags.filter((t) => t[0] === 'p' && t[1]).map((t) => t[1]));
  const includeReplies = !event.tags.some((t) => t[0] === 'include' && t[1] === 'no-replies');
  return {
    id: dTag[1],
    title,
    description,
    hashtags,
    authors,
    includeReplies,
    sourceEventId: event.id,
    ownerPubkey: event.pubkey,
  };
}

async function checkRelayStatuses(relays: string[]): Promise<RelayStatus[]> {
  const pool = new SimplePool();
  try {
    return await Promise.all(relays.map(async (relay) => {
      try {
        await pool.get([relay], { kinds: [1], limit: 1 });
        return { relay, ok: true };
      } catch (error) {
        return {
          relay,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }));
  } finally {
    pool.close(relays);
  }
}

const FEED_KINDS = [1, 30023, 30311, 30017, 30018, 9735];

function applyMuteFilterForFeed(items: FeedItem[], contentFilters?: ContentFilters): FeedItem[] {
  if (!contentFilters) return items;
  return applyContentFilters(items, contentFilters);
}

export function findNextCursor(items: NostrEvent[]): number | undefined {
  if (items.length === 0) return undefined;
  return Math.min(...items.map((item) => item.created_at)) - 1;
}

export function scoreWotEvent(event: NostrEvent, followingSet: Set<string>, secondHopSet: Set<string>): number {
  if (followingSet.has(event.pubkey)) return 2;
  if (secondHopSet.has(event.pubkey)) return 1;
  return 0.25;
}

export function interactionScoreForEvent(event: NostrEvent, interactions: NostrEvent[]): number {
  let score = 0;
  for (const interaction of interactions) {
    const eTags = interaction.tags.filter((tag) => tag[0] === 'e').map((tag) => tag[1]);
    if (!eTags.includes(event.id)) continue;
    if (interaction.kind === 9735) score += 3;
    else if (interaction.kind === 6) score += 2;
    else if (interaction.kind === 7) score += 1;
    else if (interaction.kind === 1) score += 1;
  }
  return score;
}

export async function loadFeedWithDiagnostics(pubkey: string, query: FeedQuery, relays: string[] = DEFAULT_RELAYS, contentFilters?: ContentFilters): Promise<FeedResult> {
  const pool = new SimplePool();
  try {
    const limit = Math.min(100, Math.max(15, query.limit ?? 25));
    const overscan = limit * 2;
    const now = Math.floor(Date.now() / 1000);
    const until = query.cursor ?? now;
    const following = await loadFollowing(pubkey, relays);
    const followingSet = new Set(following);
    const followingAuthors = unique([pubkey, ...following]).slice(0, 200);
    let events: NostrEvent[] = [];

    if (query.mode === 'firehose') {
      events = await pool.querySync(relays, { kinds: FEED_KINDS, limit: overscan, until });
      events = events.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
    } else if (query.mode === 'following') {
      events = followingAuthors.length > 0
        ? await pool.querySync(relays, { kinds: FEED_KINDS, authors: followingAuthors, limit: overscan, until })
        : [];
      events = events.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
    } else if (query.mode === 'wot') {
      const seeds = following.slice(0, 60);
      const secondHopContacts = seeds.length > 0
        ? await pool.querySync(relays, { kinds: [3], authors: seeds, limit: 400 })
        : [];
      const secondHopSet = new Set<string>();
      for (const evt of secondHopContacts) {
        for (const tag of evt.tags) {
          if (tag[0] === 'p' && tag[1] && !followingSet.has(tag[1]) && tag[1] !== pubkey) secondHopSet.add(tag[1]);
        }
      }

      const wotAuthors = unique([pubkey, ...following, ...Array.from(secondHopSet)]).slice(0, 260);
      events = wotAuthors.length > 0
        ? await pool.querySync(relays, { kinds: FEED_KINDS, authors: wotAuthors, limit: overscan * 2, until })
        : [];

      events = events
        .map((event) => ({ event, score: scoreWotEvent(event, followingSet, secondHopSet) }))
        .sort((a, b) => b.score - a.score || b.event.created_at - a.event.created_at)
        .slice(0, limit)
        .map((entry) => entry.event);
    } else {
      const baseEvents = await pool.querySync(relays, { kinds: FEED_KINDS, limit: overscan, until });
      const eventIds = baseEvents.map((event) => event.id);
      const interactions = eventIds.length > 0
        ? await pool.querySync(relays, { kinds: [7, 6, 9735, 1], '#e': eventIds.slice(0, 120), limit: 1000 } as any)
        : [];

      events = baseEvents
        .map((event) => ({ event, score: interactionScoreForEvent(event, interactions) }))
        .sort((a, b) => b.score - a.score || b.event.created_at - a.event.created_at)
        .slice(0, limit)
        .map((entry) => entry.event);
    }

    const profileAuthors = unique(events.map((e) => e.pubkey));
    const profiles = profileAuthors.length > 0
      ? await fetchProfilesBatchCached(profileAuthors, relays)
      : new Map<string, NostrProfile | null>();

    const items = events.map((event) => ({ ...event, profile: profiles.get(event.pubkey) || undefined }));
    const filteredItems = applyMuteFilterForFeed(items, contentFilters);
    const relayStatuses = await checkRelayStatuses(relays);
    const nextCursor = findNextCursor(events);

    return {
      items: filteredItems,
      nextCursor,
      diagnostics: {
        mode: query.mode,
        followingCount: following.length,
        authorCount: query.mode === 'firehose' ? 0 : followingAuthors.length,
        relayStatuses,
        eventCount: filteredItems.length,
        hasMore: items.length >= limit,
      },
    };
  } finally {
    pool.close(relays);
  }
}

export async function loadFeed(pubkey: string, relays: string[] = DEFAULT_RELAYS, contentFilters?: ContentFilters): Promise<FeedItem[]> {
  const result = await loadFeedWithDiagnostics(pubkey, { mode: 'following', limit: 30 }, relays, contentFilters);
  return result.items;
}

export async function loadProfileActivity(pubkey: string, relays?: string[], contentFilters?: ContentFilters): Promise<FeedItem[]> {
  const pool = new SimplePool();
  try {
    // Use user's configured relays if none provided
    const effectiveRelays = relays || await getRelaysForUser(pubkey, pool);
    console.log('[loadProfileActivity] using relays:', effectiveRelays.slice(0, 4));
    const events = await pool.querySync(effectiveRelays, { kinds: [1], authors: [pubkey], limit: 40 });
    console.log('[loadProfileActivity] fetched', events.length, 'events');
    const profile = await fetchProfileCached(pubkey, effectiveRelays) || undefined;
    const items = events
      .sort((a, b) => b.created_at - a.created_at)
      .map((event) => ({ ...event, profile }));
    return applyMuteFilterForFeed(items, contentFilters);
  } finally {
    pool.close(FALLBACK_RELAYS);
  }
}

export async function loadFollowers(pubkey: string, relays: string[] = DEFAULT_RELAYS): Promise<string[]> {
  const pool = new SimplePool();
  try {
    const contactEvents = await pool.querySync(relays, {
      kinds: [3],
      '#p': [pubkey],
      limit: 500,
    } as any);
    return unique(contactEvents.map((e) => e.pubkey));
  } finally {
    pool.close(relays);
  }
}

export async function followPubkey(currentPubkey: string, targetPubkey: string, signEventFn: (evt: Omit<NostrEvent, 'id' | 'sig'>) => Promise<NostrEvent | null>, publishFn: (evt: NostrEvent) => Promise<any>, relays: string[] = DEFAULT_RELAYS): Promise<boolean> {
  const existing = await loadFollowing(currentPubkey, relays);
  const next = unique([...existing, targetPubkey]);
  const unsigned = {
    kind: 3,
    content: '',
    tags: next.map((pk) => ['p', pk]),
    pubkey: currentPubkey,
    created_at: Math.floor(Date.now() / 1000),
  };
  const signed = await signEventFn(unsigned);
  if (!signed) return false;
  const result = await publishFn(signed);
  return Boolean(result?.success);
}

export async function unfollowPubkey(currentPubkey: string, targetPubkey: string, signEventFn: (evt: Omit<NostrEvent, 'id' | 'sig'>) => Promise<NostrEvent | null>, publishFn: (evt: NostrEvent) => Promise<any>, relays: string[] = DEFAULT_RELAYS): Promise<boolean> {
  const existing = await loadFollowing(currentPubkey, relays);
  const next = existing.filter((pk) => pk !== targetPubkey);
  const unsigned = {
    kind: 3,
    content: '',
    tags: next.map((pk) => ['p', pk]),
    pubkey: currentPubkey,
    created_at: Math.floor(Date.now() / 1000),
  };
  const signed = await signEventFn(unsigned);
  if (!signed) return false;
  const result = await publishFn(signed);
  return Boolean(result?.success);
}

export interface ContactGraphStats {
  followers: number;
  following: number;
}

const contactGraphCache = new Map<string, { at: number; stats: ContactGraphStats }>();
const CONTACT_GRAPH_TTL_MS = 2 * 60 * 1000;

export async function loadContactGraphStats(pubkeys: string[], relays: string[] = DEFAULT_RELAYS): Promise<Map<string, ContactGraphStats>> {
  const uniquePubkeys = unique(pubkeys.filter(Boolean));
  const now = Date.now();
  const result = new Map<string, ContactGraphStats>();
  const toFetch: string[] = [];

  for (const pubkey of uniquePubkeys) {
    const cached = contactGraphCache.get(pubkey);
    if (cached && (now - cached.at) < CONTACT_GRAPH_TTL_MS) {
      result.set(pubkey, cached.stats);
    } else {
      toFetch.push(pubkey);
    }
  }

  if (toFetch.length === 0) return result;

  const pool = new SimplePool();
  try {
    const [followingEvents, followerEvents] = await Promise.all([
      pool.querySync(relays, { kinds: [3], authors: toFetch, limit: Math.max(400, toFetch.length * 4) }),
      pool.querySync(relays, { kinds: [3], '#p': toFetch, limit: 2500 } as any),
    ]);

    const latestByAuthor = new Map<string, any>();
    for (const evt of followingEvents) {
      const prev = latestByAuthor.get(evt.pubkey);
      if (!prev || evt.created_at > prev.created_at) latestByAuthor.set(evt.pubkey, evt);
    }

    const followingCounts = new Map<string, number>();
    for (const pubkey of toFetch) {
      const evt = latestByAuthor.get(pubkey);
      const count = evt ? unique(evt.tags.filter((t: string[]) => t[0] === 'p' && t[1]).map((t: string[]) => t[1])).length : 0;
      followingCounts.set(pubkey, count);
    }

    const followerSets = new Map<string, Set<string>>();
    for (const evt of followerEvents) {
      for (const tag of evt.tags || []) {
        if (tag[0] !== 'p' || !tag[1] || !toFetch.includes(tag[1])) continue;
        const set = followerSets.get(tag[1]) || new Set<string>();
        set.add(evt.pubkey);
        followerSets.set(tag[1], set);
      }
    }

    for (const pubkey of toFetch) {
      const stats = {
        followers: followerSets.get(pubkey)?.size || 0,
        following: followingCounts.get(pubkey) || 0,
      };
      contactGraphCache.set(pubkey, { at: now, stats });
      result.set(pubkey, stats);
    }

    return result;
  } finally {
    pool.close(relays);
  }
}

export async function publishKind1(content: string, pubkey: string, signEventFn: (evt: Omit<NostrEvent, 'id' | 'sig'>) => Promise<NostrEvent | null>, publishFn: (evt: NostrEvent) => Promise<any>): Promise<boolean> {
  const unsigned = {
    kind: 1,
    content,
    tags: [],
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
  };
  const signed = await signEventFn(unsigned);
  if (!signed) return false;
  const result = await publishFn(signed);
  return Boolean(result?.success);
}

export async function reactToEvent(kind: 'like' | 'repost' | 'reply', source: FeedItem, pubkey: string, content: string, signEventFn: (evt: Omit<NostrEvent, 'id' | 'sig'>) => Promise<NostrEvent | null>, publishFn: (evt: NostrEvent) => Promise<any>): Promise<boolean> {
  if (kind === 'like') {
    const signed = await signEventFn({
      kind: 7,
      content: '+',
      tags: [['e', source.id], ['p', source.pubkey]],
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
    });
    if (!signed) return false;
    return Boolean((await publishFn(signed))?.success);
  }

  if (kind === 'repost') {
    const signed = await signEventFn({
      kind: 6,
      content: JSON.stringify(source),
      tags: [['e', source.id], ['p', source.pubkey]],
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
    });
    if (!signed) return false;
    return Boolean((await publishFn(signed))?.success);
  }

  const signed = await signEventFn({
    kind: 1,
    content,
    tags: [['e', source.id], ['p', source.pubkey]],
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
  });
  if (!signed) return false;
  return Boolean((await publishFn(signed))?.success);
}

export function toNpub(pubkey: string): string {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
}

export interface DiscoverUser {
  pubkey: string;
  followers: number;
  followerCount?: number;
  followers_count?: number;
  follower_count?: number;
  following: number;
  followingCount?: number;
  followings?: number;
  followings_count?: number;
  following_count?: number;
  activity: number;
  freshnessScore: number;
  overlapScore: number;
  secondHopCount: number;
  wotFollowerCount: number;
  proximityScore: number;
  interactionScore: number;
  relayAffinityScore: number;
  forYouScore: number;
  wotScore: number;
  score: number;
  verifiedNip05: boolean;
}

export interface DiscoverPools {
  blended: DiscoverUser[];
  wot: DiscoverUser[];
  general: DiscoverUser[];
}

const discoverCache = new Map<string, { at: number; data: DiscoverPools }>();
const DISCOVER_CACHE_TTL_MS = 5 * 60 * 1000;

function normalized(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, value / max);
}

export async function loadCuratedDiscoverUsers(pubkey: string, relays: string[] = DEFAULT_RELAYS): Promise<DiscoverPools> {
  const cached = discoverCache.get(pubkey);
  if (cached && Date.now() - cached.at < DISCOVER_CACHE_TTL_MS) return cached.data;

  const pool = new SimplePool();
  try {
    const now = Math.floor(Date.now() / 1000);
    const since = now - (7 * 24 * 60 * 60);

    const userFollowing = await loadFollowing(pubkey, relays);
    const followingSet = new Set(userFollowing);
    const wotSeeds = unique(userFollowing.slice(0, 35));

    const [noteEvents, contactEvents, wotContacts] = await Promise.all([
      pool.querySync(relays, { kinds: [1], limit: 1200, since }),
      pool.querySync(relays, { kinds: [3], limit: 1000 }),
      wotSeeds.length > 0
        ? pool.querySync(relays, { kinds: [3], authors: wotSeeds, limit: 600 })
        : Promise.resolve([] as NostrEvent[]),
    ]);

    const activityMap = new Map<string, number>();
    const latestActivityMap = new Map<string, number>();
    for (const evt of noteEvents) {
      activityMap.set(evt.pubkey, (activityMap.get(evt.pubkey) || 0) + 1);
      const prev = latestActivityMap.get(evt.pubkey) || 0;
      if (evt.created_at > prev) latestActivityMap.set(evt.pubkey, evt.created_at);
    }

    const followerMap = new Map<string, number>();
    const followingMap = new Map<string, number>();
    for (const evt of contactEvents) {
      const follows = evt.tags.filter((t) => t[0] === 'p' && t[1]);
      followingMap.set(evt.pubkey, follows.length);
      for (const tag of follows) {
        const target = tag[1];
        followerMap.set(target, (followerMap.get(target) || 0) + 1);
      }
    }

    const wotFollowerMap = new Map<string, number>();
    const overlapMap = new Map<string, number>();
    const secondHopMap = new Map<string, number>();
    for (const evt of wotContacts) {
      const follows = evt.tags.filter((t) => t[0] === 'p' && t[1]).map((t) => t[1]);
      for (const target of follows) {
        wotFollowerMap.set(target, (wotFollowerMap.get(target) || 0) + 1);
      }
      for (const target of follows) {
        if (!followingSet.has(target)) overlapMap.set(target, (overlapMap.get(target) || 0) + 1);
        secondHopMap.set(target, (secondHopMap.get(target) || 0) + 1);
      }
    }

    const interactionMap = new Map<string, number>();
    const relayAffinityMap = new Map<string, number>();
    const networkAuthors = new Set([...userFollowing, pubkey]);
    for (const evt of noteEvents) {
      if (!networkAuthors.has(evt.pubkey)) continue;
      const mentionTags = evt.tags.filter((t) => t[0] === 'p' && t[1]).map((t) => t[1]);
      for (const target of mentionTags) {
        interactionMap.set(target, (interactionMap.get(target) || 0) + 1);
      }
      const relayTagCount = evt.tags.filter((t) => t[0] === 'relay' && t[1]).length;
      for (const target of mentionTags) {
        relayAffinityMap.set(target, (relayAffinityMap.get(target) || 0) + relayTagCount);
      }
    }

    const generalCandidates = new Set<string>();
    [...activityMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 240).forEach(([pk]) => generalCandidates.add(pk));
    [...followerMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 240).forEach(([pk]) => generalCandidates.add(pk));

    const wotCandidates = new Set<string>();
    [...wotFollowerMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 260).forEach(([pk]) => wotCandidates.add(pk));

    for (const pk of [pubkey, ...userFollowing]) {
      generalCandidates.delete(pk);
      wotCandidates.delete(pk);
    }

    const universe = unique([...generalCandidates, ...wotCandidates])
      .filter((pk) => !followingSet.has(pk) && pk !== pubkey)
      .slice(0, 320);
    if (universe.length === 0) {
      const empty = { blended: [], wot: [], general: [] };
      discoverCache.set(pubkey, { at: Date.now(), data: empty });
      return empty;
    }

    const profiles = await fetchProfilesBatchCached(universe, relays);
    const universeSet = new Set(universe);
    const followerEvents = await pool.querySync(relays, { kinds: [3], '#p': universe.slice(0, 250), limit: 2500 } as any);
    const preciseFollowerMap = new Map<string, Set<string>>();
    for (const evt of followerEvents) {
      for (const tag of evt.tags) {
        if (tag[0] !== 'p' || !tag[1] || !universeSet.has(tag[1])) continue;
        if (!preciseFollowerMap.has(tag[1])) preciseFollowerMap.set(tag[1], new Set());
        preciseFollowerMap.get(tag[1])!.add(evt.pubkey);
      }
    }

    const maxWot = Math.max(1, ...universe.map((pk) => wotFollowerMap.get(pk) || 0));
    const maxOverlap = Math.max(1, ...universe.map((pk) => overlapMap.get(pk) || 0));
    const maxActivity = Math.max(1, ...universe.map((pk) => activityMap.get(pk) || 0));
    const maxSecondHop = Math.max(1, ...universe.map((pk) => secondHopMap.get(pk) || 0));
    const maxInteraction = Math.max(1, ...universe.map((pk) => interactionMap.get(pk) || 0));
    const maxRelayAffinity = Math.max(1, ...universe.map((pk) => relayAffinityMap.get(pk) || 0));
    const maxFollowers = Math.max(1, ...universe.map((pk) => preciseFollowerMap.get(pk)?.size ?? followerMap.get(pk) ?? 0));

    const oneWeekSeconds = 7 * 24 * 60 * 60;

    const users = universe.map((pk) => {
      const profile = profiles.get(pk);
      const verifiedNip05 = Boolean(profile?.nip05 && profile.nip05.includes('@'));
      const wotFollowerCount = wotFollowerMap.get(pk) || 0;
      const mutualFollowCount = overlapMap.get(pk) || 0;
      const secondHopCount = secondHopMap.get(pk) || 0;
      const activity = activityMap.get(pk) || 0;
      const proximityScore = (0.6 * normalized(mutualFollowCount, maxOverlap)) + (0.4 * normalized(secondHopCount, maxSecondHop));
      const interactionScore = normalized(interactionMap.get(pk) || 0, maxInteraction);
      const relayAffinityScore = normalized(relayAffinityMap.get(pk) || 0, maxRelayAffinity);

      const followerCount = preciseFollowerMap.get(pk)?.size ?? followerMap.get(pk) ?? 0;
      const followingCount = followingMap.get(pk) || 0;
      const freshnessSeconds = Math.max(0, now - (latestActivityMap.get(pk) || 0));
      const freshnessScore = Math.max(0, 1 - Math.min(1, freshnessSeconds / oneWeekSeconds));
      const forYouScore =
        (0.40 * normalized(followerCount, maxFollowers)) +
        (0.25 * normalized(activity, maxActivity)) +
        (0.20 * freshnessScore) +
        (0.15 * (verifiedNip05 ? 1 : 0));
      const wotScore =
        (0.40 * proximityScore) +
        (0.25 * interactionScore) +
        (0.20 * relayAffinityScore) +
        (0.15 * normalized(wotFollowerCount, maxWot));
      const score = (forYouScore + wotScore) / 2;

      return {
        pubkey: pk,
        followers: followerCount,
        followerCount,
        followers_count: followerCount,
        follower_count: followerCount,
        following: followingCount,
        followingCount,
        followings: followingCount,
        followings_count: followingCount,
        following_count: followingCount,
        activity,
        freshnessScore,
        overlapScore: mutualFollowCount,
        secondHopCount,
        wotFollowerCount,
        proximityScore,
        interactionScore,
        relayAffinityScore,
        forYouScore,
        wotScore,
        score,
        verifiedNip05,
      };
    }).filter((u) => u.followers > 0 || u.activity > 0 || u.wotFollowerCount > 0);

    const general = users
      .filter((u) => generalCandidates.has(u.pubkey))
      .sort((a, b) => b.forYouScore - a.forYouScore || b.followers - a.followers)
      .slice(0, 100);

    const wot = users
      .filter((u) => wotCandidates.has(u.pubkey))
      .sort((a, b) => b.wotScore - a.wotScore || b.overlapScore - a.overlapScore)
      .slice(0, 100);

    const blended = unique([...general.map((u) => u.pubkey), ...wot.map((u) => u.pubkey)])
      .map((pk) => users.find((u) => u.pubkey === pk))
      .filter((u) => Boolean(u)) as DiscoverUser[];

    blended.sort((a, b) => b.forYouScore - a.forYouScore || b.followers - a.followers);

    const data = {
      blended: blended.length > 0 ? blended : general,
      wot,
      general,
    };
    discoverCache.set(pubkey, { at: Date.now(), data });
    return data;
  } catch {
    const fallback = discoverCache.get(pubkey)?.data || { blended: [], wot: [], general: [] };
    return fallback;
  } finally {
    pool.close(relays);
  }
}

export interface NetworkPost {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  proximityScore: number;
  interactionScore: number;
}

export async function loadNetworkPosts(pubkey: string, relays: string[] = DEFAULT_RELAYS): Promise<NetworkPost[]> {
  const pool = new SimplePool();
  try {
    const following = await loadFollowing(pubkey, relays);
    const authors = unique([...following, pubkey]).slice(0, 120);
    if (authors.length === 0) return [];
    const since = Math.floor(Date.now() / 1000) - (3 * 24 * 60 * 60);
    const events = await pool.querySync(relays, { kinds: [1], authors, limit: 400, since });
    const interactionByAuthor = new Map<string, number>();
    for (const evt of events) {
      for (const tag of evt.tags) {
        if (tag[0] === 'p' && tag[1]) interactionByAuthor.set(tag[1], (interactionByAuthor.get(tag[1]) || 0) + 1);
      }
    }
    const maxInteractions = Math.max(1, ...[...interactionByAuthor.values(), 1]);
    return events
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 80)
      .map((evt) => ({
        id: evt.id,
        pubkey: evt.pubkey,
        content: evt.content,
        created_at: evt.created_at,
        proximityScore: following.includes(evt.pubkey) ? 1 : 0.4,
        interactionScore: (interactionByAuthor.get(evt.pubkey) || 0) / maxInteractions,
      }));
  } finally {
    pool.close(relays);
  }
}

export async function loadSuggestedTopics(pubkey: string, relays: string[] = DEFAULT_RELAYS): Promise<Record<string, number>> {
  const pool = new SimplePool();
  try {
    const following = await loadFollowing(pubkey, relays);
    const authors = unique([...following, pubkey]).slice(0, 80);
    if (authors.length === 0) return {};
    const since = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    const events = await pool.querySync(relays, { kinds: [1], authors, limit: 500, since });
    const counts: Record<string, number> = {};
    for (const event of events) {
      const words = event.content.match(/#([a-zA-Z0-9_]{2,32})/g) || [];
      for (const raw of words) {
        const topic = raw.slice(1).toLowerCase();
        counts[topic] = (counts[topic] || 0) + 1;
      }
    }
    return counts;
  } finally {
    pool.close(relays);
  }
}

export function invalidateDiscoverCache(pubkey?: string): void {
  if (pubkey) {
    discoverCache.delete(pubkey);
    return;
  }
  discoverCache.clear();
}

export function applyOptimisticFollow(pools: DiscoverPools, followedPubkey: string): DiscoverPools {
  const removeFollowed = (items: DiscoverUser[]) => items.filter((item) => item.pubkey !== followedPubkey);
  return {
    blended: removeFollowed(pools.blended),
    wot: removeFollowed(pools.wot),
    general: removeFollowed(pools.general),
  };
}

export function matchesCustomFeed(event: NostrEvent, definition: CustomFeedDefinition): boolean {
  // Skip replies if not included
  if (!definition.includeReplies && event.tags.some((t) => t[0] === 'e')) return false;
  
  // Get hashtags from event
  const eventHashtags = (event.tags || [])
    .filter((t) => t[0] === 't' && t[1])
    .map((t) => t[1].toLowerCase());
  
  // Handle undefined/empty arrays safely
  const feedHashtags = definition.hashtags || [];
  const feedAuthors = definition.authors || [];
  
  // If no topic filter, match all. Otherwise require at least one match.
  const hasTopicMatch = feedHashtags.length === 0 || 
    feedHashtags.some((tag) => eventHashtags.includes(tag.toLowerCase()));
  
  // If no author filter, match all. Otherwise require author match.
  const hasAuthorMatch = feedAuthors.length === 0 || 
    feedAuthors.includes(event.pubkey);
  
  // Must match both topic AND author criteria
  return hasTopicMatch && hasAuthorMatch;
}

export async function loadUserCustomFeeds(pubkey: string, relays: string[] = DEFAULT_RELAYS): Promise<CustomFeedDefinition[]> {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(relays, { kinds: [30000], authors: [pubkey], limit: 200 });
    const byD = new Map<string, NostrEvent>();
    for (const evt of events) {
      const feed = parseCustomFeedFromEvent(evt);
      if (!feed) continue;
      const prev = byD.get(feed.id);
      if (!prev || evt.created_at > prev.created_at) byD.set(feed.id, evt);
    }
    return Array.from(byD.values())
      .map((evt) => parseCustomFeedFromEvent(evt))
      .filter((x): x is CustomFeedDefinition => Boolean(x))
      .sort((a, b) => a.title.localeCompare(b.title));
  } finally {
    pool.close(relays);
  }
}

export async function loadDiscoverableCustomFeeds(relays: string[] = DEFAULT_RELAYS): Promise<CustomFeedDefinition[]> {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(relays, { kinds: [30000], limit: 500 });
    const feeds = events
      .map((event) => parseCustomFeedFromEvent(event))
      .filter((item): item is CustomFeedDefinition => {
        if (!item) return false;
        return item.hashtags.length > 0 || item.authors.length > 0;
      });

    const byKey = new Map<string, CustomFeedDefinition>();
    for (const feed of feeds) {
      const key = `${feed.ownerPubkey}:${feed.id}`;
      if (!byKey.has(key)) byKey.set(key, feed);
    }
    return Array.from(byKey.values()).slice(0, 100);
  } finally {
    pool.close(relays);
  }
}

export async function publishCustomFeed(
  definition: CustomFeedDefinition,
  pubkey: string,
  signEventFn: (evt: Omit<NostrEvent, 'id' | 'sig'>) => Promise<NostrEvent | null>,
  publishFn: (evt: NostrEvent) => Promise<any>,
): Promise<boolean> {
  const unsigned = {
    kind: 30000,
    content: '',
    tags: [
      ['d', definition.id],
      ['title', definition.title],
      ...(definition.description ? [['description', definition.description]] : []),
      ...definition.hashtags.map((tag) => ['t', tag.toLowerCase()]),
      ...definition.authors.map((author) => ['p', author]),
      ...(definition.includeReplies ? [] : [['include', 'no-replies']]),
    ],
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
  } as Omit<NostrEvent, 'id' | 'sig'>;

  const signed = await signEventFn(unsigned);
  if (!signed) return false;
  const result = await publishFn(signed);
  return Boolean(result?.success);
}

export async function loadBookmarkFeed(pubkey: string, relays: string[] = DEFAULT_RELAYS, contentFilters?: ContentFilters): Promise<FeedItem[]> {
  const pool = new SimplePool();
  try {
    const bookmarkEvents = await pool.querySync(relays, { kinds: [10003, 30003], authors: [pubkey], limit: 50 });
    if (bookmarkEvents.length === 0) return [];
    const newest = bookmarkEvents.sort((a, b) => b.created_at - a.created_at)[0];
    const eventIds = unique(newest.tags.filter((t) => t[0] === 'e' && t[1]).map((t) => t[1])).slice(0, 150);
    if (eventIds.length === 0) return [];
    const events = await pool.querySync(relays, { kinds: FEED_KINDS, ids: eventIds, limit: eventIds.length } as any);
    const authors = unique(events.map((e) => e.pubkey));
    const profiles = await fetchProfilesBatchCached(authors, relays);
    return applyMuteFilterForFeed(events
      .sort((a, b) => b.created_at - a.created_at)
      .map((event) => ({ ...event, profile: profiles.get(event.pubkey) || undefined })), contentFilters);
  } finally {
    pool.close(relays);
  }
}

export async function loadFeedForCustomDefinition(
  pubkey: string,
  definition: CustomFeedDefinition,
  cursor?: number,
  relays: string[] = DEFAULT_RELAYS,
  contentFilters?: ContentFilters,
): Promise<FeedResult> {
  const base = await loadFeedWithDiagnostics(pubkey, { mode: 'firehose', cursor, limit: 70 }, relays, contentFilters);
  const filtered = base.items.filter((item) => matchesCustomFeed(item, definition)).slice(0, 40);
  return {
    items: filtered,
    nextCursor: findNextCursor(filtered),
    diagnostics: {
      ...base.diagnostics,
      mode: 'firehose',
      eventCount: filtered.length,
      hasMore: base.diagnostics.hasMore,
    },
  };
}

export const SOCIAL_RELAYS = DEFAULT_RELAYS;
