import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AnalyticsScope, loadAnalyticsDashboard, type AnalyticsInterval } from '../lib/analytics';
import { ZapBreakdownModal } from '../components/ZapBreakdownModal';
import { encodeNpub, truncateNpub } from '../lib/nostr';
import { fetchProfilesBatchCached, profileDisplayName } from '../lib/profileCache';
import { Avatar } from '../components/Avatar';
import { ConfigAccordion } from '../components/ConfigAccordion';
import { TimeRangePicker, type TimeRangeValue } from '../components/analytics/TimeRangePicker';
import { TrendChart, type TrendPoint } from '../components/analytics/TrendChart';

const SCOPE_STORAGE_KEY = 'nostrmaxi.analytics.scope';

const IMAGE_URL_PATTERNS = [
  /https?:\/\/blossom\.[^/]+\/[^\s]+/i,
  /https?:\/\/nostr\.build\/[^\s]+/i,
  /https?:\/\/void\.cat\/[^\s]+/i,
  /https?:\/\/imgur\.com\/[^\s]+/i,
  /https?:\/\/i\.imgur\.com\/[^\s]+/i,
  /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?/i,
];

function extractImageUrl(content: string): string | null {
  for (const pattern of IMAGE_URL_PATTERNS) {
    const match = content.match(pattern);
    if (match) return match[0].replace(/[),.;!?]+$/, '');
  }
  return null;
}

function extractPostText(content: string, imageUrl: string | null): string {
  if (!imageUrl) return content.trim();
  return content.replace(imageUrl, '').trim();
}

function scopeLabel(scope: AnalyticsScope): string {
  switch (scope) {
    case 'individual': return 'Individual (You Only)';
    case 'following': return 'Following (People You Follow)';
    case 'wot': return 'WoT (Your Network)';
    case 'global': return 'Global (All Nostr)';
    default: return 'Unknown';
  }
}

function scopeInsight(scope: AnalyticsScope): string {
  switch (scope) {
    case 'individual': return 'Your personal analytics: posts, engagement, growth, and reach.';
    case 'following': return 'Trending among people you follow: discover what your network is sharing.';
    case 'wot': return 'Trending in your extended network: trusted follows + 2nd degree voices.';
    case 'global': return 'Trending globally: full Nostr stream and broad network momentum.';
    default: return '';
  }
}

function Sparkline({ points, color = '#00d4ff' }: { points: number[]; color?: string }) {
  const max = Math.max(1, ...points);
  const path = points
    .map((value, i) => `${(i / Math.max(1, points.length - 1)) * 100},${100 - ((value / max) * 100)}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 100" className="w-full h-14">
      <polyline fill="none" stroke={color} strokeWidth="4" points={path} />
    </svg>
  );
}

function toTrendData(data: any): TrendPoint[] {
  const posts = data?.profile?.followerGrowth ?? [];
  const reactions = data?.profile?.engagementRate ?? [];
  const reposts = data?.network?.networkGrowth ?? [];
  const zaps = data?.engagement?.zaps ?? [];
  const maxLen = Math.max(posts.length, reactions.length, reposts.length, zaps.length);

  return Array.from({ length: maxLen }).map((_, i) => ({
    date: posts[i]?.label ?? reactions[i]?.label ?? reposts[i]?.label ?? zaps[i]?.label ?? `#${i + 1}`,
    posts: Number(posts[i]?.value ?? 0),
    reactions: Number(reactions[i]?.value ?? 0),
    reposts: Number(reposts[i]?.value ?? 0),
    zaps: Number(zaps[i]?.value ?? 0),
    zapAmount: Number(zaps[i]?.secondary ?? 0),
  }));
}

function formatMetric(metric: 'posts' | 'reactions' | 'reposts' | 'zaps' | 'zapAmount', value: number): string {
  if (metric === 'zapAmount') return `${Math.round(value).toLocaleString()} sats`;
  if (metric === 'reactions') return `${value.toLocaleString()}%`;
  return Math.round(value).toLocaleString();
}

export function AnalyticsPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<AnalyticsScope>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(SCOPE_STORAGE_KEY) : null;
    if (stored === 'individual' || stored === 'following' || stored === 'wot' || stored === 'global') return stored;
    return 'individual';
  });
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('30d');
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [comparePrevious, setComparePrevious] = useState(false);
  const [performanceMetric, setPerformanceMetric] = useState<'posts' | 'reactions' | 'zaps' | 'reposts'>('posts');
  const [expandedMetric, setExpandedMetric] = useState<'followers' | 'engagement' | 'reach' | 'profileViews' | 'network' | null>(null);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [previousData, setPreviousData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [zapperProfiles, setZapperProfiles] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const range = {
      interval: timeRange as AnalyticsInterval,
      ...(timeRange === 'custom' && customStart && customEnd
        ? {
            startTs: Math.floor(customStart.getTime() / 1000),
            endTs: Math.floor(customEnd.getTime() / 1000),
          }
        : {}),
    };

    loadAnalyticsDashboard(user.pubkey, scope, range)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));

    if (comparePrevious) {
      const now = Date.now();
      const prevRange = timeRange === '7d'
        ? { interval: 'custom' as AnalyticsInterval, startTs: Math.floor((now - (14 * 86400000)) / 1000), endTs: Math.floor((now - (7 * 86400000)) / 1000) }
        : timeRange === '90d'
          ? { interval: 'custom' as AnalyticsInterval, startTs: Math.floor((now - (180 * 86400000)) / 1000), endTs: Math.floor((now - (90 * 86400000)) / 1000) }
          : timeRange === '1y'
            ? { interval: 'custom' as AnalyticsInterval, startTs: Math.floor((now - (730 * 86400000)) / 1000), endTs: Math.floor((now - (365 * 86400000)) / 1000) }
            : timeRange === 'custom' && customStart && customEnd
              ? {
                  interval: 'custom' as AnalyticsInterval,
                  startTs: Math.floor((customStart.getTime() - (customEnd.getTime() - customStart.getTime())) / 1000),
                  endTs: Math.floor(customStart.getTime() / 1000),
                }
              : { interval: 'custom' as AnalyticsInterval, startTs: Math.floor((now - (60 * 86400000)) / 1000), endTs: Math.floor((now - (30 * 86400000)) / 1000) };

      loadAnalyticsDashboard(user.pubkey, scope, prevRange).then(setPreviousData).catch(() => setPreviousData(null));
    } else {
      setPreviousData(null);
    }
  }, [user, scope, timeRange, customStart, customEnd, comparePrevious]);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(SCOPE_STORAGE_KEY, scope);
  }, [scope]);

  useEffect(() => {
    if (!data?.engagement?.topZappers) return;
    const pubkeys = data.engagement.topZappers
      .filter((z: any) => z.pubkey !== 'anonymous')
      .map((z: any) => z.pubkey);
    fetchProfilesBatchCached(pubkeys).then(setZapperProfiles);
  }, [data]);

  const insight = useMemo(() => scopeInsight(scope), [scope]);
  const trendData = useMemo(() => toTrendData(data), [data]);
  const previousTrendData = useMemo(() => toTrendData(previousData), [previousData]);

  const performanceToggles: { key: 'posts' | 'reactions' | 'zaps' | 'reposts'; label: string }[] = [
    { key: 'posts', label: 'Posts' },
    { key: 'reactions', label: 'Reactions' },
    { key: 'zaps', label: 'Zaps' },
    { key: 'reposts', label: 'Reach' },
  ];

  const metricCards = data
    ? [
        { key: 'followers' as const, title: 'Followers', metric: 'posts' as const, value: data.profile.followerGrowth.at(-1)?.value ?? 0, series: data.profile.followerGrowth.map((p: any) => p.value), color: '#00d4ff' },
        { key: 'engagement' as const, title: 'Engagement', metric: 'reactions' as const, value: data.profile.engagementRate.at(-1)?.value ?? 0, series: data.profile.engagementRate.map((p: any) => p.value), color: '#34d399' },
        { key: 'reach' as const, title: 'Reach', metric: 'reposts' as const, value: data.profile.reachEstimate.at(-1)?.value ?? 0, series: data.profile.reachEstimate.map((p: any) => p.value), color: '#60a5fa' },
        { key: 'profileViews' as const, title: 'Profile views', metric: 'zaps' as const, value: data.profile.profileViews.at(-1)?.value ?? 0, series: data.profile.profileViews.map((p: any) => p.value), color: '#f472b6' },
        { key: 'network' as const, title: 'Network size', metric: 'zapAmount' as const, value: data.network.networkGrowth.at(-1)?.value ?? 0, series: data.network.networkGrowth.map((p: any) => p.value), color: '#a78bfa' },
      ]
    : [];

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <ConfigAccordion
        id="analytics-scope-controls"
        title="Analytics Scope & Controls"
        subtitle="Compact mode: expand only when you want to adjust scope/export options."
        summary={<span>Current scope: <strong className="text-cyan-200">{scopeLabel(scope)}</strong></span>}
        defaultOpen={false}
        rightSlot={<span className="text-xs text-blue-300">Active: <strong className="text-cyan-200">{scopeLabel(scope)}</strong></span>}
      >
        <div>
          <p className="cy-kicker">ANALYTICS COMMAND CENTER</p>
          <h1 className="cy-title">Nostr Intelligence Dashboard</h1>
          <p className="text-blue-200 mt-2">{insight}</p>
        </div>
        <div className="inline-flex border border-cyan-800 rounded-lg overflow-hidden flex-wrap">
          {(['individual', 'following', 'wot', 'global'] as AnalyticsScope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-4 py-2 text-sm transition border-r border-cyan-800 last:border-r-0 ${
                scope === s
                  ? 'bg-cyan-500/20 text-cyan-100 shadow-[0_0_20px_rgba(0,212,255,0.35)]'
                  : 'text-blue-200 hover:text-cyan-200 hover:bg-cyan-500/10'
              }`}
            >
              {s === 'individual' ? 'You' : s === 'following' ? 'Following' : s === 'wot' ? 'WoT' : 'Global'}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end text-xs text-blue-300">
          <button
            className="cy-btn-secondary"
            onClick={() => {
              if (!data) return;
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `nostrmaxi-analytics-${scope}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </button>
        </div>
      </ConfigAccordion>

      <TimeRangePicker
        value={timeRange}
        customStart={customStart}
        customEnd={customEnd}
        onChange={(range, start, end) => {
          setTimeRange(range);
          if (range === 'custom') {
            setCustomStart(start ?? customStart);
            setCustomEnd(end ?? customEnd);
          }
        }}
      />

      <div className="cy-card p-3 flex items-center justify-between">
        <span className="text-sm text-blue-200">Compare to previous period</span>
        <button
          type="button"
          onClick={() => setComparePrevious((v) => !v)}
          className={`px-3 py-1 rounded-full text-xs border transition ${comparePrevious ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-cyan-800 text-blue-200'}`}
        >
          {comparePrevious ? 'On' : 'Off'}
        </button>
      </div>

      {loading && <div className="cy-card p-6 text-cyan-200">Loading analytics…</div>}
      {error && <div className="cy-card p-6 text-red-300">{error}</div>}

      {data && (
        <>
          <div className="grid lg:grid-cols-5 gap-4">
            {metricCards.map((card) => {
              const prevVal = previousData ? Number(
                card.key === 'followers' ? previousData.profile.followerGrowth.at(-1)?.value ?? 0
                : card.key === 'engagement' ? previousData.profile.engagementRate.at(-1)?.value ?? 0
                : card.key === 'reach' ? previousData.profile.reachEstimate.at(-1)?.value ?? 0
                : card.key === 'profileViews' ? previousData.profile.profileViews.at(-1)?.value ?? 0
                : previousData.network.networkGrowth.at(-1)?.value ?? 0,
              ) : null;
              const delta = prevVal && prevVal !== 0 ? (((Number(card.value) - prevVal) / prevVal) * 100) : null;

              return (
                <button key={card.key} onClick={() => setExpandedMetric((current) => current === card.key ? null : card.key)} className="cy-card p-4 text-left hover:border-cyan-300/60 transition-colors">
                  <p className="cy-kicker">{card.title}</p>
                  <p className="text-2xl text-cyan-100 mt-2">{formatMetric(card.metric, Number(card.value))}</p>
                  {comparePrevious && delta !== null && Number.isFinite(delta) && (
                    <p className={`text-xs mt-1 ${delta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</p>
                  )}
                  <Sparkline points={card.series} color={card.color} />
                  {expandedMetric === card.key && (
                    <div className="mt-2 pt-2 border-t border-cyan-900/70">
                      <TrendChart data={trendData} metric={card.metric} previousData={comparePrevious ? previousTrendData : undefined} height={180} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <section className="cy-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-cyan-200 font-semibold">Performance Over Time</h2>
              <div className="flex flex-wrap gap-2">
                {performanceToggles.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPerformanceMetric(item.key)}
                    className={`px-3 py-1 rounded-full text-xs border transition ${
                      performanceMetric === item.key
                        ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100 shadow-[0_0_14px_rgba(0,212,255,0.35)]'
                        : 'border-cyan-800 text-blue-200 hover:text-cyan-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <TrendChart data={trendData} metric={performanceMetric} previousData={comparePrevious ? previousTrendData : undefined} height={320} />
          </section>

          <section className="grid xl:grid-cols-2 gap-4">
            <ChartCard title={scope === 'wot' ? 'Trending in your network' : 'Trending globally'}>
              <BarList rows={data.content.hashtagEngagement.map((h: any) => ({ label: h.hashtag, value: h.value }))} />
            </ChartCard>
            <ChartCard title="Top posts by zaps/reactions">
              <div className="space-y-2">
                {data.profile.topPosts.map((post: any) => {
                  const preview = post.preview ?? '';
                  const imageUrl = extractImageUrl(preview);
                  const boundedText = extractPostText(preview, imageUrl);

                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setSelectedPostId(post.id)}
                      className="cy-panel p-3 text-sm w-full text-left hover:border-cyan-300/60 transition-colors cursor-pointer"
                    >
                      {imageUrl && <img src={imageUrl} alt="Post media" loading="lazy" className="w-full h-24 object-cover rounded-md mb-2" />}
                      <p className="text-cyan-100 overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">{boundedText || preview}</p>
                      <div className="text-blue-300 text-xs mt-1">⚡ {post.zaps.toLocaleString()} sats · ❤ {post.reactions} reactions · Score {post.score}</div>
                      <div className="text-xs text-cyan-400/70 mt-1">Click for zap breakdown →</div>
                    </button>
                  );
                })}
              </div>
            </ChartCard>
            <ChartCard title="Content type performance">
              <Donut rows={data.content.contentTypePerformance.map((d: any) => ({ label: d.type, value: d.value }))} />
            </ChartCard>
            <ChartCard title="Best posting times">
              <BarList rows={data.content.bestPostingTimes.map((h: any) => ({ label: h.hour, value: h.score }))} />
            </ChartCard>
            <ChartCard title="Relay performance">
              <BarList rows={data.relay.relayPerformance.map((r: any) => ({ label: r.relay.replace('wss://', ''), value: Math.round(r.uptime) }))} suffix="% uptime" />
            </ChartCard>
            <ChartCard title="Influential connections">
              <BarList rows={data.network.influentialConnections.map((c: any) => ({ label: c.pubkey.slice(0, 14), value: c.influence }))} />
            </ChartCard>
          </section>

          {data.engagement?.topZappers && data.engagement.topZappers.length > 0 && (
            <section className="cy-card p-6">
              <h2 className="text-cyan-200 font-semibold mb-4 text-xl">⚡ Top Zappers</h2>
              <p className="text-blue-200 text-sm mb-6">Your biggest supporters — click for profile</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.engagement.topZappers.map((zapper: any) => {
                  const profile = zapperProfiles.get(zapper.pubkey);
                  const isAnon = zapper.pubkey === 'anonymous';
                  const displayName = isAnon ? 'Anonymous' : profileDisplayName(zapper.pubkey, profile);
                  const npub = isAnon ? '' : encodeNpub(zapper.pubkey);

                  return (
                    <div key={zapper.pubkey} className="cy-panel p-4 hover:border-cyan-300/60 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        {!isAnon && <Avatar pubkey={zapper.pubkey} size={40} />}
                        {isAnon && <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-300 text-xl">👤</div>}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-cyan-100 truncate">{displayName}</p>
                          {!isAnon && <p className="text-xs text-cyan-300/70 truncate">{truncateNpub(npub)}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-lg font-bold text-cyan-100">{zapper.totalSats.toLocaleString()}</p><p className="text-xs text-blue-300">Total sats</p></div>
                        <div><p className="text-lg font-bold text-cyan-100">{zapper.zapCount}</p><p className="text-xs text-blue-300">Zaps</p></div>
                        <div><p className="text-lg font-bold text-cyan-100">{zapper.averageSats}</p><p className="text-xs text-blue-300">Avg</p></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {selectedPostId && <ZapBreakdownModal eventId={selectedPostId} onClose={() => setSelectedPostId(null)} />}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="cy-card p-5">
      <h2 className="text-cyan-200 font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function BarList({ rows, suffix = '' }: { rows: { label: string; value: number }[]; suffix?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="text-xs text-blue-200 flex justify-between"><span>{row.label}</span><span>{row.value}{suffix ? ` ${suffix}` : ''}</span></div>
          <div className="h-2 bg-blue-950/80 mt-1">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut({ rows }: { rows: { label: string; value: number }[] }) {
  const total = Math.max(1, rows.reduce((sum, r) => sum + r.value, 0));
  let acc = 0;
  const colors = ['#00d4ff', '#34d399', '#a78bfa', '#f472b6', '#60a5fa'];
  return (
    <div className="flex items-center gap-4">
      <svg width="180" height="180" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#11254d" strokeWidth="7" />
        {rows.map((row, idx) => {
          const pct = (row.value / total) * 100;
          const node = (
            <circle
              key={row.label}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={colors[idx % colors.length]}
              strokeWidth="7"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 21 21)"
            />
          );
          acc += pct;
          return node;
        })}
      </svg>
      <div className="space-y-1 text-sm">
        {rows.map((row, idx) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="inline-block w-2 h-2" style={{ backgroundColor: colors[idx % colors.length] }} />
            <span className="text-blue-200">{row.label}: {row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
