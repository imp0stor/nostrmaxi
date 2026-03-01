import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type FeedTier = 'wot' | 'genuine' | 'firehose';

type FeedRecord = {
  id: string;
  name: string;
  isPublic: boolean;
  filterConfig: {
    contentTypes?: string[];
    tier?: FeedTier;
    wotThreshold?: number;
  };
};

type TrendingItem = {
  id: string;
  pubkey: string;
  content: string;
  createdAt: number;
  score: number;
  stats: { reposts: number; reactions: number; zaps: number };
};

const CONTENT_OPTIONS = ['text', 'image', 'video', 'audio', 'link'];

export function FeedsPage() {
  const [feeds, setFeeds] = useState<FeedRecord[]>([]);
  const [subs, setSubs] = useState<Array<{ id: string; feed: FeedRecord }>>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [tier, setTier] = useState<FeedTier>('genuine');
  const [wotThreshold, setWotThreshold] = useState(35);
  const [isPublic, setIsPublic] = useState(true);
  const [contentTypes, setContentTypes] = useState<string[]>(['text']);
  const [subscribeFeedId, setSubscribeFeedId] = useState('');

  const activeTierLabel = useMemo(() => {
    if (tier === 'wot') return 'WoT';
    if (tier === 'genuine') return 'Genuine';
    return 'Firehose';
  }, [tier]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, subscriptions, trend] = await Promise.all([
        api.listFeeds(),
        api.listFeedSubscriptions(),
        api.getTrendingFeeds(50),
      ]);
      setFeeds(mine);
      setSubs(subscriptions);
      setTrending(trend);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feeds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    await api.createFeed({ name, tier, wotThreshold, isPublic, contentTypes });
    setName('');
    await load();
  };

  const toggleContentType = (type: string) => {
    setContentTypes((prev) => {
      if (prev.includes(type)) return prev.filter((item) => item !== type);
      return [...prev, type];
    });
  };

  const onDelete = async (feedId: string) => {
    await api.deleteFeed(feedId);
    await load();
  };

  const onSubscribe = async (feedId: string) => {
    await api.subscribeFeed(feedId);
    setSubscribeFeedId('');
    await load();
  };

  const onUnsubscribe = async (feedId: string) => {
    await api.unsubscribeFeed(feedId);
    await load();
  };

  return (
    <div className="nm-page max-w-6xl text-orange-100" style={{ background: '#000000' }}>
      <header className="cy-card p-5 mb-4 border border-orange-500/30">
        <h1 className="text-2xl font-semibold">Feeds</h1>
        <p className="text-sm text-orange-300/80 mt-1">Create, tune, and subscribe to curated feeds. Active tier: {activeTierLabel}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="cy-card p-5 border border-orange-500/25">
          <h2 className="text-lg font-semibold mb-3">Create feed</h2>
          <form className="space-y-3" onSubmit={onCreate}>
            <input className="cy-input" placeholder="Feed name" value={name} onChange={(e) => setName(e.target.value)} required />

            <div className="flex gap-2 flex-wrap">
              {(['wot', 'genuine', 'firehose'] as FeedTier[]).map((value) => (
                <button key={value} type="button" className={`cy-chip ${tier === value ? 'border-orange-300 text-orange-100' : ''}`} onClick={() => setTier(value)}>
                  {value.toUpperCase()}
                </button>
              ))}
            </div>

            <label className="text-xs text-orange-300 block">
              WoT threshold: {wotThreshold}
              <input type="range" min={0} max={100} value={wotThreshold} onChange={(e) => setWotThreshold(Number(e.target.value))} className="w-full" />
            </label>

            <div className="flex gap-2 flex-wrap">
              {CONTENT_OPTIONS.map((type) => (
                <button key={type} type="button" className={`cy-chip ${contentTypes.includes(type) ? 'border-orange-300 text-orange-100' : ''}`} onClick={() => toggleContentType(type)}>
                  {type}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-orange-300">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Public feed
            </label>

            <button type="submit" className="nm-pill nm-pill-primary">Create feed</button>
          </form>
        </section>

        <section className="cy-card p-5 border border-orange-500/25">
          <h2 className="text-lg font-semibold mb-3">My feeds</h2>
          {feeds.length === 0 ? <p className="text-sm text-orange-300/70">No feeds yet.</p> : (
            <div className="space-y-2">
              {feeds.map((feed) => (
                <article key={feed.id} className="rounded border border-orange-500/25 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{feed.name}</p>
                      <p className="text-xs text-orange-300/80">Tier: {(feed.filterConfig?.tier || 'genuine').toUpperCase()} · WoT {feed.filterConfig?.wotThreshold ?? 35}</p>
                      <a className="text-xs text-orange-400 underline" href={`/api/v1/feeds/${feed.id}/rss`} target="_blank" rel="noreferrer">RSS export</a>
                    </div>
                    <button className="cy-chip text-xs" onClick={() => void onDelete(feed.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <section className="cy-card p-5 border border-orange-500/25">
          <h2 className="text-lg font-semibold mb-3">Subscribed feeds</h2>
          <div className="mb-3 flex gap-2">
            <input className="cy-input" placeholder="Public feed id" value={subscribeFeedId} onChange={(e) => setSubscribeFeedId(e.target.value)} />
            <button className="cy-chip" onClick={() => void onSubscribe(subscribeFeedId)} disabled={!subscribeFeedId.trim()}>Subscribe</button>
          </div>
          {subs.length === 0 ? <p className="text-sm text-orange-300/70">No subscriptions yet.</p> : (
            <div className="space-y-2">
              {subs.map((sub) => (
                <article key={sub.id} className="rounded border border-orange-500/25 p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{sub.feed.name}</p>
                    <p className="text-xs text-orange-300/80">{sub.feed.id}</p>
                  </div>
                  <button className="cy-chip text-xs" onClick={() => void onUnsubscribe(sub.feed.id)}>Unsubscribe</button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="cy-card p-5 border border-orange-500/25">
          <h2 className="text-lg font-semibold mb-3">Trending now</h2>
          {loading ? <p className="text-sm text-orange-300/70">Loading…</p> : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <div className="space-y-2 max-h-[420px] overflow-auto">
            {trending.map((item) => (
              <article key={item.id} className="rounded border border-orange-500/20 p-3">
                <p className="text-xs text-orange-300/75 mb-1">Score {item.score.toFixed(2)} · ⚡{item.stats.zaps} ❤{item.stats.reactions} 🔁{item.stats.reposts}</p>
                <p className="text-sm text-orange-100 whitespace-pre-wrap">{item.content.slice(0, 220) || '(empty post)'}</p>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-xs text-orange-400">{item.pubkey.slice(0, 8)}…</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
