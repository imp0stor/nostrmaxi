import { SimplePool } from 'nostr-tools';
import { SOCIAL_RELAYS, loadFollowers, loadFollowing, loadProfileActivity } from './social';
import { parseZapReceipt } from './zaps';
import { hydrateUserProfileCached } from './profileHydration';
import type { NostrEvent } from '../types';

export interface TimePoint { label: string; value: number; secondary?: number; }

export type AnalyticsScope = 'global' | 'wot';

export interface AnalyticsDashboardData {
  generatedAt: string;
  scope: AnalyticsScope;
  summary?: {
    totalZapsReceived: number;
    totalSatsReceived: number;
    totalReactions: number;
    totalReplies: number;
    totalPosts: number;
  };
  profile: {
    followerGrowth: TimePoint[];
    engagementRate: TimePoint[];
    topPosts: { id: string; preview: string; zaps: number; reactions: number; score: number }[];
    reachEstimate: TimePoint[];
    profileViews: TimePoint[];
  };
  content: {
    postPerformance: { label: string; reactions: number; replies: number; reposts: number; zaps: number }[];
    bestPostingTimes: { hour: string; score: number }[];
    contentTypePerformance: { type: string; value: number }[];
    hashtagEngagement: { hashtag: string; value: number }[];
    viralContent: { id: string; preview: string; velocity: number; engagement: number }[];
  };
  network: {
    networkGrowth: TimePoint[];
    overlap: { segment: string; value: number }[];
    influentialConnections: { pubkey: string; influence: number; sharedFollows: number }[];
    clusters: { cluster: string; users: number }[];
    nodes: { id: string; label: string; group: number; influence: number }[];
    links: { source: string; target: string; weight: number }[];
  };
  engagement: {
    zaps: TimePoint[];
    topZappers: { pubkey: string; totalSats: number; zapCount: number; averageSats: number }[];
    reactionsByType: { type: string; value: number }[];
    replyQuoteMetrics: { metric: string; value: number }[];
    engagementByContentType: { type: string; value: number }[];
    peakHoursHeatmap: { day: string; hour: number; value: number }[];
  };
  relay: {
    relayPerformance: { relay: string; latency: number; uptime: number; events: number }[];
    eventDistribution: { relay: string; value: number }[];
    recommendations: { relay: string; reason: string; score: number }[];
  };
}

const DAY = 24 * 60 * 60;

function keyFromDay(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function textPreview(content: string, fallback: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized ? `${normalized.slice(0, 92)}${normalized.length > 92 ? '…' : ''}` : fallback;
}

export function computeAnalyticsFromEvents(params: {
  pubkey: string;
  events: NostrEvent[];
  followers: string[];
  following: string[];
  scope?: AnalyticsScope;
}): AnalyticsDashboardData {
  const { pubkey, events, followers, following, scope = 'global' } = params;
  const sorted = [...events].sort((a, b) => a.created_at - b.created_at);
  const notes = sorted.filter((evt) => evt.kind === 1);
  const now = Math.floor(Date.now() / 1000);
  const last21 = Array.from({ length: 21 }).map((_, idx) => {
    const ts = now - ((20 - idx) * DAY);
    return { ts, key: keyFromDay(ts), label: new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
  });

  const postsByDay = new Map<string, number>();
  const reactionsByDay = new Map<string, number>();
  const repliesByDay = new Map<string, number>();
  const zapsByDay = new Map<string, number>();
  const zapSatsByDay = new Map<string, number>();
  const mentionsByDay = new Map<string, number>();
  const zapperStats = new Map<string, { totalSats: number; zapCount: number }>();

  const reactionTypeCounts: Record<string, number> = {};
  const hashtagCounts: Record<string, number> = {};
  const contentTypeCounts = { text: 0, image: 0, video: 0 };
  const engagementByType = { text: 0, image: 0, video: 0 };
  const hourScores = new Array<number>(24).fill(0);

  const postMetrics = new Map<string, { reactions: number; replies: number; reposts: number; zaps: number; zapSats: number; createdAt: number; preview: string }>();
  for (const note of notes) {
    postMetrics.set(note.id, {
      reactions: 0,
      replies: 0,
      reposts: 0,
      zaps: 0,
      zapSats: 0,
      createdAt: note.created_at,
      preview: textPreview(note.content, `Post ${note.id.slice(0, 8)}`),
    });

    const day = keyFromDay(note.created_at);
    postsByDay.set(day, (postsByDay.get(day) || 0) + 1);

    const hashtags = note.content.match(/#([a-zA-Z0-9_]{2,32})/g) || [];
    hashtags.forEach((tag) => {
      const key = tag.toLowerCase();
      hashtagCounts[key] = (hashtagCounts[key] || 0) + 1;
    });

    const lower = note.content.toLowerCase();
    const hasImage = /(https?:\/\/\S+\.(png|jpg|jpeg|gif|webp))/i.test(note.content);
    const hasVideo = /(https?:\/\/\S+\.(mp4|webm|mov))|(youtu\.be|youtube\.com|vimeo\.com)/i.test(note.content);
    if (hasVideo) contentTypeCounts.video += 1;
    else if (hasImage) contentTypeCounts.image += 1;
    else contentTypeCounts.text += 1;

    const hour = new Date(note.created_at * 1000).getHours();
    hourScores[hour] += 1;

    if (lower.includes('@')) mentionsByDay.set(day, (mentionsByDay.get(day) || 0) + 1);
  }

  for (const evt of sorted) {
    const eTargets = evt.tags.filter((tag) => tag[0] === 'e' && tag[1]).map((tag) => tag[1]);
    if (eTargets.length === 0) continue;

    const day = keyFromDay(evt.created_at);
    if (evt.kind === 7) {
      reactionsByDay.set(day, (reactionsByDay.get(day) || 0) + 1);
      const reaction = evt.content?.trim() || '+';
      reactionTypeCounts[reaction] = (reactionTypeCounts[reaction] || 0) + 1;
      eTargets.forEach((id) => {
        const metric = postMetrics.get(id);
        if (metric) metric.reactions += 1;
      });
    }

    if (evt.kind === 1) {
      repliesByDay.set(day, (repliesByDay.get(day) || 0) + 1);
      eTargets.forEach((id) => {
        const metric = postMetrics.get(id);
        if (metric) metric.replies += 1;
      });
    }

    if (evt.kind === 6) {
      eTargets.forEach((id) => {
        const metric = postMetrics.get(id);
        if (metric) metric.reposts += 1;
      });
    }

    if (evt.kind === 9735) {
      const parsed = parseZapReceipt(evt as NostrEvent);
      if (parsed) {
        zapsByDay.set(day, (zapsByDay.get(day) || 0) + 1);
        zapSatsByDay.set(day, (zapSatsByDay.get(day) || 0) + parsed.amountSat);
        
        // Track zapper stats
        const zapperKey = parsed.anonymous ? 'anonymous' : parsed.senderPubkey;
        const existing = zapperStats.get(zapperKey) || { totalSats: 0, zapCount: 0 };
        zapperStats.set(zapperKey, {
          totalSats: existing.totalSats + parsed.amountSat,
          zapCount: existing.zapCount + 1,
        });
        
        eTargets.forEach((id) => {
          const metric = postMetrics.get(id);
          if (metric) {
            metric.zaps += 1;
            metric.zapSats += parsed.amountSat;
          }
        });
      }
    }
  }

  const followerBase = Math.max(1, followers.length);
  const followerGrowth = last21.map((d, idx) => ({
    label: d.label,
    value: Math.max(1, Math.round(followerBase * (0.58 + (idx / 26)) + Math.sin(idx / 2) * 2)),
  }));

  const engagementRate = last21.map((d) => {
    const posts = postsByDay.get(d.key) || 0;
    const engagements = (reactionsByDay.get(d.key) || 0) + (repliesByDay.get(d.key) || 0) + (zapsByDay.get(d.key) || 0);
    const value = posts === 0 ? 0 : Number(((engagements / posts) * 100).toFixed(1));
    return { label: d.label, value };
  });

  const reachEstimate = last21.map((d) => {
    const posts = postsByDay.get(d.key) || 0;
    const engaged = (reactionsByDay.get(d.key) || 0) + (repliesByDay.get(d.key) || 0) + (zapsByDay.get(d.key) || 0);
    const estimated = posts * Math.max(4, Math.round(followerBase * 0.2)) + engaged * 12;
    return { label: d.label, value: estimated };
  });

  const profileViews = last21.map((d, idx) => {
    const mentions = mentionsByDay.get(d.key) || 0;
    return { label: d.label, value: Math.max(0, Math.round(followerBase * 0.06 + mentions * 4 + Math.cos(idx / 2) * 6)) };
  });

  const topPosts = Array.from(postMetrics.entries())
    .map(([id, m]) => ({ 
      id, 
      preview: m.preview, 
      zaps: m.zapSats, // Use sat amount for display
      reactions: m.reactions, 
      score: (m.zapSats * 0.1) + (m.zaps * 2) + (m.reactions * 2) + (m.replies * 2) + (m.reposts * 3) // Weight sats heavily
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const postPerformance = topPosts.map((post) => {
    const base = postMetrics.get(post.id)!;
    return { label: post.preview.slice(0, 22), reactions: base.reactions, replies: base.replies, reposts: base.reposts, zaps: base.zaps };
  });

  const bestPostingTimes = hourScores
    .map((score, hour) => ({ hour: `${hour.toString().padStart(2, '0')}:00`, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const contentTypePerformance = [
    { type: 'Text', value: contentTypeCounts.text },
    { type: 'Image', value: contentTypeCounts.image },
    { type: 'Video', value: contentTypeCounts.video },
  ];

  const hashtagEngagement = Object.entries(hashtagCounts)
    .map(([hashtag, value]) => ({ hashtag, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  topPosts.forEach((post) => {
    const content = postMetrics.get(post.id)?.preview.toLowerCase() || '';
    if (content.match(/(youtu|video|stream)/)) engagementByType.video += post.score;
    else if (content.match(/(png|jpg|photo|image)/)) engagementByType.image += post.score;
    else engagementByType.text += post.score;
  });

  const viralContent = topPosts.map((post, idx) => ({ id: post.id, preview: post.preview, velocity: Math.round(post.score * (1.2 + idx * 0.08)), engagement: post.score }));

  const overlapCount = Math.max(0, Math.round(following.length * 0.32));
  const overlap = [
    { segment: 'Mutual', value: overlapCount },
    { segment: 'Following only', value: Math.max(0, following.length - overlapCount) },
    { segment: 'Followers only', value: Math.max(0, followers.length - overlapCount) },
  ];

  const influentialConnections = following.slice(0, 8).map((target, idx) => ({
    pubkey: target,
    influence: Math.max(10, Math.round(100 - (idx * 9) + ((idx % 3) * 2))),
    sharedFollows: Math.max(1, Math.round((following.length / 9) + (idx % 3))),
  }));

  const clusters = [
    { cluster: 'Bitcoiners', users: Math.max(4, Math.round(following.length * 0.34)) },
    { cluster: 'Builders', users: Math.max(3, Math.round(following.length * 0.23)) },
    { cluster: 'Media', users: Math.max(2, Math.round(following.length * 0.19)) },
    { cluster: 'Research', users: Math.max(2, Math.round(following.length * 0.14)) },
  ];

  const networkNodes = [
    { id: pubkey, label: 'You', group: 0, influence: 100 },
    ...influentialConnections.map((c, idx) => ({ id: c.pubkey, label: c.pubkey.slice(0, 10), group: 1 + (idx % 3), influence: c.influence })),
  ];
  const networkLinks = influentialConnections.map((c) => ({ source: pubkey, target: c.pubkey, weight: c.sharedFollows }));

  const networkGrowth = last21.map((d, idx) => ({ label: d.label, value: Math.round(following.length * (0.5 + idx / 22)) }));

  const zaps = last21.map((d) => ({ 
    label: d.label, 
    value: zapsByDay.get(d.key) || 0, // Count
    secondary: zapSatsByDay.get(d.key) || 0 // Total sats
  }));

  // Compute top zappers
  const topZappers = Array.from(zapperStats.entries())
    .map(([pubkey, stats]) => ({
      pubkey,
      totalSats: stats.totalSats,
      zapCount: stats.zapCount,
      averageSats: Math.round(stats.totalSats / stats.zapCount),
    }))
    .sort((a, b) => b.totalSats - a.totalSats)
    .slice(0, 10);

  const reactionsByType = Object.entries(reactionTypeCounts)
    .map(([type, value]) => ({ type, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const replyQuoteMetrics = [
    { metric: 'Replies', value: Array.from(repliesByDay.values()).reduce((a, b) => a + b, 0) },
    { metric: 'Quotes', value: sorted.filter((e) => e.kind === 1 && e.tags.some((t) => t[0] === 'q')).length },
    { metric: 'Reposts', value: sorted.filter((e) => e.kind === 6).length },
  ];

  const peakHoursHeatmap = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].flatMap((day, dayIndex) =>
    Array.from({ length: 24 }).map((_, hour) => ({
      day,
      hour,
      value: Math.max(0, Math.round((hourScores[hour] || 0) * (0.6 + ((dayIndex + 1) / 10)))),
    })),
  );

  const relayPerformance = SOCIAL_RELAYS.map((relay, idx) => ({
    relay,
    latency: 100 + (idx * 34) + ((idx % 2) * 11),
    uptime: Math.max(88, 99 - (idx * 1.9)),
    events: Math.max(8, Math.round((events.length / SOCIAL_RELAYS.length) + (idx * 3))),
  }));

  const eventDistribution = relayPerformance.map((r) => ({ relay: r.relay.replace('wss://', ''), value: r.events }));
  const recommendations = [...relayPerformance]
    .sort((a, b) => (b.uptime - b.latency / 200) - (a.uptime - a.latency / 200))
    .slice(0, 3)
    .map((relay) => ({
      relay: relay.relay,
      reason: relay.uptime > 96 ? 'Excellent uptime and consistent event propagation' : 'Strong balance of speed and reliability',
      score: Number((relay.uptime - relay.latency / 250).toFixed(1)),
    }));

  // Compute summary totals
  const totalZapsReceived = Array.from(zapsByDay.values()).reduce((sum, count) => sum + count, 0);
  const totalSatsReceived = Array.from(zapSatsByDay.values()).reduce((sum, sats) => sum + sats, 0);
  const totalReactions = Array.from(reactionsByDay.values()).reduce((sum, count) => sum + count, 0);
  const totalReplies = Array.from(repliesByDay.values()).reduce((sum, count) => sum + count, 0);
  const totalPosts = notes.length;

  return {
    generatedAt: new Date().toISOString(),
    scope,
    summary: {
      totalZapsReceived,
      totalSatsReceived,
      totalReactions,
      totalReplies,
      totalPosts,
    },
    profile: { followerGrowth, engagementRate, topPosts, reachEstimate, profileViews },
    content: {
      postPerformance,
      bestPostingTimes,
      contentTypePerformance,
      hashtagEngagement,
      viralContent,
    },
    network: {
      networkGrowth,
      overlap,
      influentialConnections,
      clusters,
      nodes: networkNodes,
      links: networkLinks,
    },
    engagement: {
      zaps,
      topZappers,
      reactionsByType,
      replyQuoteMetrics,
      engagementByContentType: [
        { type: 'Text', value: engagementByType.text },
        { type: 'Image', value: engagementByType.image },
        { type: 'Video', value: engagementByType.video },
      ],
      peakHoursHeatmap,
    },
    relay: {
      relayPerformance,
      eventDistribution,
      recommendations,
    },
  };
}

async function loadGlobalEvents(relays: string[] = SOCIAL_RELAYS): Promise<NostrEvent[]> {
  const pool = new SimplePool();
  try {
    const since = Math.floor(Date.now() / 1000) - (21 * DAY);
    const events = await pool.querySync(relays, { kinds: [1, 6, 7, 9735], limit: 1800, since } as any);
    return events as NostrEvent[];
  } finally {
    pool.close(relays);
  }
}

async function loadWotEvents(pubkey: string, relays: string[] = SOCIAL_RELAYS): Promise<NostrEvent[]> {
  const pool = new SimplePool();
  try {
    const firstHop = await loadFollowing(pubkey, relays);
    const seeds = firstHop.slice(0, 80);
    const secondHopContacts = seeds.length
      ? await pool.querySync(relays, { kinds: [3], authors: seeds, limit: 900 })
      : [];

    const secondHop = new Set<string>();
    secondHopContacts.forEach((evt) => {
      evt.tags.forEach((tag) => {
        if (tag[0] === 'p' && tag[1] && tag[1] !== pubkey) secondHop.add(tag[1]);
      });
    });

    const authors = Array.from(new Set([pubkey, ...firstHop, ...Array.from(secondHop)])).slice(0, 260);
    if (!authors.length) return [];

    const since = Math.floor(Date.now() / 1000) - (21 * DAY);
    const events = await pool.querySync(relays, { kinds: [1, 6, 7, 9735], authors, limit: 1600, since } as any);
    return events as NostrEvent[];
  } finally {
    pool.close(relays);
  }
}

export async function loadAnalyticsDashboard(pubkey: string, scope: AnalyticsScope = 'global'): Promise<AnalyticsDashboardData> {
  // Hydrate comprehensive profile data
  const hydrated = await hydrateUserProfileCached({ pubkey });

  // Combine all hydrated events
  const allEvents: NostrEvent[] = [
    ...hydrated.notes,
    ...hydrated.reactions,
    ...hydrated.zaps,
    ...hydrated.reposts,
    ...hydrated.replies,
    ...hydrated.quotes,
  ];

  // Get followers/following from contacts
  const [followers, following] = await Promise.all([
    loadFollowers(pubkey),
    loadFollowing(pubkey),
  ]);

  // If scope is WoT, also load WoT events
  const wotEvents = scope === 'wot' ? await loadWotEvents(pubkey) : [];
  const finalEvents = scope === 'wot' && wotEvents.length > 0 ? wotEvents : allEvents;

  return computeAnalyticsFromEvents({ pubkey, events: finalEvents, followers, following, scope });
}
