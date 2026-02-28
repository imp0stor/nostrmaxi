export type Interval = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';

export interface TimeRange {
  start: number;
  end: number;
}

export enum AnalyticsScope {
  USER = 'user',
  NETWORK = 'network',
  RELAY = 'relay',
  WOT = 'wot',
  TOPIC = 'topic',
}

export interface TopPost {
  id: string;
  content: string;
  reactions: number;
  reposts: number;
  zaps: number;
  zapAmount: number;
  score: number;
}

export interface TimelineDataPoint {
  date: string;
  posts: number;
  reactions: number;
  reposts: number;
  zaps: number;
  zapAmount: number;
}

export interface TrendingHashtag {
  tag: string;
  count: number;
  growth: number;
}

export interface TrendingTopic {
  topic: string;
  score: number;
}

export interface RelatedTopic {
  tag: string;
  cooccurrence: number;
}

export interface TrendingPost {
  id: string;
  pubkey: string;
  content: string;
  score: number;
  createdAt: number;
}

export interface RelayRanking {
  url: string;
  totalEvents: number;
  uniqueAuthors: number;
  marketShare: number;
  rank: number;
}

export interface RelayComparison {
  relays: RelayAnalytics[];
  generatedAt: number;
}

export interface Community {
  id: string;
  members: number;
  density: number;
  topMembers: string[];
}

export interface Connector {
  pubkey: string;
  bridgeScore: number;
}

export interface UserAnalytics {
  pubkey: string;
  timeRange: TimeRange;
  followers: number;
  followerGrowth: number;
  following: number;
  totalPosts: number;
  totalReactions: number;
  totalReposts: number;
  totalZaps: number;
  totalZapAmount: number;
  avgEngagementRate: number;
  reach: number;
  impressions: number;
  bestPostingHours: { hour: number; engagement: number }[];
  bestPostingDays: { day: string; engagement: number }[];
  contentTypes: {
    text: number;
    image: number;
    video: number;
    link: number;
  };
  topPosts: TopPost[];
  timeline: TimelineDataPoint[];
}

export interface NetworkAnalytics {
  timeRange: TimeRange;
  totalEvents: number;
  uniqueAuthors: number;
  activeUsers24h: number;
  activeUsers7d: number;
  newUsers: number;
  totalNotes: number;
  totalReactions: number;
  totalReposts: number;
  totalZaps: number;
  totalZapVolume: number;
  trendingHashtags: TrendingHashtag[];
  trendingTopics: TrendingTopic[];
  languageDistribution: { lang: string; percent: number }[];
  contentTypeDistribution: { type: string; percent: number }[];
  eventGrowthRate: number;
  userGrowthRate: number;
  activityTimeline: { date: string; events: number; users: number }[];
}

export interface RelayAnalytics {
  url: string;
  timeRange: TimeRange;
  uptime: number;
  avgLatencyMs: number;
  lastSeen: number;
  totalEvents: number;
  uniqueAuthors: number;
  eventsPerHour: number;
  eventKindDistribution: { kind: number; count: number }[];
  topAuthors: { pubkey: string; events: number }[];
  marketShare: number;
  rankByActivity: number;
}

export interface WotAnalytics {
  pubkey: string;
  timeRange: TimeRange;
  networkSize: number;
  directFollows: number;
  secondDegree: number;
  avgPathLength: number;
  influenceScore: number;
  keyConnectors: Connector[];
  communities: Community[];
  wotEngagementRate: number;
  mutualFollows: number;
  potentialReach: number;
}

export interface TopicAnalytics {
  hashtag: string;
  timeRange: TimeRange;
  totalPosts: number;
  uniqueAuthors: number;
  engagement: number;
  trendScore: number;
  velocity: number;
  peakTime: number;
  topAuthors: { pubkey: string; posts: number; engagement: number }[];
  relatedHashtags: RelatedTopic[];
  timeline: { date: string; posts: number; engagement: number }[];
}
