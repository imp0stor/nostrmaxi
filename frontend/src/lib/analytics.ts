import { SimplePool } from 'nostr-tools';
import type { NostrEvent } from '../types';
import { FALLBACK_RELAYS } from './relayConfig';
import { parseZapReceipt } from './zaps';

export interface TimePoint {
  label: string;
  value: number;
}

export type AnalyticsScope = 'individual';
export type AnalyticsInterval = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';

export interface AnalyticsRange {
  interval: AnalyticsInterval;
  startTs?: number;
  endTs?: number;
}

export interface PostSummary {
  id: string;
  createdAt: number;
  preview: string;
}

export interface TopPost {
  id: string;
  preview: string;
  reactions: number;
  replies: number;
  reposts: number;
  zaps: number;
  zapSats: number;
  score: number;
}

export interface TopZapper {
  pubkey: string;
  totalSats: number;
  zapCount: number;
  averageSats: number;
}

export interface AnalyticsLoadProgress {
  totalUnits: number;
  processedUnits: number;
  percent: number;
  status: string;
}

export type AnalyticsPhase = 'resolving' | 'fetching' | 'aggregating' | 'enriching' | 'complete';

export interface AnalyticsProgressUpdate extends AnalyticsLoadProgress {
  phase: AnalyticsPhase;
}

export interface AnalyticsDashboardData {
  generatedAt: string;
  pubkey: string;
  followerCount: number;
  followingCount: number;
  totalPosts: number;
  postsPerDay: TimePoint[];
  postsPerWeek: TimePoint[];
  engagementPerDay: TimePoint[];
  recentPosts: PostSummary[];
  topPosts: TopPost[];
  engagementTotals: {
    reactions: number;
    replies: number;
    reposts: number;
    zaps: number;
    score: number;
  };
  growth: {
    postsDeltaPct: number;
    engagementDeltaPct: number;
  };
  relayDistribution: { relay: string; posts: number }[];
  zapStats: {
    totalSats: number;
    totalZaps: number;
    totalSatsSent: number;
    totalZapsSent: number;
    averageZapAmount: number;
    topZappers: TopZapper[];
  };
  bestPostingTimes: {
    hours: { hour: number; engagement: number }[];
    days: { day: string; engagement: number }[];
  };
  hashtagPerformance: { hashtag: string; posts: number; engagement: number }[];
  noHistoricalDataMessage?: string;
}

const DAY = 24 * 60 * 60;
const CACHE_VERSION = 'v2-real';
const CACHE_VERSION_KEY = 'nostrmaxi.analytics.version';
const CACHE_PREFIX = `nostrmaxi.analytics.${CACHE_VERSION}`;

function localStorageSafe(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function ensureCacheVersion(): void {
  const storage = localStorageSafe();
  if (!storage) return;

  const current = storage.getItem(CACHE_VERSION_KEY);
  if (current === CACHE_VERSION) return;

  const keysToDelete: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith('nostrmaxi.analytics.')) keysToDelete.push(key);
  }
  keysToDelete.forEach((key) => storage.removeItem(key));
  storage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
}

export function clearAnalyticsCache(): void {
  const storage = localStorageSafe();
  if (!storage) return;

  const keysToDelete: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith('nostrmaxi.analytics.')) keysToDelete.push(key);
  }
  keysToDelete.forEach((key) => storage.removeItem(key));
  storage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
}

function cacheKey(ownerPubkey: string, targetPubkey: string, range: AnalyticsRange): string {
  return `${CACHE_PREFIX}.${ownerPubkey}.${targetPubkey}.${range.interval}.${range.startTs || ''}.${range.endTs || ''}`;
}

function getRangeBounds(range: AnalyticsRange): { startTs: number; endTs: number } {
  const now = Math.floor(Date.now() / 1000);
  if (range.interval === 'custom' && range.startTs && range.endTs) {
    return { startTs: range.startTs, endTs: range.endTs };
  }
  if (range.interval === '7d') return { startTs: now - (7 * DAY), endTs: now };
  if (range.interval === '90d') return { startTs: now - (90 * DAY), endTs: now };
  if (range.interval === '1y') return { startTs: now - (365 * DAY), endTs: now };
  if (range.interval === 'all') return { startTs: now - (365 * 5 * DAY), endTs: now };
  return { startTs: now - (30 * DAY), endTs: now };
}

function formatDayLabel(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function getWeekLabel(ts: number): string {
  const d = new Date(ts * 1000);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

export function computeProgress(totalUnits: number, processedUnits: number): AnalyticsLoadProgress {
  const safeTotal = Math.max(1, totalUnits);
  const boundedProcessed = Math.min(Math.max(0, processedUnits), safeTotal);
  const percent = Math.max(0, Math.min(100, Math.round((boundedProcessed / safeTotal) * 100)));
  return {
    totalUnits: safeTotal,
    processedUnits: boundedProcessed,
    percent,
    status: `${percent}%`,
  };
}

function postPreview(content: string, id: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return `Post ${id.slice(0, 8)}`;
  return normalized.length > 120 ? `${normalized.slice(0, 120)}…` : normalized;
}

function extractEventIds(evt: NostrEvent): string[] {
  return evt.tags.filter((t) => t[0] === 'e' && t[1]).map((t) => t[1]);
}

function parseBolt11AmountSats(invoice: string | undefined): number | null {
  if (!invoice) return null;
  const lower = invoice.trim().toLowerCase();
  const match = lower.match(/^ln[a-z]+(\d+)([munp]?)/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2] || '';
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (unit === '') return Math.floor(amount * 100_000_000);
  if (unit === 'm') return Math.floor(amount * 100_000);
  if (unit === 'u') return Math.floor(amount * 100);
  if (unit === 'n') return Math.floor(amount / 10);
  if (unit === 'p') return Math.floor(amount / 10_000);
  return null;
}

function parseZapAmountSat(evt: NostrEvent): number {
  const parsed = parseZapReceipt(evt);
  if (parsed?.amountSat && parsed.amountSat > 0) return parsed.amountSat;
  const bolt11 = evt.tags.find((t) => t[0] === 'bolt11' && t[1])?.[1];
  return parseBolt11AmountSats(bolt11) || 0;
}

async function queryEvents(pool: SimplePool, filter: any): Promise<NostrEvent[]> {
  const events = await pool.querySync(FALLBACK_RELAYS, filter);
  return (events as NostrEvent[]) || [];
}

async function loadAnalyticsRaw(
  pubkey: string,
  range: AnalyticsRange,
  onProgress?: (update: AnalyticsProgressUpdate) => void,
): Promise<AnalyticsDashboardData> {
  const pool = new SimplePool();
  try {
    const emitProgress = (phase: AnalyticsPhase, status: string, totalUnits: number, processedUnits: number) => {
      if (!onProgress) return;
      const base = computeProgress(totalUnits, processedUnits);
      onProgress({ ...base, phase, status });
    };

    const { startTs, endTs } = getRangeBounds(range);

    emitProgress('resolving', 'Resolving baseline profile and post graph…', 100, 2);
    const [contactEvents, followerEvents, posts] = await Promise.all([
      queryEvents(pool, { kinds: [3], authors: [pubkey], limit: 20 }),
      queryEvents(pool, { kinds: [3], '#p': [pubkey], limit: 5000 }),
      queryEvents(pool, { kinds: [1], authors: [pubkey], limit: 2000 }),
    ]);

    const latestContact = [...contactEvents].sort((a, b) => b.created_at - a.created_at)[0];
    const followingCount = latestContact
      ? new Set(latestContact.tags.filter((t) => t[0] === 'p' && t[1]).map((t) => t[1])).size
      : 0;
    const followerCount = new Set(followerEvents.map((e) => e.pubkey)).size;

    const sortedPosts = [...posts].sort((a, b) => b.created_at - a.created_at);
    const postById = new Map(sortedPosts.map((post) => [post.id, post]));
    const totalPosts = sortedPosts.length;
    const rangedPosts = sortedPosts.filter((p) => p.created_at >= startTs && p.created_at <= endTs);
    const postIds = sortedPosts.map((p) => p.id);

    const postIdChunks = chunk(postIds, 150);
    const reactionEvents: NostrEvent[] = [];
    const replyEvents: NostrEvent[] = [];
    const repostEvents: NostrEvent[] = [];
    const zapEvents: NostrEvent[] = [];

    emitProgress('fetching', 'Fetching engagement events in chunks…', Math.max(1, postIdChunks.length), 0);
    for (let index = 0; index < postIdChunks.length; index += 1) {
      const ids = postIdChunks[index];
      if (ids.length === 0) continue;
      const [reactions, replies, reposts, zaps] = await Promise.all([
        queryEvents(pool, { kinds: [7], '#e': ids, limit: 3000 }),
        queryEvents(pool, { kinds: [1], '#e': ids, limit: 3000 }),
        queryEvents(pool, { kinds: [6], '#e': ids, limit: 3000 }),
        queryEvents(pool, { kinds: [9735], '#e': ids, limit: 3000 }),
      ]);
      reactionEvents.push(...reactions);
      replyEvents.push(...replies);
      repostEvents.push(...reposts);
      zapEvents.push(...zaps);
      emitProgress('fetching', `Fetching chunk ${index + 1}/${postIdChunks.length}…`, postIdChunks.length, index + 1);
    }

    const postMetrics = new Map<string, TopPost>();
    const hashtagUsage = new Map<string, { posts: number; engagement: number }>();
    let totalReactions = 0;
    let totalReplies = 0;
    let totalReposts = 0;

    const aggregationSteps = 6;
    emitProgress('aggregating', 'Building post metric baselines…', aggregationSteps, 0);

    sortedPosts.forEach((post) => {
      postMetrics.set(post.id, {
        id: post.id,
        preview: postPreview(post.content, post.id),
        reactions: 0,
        replies: 0,
        reposts: 0,
        zaps: 0,
        zapSats: 0,
        score: 0,
      });

      const tags = [
        ...post.tags.filter((t) => t[0] === 't' && t[1]).map((t) => t[1]),
        ...(post.content.match(/#([a-zA-Z0-9_]+)/g) || []).map((t) => t.slice(1)),
      ];
      new Set(tags.map((t) => t.toLowerCase())).forEach((tag) => {
        const existing = hashtagUsage.get(tag) || { posts: 0, engagement: 0 };
        hashtagUsage.set(tag, { posts: existing.posts + 1, engagement: existing.engagement });
      });
    });
    emitProgress('aggregating', 'Aggregating reactions…', aggregationSteps, 1);

    const postIdSet = new Set(postIds);

    reactionEvents.forEach((evt) => {
      extractEventIds(evt).forEach((id) => {
        if (!postIdSet.has(id)) return;
        const metric = postMetrics.get(id);
        if (metric) {
          metric.reactions += 1;
          totalReactions += 1;
        }
      });
    });
    emitProgress('aggregating', 'Aggregating replies…', aggregationSteps, 2);

    replyEvents.forEach((evt) => {
      if (evt.pubkey === pubkey) return;
      extractEventIds(evt).forEach((id) => {
        if (!postIdSet.has(id)) return;
        const metric = postMetrics.get(id);
        if (metric) {
          metric.replies += 1;
          totalReplies += 1;
        }
      });
    });
    emitProgress('aggregating', 'Aggregating reposts…', aggregationSteps, 3);

    repostEvents.forEach((evt) => {
      extractEventIds(evt).forEach((id) => {
        if (!postIdSet.has(id)) return;
        const metric = postMetrics.get(id);
        if (metric) {
          metric.reposts += 1;
          totalReposts += 1;
        }
      });
    });

    const zapperStats = new Map<string, { sats: number; count: number }>();
    let totalSats = 0;
    let totalZaps = 0;

    zapEvents.forEach((evt) => {
      const sats = parseZapAmountSat(evt);
      if (sats <= 0) return;
      const sender = evt.tags.find((t) => t[0] === 'P' && t[1])?.[1] || evt.pubkey;
      const senderPrev = zapperStats.get(sender) || { sats: 0, count: 0 };
      zapperStats.set(sender, { sats: senderPrev.sats + sats, count: senderPrev.count + 1 });

      totalSats += sats;
      totalZaps += 1;

      extractEventIds(evt).forEach((id) => {
        if (!postIdSet.has(id)) return;
        const metric = postMetrics.get(id);
        if (!metric) return;
        metric.zaps += 1;
        metric.zapSats += sats;
      });
    });
    emitProgress('aggregating', 'Computing timelines and top content…', aggregationSteps, 4);

    const postsPerDayMap = new Map<string, number>();
    const postsPerWeekMap = new Map<string, number>();
    const engagementPerDayMap = new Map<string, number>();

    rangedPosts.forEach((post) => {
      const day = formatDayLabel(post.created_at);
      const week = getWeekLabel(post.created_at);
      postsPerDayMap.set(day, (postsPerDayMap.get(day) || 0) + 1);
      postsPerWeekMap.set(week, (postsPerWeekMap.get(week) || 0) + 1);

      const m = postMetrics.get(post.id);
      const engagement = m ? (m.reactions + m.replies + m.reposts + m.zapSats) : 0;
      engagementPerDayMap.set(day, (engagementPerDayMap.get(day) || 0) + engagement);
    });

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayTotals = new Array<number>(7).fill(0);
    const hourTotals = new Array<number>(24).fill(0);

    sortedPosts.forEach((post) => {
      const metric = postMetrics.get(post.id);
      const engagement = metric ? (metric.reactions + metric.replies + metric.reposts + metric.zapSats) : 0;
      const d = new Date(post.created_at * 1000);
      dayTotals[d.getDay()] += engagement;
      hourTotals[d.getHours()] += engagement;
    });

    postMetrics.forEach((metric, postId) => {
      metric.score = metric.reactions + metric.replies + metric.reposts + metric.zapSats;
      const post = postById.get(postId);
      if (!post) return;

      const tags = [
        ...post.tags.filter((t) => t[0] === 't' && t[1]).map((t) => t[1]),
        ...(post.content.match(/#([a-zA-Z0-9_]+)/g) || []).map((t) => t.slice(1)),
      ];

      new Set(tags.map((t) => t.toLowerCase())).forEach((tag) => {
        const existing = hashtagUsage.get(tag) || { posts: 0, engagement: 0 };
        hashtagUsage.set(tag, { posts: existing.posts, engagement: existing.engagement + metric.score });
      });
    });
    emitProgress('aggregating', 'Aggregating complete, enriching with sent zaps and relays…', aggregationSteps, 5);

    const topZappers: TopZapper[] = Array.from(zapperStats.entries())
      .map(([pubkeyValue, stat]) => ({
        pubkey: pubkeyValue,
        totalSats: stat.sats,
        zapCount: stat.count,
        averageSats: Math.round(stat.sats / stat.count),
      }))
      .sort((a, b) => b.totalSats - a.totalSats);

    const enrichTotal = Math.max(2, FALLBACK_RELAYS.length + 1);
    let enrichProcessed = 0;

    const sentZaps = await queryEvents(pool, { kinds: [9735], authors: [pubkey], since: startTs, until: endTs, limit: 3000 });
    enrichProcessed += 1;
    emitProgress('enriching', 'Enriching with outgoing zaps…', enrichTotal, enrichProcessed);

    let totalSatsSent = 0;
    for (const evt of sentZaps) {
      totalSatsSent += parseZapAmountSat(evt);
    }

    const relayDistribution: { relay: string; posts: number }[] = [];
    for (const relay of FALLBACK_RELAYS) {
      const relayPosts = await pool.querySync([relay], { kinds: [1], authors: [pubkey], since: startTs, until: endTs, limit: 2000 });
      relayDistribution.push({ relay, posts: (relayPosts as NostrEvent[]).length });
      enrichProcessed += 1;
      emitProgress('enriching', `Enriching relay distribution (${enrichProcessed - 1}/${FALLBACK_RELAYS.length})…`, enrichTotal, enrichProcessed);
    }

    const postsPerDay = Array.from(postsPerDayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));

    const postsPerWeek = Array.from(postsPerWeekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));

    const engagementPerDay = Array.from(engagementPerDayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));

    const topPosts = Array.from(postMetrics.values())
      .sort((a, b) => b.score - a.score);

    const recentPosts = sortedPosts.map((post) => ({
      id: post.id,
      createdAt: post.created_at,
      preview: postPreview(post.content, post.id),
    }));

    const hashtagPerformance = Array.from(hashtagUsage.entries())
      .map(([hashtag, stats]) => ({ hashtag, posts: stats.posts, engagement: stats.engagement }))
      .sort((a, b) => b.engagement - a.engagement);

    const sortedRanged = [...rangedPosts].sort((a, b) => a.created_at - b.created_at);
    const midpoint = Math.floor(sortedRanged.length / 2);
    const firstHalf = sortedRanged.slice(0, midpoint);
    const secondHalf = sortedRanged.slice(midpoint);
    const firstHalfEngagement = firstHalf.reduce((sum, post) => {
      const metric = postMetrics.get(post.id);
      return sum + (metric ? (metric.reactions + metric.replies + metric.reposts + metric.zaps) : 0);
    }, 0);
    const secondHalfEngagement = secondHalf.reduce((sum, post) => {
      const metric = postMetrics.get(post.id);
      return sum + (metric ? (metric.reactions + metric.replies + metric.reposts + metric.zaps) : 0);
    }, 0);

    const postsDeltaPct = firstHalf.length > 0 ? Number((((secondHalf.length - firstHalf.length) / firstHalf.length) * 100).toFixed(1)) : 0;
    const engagementDeltaPct = firstHalfEngagement > 0 ? Number((((secondHalfEngagement - firstHalfEngagement) / firstHalfEngagement) * 100).toFixed(1)) : 0;

    const relayDistributionSorted = relayDistribution
      .sort((a, b) => b.posts - a.posts)
      .map((entry) => ({ relay: entry.relay, posts: entry.posts }));

    emitProgress('complete', 'Analytics ready.', 100, 100);
    return {
      generatedAt: new Date().toISOString(),
      pubkey,
      followerCount,
      followingCount,
      totalPosts,
      postsPerDay,
      postsPerWeek,
      engagementPerDay,
      recentPosts,
      topPosts,
      engagementTotals: {
        reactions: totalReactions,
        replies: totalReplies,
        reposts: totalReposts,
        zaps: totalZaps,
        score: totalReactions + totalReplies + totalReposts + totalZaps,
      },
      growth: {
        postsDeltaPct,
        engagementDeltaPct,
      },
      relayDistribution: relayDistributionSorted,
      zapStats: {
        totalSats,
        totalZaps,
        totalSatsSent,
        totalZapsSent: sentZaps.length,
        averageZapAmount: totalZaps > 0 ? Math.round(totalSats / totalZaps) : 0,
        topZappers,
      },
      bestPostingTimes: {
        hours: hourTotals.map((engagement, hour) => ({ hour, engagement })),
        days: weekdayLabels.map((day, idx) => ({ day, engagement: dayTotals[idx] })),
      },
      hashtagPerformance,
      noHistoricalDataMessage: postsPerDay.length === 0 ? 'No historical data available' : undefined,
    };
  } finally {
    pool.close(FALLBACK_RELAYS);
  }
}

export async function loadAnalyticsDashboard(
  pubkey: string,
  scope: AnalyticsScope = 'individual',
  range: AnalyticsRange = { interval: '30d' },
  forceRefresh = false,
  targetPubkey?: string,
  onProgress?: (update: AnalyticsProgressUpdate) => void,
): Promise<AnalyticsDashboardData> {
  if (scope !== 'individual') {
    throw new Error('Only individual scope is supported for real-data analytics.');
  }

  ensureCacheVersion();

  const storage = localStorageSafe();
  const resolvedTargetPubkey = (targetPubkey || pubkey).toLowerCase();
  const key = cacheKey(pubkey, resolvedTargetPubkey, range);
  if (!forceRefresh && storage) {
    const raw = storage.getItem(key);
    if (raw) {
      try {
        const cached = JSON.parse(raw) as AnalyticsDashboardData;
        onProgress?.({ ...computeProgress(1, 1), phase: 'complete', status: 'Loaded analytics from cache.' });
        return cached;
      } catch {
        storage.removeItem(key);
      }
    }
  }

  const data = await loadAnalyticsRaw(resolvedTargetPubkey, range, onProgress);
  if (storage) {
    storage.setItem(key, JSON.stringify(data));
  }
  return data;
}

// Legacy compute helper kept for tests and compatibility.
export function computeAnalyticsFromEvents(params: {
  pubkey: string;
  events: NostrEvent[];
  followers: string[];
  following: string[];
  scope?: 'individual' | 'following' | 'wot' | 'global';
}) {
  const notes = params.events.filter((e) => e.kind === 1 && !e.tags.some((t) => t[0] === 'e'));
  const postIds = new Set(notes.map((n) => n.id));

  const metrics = new Map<string, { reactions: number; replies: number; reposts: number; zapSats: number; preview: string }>();
  notes.forEach((n) => {
    metrics.set(n.id, {
      reactions: 0,
      replies: 0,
      reposts: 0,
      zapSats: 0,
      preview: postPreview(n.content, n.id),
    });
  });

  const reactionTypeCounts: Record<string, number> = {};

  params.events.forEach((evt) => {
    const targets = extractEventIds(evt).filter((id) => postIds.has(id));
    if (!targets.length) return;

    if (evt.kind === 7) {
      const reaction = evt.content?.trim() || '+';
      reactionTypeCounts[reaction] = (reactionTypeCounts[reaction] || 0) + 1;
      targets.forEach((id) => {
        const m = metrics.get(id);
        if (m) m.reactions += 1;
      });
    }

    if (evt.kind === 1) {
      targets.forEach((id) => {
        const m = metrics.get(id);
        if (m) m.replies += 1;
      });
    }

    if (evt.kind === 6) {
      targets.forEach((id) => {
        const m = metrics.get(id);
        if (m) m.reposts += 1;
      });
    }

    if (evt.kind === 9735) {
      const sats = parseZapAmountSat(evt);
      targets.forEach((id) => {
        const m = metrics.get(id);
        if (m) m.zapSats += sats;
      });
    }
  });

  const topPosts = Array.from(metrics.entries())
    .map(([id, m]) => ({
      id,
      preview: m.preview,
      zaps: m.zapSats,
      reactions: m.reactions,
      score: m.reactions + m.replies + m.reposts + m.zapSats,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const reactionsByType = Object.entries(reactionTypeCounts)
    .map(([type, value]) => ({ type, value }))
    .sort((a, b) => b.value - a.value);

  return {
    scope: params.scope || 'individual',
    profile: { topPosts },
    engagement: { reactionsByType },
  };
}
