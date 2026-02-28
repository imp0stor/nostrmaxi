import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signEvent, publishEvent, truncateNpub } from '../lib/nostr';
import { loadBookmarkFeed, loadDiscoverableCustomFeeds, loadFeedForCustomDefinition, loadFeedWithDiagnostics, loadFollowing, loadUserCustomFeeds, publishCustomFeed, publishKind1, reactToEvent, type CustomFeedDefinition, type FeedItem, type FeedDiagnostics, type FeedMode } from '../lib/social';
import { extractQuoteRefsFromTokens, parseMediaFromFeedItem } from '../lib/media';
import { Avatar } from '../components/Avatar';
import { InlineContent } from '../components/InlineContent';
import { resolveQuotedEvents } from '../lib/quotes';
import { fetchProfilesBatchCached } from '../lib/profileCache';
import { aggregateZaps, buildZapButtonLabel, createPendingZap, formatZapIndicator, getDefaultZapAmountOptions, getZapPreferences, loadZapReceipts, mergePendingIntoAggregates, sendZap, subscribeToZaps, type PendingZap, type ZapAggregate } from '../lib/zaps';
import { evaluateMute } from '../lib/muteWords';
import { useMuteSettings } from '../hooks/useMuteSettings';
import { CONTENT_TYPE_LABELS, detectContentTypes, extractLiveStreamMeta } from '../lib/contentTypes';
import { LiveStreamCard } from '../components/LiveStreamCard';
import { ConfigAccordion } from '../components/ConfigAccordion';
import { FilterBar } from '../components/filters/FilterBar';
import { useTagFilter } from '../hooks/useTagFilter';

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

type FeedFilter = 'mediaOnly' | 'textOnly' | 'replies' | 'reposts' | 'withLinks';

interface FeedFilterState {
  mediaOnly: boolean;
  textOnly: boolean;
  replies: boolean;
  reposts: boolean;
  withLinks: boolean;
}

const FEED_FILTER_LABELS: Record<FeedFilter, string> = {
  mediaOnly: 'Media only',
  textOnly: 'Text only',
  replies: 'Replies',
  reposts: 'Reposts',
  withLinks: 'With links',
};

const FEED_MODE_LABELS: Record<FeedMode, string> = {
  firehose: 'Firehose',
  following: 'Following',
  wot: 'WoT',
  'high-signal': 'High Signal',
};

const FEED_MODE_STORAGE_KEY = 'nostrmaxi.feed.mode';
const FEED_FILTERS_STORAGE_KEY = 'nostrmaxi.feed.content-filters';
const LIVE_NOTIFIED_IDS_KEY = 'nostrmaxi.live.notified';

const DEFAULT_FEED_FILTERS: FeedFilterState = {
  mediaOnly: false,
  textOnly: false,
  replies: false,
  reposts: false,
  withLinks: false,
};

function parseFeedFilters(value: string | null): FeedFilterState {
  if (!value) return DEFAULT_FEED_FILTERS;
  try {
    const parsed = JSON.parse(value) as Partial<FeedFilterState>;
    return {
      mediaOnly: Boolean(parsed.mediaOnly),
      textOnly: Boolean(parsed.textOnly),
      replies: Boolean(parsed.replies),
      reposts: Boolean(parsed.reposts),
      withLinks: Boolean(parsed.withLinks),
    };
  } catch {
    return DEFAULT_FEED_FILTERS;
  }
}

function getInitialMode(): FeedMode {
  if (typeof window === 'undefined') return 'following';
  const mode = window.localStorage.getItem(FEED_MODE_STORAGE_KEY);
  if (mode === 'firehose' || mode === 'following' || mode === 'wot' || mode === 'high-signal') return mode;
  return 'following';
}

export function FeedPage() {
  const { user, isAuthenticated } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedFilters, setFeedFilters] = useState<FeedFilterState>(() => {
    if (typeof window === 'undefined') return DEFAULT_FEED_FILTERS;
    return parseFeedFilters(window.localStorage.getItem(FEED_FILTERS_STORAGE_KEY));
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [composer, setComposer] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<FeedDiagnostics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quotedEvents, setQuotedEvents] = useState<Map<string, FeedItem>>(new Map());
  const [quotedProfiles, setQuotedProfiles] = useState<Map<string, any>>(new Map());
  const [quotedLoadingIds, setQuotedLoadingIds] = useState<Set<string>>(new Set());
  const [quotedFailedIds, setQuotedFailedIds] = useState<Set<string>>(new Set());
  const [feedMode, setFeedMode] = useState<FeedMode>(getInitialMode());
  const [activeCustomFeedId, setActiveCustomFeedId] = useState<string | null>(null);
  const [userCustomFeeds, setUserCustomFeeds] = useState<CustomFeedDefinition[]>([]);
  const [discoverableFeeds, setDiscoverableFeeds] = useState<CustomFeedDefinition[]>([]);
  const [showCreateFeed, setShowCreateFeed] = useState(false);
  const [newFeedTitle, setNewFeedTitle] = useState('');
  const [newFeedDescription, setNewFeedDescription] = useState('');
  const [newFeedTopics, setNewFeedTopics] = useState('');
  const [newFeedAuthors, setNewFeedAuthors] = useState('');
  const [newFeedIncludeReplies, setNewFeedIncludeReplies] = useState(true);
  const [zapByEventId, setZapByEventId] = useState<Map<string, ZapAggregate>>(new Map());
  const [pendingZaps, setPendingZaps] = useState<PendingZap[]>([]);
  const { settings: muteSettings, syncNow: syncMuteSettings } = useMuteSettings(user?.pubkey);
  const [liveAlerts, setLiveAlerts] = useState<string[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const observerRef = useRef<HTMLDivElement | null>(null);
  const { selectedTags, logic, setSelectedTags, setLogic } = useTagFilter({
    storageKey: 'nostrmaxi.feed.tag-filter',
    defaultLogic: 'or',
  });

  const canPost = useMemo(() => isAuthenticated && Boolean(user?.pubkey), [isAuthenticated, user?.pubkey]);

  const mutedByEventId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of feed) {
      const quoteIds = extractQuoteRefsFromTokens(parseMediaFromFeedItem(item).tokens);
      const quotedContents = quoteIds.map((id) => quotedEvents.get(id)?.content).filter((x): x is string => Boolean(x));
      const displayName = item.profile?.display_name || item.profile?.name || item.profile?.nip05;
      const result = evaluateMute({ event: item, displayName, quotedContents }, muteSettings);
      map.set(item.id, result.muted);
    }
    return map;
  }, [feed, quotedEvents, muteSettings]);

  const hiddenCount = useMemo(() => Array.from(mutedByEventId.values()).filter(Boolean).length, [mutedByEventId]);

  const filteredFeed = useMemo(() => {
    return feed.filter((item) => {
      if (mutedByEventId.get(item.id)) return false;

      const media = parseMediaFromFeedItem(item);
      const hasMedia = media.images.length > 0 || media.videos.length > 0 || media.audios.length > 0;
      const hasLinks = media.links.length > 0;
      const isReply = item.kind === 1 && item.tags?.some((t) => t[0] === 'e');
      const isRepost = item.kind === 6;
      const isTextOnly = item.kind === 1 && !hasMedia && !hasLinks;

      if (feedFilters.mediaOnly && !hasMedia) return false;
      if (feedFilters.textOnly && !isTextOnly) return false;
      if (feedFilters.replies && !isReply) return false;
      if (feedFilters.reposts && !isRepost) return false;
      if (feedFilters.withLinks && !hasLinks) return false;

      return true;
    });
  }, [feed, feedFilters, mutedByEventId]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const item of feed) {
      for (const tag of item.tags || []) {
        if (tag[0] === 't' && tag[1]) tags.add(tag[1].toLowerCase());
      }
      const inline = (item.content || '').match(/#[a-z0-9_]+/gi) || [];
      inline.forEach((value) => tags.add(value.slice(1).toLowerCase()));
    }
    return Array.from(tags).slice(0, 80);
  }, [feed]);

  const tagFilteredFeed = useMemo(() => {
    if (selectedTags.length === 0) return filteredFeed;

    return filteredFeed.filter((item) => {
      const tags = new Set<string>();
      for (const tag of item.tags || []) {
        if (tag[0] === 't' && tag[1]) tags.add(tag[1].toLowerCase());
      }
      const inline = (item.content || '').match(/#[a-z0-9_]+/gi) || [];
      inline.forEach((value) => tags.add(value.slice(1).toLowerCase()));

      if (logic === 'and') return selectedTags.every((tag) => tags.has(tag.toLowerCase()));
      return selectedTags.some((tag) => tags.has(tag.toLowerCase()));
    });
  }, [filteredFeed, selectedTags, logic]);

  const activeCustomFeed = useMemo(
    () => userCustomFeeds.find((feedDef) => feedDef.id === activeCustomFeedId) || null,
    [userCustomFeeds, activeCustomFeedId],
  );

  const displayZapByEventId = useMemo(
    () => mergePendingIntoAggregates(zapByEventId, pendingZaps),
    [zapByEventId, pendingZaps],
  );

  useEffect(() => {
    if (!user?.pubkey) return;
    void syncMuteSettings();
    // run on identity change only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.pubkey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FEED_MODE_STORAGE_KEY, feedMode);
  }, [feedMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FEED_FILTERS_STORAGE_KEY, JSON.stringify(feedFilters));
  }, [feedFilters]);

  useEffect(() => {
    if (!user?.pubkey) return;
    const loadCustomFeedState = async () => {
      const [mine, discoverable, following] = await Promise.all([
        loadUserCustomFeeds(user.pubkey),
        loadDiscoverableCustomFeeds(),
        loadFollowing(user.pubkey),
      ]);
      setUserCustomFeeds(mine);
      setDiscoverableFeeds(discoverable.filter((feedDef) => feedDef.ownerPubkey !== user.pubkey));
      setFollowingSet(new Set(following));
      if (activeCustomFeedId && !mine.some((feedDef) => feedDef.id === activeCustomFeedId)) {
        setActiveCustomFeedId(null);
      }
    };
    void loadCustomFeedState();
  }, [user?.pubkey]);

  const loadPage = async (reset = false) => {
    if (!user?.pubkey) return;
    if (reset) {
      setLoading(true);
      setLoadError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const nextCursor = reset ? undefined : cursor;
      const result = activeCustomFeed
        ? await loadFeedForCustomDefinition(user.pubkey, activeCustomFeed, nextCursor, undefined, muteSettings)
        : (feedMode === 'following' && activeCustomFeedId === 'bookmarks')
          ? {
            items: await loadBookmarkFeed(user.pubkey, undefined, muteSettings),
            nextCursor: undefined,
            diagnostics: {
              mode: 'following' as FeedMode,
              followingCount: 0,
              authorCount: 0,
              relayStatuses: [],
              eventCount: 0,
              hasMore: false,
            },
          }
          : await loadFeedWithDiagnostics(user.pubkey, {
            mode: feedMode,
            cursor: nextCursor,
            limit: reset ? 45 : 35,
          }, undefined, muteSettings);
      setFeed((prev) => {
        if (reset) return result.items;
        const seen = new Set(prev.map((item) => item.id));
        const nextItems = result.items.filter((item) => !seen.has(item.id));
        return [...prev, ...nextItems];
      });
      setDiagnostics(result.diagnostics);
      setCursor(result.nextCursor);
      setHasMore(Boolean(result.diagnostics.hasMore && result.nextCursor));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load feed';
      setLoadError(message);
      if (reset) setFeed([]);
      console.error('[feed] load error', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const refresh = async () => {
    setCursor(undefined);
    setHasMore(false);
    await loadPage(true);
  };

  useEffect(() => {
    void refresh();
  }, [user?.pubkey, feedMode, activeCustomFeedId, activeCustomFeed?.id, muteSettings]);

  useEffect(() => {
    const target = observerRef.current;
    if (!target || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (!first?.isIntersecting || loadingMore || loading || !hasMore) return;
      void loadPage(false);
    }, { rootMargin: '1200px 0px 1200px 0px', threshold: 0.01 });

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, cursor, feedMode, user?.pubkey]);

  useEffect(() => {
    if (!loading && hasMore && !loadingMore && typeof window !== 'undefined') {
      const targetHeight = Math.floor(window.innerHeight * 1.6);
      if (document.documentElement.scrollHeight <= targetHeight) {
        void loadPage(false);
      }
    }
  }, [feed.length, loading, hasMore, loadingMore]);

  useEffect(() => {
    const loadQuotes = async () => {
      const refs = [...new Set(feed.flatMap((item) => extractQuoteRefsFromTokens(parseMediaFromFeedItem(item).tokens)))];
      if (refs.length === 0) {
        setQuotedEvents(new Map());
        setQuotedProfiles(new Map());
        setQuotedLoadingIds(new Set());
        setQuotedFailedIds(new Set());
        return;
      }

      setQuotedLoadingIds(new Set(refs));
      setQuotedFailedIds(new Set());

      try {
        const events = await resolveQuotedEvents(refs);
        setQuotedEvents(events as Map<string, FeedItem>);

        const missing = refs.filter((id) => !events.has(id));
        setQuotedFailedIds(new Set(missing));

        const profiles = await fetchProfilesBatchCached([...new Set([...events.values()].map((e) => e.pubkey))]);
        setQuotedProfiles(profiles);
      } finally {
        setQuotedLoadingIds(new Set());
      }
    };
    void loadQuotes();
  }, [feed]);

  useEffect(() => {
    const loadZaps = async () => {
      if (feed.length === 0) {
        setZapByEventId(new Map());
        return;
      }
      const eventIds = feed.map((f) => f.id);
      const authors = [...new Set(feed.map((f) => f.pubkey))];
      const receipts = await loadZapReceipts(eventIds, authors);
      const { byEventId } = aggregateZaps(receipts);
      setZapByEventId(byEventId);

      return subscribeToZaps({
        eventIds,
        profilePubkeys: authors,
        onReceipt: () => {
          void loadZaps();
        },
      });
    };

    let unsubscribe: (() => void) | undefined;
    void loadZaps().then((cleanup) => {
      unsubscribe = cleanup;
    });
    return () => unsubscribe?.();
  }, [feed]);

  useEffect(() => {
    if (typeof window === 'undefined' || feed.length === 0) return;
    let notified = new Set<string>();
    try {
      notified = new Set<string>(JSON.parse(window.localStorage.getItem(LIVE_NOTIFIED_IDS_KEY) || '[]'));
    } catch {
      notified = new Set<string>();
    }
    const liveNow = feed.filter((evt) => evt.kind === 30311 && (evt.tags?.some((t) => t[0] === 'status' && t[1] === 'live')) && followingSet.has(evt.pubkey));
    const fresh = liveNow.filter((evt) => !notified.has(evt.id)).slice(0, 3);
    if (fresh.length === 0) return;

    setLiveAlerts(fresh.map((evt) => extractLiveStreamMeta(evt)?.title || 'Live stream'));
    for (const evt of fresh) notified.add(evt.id);
    window.localStorage.setItem(LIVE_NOTIFIED_IDS_KEY, JSON.stringify(Array.from(notified).slice(-80)));

    if ('Notification' in window) {
      if (Notification.permission === 'default') void Notification.requestPermission();
      if (Notification.permission === 'granted') {
        for (const evt of fresh) {
          const meta = extractLiveStreamMeta(evt);
          new Notification('Streamer went live', { body: `${meta?.host || 'Someone'}: ${meta?.title || 'Live now'}` });
        }
      }
    }
  }, [feed, followingSet]);

  const onPublish = async () => {
    if (!user?.pubkey || !composer.trim()) return;
    setBusyId('composer');
    const ok = await publishKind1(composer.trim(), user.pubkey, signEvent, publishEvent);
    setBusyId(null);
    if (ok) {
      setComposer('');
      await refresh();
    }
  };

  const onAction = async (kind: 'like' | 'repost' | 'reply', item: FeedItem) => {
    if (!user?.pubkey) return;
    setBusyId(`${kind}-${item.id}`);
    const replyText = kind === 'reply' ? prompt('Reply text:') || '' : '';
    const ok = await reactToEvent(kind, item, user.pubkey, replyText, signEvent, publishEvent);
    setBusyId(null);
    if (ok) await refresh();
  };

  const onZap = async (item: FeedItem) => {
    if (!user?.pubkey) return;
    const options = getDefaultZapAmountOptions();
    const prefs = getZapPreferences();
    const amountRaw = prompt(`Zap amount (sats) [${options.join(', ')}]:`, String(prefs.lastAmountSat || options[0]));
    if (!amountRaw) return;
    const amountSat = Number(amountRaw);
    if (!Number.isFinite(amountSat) || amountSat <= 0) {
      alert('Enter a valid sats amount');
      return;
    }

    if (!item.profile?.lud16) {
      alert('Recipient has no lightning address (lud16).');
      return;
    }

    setBusyId(`zap-${item.id}`);
    const pending = createPendingZap({ targetEventId: item.id, recipientPubkey: item.pubkey, amountSat });
    setPendingZaps((prev) => [pending, ...prev]);

    try {
      await sendZap({
        senderPubkey: user.pubkey,
        recipientPubkey: item.pubkey,
        recipientProfile: item.profile,
        amountSat,
        targetEventId: item.id,
        preferredWallet: prefs.lastWalletKind,
        signEventFn: signEvent,
      });
      setPendingZaps((prev) => prev.map((z) => z.id === pending.id ? { ...z, status: 'confirmed' } : z));
      await refresh();
    } catch (error) {
      setPendingZaps((prev) => prev.map((z) => z.id === pending.id ? { ...z, status: 'failed', error: error instanceof Error ? error.message : 'Failed to send zap' } : z));
      alert(error instanceof Error ? error.message : 'Failed to send zap');
    } finally {
      setBusyId(null);
      setTimeout(() => {
        setPendingZaps((prev) => prev.filter((z) => z.id !== pending.id));
      }, 8000);
    }
  };

  const toggleFilter = (filter: FeedFilter) => {
    setFeedFilters((prev) => ({ ...prev, [filter]: !prev[filter] }));
  };

  const clearFilters = () => {
    setFeedFilters(DEFAULT_FEED_FILTERS);
  };


  const onCreateCustomFeed = async () => {
    if (!user?.pubkey || !newFeedTitle.trim()) return;
    const id = newFeedTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || `feed-${Date.now()}`;
    const hashtags = Array.from(new Set(newFeedTopics.split(',').map((x) => x.trim().replace(/^#/, '').toLowerCase()).filter(Boolean)));
    const authors = Array.from(new Set(newFeedAuthors.split(',').map((x) => x.trim()).filter(Boolean)));
    const ok = await publishCustomFeed({
      id,
      title: newFeedTitle.trim(),
      description: newFeedDescription.trim(),
      hashtags,
      authors,
      includeReplies: newFeedIncludeReplies,
    }, user.pubkey, signEvent, publishEvent);

    if (!ok) {
      alert('Failed to publish custom feed list event.');
      return;
    }

    const nextFeeds = await loadUserCustomFeeds(user.pubkey);
    setUserCustomFeeds(nextFeeds);
    setActiveCustomFeedId(id);
    setFeedMode('following');
    setShowCreateFeed(false);
    setNewFeedTitle('');
    setNewFeedDescription('');
    setNewFeedTopics('');
    setNewFeedAuthors('');
    setNewFeedIncludeReplies(true);
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="cy-card p-8 text-center">
          <h2 className="cy-title">Authenticate to access the timeline</h2>
          <p className="cy-muted mt-2">Login with your Nostr key to read, post, and interact.</p>
          <Link to="/" className="cy-btn mt-6 inline-block">Return home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="cy-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="cy-kicker">SOCIAL FEED</p>
            <h1 className="cy-title">Home Timeline</h1>
          </div>
          <button className="cy-btn-secondary" onClick={refresh}>Refresh</button>
        </div>
      </header>

      <section className="cy-card p-5">
        <p className="cy-kicker mb-2">FEED MODE</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FEED_MODE_LABELS) as FeedMode[]).map((mode) => (
            <button
              key={mode}
              className={`cy-chip text-sm ${feedMode === mode ? 'border-cyan-300 text-cyan-100 shadow-[0_0_14px_rgba(0,212,255,0.25)]' : ''}`}
              onClick={() => {
                setActiveCustomFeedId(null);
                setFeedMode(mode);
              }}
            >
              {FEED_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </section>

      <section className="cy-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="cy-kicker">PRIMAL-STYLE CUSTOM FEEDS (NIP-51)</p>
          <button className="cy-btn-secondary text-xs" onClick={() => setShowCreateFeed((v) => !v)}>{showCreateFeed ? 'Close' : 'Create Feed'}</button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className={`cy-chip text-sm ${activeCustomFeedId === 'bookmarks' ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => { setFeedMode('following'); setActiveCustomFeedId('bookmarks'); }}>
            Saved / Bookmarks
          </button>
          {userCustomFeeds.map((feedDef) => (
            <button key={feedDef.id} className={`cy-chip text-sm ${activeCustomFeedId === feedDef.id ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => { setFeedMode('following'); setActiveCustomFeedId(feedDef.id); }}>
              {feedDef.title}
            </button>
          ))}
        </div>

        {discoverableFeeds.length > 0 ? (
          <div>
            <p className="text-xs text-cyan-300/80 mb-2">Discover public feeds</p>
            <div className="flex flex-wrap gap-2">
              {discoverableFeeds.slice(0, 10).map((feedDef) => (
                <button key={`${feedDef.ownerPubkey}:${feedDef.id}`} className="cy-chip text-xs" onClick={() => {
                  setUserCustomFeeds((prev) => prev.some((f) => f.id === feedDef.id) ? prev : [...prev, feedDef]);
                  setActiveCustomFeedId(feedDef.id);
                  setFeedMode('following');
                }}>
                  {feedDef.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showCreateFeed ? (
          <div className="grid md:grid-cols-2 gap-3">
            <input className="cy-input" placeholder="Feed title" value={newFeedTitle} onChange={(e) => setNewFeedTitle(e.target.value)} />
            <input className="cy-input" placeholder="Description" value={newFeedDescription} onChange={(e) => setNewFeedDescription(e.target.value)} />
            <input className="cy-input" placeholder="Topics (comma-separated hashtags)" value={newFeedTopics} onChange={(e) => setNewFeedTopics(e.target.value)} />
            <input className="cy-input" placeholder="Authors (comma-separated pubkeys)" value={newFeedAuthors} onChange={(e) => setNewFeedAuthors(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-cyan-100">
              <input type="checkbox" checked={newFeedIncludeReplies} onChange={(e) => setNewFeedIncludeReplies(e.target.checked)} /> Include replies
            </label>
            <div className="flex justify-end">
              <button className="cy-btn" onClick={onCreateCustomFeed}>Save to Nostr</button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="cy-card p-5">
        <p className="cy-kicker mb-2">COMPOSER / KIND-1</p>
        <label htmlFor="feed-composer" className="sr-only">Compose event</label>
        <textarea
          id="feed-composer"
          name="feedComposer"
          className="cy-input min-h-28"
          placeholder="Broadcast signal to your network..."
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
        />
        <div className="mt-3 flex justify-end">
          <button className="cy-btn" onClick={onPublish} disabled={!canPost || busyId === 'composer'}>
            {busyId === 'composer' ? 'Publishing…' : 'Post Event'}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <ConfigAccordion
          id="feed-content-filters"
          title="Content Filters"
          subtitle="Narrow the timeline by post type"
          summary="Filter chips for media, replies, reposts, and link-heavy content"
          defaultOpen={false}
          rightSlot={<button className="cy-btn-secondary text-xs" onClick={clearFilters}>Reset</button>}
        >
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FEED_FILTER_LABELS) as FeedFilter[]).map((filter) => {
              const active = feedFilters[filter];
              return (
                <button
                  key={filter}
                  className={`cy-chip text-sm ${active ? 'border-cyan-300 text-cyan-100 shadow-[0_0_14px_rgba(0,212,255,0.25)]' : ''}`}
                  onClick={() => toggleFilter(filter)}
                >
                  {FEED_FILTER_LABELS[filter]}
                </button>
              );
            })}
          </div>
        </ConfigAccordion>

        <div className="cy-card p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-cyan-200">{hiddenCount} posts hidden by profile mute rules</p>
          <Link to="/settings" className="cy-btn-secondary text-xs">Manage muted words</Link>
        </div>

        {liveAlerts.length > 0 ? (
          <div className="cy-card p-4 border border-red-400/40">
            <p className="text-sm text-red-200">🔴 Live now from people you follow: {liveAlerts.join(', ')}</p>
          </div>
        ) : null}

        {diagnostics ? (
          <div className="cy-card p-4 text-sm">
            <p className="cy-kicker">RELAY STATUS</p>
            <p className="text-cyan-200 mt-1">
              Mode: <span className="font-semibold">{activeCustomFeedId === 'bookmarks' ? 'Saved / Bookmarks' : (activeCustomFeed?.title || FEED_MODE_LABELS[diagnostics.mode])}</span> · Following: {diagnostics.followingCount} · Events: {diagnostics.eventCount}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {diagnostics.relayStatuses.map((relay) => (
                <span key={relay.relay} className={`cy-chip ${relay.ok ? '' : 'border-red-500/60 text-red-300'}`}>
                  {relay.ok ? '●' : '○'} {relay.relay.replace('wss://', '')}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? <div className="cy-card p-6">Loading feed from relays…</div> : null}
        {loadError ? <div className="cy-card p-6 text-red-300">Feed failed to load: {loadError}</div> : null}
        {!loading && !loadError && tagFilteredFeed.length === 0 ? (
          <div className="cy-card p-6">
            <p className="text-gray-100">No timeline events match current filters.</p>
            <p className="cy-muted mt-2">Try clearing filters, refreshing feed, or following more accounts from Discover.</p>
          </div>
        ) : null}

        <FilterBar
          title="Feed Tag Filter"
          availableTags={availableTags}
          selectedTags={selectedTags}
          logic={logic}
          onTagsChange={setSelectedTags}
          onLogicChange={setLogic}
          onApply={() => { /* live filter */ }}
        />

        {tagFilteredFeed.map((item) => {
          const media = parseMediaFromFeedItem(item);
          const contentTypes = Array.from(detectContentTypes(item));
          const liveMeta = extractLiveStreamMeta(item);
          const displayName = item.profile?.display_name || item.profile?.name || 'nostr user';
          const hasNip05 = Boolean(item.profile?.nip05);
          const shortNpub = truncateNpub(item.pubkey, 10);
          return (
            <article key={item.id} className="cy-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar pubkey={item.pubkey} size={44} />
                  <div>
                    <Link to={`/profile/${item.pubkey}`} className="text-cyan-300 font-semibold">
                      {hasNip05 ? item.profile?.nip05 : displayName}
                    </Link>
                    {!hasNip05 ? <p className="text-xs text-cyan-400/80">{displayName}</p> : null}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-cyan-500">Identity details</summary>
                      <p className="cy-mono text-xs text-cyan-500 mt-1">{shortNpub}</p>
                    </details>
                  </div>
                </div>
                <span className="cy-mono text-xs text-blue-300">{formatTime(item.created_at)}</span>
              </div>
              <InlineContent
                tokens={media.tokens}
                quotedEvents={quotedEvents}
                quotedProfiles={quotedProfiles}
                quotedLoadingIds={quotedLoadingIds}
                quotedFailedIds={quotedFailedIds}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {contentTypes.map((type) => (
                  <span key={`${item.id}-${type}`} className="text-[11px] rounded-full border border-cyan-400/40 px-2 py-0.5 text-cyan-200 bg-cyan-500/10">{CONTENT_TYPE_LABELS[type]}</span>
                ))}
              </div>
              {liveMeta ? <LiveStreamCard meta={liveMeta} /> : null}
              <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                <span className="cy-chip" title="Zap totals">
                  {formatZapIndicator(displayZapByEventId.get(item.id))}
                </span>
                <div className="flex gap-2">
                  <button className="cy-chip" onClick={() => onAction('like', item)} disabled={busyId === `like-${item.id}`}>Like</button>
                  <button className="cy-chip" onClick={() => onAction('repost', item)} disabled={busyId === `repost-${item.id}`}>Repost</button>
                  <button className="cy-chip" onClick={() => onAction('reply', item)} disabled={busyId === `reply-${item.id}`}>Reply</button>
                  <button className="cy-chip" onClick={() => onZap(item)} disabled={busyId === `zap-${item.id}`}>{buildZapButtonLabel(busyId === `zap-${item.id}`)}</button>
                </div>
              </div>
            </article>
          );
        })}

        <div ref={observerRef} className="h-4" />
        {loadingMore ? <div className="cy-card p-4 text-sm">Loading more events…</div> : null}
      </section>
    </div>
  );
}
