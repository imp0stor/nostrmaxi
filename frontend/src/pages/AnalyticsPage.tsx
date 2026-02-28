import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { SimplePool } from 'nostr-tools';
import { useAuth } from '../hooks/useAuth';
import { clearAnalyticsCache, loadAnalyticsDashboard, type AnalyticsDashboardData, type AnalyticsInterval } from '../lib/analytics';
import type { NostrEvent } from '../types';
import { FALLBACK_RELAYS } from '../lib/relayConfig';
import { parseZapReceipt } from '../lib/zaps';
import { fetchProfilesBatchCached, profileDisplayName } from '../lib/profileCache';
import { encodeNpub, truncateNpub } from '../lib/nostr';
import { TimeRangePicker, type TimeRangeValue } from '../components/analytics/TimeRangePicker';
import { MetricCard } from '../components/analytics/MetricCard';
import { EngagementChart } from '../components/analytics/EngagementChart';
import { PostingActivityChart } from '../components/analytics/PostingActivityChart';
import { BestHoursChart } from '../components/analytics/BestHoursChart';
import { BestDaysChart } from '../components/analytics/BestDaysChart';
import { TopPostCard } from '../components/analytics/TopPostCard';
import { HashtagTable } from '../components/analytics/HashtagTable';
import { AnalyticsLoadingSkeleton } from '../components/analytics/AnalyticsLoadingSkeleton';
import { Avatar } from '../components/Avatar';
import { PostModal } from '../components/PostModal';

interface TimelineDataPoint {
  date: string;
  engagement: number;
  posts: number;
}

interface TopPost {
  id: string;
  content: string;
  reactions: number;
  replies: number;
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

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function useDialogA11y(isOpen: boolean, onClose: () => void, closeButtonRef: RefObject<HTMLButtonElement | null>, modalRef: RefObject<HTMLDivElement | null>, openAnnouncement: string, closeAnnouncement: string) {
  const [announceText, setAnnounceText] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      return;
    }

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setAnnounceText(openAnnouncement);

    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true);
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
      setAnnounceText(closeAnnouncement);
    };
  }, [isOpen, openAnnouncement, closeAnnouncement, closeButtonRef]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, modalRef]);

  return { announceText, isVisible };
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
    replies: post.replies,
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

function ZapperDetailModal({ pubkey, viewerPubkey, onClose }: { pubkey: string | null; viewerPubkey: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [zaps, setZaps] = useState<Array<{ id: string; createdAt: number; amount: number; message: string }>>([]);

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const { announceText, isVisible } = useDialogA11y(Boolean(pubkey), onClose, closeButtonRef, modalRef, 'Zapper details dialog opened', 'Zapper details dialog closed');

  const load = async () => {
    if (!pubkey) return;
    setLoading(true);
    setError(null);

    try {
      const pool = new SimplePool();
      const [events, profiles] = await Promise.all([
        pool.querySync(FALLBACK_RELAYS, { kinds: [9735], authors: [pubkey], '#p': [viewerPubkey], limit: 300 }) as Promise<NostrEvent[]>,
        fetchProfilesBatchCached([pubkey]),
      ]);
      setProfile(profiles.get(pubkey) ?? null);
      const parsed = events
        .map((evt) => ({
          id: evt.id,
          createdAt: evt.created_at,
          amount: parseZapReceipt(evt)?.amountSat ?? 0,
          message: parseZapReceipt(evt)?.content ?? '',
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      setZaps(parsed);
    } catch (loadError) {
      console.error('Failed to load zapper details', loadError);
      setError('Could not load zapper details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pubkey) return;
    void load();
  }, [pubkey, viewerPubkey]);

  if (!pubkey) return null;
  const npub = encodeNpub(pubkey);

  return (
    <>
      <div className="sr-only" aria-live="polite">{announceText}</div>
      <div
        className={`fixed inset-0 z-50 p-0 sm:p-6 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        role="presentation"
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="zapper-modal-title"
          className={`w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl border border-cyan-500/30 bg-[#070b16] max-h-[90vh] overflow-y-auto shadow-2xl transition-all duration-200 ease-out transform ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-[#070b16]/95 backdrop-blur-sm sticky top-0">
            <h3 id="zapper-modal-title" className="text-lg font-semibold text-white">Top Zapper Details</h3>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="text-xl text-gray-300 hover:text-white rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label="Close zapper details"
            >
              ×
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar pubkey={pubkey} size={42} clickable={false} />
              <div>
                <p className="text-white font-semibold">{profileDisplayName(pubkey, profile)}</p>
                <p className="text-xs text-gray-400">{profile?.nip05 || truncateNpub(npub, 8)}</p>
              </div>
              <Link to={`/profile/${npub}`} className="ml-auto text-sm px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Open Profile</Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <span className="inline-block h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Loading...
                </div>
                {[...Array.from({ length: 4 })].map((_, i) => (
                  <div key={i} className="h-16 rounded bg-gray-800/60 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="space-y-3">
                <p className="text-red-300">{error}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="px-3 py-2 rounded-md bg-red-700/80 hover:bg-red-700 text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  Retry
                </button>
              </div>
            ) : zaps.length === 0 ? (
              <p className="text-gray-400">⚡ No zaps yet from this zapper in the selected relay set.</p>
            ) : (
              <div className="space-y-2">
                {zaps.map((zap) => (
                  <div key={zap.id} className="rounded border border-gray-700/60 bg-gray-800/60 p-3 shadow-sm transition-colors hover:border-cyan-500/30">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cyan-200">⚡ {zap.amount.toLocaleString()} sats</span>
                      <span className="text-gray-400">{new Date(zap.createdAt * 1000).toLocaleString()}</span>
                    </div>
                    {zap.message && <p className="text-gray-200 text-sm mt-2 whitespace-pre-wrap break-words">{zap.message}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function HashtagPostsModal({ hashtag, authorPubkey, onClose }: { hashtag: string | null; authorPubkey: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<NostrEvent[]>([]);

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const { announceText, isVisible } = useDialogA11y(Boolean(hashtag), onClose, closeButtonRef, modalRef, 'Hashtag posts dialog opened', 'Hashtag posts dialog closed');

  const load = async () => {
    if (!hashtag) return;
    setLoading(true);
    setError(null);
    try {
      const pool = new SimplePool();
      const events = await pool.querySync(FALLBACK_RELAYS, {
        kinds: [1],
        authors: [authorPubkey],
        '#t': [hashtag.toLowerCase()],
        limit: 100,
      }) as NostrEvent[];
      setPosts(events.sort((a, b) => b.created_at - a.created_at));
    } catch (loadError) {
      console.error('Failed to load hashtag posts', loadError);
      setError('Could not load hashtag posts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hashtag) return;
    void load();
  }, [hashtag, authorPubkey]);

  if (!hashtag) return null;

  return (
    <>
      <div className="sr-only" aria-live="polite">{announceText}</div>
      <div
        className={`fixed inset-0 z-50 p-0 sm:p-6 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        role="presentation"
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="hashtag-modal-title"
          className={`w-full sm:max-w-3xl rounded-t-2xl sm:rounded-xl border border-cyan-500/30 bg-[#070b16] max-h-[90vh] overflow-y-auto shadow-2xl transition-all duration-200 ease-out transform ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-[#070b16]/95 backdrop-blur-sm sticky top-0">
            <h3 id="hashtag-modal-title" className="text-lg font-semibold text-white">#{hashtag} posts</h3>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="text-xl text-gray-300 hover:text-white rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label="Close hashtag posts"
            >
              ×
            </button>
          </div>
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <span className="inline-block h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Loading...
                </div>
                {[...Array.from({ length: 4 })].map((_, i) => (
                  <div key={i} className="h-16 rounded bg-gray-800/60 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="space-y-3">
                <p className="text-red-300">{error}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="px-3 py-2 rounded-md bg-red-700/80 hover:bg-red-700 text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  Retry
                </button>
              </div>
            ) : posts.length === 0 ? (
              <p className="text-gray-400">📭 No posts found for this hashtag in the selected time window.</p>
            ) : (
              posts.map((post) => (
                <a
                  key={post.id}
                  href={`https://njump.me/${post.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded border border-gray-700/60 bg-gray-800/50 p-3 hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <p className="text-gray-200 whitespace-pre-wrap break-words line-clamp-3">{post.content}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(post.created_at * 1000).toLocaleString()}</p>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function AnalyticsPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('30d');
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedPost, setSelectedPost] = useState<TopPost | null>(null);
  const [selectedZapperPubkey, setSelectedZapperPubkey] = useState<string | null>(null);
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);

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
            className="px-3 py-2 rounded-md bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-500 text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div className="cy-card p-4 text-red-300 flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              setRefreshTick((v) => v + 1);
            }}
            className="px-3 py-2 rounded-md bg-red-700/80 hover:bg-red-700 active:bg-red-600 text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            Retry
          </button>
        </div>
      )}

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
          <p className="text-gray-400">📭 No posts found yet. Publish a post to start tracking engagement.</p>
        ) : (
          <div className="space-y-3">
            {safeMetrics.topPosts.slice(0, 5).map((post, i) => (
              <TopPostCard key={post.id} rank={i + 1} post={post} onClick={() => setSelectedPost(post)} />
            ))}
          </div>
        )}
      </section>

      <section className="cy-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">⚡ Zap Stats</h2>
        <p className="text-gray-300 mb-3">Average zap amount: {formatSats(safeMetrics.averageZapAmount)} sats</p>
        {safeMetrics.topZappers.length === 0 ? (
          <p className="text-gray-400">⚡ No zaps yet.</p>
        ) : (
          <div className="space-y-2">
            {safeMetrics.topZappers.slice(0, 5).map((z) => (
              <button
                key={z.pubkey}
                type="button"
                onClick={() => setSelectedZapperPubkey(z.pubkey)}
                className="w-full flex justify-between text-sm text-gray-300 hover:bg-gray-800/40 active:bg-gray-800/70 rounded px-2 py-1 border border-transparent hover:border-cyan-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <span className="font-mono">{z.pubkey.slice(0, 12)}…</span>
                <span>{formatSats(z.sats)} sats ({z.count} zaps)</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="cy-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">#️⃣ Hashtag Performance</h2>
        {safeMetrics.topHashtags.length === 0 ? (
          <p className="text-gray-400">🏷️ No hashtag data yet.</p>
        ) : (
          <HashtagTable hashtags={safeMetrics.topHashtags} onTagClick={(tag) => setSelectedHashtag(tag)} />
        )}
      </section>

      <section className="cy-card p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Posts</h2>
        {safeMetrics.recentPosts.length === 0 ? (
          <p className="text-gray-400">📭 No recent posts found.</p>
        ) : (
          <div className="space-y-2">
            {safeMetrics.recentPosts.slice(0, 8).map((post) => (
              <div key={post.id} className="p-3 rounded border border-gray-700/60 bg-gray-800/50 shadow-sm">
                <p className="text-gray-200 line-clamp-2">{post.preview}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(post.createdAt * 1000).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <PostModal
        eventId={selectedPost?.id ?? null}
        isOpen={Boolean(selectedPost)}
        onClose={() => setSelectedPost(null)}
        initialMetrics={selectedPost ? {
          reactions: selectedPost.reactions,
          reposts: selectedPost.reposts,
          replies: selectedPost.replies,
          zaps: selectedPost.zaps,
          zapSats: selectedPost.zapAmount,
        } : undefined}
      />

      <ZapperDetailModal
        pubkey={selectedZapperPubkey}
        viewerPubkey={user.pubkey}
        onClose={() => setSelectedZapperPubkey(null)}
      />

      <HashtagPostsModal
        hashtag={selectedHashtag}
        authorPubkey={user.pubkey}
        onClose={() => setSelectedHashtag(null)}
      />
    </div>
  );
}
