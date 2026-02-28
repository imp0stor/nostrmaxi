import type { DiscoverCardDataLike } from '../types/discover';

export interface RelayRecommendation {
  url: string;
  name: string;
  description: string;
  reliability: 'high' | 'medium' | 'unknown';
  region?: string;
  topics: string[];
  monthlyActiveUsers: number;
  activityScore: number;
  uptime: number;
  popularityScore: number;
}

export interface RelayPerformanceMetrics {
  uptimePct: number;
  latencyMs: number;
  throughputEventsPerSec: number;
  connectionStability: number;
}

export interface RelayGeographicMetrics {
  region: string;
  cdnEdge: boolean;
  latencyToUserMs: number;
}

export interface RelayContentMetrics {
  storageCapacityGb: number;
  retentionDays: number;
  dataCompleteness: number;
  supportedEventKinds: number[];
}

export interface RelayFeatureMetrics {
  nips: number[];
  read: boolean;
  write: boolean;
  authRequired: boolean;
  paid: boolean;
}

export interface RelayCommunityMetrics {
  activeUsers: number;
  eventVolumeDaily: number;
  spamModeration: number;
  focusTopics: string[];
}

export interface RelayTrustMetrics {
  operatorReputation: number;
  uptimeHistory: number;
  censorshipResistance: number;
  privacyPolicyScore: number;
}

export interface RelayMetrics {
  performance: RelayPerformanceMetrics;
  geographic: RelayGeographicMetrics;
  content: RelayContentMetrics;
  feature: RelayFeatureMetrics;
  community: RelayCommunityMetrics;
  trust: RelayTrustMetrics;
}

export interface RelaySortBreakdown {
  performance: number;
  geography: number;
  content: number;
  feature: number;
  community: number;
  trust: number;
}

export interface SimilarTopic {
  topic: string;
  count: number;
}

export interface RankedRelayRecommendation extends RelayRecommendation {
  reason: string;
  score: number;
  stars: number;
  badges: string[];
  metrics: RelayMetrics;
  breakdown: RelaySortBreakdown;
}

export type RelaySortMode = 'overall' | 'uptime' | 'latency' | 'popularity' | 'features';

export interface RelayFilter {
  regions?: string[];
  nips?: number[];
  pricing?: 'all' | 'free' | 'paid';
}

export interface RelayMetricsPayload {
  generatedAt: string;
  ttlSeconds: number;
  relays: RelayMetricsSeed[];
}

export interface RelayMetricsSeed extends RelayRecommendation {
  metrics: RelayMetrics;
}

const DEFAULT_RELAYS: RelayMetricsSeed[] = [
  {
    url: 'wss://relay.damus.io',
    name: 'Damus Relay',
    description: 'High-traffic public relay used across many clients.',
    reliability: 'high',
    region: 'Global',
    topics: ['general', 'social', 'mobile'],
    monthlyActiveUsers: 325000,
    activityScore: 0.95,
    uptime: 0.995,
    popularityScore: 0.98,
    metrics: {
      performance: { uptimePct: 99.5, latencyMs: 118, throughputEventsPerSec: 3400, connectionStability: 0.98 },
      geographic: { region: 'Global', cdnEdge: true, latencyToUserMs: 92 },
      content: { storageCapacityGb: 5500, retentionDays: 180, dataCompleteness: 0.93, supportedEventKinds: [0, 1, 3, 4, 6, 7, 40, 41, 42, 9735] },
      feature: { nips: [1, 2, 4, 9, 11, 15, 42, 50, 57], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 325000, eventVolumeDaily: 3100000, spamModeration: 0.79, focusTopics: ['social', 'general', 'mobile'] },
      trust: { operatorReputation: 0.89, uptimeHistory: 0.96, censorshipResistance: 0.9, privacyPolicyScore: 0.83 },
    },
  },
  {
    url: 'wss://relay.nostr.band',
    name: 'Nostr.Band Relay',
    description: 'Indexer-friendly relay with broad ecosystem reach.',
    reliability: 'high',
    region: 'Global',
    topics: ['general', 'search', 'analytics'],
    monthlyActiveUsers: 280000,
    activityScore: 0.92,
    uptime: 0.992,
    popularityScore: 0.94,
    metrics: {
      performance: { uptimePct: 99.2, latencyMs: 132, throughputEventsPerSec: 3800, connectionStability: 0.97 },
      geographic: { region: 'Global', cdnEdge: true, latencyToUserMs: 102 },
      content: { storageCapacityGb: 7200, retentionDays: 365, dataCompleteness: 0.96, supportedEventKinds: [0, 1, 3, 4, 6, 7, 1984, 9735, 10000, 30000] },
      feature: { nips: [1, 2, 4, 9, 11, 15, 33, 42, 50, 57], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 280000, eventVolumeDaily: 4200000, spamModeration: 0.84, focusTopics: ['search', 'analytics', 'news'] },
      trust: { operatorReputation: 0.91, uptimeHistory: 0.95, censorshipResistance: 0.87, privacyPolicyScore: 0.81 },
    },
  },
  {
    url: 'wss://nos.lol',
    name: 'nos.lol',
    description: 'Popular community relay with good uptime.',
    reliability: 'medium',
    region: 'US/EU',
    topics: ['general', 'memes', 'community'],
    monthlyActiveUsers: 165000,
    activityScore: 0.84,
    uptime: 0.976,
    popularityScore: 0.86,
    metrics: {
      performance: { uptimePct: 97.6, latencyMs: 165, throughputEventsPerSec: 1900, connectionStability: 0.93 },
      geographic: { region: 'US/EU', cdnEdge: false, latencyToUserMs: 128 },
      content: { storageCapacityGb: 2100, retentionDays: 120, dataCompleteness: 0.86, supportedEventKinds: [0, 1, 3, 4, 6, 7, 9735] },
      feature: { nips: [1, 2, 4, 9, 11, 42, 57], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 165000, eventVolumeDaily: 980000, spamModeration: 0.72, focusTopics: ['community', 'memes', 'social'] },
      trust: { operatorReputation: 0.8, uptimeHistory: 0.88, censorshipResistance: 0.84, privacyPolicyScore: 0.77 },
    },
  },
  {
    url: 'wss://relay.primal.net',
    name: 'Primal Relay',
    description: 'Common relay for social graph and profile fetches.',
    reliability: 'medium',
    region: 'Global',
    topics: ['social', 'profiles', 'feed'],
    monthlyActiveUsers: 210000,
    activityScore: 0.88,
    uptime: 0.981,
    popularityScore: 0.9,
    metrics: {
      performance: { uptimePct: 98.1, latencyMs: 140, throughputEventsPerSec: 2500, connectionStability: 0.95 },
      geographic: { region: 'Global', cdnEdge: true, latencyToUserMs: 95 },
      content: { storageCapacityGb: 3000, retentionDays: 150, dataCompleteness: 0.9, supportedEventKinds: [0, 1, 3, 6, 7, 9735, 10002] },
      feature: { nips: [1, 2, 9, 11, 42, 57, 65], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 210000, eventVolumeDaily: 1850000, spamModeration: 0.76, focusTopics: ['social', 'profiles', 'feed'] },
      trust: { operatorReputation: 0.85, uptimeHistory: 0.9, censorshipResistance: 0.86, privacyPolicyScore: 0.78 },
    },
  },
  {
    url: 'wss://purplepag.es',
    name: 'Purple Pages',
    description: 'Identity-focused relay often used for profile discovery and verification.',
    reliability: 'high',
    region: 'US',
    topics: ['identity', 'profiles', 'directories'],
    monthlyActiveUsers: 92000,
    activityScore: 0.76,
    uptime: 0.989,
    popularityScore: 0.72,
    metrics: {
      performance: { uptimePct: 98.9, latencyMs: 122, throughputEventsPerSec: 1200, connectionStability: 0.96 },
      geographic: { region: 'US', cdnEdge: false, latencyToUserMs: 110 },
      content: { storageCapacityGb: 1300, retentionDays: 365, dataCompleteness: 0.92, supportedEventKinds: [0, 3, 10002] },
      feature: { nips: [1, 2, 9, 11, 65], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 92000, eventVolumeDaily: 340000, spamModeration: 0.86, focusTopics: ['identity', 'directories'] },
      trust: { operatorReputation: 0.9, uptimeHistory: 0.94, censorshipResistance: 0.82, privacyPolicyScore: 0.85 },
    },
  },
  {
    url: 'wss://relay.snort.social',
    name: 'Snort Relay',
    description: 'Active social relay with strong usage in web-first clients.',
    reliability: 'high',
    region: 'EU/US',
    topics: ['social', 'news', 'community'],
    monthlyActiveUsers: 143000,
    activityScore: 0.82,
    uptime: 0.987,
    popularityScore: 0.79,
    metrics: {
      performance: { uptimePct: 98.7, latencyMs: 134, throughputEventsPerSec: 1750, connectionStability: 0.95 },
      geographic: { region: 'EU/US', cdnEdge: true, latencyToUserMs: 101 },
      content: { storageCapacityGb: 1900, retentionDays: 140, dataCompleteness: 0.88, supportedEventKinds: [0, 1, 3, 6, 7, 1984] },
      feature: { nips: [1, 2, 9, 11, 15, 42], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 143000, eventVolumeDaily: 710000, spamModeration: 0.8, focusTopics: ['news', 'social', 'community'] },
      trust: { operatorReputation: 0.84, uptimeHistory: 0.91, censorshipResistance: 0.85, privacyPolicyScore: 0.79 },
    },
  },
  // Auto-discovered from user relay lists (kind:10002) - 2026-02-28
  {
    url: 'wss://relay.momostr.pink',
    name: 'Momostr Relay',
    description: 'Popular community relay with strong Japanese/Asian presence.',
    reliability: 'high',
    region: 'APAC',
    topics: ['social', 'community', 'international'],
    monthlyActiveUsers: 180000,
    activityScore: 0.88,
    uptime: 0.985,
    popularityScore: 0.91,
    metrics: {
      performance: { uptimePct: 98.5, latencyMs: 145, throughputEventsPerSec: 2200, connectionStability: 0.94 },
      geographic: { region: 'APAC', cdnEdge: true, latencyToUserMs: 120 },
      content: { storageCapacityGb: 2500, retentionDays: 180, dataCompleteness: 0.89, supportedEventKinds: [0, 1, 3, 6, 7, 9735] },
      feature: { nips: [1, 2, 9, 11, 42, 57], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 180000, eventVolumeDaily: 1200000, spamModeration: 0.82, focusTopics: ['social', 'community'] },
      trust: { operatorReputation: 0.86, uptimeHistory: 0.93, censorshipResistance: 0.84, privacyPolicyScore: 0.8 },
    },
  },
  {
    url: 'wss://relay.ditto.pub',
    name: 'Ditto Relay',
    description: 'Ditto project relay with ActivityPub bridge capabilities.',
    reliability: 'high',
    region: 'Global',
    topics: ['social', 'fediverse', 'bridge'],
    monthlyActiveUsers: 120000,
    activityScore: 0.84,
    uptime: 0.991,
    popularityScore: 0.85,
    metrics: {
      performance: { uptimePct: 99.1, latencyMs: 125, throughputEventsPerSec: 1800, connectionStability: 0.96 },
      geographic: { region: 'Global', cdnEdge: true, latencyToUserMs: 95 },
      content: { storageCapacityGb: 2000, retentionDays: 200, dataCompleteness: 0.91, supportedEventKinds: [0, 1, 3, 6, 7, 9735, 10002] },
      feature: { nips: [1, 2, 9, 11, 42, 50, 57, 65], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 120000, eventVolumeDaily: 900000, spamModeration: 0.85, focusTopics: ['fediverse', 'bridge'] },
      trust: { operatorReputation: 0.88, uptimeHistory: 0.94, censorshipResistance: 0.87, privacyPolicyScore: 0.82 },
    },
  },
  {
    url: 'wss://nostr.oxtr.dev',
    name: 'Oxtr Dev Relay',
    description: 'Developer-friendly relay with good performance.',
    reliability: 'high',
    region: 'EU',
    topics: ['development', 'technical', 'general'],
    monthlyActiveUsers: 45000,
    activityScore: 0.75,
    uptime: 0.988,
    popularityScore: 0.72,
    metrics: {
      performance: { uptimePct: 98.8, latencyMs: 110, throughputEventsPerSec: 1400, connectionStability: 0.95 },
      geographic: { region: 'EU', cdnEdge: false, latencyToUserMs: 85 },
      content: { storageCapacityGb: 1200, retentionDays: 120, dataCompleteness: 0.87, supportedEventKinds: [0, 1, 3, 6, 7, 9735] },
      feature: { nips: [1, 2, 9, 11, 42, 57], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 45000, eventVolumeDaily: 280000, spamModeration: 0.78, focusTopics: ['development', 'technical'] },
      trust: { operatorReputation: 0.82, uptimeHistory: 0.91, censorshipResistance: 0.83, privacyPolicyScore: 0.79 },
    },
  },
  {
    url: 'wss://nostr.mom',
    name: 'Nostr.mom',
    description: 'Friendly community relay with good uptime.',
    reliability: 'medium',
    region: 'US',
    topics: ['social', 'community', 'general'],
    monthlyActiveUsers: 38000,
    activityScore: 0.71,
    uptime: 0.982,
    popularityScore: 0.68,
    metrics: {
      performance: { uptimePct: 98.2, latencyMs: 135, throughputEventsPerSec: 1100, connectionStability: 0.93 },
      geographic: { region: 'US', cdnEdge: false, latencyToUserMs: 100 },
      content: { storageCapacityGb: 800, retentionDays: 90, dataCompleteness: 0.84, supportedEventKinds: [0, 1, 3, 6, 7] },
      feature: { nips: [1, 2, 9, 11, 42], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 38000, eventVolumeDaily: 180000, spamModeration: 0.75, focusTopics: ['community', 'social'] },
      trust: { operatorReputation: 0.79, uptimeHistory: 0.88, censorshipResistance: 0.81, privacyPolicyScore: 0.76 },
    },
  },
  {
    url: 'wss://nostr.land',
    name: 'Nostr.land',
    description: 'Well-established relay with solid infrastructure.',
    reliability: 'high',
    region: 'EU',
    topics: ['general', 'social', 'news'],
    monthlyActiveUsers: 52000,
    activityScore: 0.77,
    uptime: 0.993,
    popularityScore: 0.74,
    metrics: {
      performance: { uptimePct: 99.3, latencyMs: 118, throughputEventsPerSec: 1600, connectionStability: 0.97 },
      geographic: { region: 'EU', cdnEdge: true, latencyToUserMs: 78 },
      content: { storageCapacityGb: 1500, retentionDays: 200, dataCompleteness: 0.9, supportedEventKinds: [0, 1, 3, 6, 7, 9735, 10002] },
      feature: { nips: [1, 2, 9, 11, 42, 57, 65], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 52000, eventVolumeDaily: 320000, spamModeration: 0.81, focusTopics: ['general', 'news'] },
      trust: { operatorReputation: 0.87, uptimeHistory: 0.95, censorshipResistance: 0.86, privacyPolicyScore: 0.83 },
    },
  },
  {
    url: 'wss://nostr.bitcoiner.social',
    name: 'Bitcoiner Social',
    description: 'Bitcoin-focused relay for the Bitcoin community.',
    reliability: 'high',
    region: 'Global',
    topics: ['bitcoin', 'finance', 'community'],
    monthlyActiveUsers: 68000,
    activityScore: 0.79,
    uptime: 0.987,
    popularityScore: 0.76,
    metrics: {
      performance: { uptimePct: 98.7, latencyMs: 128, throughputEventsPerSec: 1350, connectionStability: 0.94 },
      geographic: { region: 'Global', cdnEdge: false, latencyToUserMs: 105 },
      content: { storageCapacityGb: 1100, retentionDays: 150, dataCompleteness: 0.88, supportedEventKinds: [0, 1, 3, 6, 7, 9735] },
      feature: { nips: [1, 2, 9, 11, 42, 57], read: true, write: true, authRequired: false, paid: false },
      community: { activeUsers: 68000, eventVolumeDaily: 420000, spamModeration: 0.83, focusTopics: ['bitcoin', 'finance'] },
      trust: { operatorReputation: 0.88, uptimeHistory: 0.92, censorshipResistance: 0.89, privacyPolicyScore: 0.81 },
    },
  },
  {
    url: 'wss://nostr.wine',
    name: 'Nostr.wine',
    description: 'Premium relay with excellent uptime and low latency.',
    reliability: 'high',
    region: 'Global',
    topics: ['premium', 'general', 'social'],
    monthlyActiveUsers: 95000,
    activityScore: 0.83,
    uptime: 0.996,
    popularityScore: 0.82,
    metrics: {
      performance: { uptimePct: 99.6, latencyMs: 98, throughputEventsPerSec: 2400, connectionStability: 0.98 },
      geographic: { region: 'Global', cdnEdge: true, latencyToUserMs: 72 },
      content: { storageCapacityGb: 3500, retentionDays: 365, dataCompleteness: 0.94, supportedEventKinds: [0, 1, 3, 6, 7, 9735, 10002, 30023] },
      feature: { nips: [1, 2, 9, 11, 15, 42, 50, 57, 65], read: true, write: true, authRequired: false, paid: true },
      community: { activeUsers: 95000, eventVolumeDaily: 620000, spamModeration: 0.91, focusTopics: ['premium', 'quality'] },
      trust: { operatorReputation: 0.93, uptimeHistory: 0.97, censorshipResistance: 0.88, privacyPolicyScore: 0.86 },
    },
  },
];

const normalizeRelayUrl = (relay: string): string => relay.trim().toLowerCase().replace(/\/+$/, '');
const normalized = (value: number, min: number, max: number): number => {
  if (max <= min) return 1;
  const n = (value - min) / (max - min);
  return Math.max(0, Math.min(1, n));
};

const regionAffinity = (userRegion: string | undefined, relayRegion: string | undefined): number => {
  if (!userRegion || !relayRegion) return 0.5;
  const u = userRegion.toLowerCase();
  const r = relayRegion.toLowerCase();
  if (r.includes('global')) return 0.78;
  if (r.includes(u)) return 1;
  if ((u.includes('us') && r.includes('eu')) || (u.includes('eu') && r.includes('us'))) return 0.82;
  return 0.42;
};

const topicOverlap = (relayTopics: string[], userTopics: string[]): number => {
  if (userTopics.length === 0) return 0.55;
  const relaySet = new Set(relayTopics.map((t) => t.toLowerCase()));
  const matches = userTopics.filter((t) => relaySet.has(t.toLowerCase())).length;
  return matches > 0 ? Math.min(1, matches / Math.max(2, userTopics.length)) : 0.3;
};

const scoreStars = (score: number): number => {
  if (score >= 0.9) return 5;
  if (score >= 0.78) return 4;
  if (score >= 0.64) return 3;
  if (score >= 0.5) return 2;
  return 1;
};

const describeReason = (r: RankedRelayRecommendation): string => {
  const { performance, geography, feature, trust } = r.breakdown;
  if (performance > 0.88 && trust > 0.84) return 'Elite uptime and trusted operator track record';
  if (geography > 0.85) return 'Closest regional latency profile for your locale';
  if (feature > 0.84) return 'Strong NIP coverage and flexible read/write support';
  if (r.metrics.community.spamModeration > 0.82) return 'Healthier community signal with quality moderation';
  return 'Balanced relay across reliability, reach, and community quality';
};

const buildBadges = (metrics: RelayMetrics): string[] => {
  const badges: string[] = [];
  if (metrics.performance.uptimePct >= 99) badges.push('99%+ Uptime');
  if (metrics.performance.latencyMs <= 130) badges.push('Low Latency');
  if (metrics.geographic.cdnEdge) badges.push('CDN Edge');
  if (metrics.feature.nips.length >= 8) badges.push('NIP Rich');
  if (!metrics.feature.paid) badges.push('Free Access');
  if (metrics.trust.censorshipResistance >= 0.88) badges.push('Censorship-Resistant');
  return badges.slice(0, 4);
};

export function relayRecommendations(): RelayRecommendation[] {
  return DEFAULT_RELAYS;
}

export async function fetchRelayMetricsSeed(signal?: AbortSignal): Promise<RelayMetricsSeed[]> {
  try {
    const response = await fetch('/api/v1/relays/metrics', { signal });
    if (!response.ok) throw new Error(`metrics endpoint failed ${response.status}`);
    const payload = (await response.json()) as RelayMetricsPayload;
    if (!Array.isArray(payload?.relays) || payload.relays.length === 0) {
      throw new Error('invalid metrics payload');
    }
    return payload.relays;
  } catch {
    return DEFAULT_RELAYS;
  }
}

export function suggestedRelays(params: {
  configuredRelays: string[];
  userRegion?: string;
  preferredTopics?: string[];
  limit?: number;
  sortBy?: RelaySortMode;
  filters?: RelayFilter;
  relayUniverse?: RelayMetricsSeed[];
}): RankedRelayRecommendation[] {
  const configured = new Set(params.configuredRelays.map(normalizeRelayUrl));
  const userTopics = (params.preferredTopics || []).map((t) => t.toLowerCase());
  const limit = params.limit ?? 6;
  const sortBy = params.sortBy ?? 'overall';
  const filters = params.filters;
  const relayUniverse = params.relayUniverse ?? DEFAULT_RELAYS;

  const throughputValues = relayUniverse.map((relay) => relay.metrics.performance.throughputEventsPerSec);
  const latencyValues = relayUniverse.map((relay) => relay.metrics.performance.latencyMs);
  const activeUserValues = relayUniverse.map((relay) => relay.metrics.community.activeUsers);
  const eventVolumeValues = relayUniverse.map((relay) => relay.metrics.community.eventVolumeDaily);

  const throughputMin = Math.min(...throughputValues);
  const throughputMax = Math.max(...throughputValues);
  const latencyMin = Math.min(...latencyValues);
  const latencyMax = Math.max(...latencyValues);
  const activeUserMin = Math.min(...activeUserValues);
  const activeUserMax = Math.max(...activeUserValues);
  const eventVolumeMin = Math.min(...eventVolumeValues);
  const eventVolumeMax = Math.max(...eventVolumeValues);

  const ranked = relayUniverse
    .filter((relay) => !configured.has(normalizeRelayUrl(relay.url)))
    .filter((relay) => {
      if (!filters) return true;
      if (filters.regions?.length && !filters.regions.some((region) => (relay.metrics.geographic.region || relay.region || '').toLowerCase().includes(region.toLowerCase()))) return false;
      if (filters.nips?.length && !filters.nips.every((nip) => relay.metrics.feature.nips.includes(nip))) return false;
      if (filters.pricing === 'free' && relay.metrics.feature.paid) return false;
      if (filters.pricing === 'paid' && !relay.metrics.feature.paid) return false;
      return true;
    })
    .map((relay) => {
      const metrics = relay.metrics;
      const reliabilityWeight = relay.reliability === 'high' ? 1 : relay.reliability === 'medium' ? 0.76 : 0.5;

      const performance = (
        normalized(metrics.performance.uptimePct, 92, 100) * 0.36
        + (1 - normalized(metrics.performance.latencyMs, latencyMin, latencyMax)) * 0.27
        + normalized(metrics.performance.throughputEventsPerSec, throughputMin, throughputMax) * 0.22
        + metrics.performance.connectionStability * 0.15
      );

      const geography = (
        regionAffinity(params.userRegion, metrics.geographic.region || relay.region) * 0.55
        + (metrics.geographic.cdnEdge ? 1 : 0.6) * 0.2
        + (1 - normalized(metrics.geographic.latencyToUserMs, latencyMin, latencyMax)) * 0.25
      );

      const content = (
        normalized(metrics.content.storageCapacityGb, 500, 8000) * 0.25
        + normalized(metrics.content.retentionDays, 30, 365) * 0.3
        + metrics.content.dataCompleteness * 0.3
        + normalized(metrics.content.supportedEventKinds.length, 3, 14) * 0.15
      );

      const feature = (
        normalized(metrics.feature.nips.length, 3, 12) * 0.45
        + (metrics.feature.read ? 0.15 : 0)
        + (metrics.feature.write ? 0.15 : 0)
        + (metrics.feature.authRequired ? 0.08 : 0.14)
        + (metrics.feature.paid ? 0.06 : 0.11)
      );

      const community = (
        normalized(metrics.community.activeUsers, activeUserMin, activeUserMax) * 0.3
        + normalized(metrics.community.eventVolumeDaily, eventVolumeMin, eventVolumeMax) * 0.35
        + metrics.community.spamModeration * 0.2
        + topicOverlap(metrics.community.focusTopics, userTopics) * 0.15
      );

      const trust = (
        metrics.trust.operatorReputation * 0.3
        + metrics.trust.uptimeHistory * 0.25
        + metrics.trust.censorshipResistance * 0.25
        + metrics.trust.privacyPolicyScore * 0.2
      );

      const networkUsage = (relay.activityScore * 0.5) + (relay.popularityScore * 0.5);
      const overallScore = (
        performance * 0.28
        + geography * 0.12
        + content * 0.14
        + feature * 0.18
        + community * 0.14
        + trust * 0.14
      ) * 0.85 + (networkUsage * 0.15);

      const score = overallScore * 0.9 + (reliabilityWeight * 0.1);
      const popularityScore = (normalized(metrics.community.activeUsers, activeUserMin, activeUserMax) + normalized(metrics.community.eventVolumeDaily, eventVolumeMin, eventVolumeMax)) / 2;

      const sortScore =
        sortBy === 'uptime' ? metrics.performance.uptimePct / 100
          : sortBy === 'latency' ? (1 - normalized(metrics.performance.latencyMs, latencyMin, latencyMax))
            : sortBy === 'popularity' ? popularityScore
              : sortBy === 'features' ? feature
                : score;

      const rankedRelay: RankedRelayRecommendation = {
        ...relay,
        score: sortScore,
        reason: '',
        stars: scoreStars(score),
        badges: buildBadges(metrics),
        metrics,
        breakdown: {
          performance,
          geography,
          content,
          feature,
          community,
          trust,
        },
      };

      rankedRelay.reason = describeReason(rankedRelay);
      return rankedRelay;
    });

  return ranked
    .sort((a, b) => b.score - a.score || b.metrics.community.activeUsers - a.metrics.community.activeUsers)
    .slice(0, limit);
}

export function buildSimilarProfiles(candidates: DiscoverCardDataLike[], following: string[], limit = 18): DiscoverCardDataLike[] {
  const followingSet = new Set(following);
  return candidates
    .filter((card) => !followingSet.has(card.pubkey))
    .sort((a, b) =>
      (b.overlapScore + b.wotFollowerCount + b.activity) - (a.overlapScore + a.wotFollowerCount + a.activity)
      || b.score - a.score,
    )
    .slice(0, limit);
}

export function rankTopics(topicCounts: Record<string, number>, limit = 12): SimilarTopic[] {
  return Object.entries(topicCounts)
    .filter(([topic, count]) => topic.length > 1 && count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([topic, count]) => ({ topic, count }));
}

export function addRelay(existing: string[], relayUrl: string): string[] {
  if (existing.includes(relayUrl)) return existing;
  return [...existing, relayUrl];
}
