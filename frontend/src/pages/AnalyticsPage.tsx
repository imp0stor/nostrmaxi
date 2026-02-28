import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { clearAnalyticsCache, loadAnalyticsDashboard, type AnalyticsDashboardData, type AnalyticsInterval } from '../lib/analytics';
import { TimeRangePicker, type TimeRangeValue } from '../components/analytics/TimeRangePicker';
import { MetricCard } from '../components/analytics/MetricCard';
import { EngagementChart } from '../components/analytics/EngagementChart';
import { PostingActivityChart } from '../components/analytics/PostingActivityChart';
import { BestHoursChart } from '../components/analytics/BestHoursChart';
import { BestDaysChart } from '../components/analytics/BestDaysChart';
import { TopPostCard } from '../components/analytics/TopPostCard';
import { HashtagTable } from '../components/analytics/HashtagTable';
import { AnalyticsLoadingSkeleton } from '../components/analytics/AnalyticsLoadingSkeleton';

interface TimelineDataPoint {
  date: string;
  engagement: number;
  posts: number;
}

interface TopPost {
  id: string;
  content: string;
  reactions: number;
  reposts: number;
  zaps: number;
  zapAmount: number;
  score: number;
}

interface HashtagStat {
  tag: string;
  count: number;
  engagement: number;
}

interface UserMetrics {
  followerCount: number;
  followingCount: number;
  totalPosts: number;
  totalZaps: number;
  totalZapAmount: number;
  averageZapAmount: number;
  timeline: TimelineDataPoint[];
  bestHours: { hour: number; engagement: number }[];
  bestDays: { day: string; engagement: number }[];
  topPosts: TopPost[];
  topHashtags: HashtagStat[];
  topZappers: { pubkey: string; sats: number; count: number }[];
  recentPosts: { id: string; preview: string; createdAt: number }[];
  noHistoricalDataMessage?: string;
}

function formatSats(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function toRange(value: TimeRangeValue): AnalyticsInterval {
  if (value === '7d' || value === '30d' || value === '90d') return value;
  return '30d';
}

function mapMetrics(data: AnalyticsDashboardData): UserMetrics {
  const postsByDate = new Map(data.postsPerDay.map((p) => [p.label, p.value]));
  const timeline = data.engagementPerDay.map((point) => ({
    date: point.label,
    engagement: Number(point.value.toFixed(1)),
    posts: postsByDate.get(point.label) ?? 0,
  }));

  const topPosts: TopPost[] = data.topPosts.map((post) => ({
    id: post.id,
    content: post.preview,
    reactions: post.reactions,
    reposts: post.reposts,
    zaps: post.zaps,
    zapAmount: post.zapSats,
    score: Number(post.score.toFixed(1)),
  }));

  const topHashtags: HashtagStat[] = data.hashtagPerformance.map((tag) => ({
    tag: tag.hashtag.replace('#', ''),
    count: tag.posts,
    engagement: tag.engagement,
  }));

  return {
    followerCount: data.followerCount,
    followingCount: data.followingCount,
    totalPosts: data.totalPosts,
    totalZaps: data.zapStats.totalZaps,
    totalZapAmount: data.zapStats.totalSats,
    averageZapAmount: data.zapStats.averageZapAmount,
    timeline,
    bestHours: data.bestPostingTimes.hours,
    bestDays: data.bestPostingTimes.days,
    topPosts,
    topHashtags,
    topZappers: data.zapStats.topZappers.map((z) => ({ pubkey: z.pubkey, sats: z.totalSats, count: z.zapCount })),
    recentPosts: data.recentPosts,
    noHistoricalDataMessage: data.noHistoricalDataMessage,
  };
}

export function AnalyticsPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('30d');
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!user?.pubkey) return;

    const loadAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await loadAnalyticsDashboard(user.pubkey, 'individual', { interval: toRange(timeRange) }, refreshTick > 0);
        setMetrics(mapMetrics(response));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    void loadAnalytics();
  }, [user?.pubkey, timeRange, refreshTick]);

  const safeMetrics = useMemo<UserMetrics | null>(() => metrics, [metrics]);

  if (!user) return null;
  if (loading || !safeMetrics) return <AnalyticsLoadingSkeleton />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400">Real on-chain Nostr analytics (no synthetic metrics)</p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangePicker value={timeRange} onChange={(range) => setTimeRange(range)} />
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              clearAnalyticsCache();
              setRefreshTick((v) => v + 1);
            }}
            className="px-3 py-2 rounded-md bg-cyan-700 hover:bg-cyan-600 text-white text-sm"
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="cy-card p-4 text-red-300">{error}</div>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Followers" value={formatNumber(safeMetrics.followerCount)} icon="👥" />
        <MetricCard label="Following" value={formatNumber(safeMetrics.followingCount)} icon="➡️" />
        <MetricCard label="Posts" value={formatNumber(safeMetrics.totalPosts)} icon="📝" />
        <MetricCard label="Total Zaps" value={`${formatSats(safeMetrics.totalZapAmount)} sats`} icon="⚡" />
      </section>

      {safeMetrics.noHistoricalDataMessage && (
        <section className="cy-card p-5 text-gray-300">{safeMetrics.noHistoricalDataMessage}</section>
      )}

      {!safeMetrics.noHistoricalDataMessage && (
        <div className="grid md:grid-cols-2 gap-6">
          <EngagementChart data={safeMetrics.timeline} />
          <PostingActivityChart data={safeMetrics.timeline} />
        </div>
      )}

      <section className="cy-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">🕐 Best Times to Post</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <BestHoursChart hours={safeMetrics.bestHours} />
          <BestDaysChart days={safeMetrics.bestDays} />
        </div>
      </section>

      <section className="cy-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">🏆 Top Posts (Real Engagement)</h2>
        {safeMetrics.topPosts.length === 0 ? (
          <p className="text-gray-400">No post engagement data available yet.</p>
        ) : (
          <div className="space-y-3">
            {safeMetrics.topPosts.slice(0, 5).map((post, i) => (
              <TopPostCard key={post.id} rank={i + 1} post={post} />
            ))}
          </div>
        )}
      </section>

      <section className="cy-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">⚡ Zap Stats</h2>
        <p className="text-gray-300 mb-3">Average zap amount: {formatSats(safeMetrics.averageZapAmount)} sats</p>
        {safeMetrics.topZappers.length === 0 ? (
          <p className="text-gray-400">No zap data available yet.</p>
        ) : (
          <div className="space-y-2">
            {safeMetrics.topZappers.slice(0, 5).map((z) => (
              <div key={z.pubkey} className="flex justify-between text-sm text-gray-300">
                <span className="font-mono">{z.pubkey.slice(0, 12)}…</span>
                <span>{formatSats(z.sats)} sats ({z.count} zaps)</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="cy-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">#️⃣ Hashtag Performance</h2>
        {safeMetrics.topHashtags.length === 0 ? (
          <p className="text-gray-400">No hashtag data available yet.</p>
        ) : (
          <HashtagTable hashtags={safeMetrics.topHashtags} />
        )}
      </section>

      <section className="cy-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Posts</h2>
        {safeMetrics.recentPosts.length === 0 ? (
          <p className="text-gray-400">No recent posts found.</p>
        ) : (
          <div className="space-y-2">
            {safeMetrics.recentPosts.slice(0, 8).map((post) => (
              <div key={post.id} className="p-3 rounded bg-gray-800/50">
                <p className="text-gray-200 line-clamp-2">{post.preview}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(post.createdAt * 1000).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
