import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { loadAnalyticsDashboard, type AnalyticsDashboardData, type AnalyticsInterval } from '../lib/analytics';
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
  followerGrowth30d: number;
  engagementRate: number;
  totalZapAmount: number;
  reach: number;
  timeline: TimelineDataPoint[];
  bestHours: { hour: number; engagement: number }[];
  bestDays: { day: string; engagement: number }[];
  topPosts: TopPost[];
  topHashtags: HashtagStat[];
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

function computeInsights(metrics: UserMetrics): string[] {
  const insights: string[] = [];

  if (metrics.followerGrowth30d > 5) insights.push(`Your follower base is growing quickly (+${metrics.followerGrowth30d.toFixed(1)}%). Keep posting consistently to sustain momentum.`);
  if (metrics.engagementRate > 25) insights.push('Your engagement rate is strong. Prioritize content formats similar to your top-performing posts.');
  if (metrics.bestHours.length > 0) {
    const topHour = [...metrics.bestHours].sort((a, b) => b.engagement - a.engagement)[0];
    insights.push(`Best posting hour: ${topHour.hour}:00. Schedule your important posts around this time.`);
  }
  if (metrics.topHashtags[0]) insights.push(`Top hashtag #${metrics.topHashtags[0].tag} drives the highest engagement—reuse it strategically.`);
  if (insights.length === 0) insights.push('Keep posting regularly and include hashtags to unlock stronger analytics insights.');

  return insights;
}

function mapMetrics(data: AnalyticsDashboardData): UserMetrics {
  const followerSeries = data.profile.followerGrowth;
  const currentFollowers = followerSeries[followerSeries.length - 1]?.value ?? 0;
  const previousFollowers = followerSeries[0]?.value ?? 0;
  const followerGrowth30d = previousFollowers > 0 ? ((currentFollowers - previousFollowers) / previousFollowers) * 100 : 0;

  const timeline = data.profile.engagementRate.map((point, index) => ({
    date: point.label,
    engagement: Number(point.value.toFixed(1)),
    posts: data.profile.followerGrowth[index]?.value ?? 0,
  }));

  const hourMap = new Map<number, number>();
  data.content.bestPostingTimes.forEach((item) => {
    const hour = Number(item.hour.split(':')[0]);
    hourMap.set(hour, item.score);
  });

  const bestHours = Array.from({ length: 24 }, (_, hour) => ({ hour, engagement: hourMap.get(hour) ?? 0 }));

  const dayMap = new Map<string, number>();
  data.engagement.peakHoursHeatmap.forEach((point) => {
    dayMap.set(point.day, (dayMap.get(point.day) ?? 0) + point.value);
  });

  const bestDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
    day,
    engagement: Number((dayMap.get(day) ?? 0).toFixed(1)),
  }));

  const topPosts: TopPost[] = data.profile.topPosts.map((post) => ({
    id: post.id,
    content: post.preview,
    reactions: post.reactions,
    reposts: 0,
    zaps: 1,
    zapAmount: post.zaps,
    score: Number(post.score.toFixed(1)),
  }));

  const topHashtags: HashtagStat[] = data.content.hashtagEngagement.map((tag) => ({
    tag: tag.hashtag.replace('#', ''),
    count: tag.value,
    engagement: tag.value,
  }));

  return {
    followerCount: currentFollowers,
    followerGrowth30d,
    engagementRate: data.profile.engagementRate[data.profile.engagementRate.length - 1]?.value ?? 0,
    totalZapAmount: data.summary?.totalSatsReceived ?? 0,
    reach: data.profile.reachEstimate[data.profile.reachEstimate.length - 1]?.value ?? 0,
    timeline,
    bestHours,
    bestDays,
    topPosts,
    topHashtags,
  };
}

export function AnalyticsPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('30d');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.pubkey) return;

    const loadAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await loadAnalyticsDashboard(user.pubkey, 'individual', { interval: toRange(timeRange) });
        const mapped = mapMetrics(response);
        setMetrics(mapped);
        setInsights(computeInsights(mapped));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    void loadAnalytics();
  }, [user?.pubkey, timeRange]);

  const safeMetrics = useMemo<UserMetrics | null>(() => metrics, [metrics]);

  if (!user) return null;
  if (loading || !safeMetrics) return <AnalyticsLoadingSkeleton />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400">Track your Nostr performance</p>
        </div>
        <TimeRangePicker value={timeRange} onChange={(range) => setTimeRange(range)} />
      </header>

      {error && <div className="cy-card p-4 text-red-300">{error}</div>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Followers" value={safeMetrics.followerCount} change={safeMetrics.followerGrowth30d} icon="👥" />
        <MetricCard label="Engagement Rate" value={`${safeMetrics.engagementRate.toFixed(1)}%`} icon="📈" />
        <MetricCard label="Total Zaps" value={`${formatSats(safeMetrics.totalZapAmount)} sats`} icon="⚡" />
        <MetricCard label="Reach" value={formatNumber(safeMetrics.reach)} icon="🌐" />
      </section>

      {insights.length > 0 && (
        <section className="cy-card p-5">
          <h2 className="text-lg font-semibold text-cyan-400 mb-3">💡 Insights</h2>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                <span className="text-cyan-400">→</span>
                <p className="text-gray-200">{insight}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <EngagementChart data={safeMetrics.timeline} />
        <PostingActivityChart data={safeMetrics.timeline} />
      </div>

      <section className="cy-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">🕐 Best Times to Post</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <BestHoursChart hours={safeMetrics.bestHours} />
          <BestDaysChart days={safeMetrics.bestDays} />
        </div>
      </section>

      <section className="cy-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">🏆 Top Performing Content</h2>
        <div className="space-y-3">
          {safeMetrics.topPosts.slice(0, 5).map((post, i) => (
            <TopPostCard key={post.id} rank={i + 1} post={post} />
          ))}
        </div>
      </section>

      <section className="cy-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">#️⃣ Hashtag Performance</h2>
        <HashtagTable hashtags={safeMetrics.topHashtags} />
      </section>
    </div>
  );
}
