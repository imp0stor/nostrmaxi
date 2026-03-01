import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signEvent, publishEvent, truncateNpub } from '../lib/nostr';
import { loadBookmarkFeed, loadDiscoverableCustomFeeds, loadFeedForCustomDefinition, loadFeedWithDiagnostics, loadFollowing, publishCustomFeed, publishKind1, reactToEvent, type CustomFeedDefinition, type FeedItem, type FeedDiagnostics, type FeedMode } from '../lib/social';
import { extractQuoteRefsFromTokens, parseMediaFromFeedItem } from '../lib/media';
import { Avatar } from '../components/Avatar';
import { InlineContent } from '../components/InlineContent';
import { resolveQuotedEvents } from '../lib/quotes';
import { fetchProfilesBatchCached } from '../lib/profileCache';
import { aggregateZaps, buildZapButtonLabel, createPendingZap, formatZapIndicator, getDefaultZapAmountOptions, getZapPreferences, loadZapReceipts, mergePendingIntoAggregates, sendZap, subscribeToZaps, type PendingZap, type ZapAggregate } from '../lib/zaps';
import { shouldFilter } from '../lib/contentFilter';
import { useContentFilters } from '../hooks/useContentFilters';
import { CONTENT_TYPE_LABELS, detectContentTypes, extractLiveStreamMeta } from '../lib/contentTypes';
import { LiveStreamCard } from '../components/LiveStreamCard';
import { useTagFilter } from '../hooks/useTagFilter';
import { addRelay } from '../lib/discoverEntities';
import { BookmarkButton } from '../components/bookmarks/BookmarkButton';
import { usePinnedPost } from '../hooks/usePinnedPost';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { shouldNotify, shouldPlaySound } from '../lib/subscriptionMatcher';
import { FeedDiscoveryModal } from '../components/feed/FeedDiscoveryModal';
import { loadCustomFeedsList, saveCustomFeedsList } from '../lib/subscriptions';
import { PostActionMenu } from '../components/PostActionMenu';
import { useMuteActions } from '../hooks/useMuteActions';
import { MediaUploader } from '../components/MediaUploader';
import { ZapBreakdownModal } from '../components/ZapBreakdownModal';

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function shortPubkey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-8)}`;
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

function collectQuoteRelayHints(items: FeedItem[]): Map<string, string[]> {
  const hints = new Map<string, Set<string>>();
  for (const item of items) {
    for (const tag of item.tags || []) {
      if (tag[0] !== 'e' || !tag[1] || !tag[2] || !/^wss?:\/\//i.test(tag[2])) continue;
      if (!hints.has(tag[1])) hints.set(tag[1], new Set());
      hints.get(tag[1])!.add(tag[2]);
    }
  }

  const out = new Map<string, string[]>();
  hints.forEach((relaySet, id) => out.set(id, [...relaySet]));
  return out;
}

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

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];
const CONNECTED_RELAYS_STORAGE_KEY = 'nostrmaxi_connected_relays';

function normalizeRelay(relay: string): string {
  return relay.trim().toLowerCase().replace(/\/+$/, '');
}

function inferMediaType(url: string): 'image' | 'video' | 'audio' | 'other' {
  const lower = url.toLowerCase();
  if (/(\.png|\.jpe?g|\.gif|\.webp|\.avif)(\?|#|$)/.test(lower)) return 'image';
  if (/(\.mp4|\.mov|\.webm|\.m3u8)(\?|#|$)/.test(lower)) return 'video';
  if (/(\.mp3|\.wav|\.ogg|\.m4a)(\?|#|$)/.test(lower)) return 'audio';
  return 'other';
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[a-f0-9]{64}$/i.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

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
  const { pinnedPost, pinPost } = usePinnedPost(user?.pubkey);
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
  const [composerMedia, setComposerMedia] = useState<Array<{ url: string; type: 'image' | 'video' | 'audio' | 'other' }>>([]);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showRelayModal, setShowRelayModal] = useState(false);
  const [connectedRelays, setConnectedRelays] = useState<string[]>([]);
  const [relaySuggestions, setRelaySuggestions] = useState<string[]>([]);
  const [relayInput, setRelayInput] = useState('');
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
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [zapByEventId, setZapByEventId] = useState<Map<string, ZapAggregate>>(new Map());
  const [pendingZaps, setPendingZaps] = useState<PendingZap[]>([]);
  const [zapComposeItem, setZapComposeItem] = useState<FeedItem | null>(null);
  const [zapAmountInput, setZapAmountInput] = useState('21');
  const [zapMessageInput, setZapMessageInput] = useState('');
  const [zapError, setZapError] = useState<string | null>(null);
  const [zapStatusLabel, setZapStatusLabel] = useState<string | null>(null);
  const [zapBreakdownEventId, setZapBreakdownEventId] = useState<string | null>(null);
  const { filters: contentFilters, syncNow: syncContentFilters } = useContentFilters(user?.pubkey);
  const { muteHashtag, isHashtagMuted } = useMuteActions(user?.pubkey);
  const { topicSubs, userSubs, notifPrefs } = useSubscriptions(user?.pubkey);
  const [notificationQueue, setNotificationQueue] = useState<Array<{ id: string; type: 'topic' | 'keyword' | 'user'; match: string }>>([]);
  const [liveAlerts, setLiveAlerts] = useState<string[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const observerRef = useRef<HTMLDivElement | null>(null);
  const { selectedTags, logic, setSelectedTags, setLogic } = useTagFilter({
    storageKey: 'nostrmaxi.feed.tag-filter',
    defaultLogic: 'or',
  });

  const canPost = useMemo(() => isAuthenticated && Boolean(user?.pubkey), [isAuthenticated, user?.pubkey]);
  const privateKey = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const nsecHex = sessionStorage.getItem('nostrmaxi_nsec_hex');
    if (!nsecHex || nsecHex.length < 64) return null;  // Need valid 32-byte key
    try {
      return hexToBytes(nsecHex);
    } catch {
      return null;
    }
  }, [user?.pubkey]);
  const userFollowing = useMemo(() => Array.from(followingSet), [followingSet]);
  const userInterests = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of feed.slice(0, 250)) {
      for (const tag of item.tags || []) {
        if (tag[0] !== 't' || !tag[1]) continue;
        const normalized = tag[1].toLowerCase();
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([topic]) => topic);
  }, [feed]);

  const mutedByEventId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of feed) {
      const quoteIds = extractQuoteRefsFromTokens(parseMediaFromFeedItem(item).tokens);
      const quoteMuted = quoteIds.some((id) => {
        const quoted = quotedEvents.get(id);
        return quoted ? shouldFilter(quoted, contentFilters) : false;
      });
      map.set(item.id, quoteMuted || shouldFilter(item, contentFilters));
    }
    return map;
  }, [feed, quotedEvents, contentFilters]);

  const hiddenCount = useMemo(() => Array.from(mutedByEventId.values()).filter(Boolean).length, [mutedByEventId]);

  const notifyByEventId = useMemo(() => {
    const map = new Map<string, { type: 'topic' | 'keyword' | 'user'; match: string }>();
    for (const item of feed) {
      if (mutedByEventId.get(item.id)) continue;
      const trigger = shouldNotify(item, {
        topicSubscriptions: topicSubs,
        userSubscriptions: userSubs,
        notificationPrefs: notifPrefs,
      });
      if (trigger) map.set(item.id, { type: trigger.type, match: trigger.match });
    }
    return map;
  }, [feed, mutedByEventId, topicSubs, userSubs, notifPrefs]);

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
    void syncContentFilters();
    // run on identity change only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.pubkey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FEED_MODE_STORAGE_KEY, feedMode);
  }, [feedMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const newlyMatched = feed
      .filter((item) => notifyByEventId.has(item.id))
      .slice(0, 5)
      .map((item) => ({ id: item.id, ...(notifyByEventId.get(item.id) as { type: 'topic' | 'keyword' | 'user'; match: string }) }));

    if (newlyMatched.length === 0) return;

    setNotificationQueue((prev) => {
      const seen = new Set(prev.map((entry) => entry.id));
      const merged = [...newlyMatched.filter((entry) => !seen.has(entry.id)), ...prev];
      return merged.slice(0, 40);
    });

    const latest = newlyMatched[0];
    if ('Notification' in window) {
      if (Notification.permission === 'default') void Notification.requestPermission();
      if (Notification.permission === 'granted') {
        new Notification('Subscription match', { body: `${latest.type}: ${latest.match}` });
      }
    }

    if (shouldPlaySound(notifPrefs)) {
      try {
        const audio = new Audio('/notification.mp3');
        void audio.play();
      } catch {
        // no-op when autoplay is blocked
      }
    }
  }, [feed, notifyByEventId, notifPrefs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FEED_FILTERS_STORAGE_KEY, JSON.stringify(feedFilters));
  }, [feedFilters]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(CONNECTED_RELAYS_STORAGE_KEY);
    if (!raw) {
      setConnectedRelays(DEFAULT_RELAYS);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setConnectedRelays(parsed.filter((relay): relay is string => typeof relay === 'string').map(normalizeRelay));
      }
    } catch {
      setConnectedRelays(DEFAULT_RELAYS);
    }
  }, []);

  useEffect(() => {
    if (!showRelayModal) return;
    let cancelled = false;
    const loadSuggestions = async () => {
      try {
        const res = await fetch('/api/relays/suggestions');
        if (!res.ok) throw new Error('suggestions unavailable');
        const json = await res.json() as { recommended?: Array<{ url?: string }>; popular?: Array<{ url?: string }>; forReading?: Array<{ url?: string }>; forWriting?: Array<{ url?: string }> };
        const pool = [
          ...(json.recommended || []).map((r) => r.url || ''),
          ...(json.popular || []).map((r) => r.url || ''),
          ...(json.forReading || []).map((r) => r.url || ''),
          ...(json.forWriting || []).map((r) => r.url || ''),
          ...DEFAULT_RELAYS,
        ].map(normalizeRelay).filter((value) => value.startsWith('wss://'));
        if (!cancelled) setRelaySuggestions(Array.from(new Set(pool)).slice(0, 20));
      } catch {
        if (!cancelled) setRelaySuggestions(DEFAULT_RELAYS.map(normalizeRelay));
      }
    };
    void loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [showRelayModal]);

  useEffect(() => {
    if (!user?.pubkey) return;
    const loadCustomFeedState = async () => {
      const [relayFeeds, discoverable, following] = await Promise.all([
        privateKey && privateKey.length === 32
          ? loadCustomFeedsList(user.pubkey, privateKey, DEFAULT_RELAYS).catch(() => [])
          : Promise.resolve([]),
        loadDiscoverableCustomFeeds(),
        loadFollowing(user.pubkey),
      ]);
      
      // Merge relay feeds with localStorage fallback
      let saved = relayFeeds;
      if (saved.length === 0) {
        try {
          const localFeeds = localStorage.getItem(`nostrmaxi_feeds_${user.pubkey}`);
          if (localFeeds) {
            saved = JSON.parse(localFeeds);
            console.log('[FeedPage] Loaded feeds from localStorage:', saved.length);
          }
        } catch {
          // ignore parse errors
        }
      } else {
        console.log('[FeedPage] Loaded feeds from relay:', saved.length);
      }
      setUserCustomFeeds(saved);
      setDiscoverableFeeds(discoverable.filter((feedDef) => feedDef.ownerPubkey !== user.pubkey));
      setFollowingSet(new Set(following));
      if (activeCustomFeedId && !saved.some((feedDef) => feedDef.id === activeCustomFeedId)) {
        setActiveCustomFeedId(null);
      }
    };
    void loadCustomFeedState();
  }, [user?.pubkey, privateKey]);

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
        ? await loadFeedForCustomDefinition(user.pubkey, activeCustomFeed, nextCursor, undefined, contentFilters)
        : (feedMode === 'following' && activeCustomFeedId === 'bookmarks')
          ? {
            items: await loadBookmarkFeed(user.pubkey, undefined, contentFilters),
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
          }, undefined, contentFilters);
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
  }, [user?.pubkey, feedMode, activeCustomFeedId, activeCustomFeed?.id, contentFilters]);

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
        const relayHintsById = collectQuoteRelayHints(feed);
        const events = await resolveQuotedEvents(refs, undefined, { relayHintsById });
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

  const retryQuotedEvent = async (eventId: string) => {
    setQuotedLoadingIds((prev) => new Set(prev).add(eventId));
    setQuotedFailedIds((prev) => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });

    try {
      const relayHintsById = collectQuoteRelayHints(feed);
      const events = await resolveQuotedEvents([eventId], undefined, { relayHintsById });
      const event = events.get(eventId);

      if (!event) {
        setQuotedFailedIds((prev) => new Set(prev).add(eventId));
        return;
      }

      setQuotedEvents((prev) => {
        const next = new Map(prev);
        next.set(eventId, event as FeedItem);
        return next;
      });

      const profiles = await fetchProfilesBatchCached([event.pubkey]);
      setQuotedProfiles((prev) => {
        const next = new Map(prev);
        const profile = profiles.get(event.pubkey);
        if (typeof profile !== 'undefined') next.set(event.pubkey, profile);
        return next;
      });
    } catch {
      setQuotedFailedIds((prev) => new Set(prev).add(eventId));
    } finally {
      setQuotedLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

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
    if (!user?.pubkey) return;
    const mediaUrls = composerMedia.map((media) => media.url).filter(Boolean);
    const payload = [composer.trim(), ...mediaUrls].filter(Boolean).join('\n').trim();
    if (!payload) return;
    setBusyId('composer');
    const ok = await publishKind1(payload, user.pubkey, signEvent, publishEvent);
    setBusyId(null);
    if (ok) {
      setComposer('');
      setComposerMedia([]);
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

  const onPin = async (item: FeedItem) => {
    if (!user?.pubkey) return;
    if (item.pubkey !== user.pubkey) return;
    if (pinnedPost?.eventId && pinnedPost.eventId !== item.id) {
      const confirmed = confirm('This will replace your current pinned post. Continue?');
      if (!confirmed) return;
    }

    try {
      await pinPost({ id: item.id, pubkey: item.pubkey });
      alert('Pinned to profile.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to pin post');
    }
  };

  const onZap = (item: FeedItem) => {
    const options = getDefaultZapAmountOptions();
    const prefs = getZapPreferences();
    setZapComposeItem(item);
    setZapAmountInput(String(prefs.lastAmountSat || options[0] || 21));
    setZapMessageInput('');
    setZapError(null);
    setZapStatusLabel(null);
  };

  const submitZap = async () => {
    if (!user?.pubkey || !zapComposeItem) return;
    const amountSat = Number(zapAmountInput);
    if (!Number.isFinite(amountSat) || amountSat <= 0) {
      setZapError('Enter a valid sats amount.');
      return;
    }

    if (!zapComposeItem.profile?.lud16) {
      setZapError('Recipient has no lightning address (lud16).');
      return;
    }

    setBusyId(`zap-${zapComposeItem.id}`);
    setZapError(null);
    const pending = createPendingZap({
      targetEventId: zapComposeItem.id,
      recipientPubkey: zapComposeItem.pubkey,
      amountSat,
      message: zapMessageInput.trim() || undefined,
    });
    setPendingZaps((prev) => [pending, ...prev]);

    try {
      const prefs = getZapPreferences();
      await sendZap({
        senderPubkey: user.pubkey,
        recipientPubkey: zapComposeItem.pubkey,
        recipientProfile: zapComposeItem.profile,
        amountSat,
        targetEventId: zapComposeItem.id,
        message: zapMessageInput.trim() || undefined,
        preferredWallet: prefs.lastWalletKind,
        signEventFn: signEvent,
        onStatus: (status) => {
          if (status === 'requesting_invoice') setZapStatusLabel('Requesting invoice…');
          if (status === 'awaiting_wallet') setZapStatusLabel('Waiting for wallet confirmation…');
          if (status === 'paid') setZapStatusLabel('Paid. Relay receipts may take a few seconds.');
        },
      });
      setPendingZaps((prev) => prev.map((z) => z.id === pending.id ? { ...z, status: 'confirmed' } : z));
      await refresh();
      setTimeout(() => {
        setZapComposeItem(null);
        setZapStatusLabel(null);
      }, 900);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send zap';
      setPendingZaps((prev) => prev.map((z) => z.id === pending.id ? { ...z, status: 'failed', error: message } : z));
      setZapError(message);
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
    setSelectedTags([]);
  };

  const persistRelays = async (nextRelays: string[]) => {
    if (!user?.pubkey) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CONNECTED_RELAYS_STORAGE_KEY, JSON.stringify(nextRelays));
    }
    setConnectedRelays(nextRelays);

    const unsigned = {
      kind: 10002,
      content: '',
      tags: nextRelays.map((relay) => ['r', relay]),
      pubkey: user.pubkey,
      created_at: Math.floor(Date.now() / 1000),
    };

    try {
      const signed = await signEvent(unsigned);
      if (signed) await publishEvent(signed, DEFAULT_RELAYS);
    } catch {
      // local persistence still works when signer/publish unavailable
    }
  };

  const onAddRelay = async (relayUrl: string) => {
    const normalized = normalizeRelay(relayUrl);
    if (!normalized.startsWith('wss://')) return;
    const next = addRelay(connectedRelays, normalized);
    await persistRelays(next);
    setRelayInput('');
  };

  const onRemoveRelay = async (relayUrl: string) => {
    const next = connectedRelays.filter((relay) => relay !== relayUrl);
    await persistRelays(next.length > 0 ? next : DEFAULT_RELAYS.map(normalizeRelay));
  };

  const onAddCustomFeed = async (feedDef: CustomFeedDefinition) => {
    if (!user?.pubkey) return;

    const normalizedFeed: CustomFeedDefinition = {
      ...feedDef,
      hashtags: Array.from(new Set((feedDef.hashtags || []).map((tag) => tag.toLowerCase()))),
      authors: Array.from(new Set(feedDef.authors || [])),
    };

    if (!feedDef.ownerPubkey || feedDef.ownerPubkey === user.pubkey) {
      await publishCustomFeed(normalizedFeed, user.pubkey, signEvent, publishEvent);
    }

    setUserCustomFeeds((prev) => {
      const next = prev.some((feed) => feed.id === normalizedFeed.id)
        ? prev.map((feed) => (feed.id === normalizedFeed.id ? normalizedFeed : feed))
        : [...prev, normalizedFeed];

      // Save to relay if we have privateKey, otherwise fallback to localStorage
      if (privateKey && privateKey.length === 32) {
        console.log('[FeedPage] Saving feeds to relay...');
        saveCustomFeedsList(next, user.pubkey, privateKey, DEFAULT_RELAYS)
          .then(() => console.log('[FeedPage] Feeds saved to relay'))
          .catch((err) => console.error('[FeedPage] Failed to save feeds to relay:', err));
      } else {
        // Fallback: save to localStorage for NIP-46 users
        console.log('[FeedPage] No privateKey, saving feeds to localStorage');
        try {
          localStorage.setItem(`nostrmaxi_feeds_${user.pubkey}`, JSON.stringify(next));
        } catch (err) {
          console.error('[FeedPage] Failed to save feeds to localStorage:', err);
        }
      }

      return next;
    });

    setActiveCustomFeedId(normalizedFeed.id);
    setFeedMode('following');
    setShowFeedModal(false);
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
      <section className="cy-card p-5">
        <p className="cy-kicker mb-2">COMPOSER / KIND-1</p>
        <label htmlFor="feed-composer" className="sr-only">Compose event</label>
        <textarea
          id="feed-composer"
          name="feedComposer"
          className="cy-input min-h-28"
          placeholder="Broadcast signal to your network... Markdown supported."
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
        />
        <div className="mt-3">
          <MediaUploader
            label="Attach media via Blossom"
            signEvent={signEvent}
            onUploaded={(result) => {
              const type = inferMediaType(result.url);
              setComposerMedia((prev) => [...prev, { url: result.url, type }]);
            }}
          />
          {composerMedia.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-cyan-200">Attached media previews</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {composerMedia.map((media, idx) => (
                  <div key={`${media.url}-${idx}`} className="rounded border border-cyan-700/50 bg-slate-950/60 p-2">
                    {media.type === 'image' ? <img src={media.url} alt="Composer attachment" className="h-28 w-full rounded object-cover" /> : null}
                    {media.type === 'video' ? <video src={media.url} controls className="h-28 w-full rounded object-cover" /> : null}
                    {media.type === 'audio' ? <audio src={media.url} controls className="w-full" /> : null}
                    {media.type === 'other' ? <a href={media.url} className="text-xs text-cyan-300 break-all" target="_blank" rel="noreferrer">{media.url}</a> : null}
                    <button type="button" className="mt-2 cy-btn-secondary text-xs" onClick={() => setComposerMedia((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-slate-400">Uploads are added to the post payload automatically — we keep raw URLs out of the composer.</p>
        </div>
        <div className="mt-3 flex justify-end">
          <button className="cy-btn" onClick={onPublish} disabled={!canPost || busyId === 'composer'}>
            {busyId === 'composer' ? 'Publishing…' : 'Post Event'}
          </button>
        </div>
      </section>

      <div className="cy-card p-3 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cy-chip" onClick={() => setShowMuteModal(true)}>🔧 Mute</button>
          <button type="button" className="cy-chip" onClick={() => setShowFiltersModal(true)}>🧰 Content Filters</button>
          <button type="button" className="cy-chip" onClick={() => setShowRelayModal(true)}>📡 Relay Status</button>
        </div>
        <p className="text-xs text-cyan-200">{hiddenCount} posts hidden</p>
      </div>

      <header className="cy-card p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className="cy-kicker">SOCIAL FEED</p>
          <button className="cy-btn-secondary" onClick={refresh}>Refresh</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(FEED_MODE_LABELS) as FeedMode[]).map((mode) => (
            <button
              key={mode}
              className={`cy-chip text-sm ${feedMode === mode && !activeCustomFeedId ? 'border-cyan-300 text-cyan-100 shadow-[0_0_14px_rgba(0,212,255,0.25)]' : ''}`}
              onClick={() => {
                setActiveCustomFeedId(null);
                setFeedMode(mode);
              }}
            >
              {FEED_MODE_LABELS[mode]}
            </button>
          ))}

          <span className="text-gray-600 mx-1">|</span>

          <button
            className={`cy-chip text-sm ${activeCustomFeedId === 'bookmarks' ? 'border-cyan-300 text-cyan-100 shadow-[0_0_14px_rgba(0,212,255,0.25)]' : ''}`}
            onClick={() => {
              setFeedMode('following');
              setActiveCustomFeedId('bookmarks');
            }}
          >
            📑 Bookmarks
          </button>

          <button
            className="cy-chip text-sm border-dashed border-gray-600 text-gray-400 hover:border-cyan-500 hover:text-cyan-400"
            onClick={() => setShowFeedModal(true)}
          >
            + Feeds
          </button>
        </div>

        {userCustomFeeds.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700/50">
            {userCustomFeeds.map((feedDef) => (
              <button
                key={feedDef.id}
                className={`cy-chip text-sm ${activeCustomFeedId === feedDef.id ? 'border-cyan-300 text-cyan-100 shadow-[0_0_14px_rgba(0,212,255,0.25)]' : ''}`}
                onClick={() => {
                  setFeedMode('following');
                  setActiveCustomFeedId(feedDef.id);
                }}
              >
                {feedDef.title}
              </button>
            ))}
          </div>
        )}
      </header>

      <FeedDiscoveryModal
        open={showFeedModal}
        onClose={() => setShowFeedModal(false)}
        onAddFeed={onAddCustomFeed}
        userProfile={{ interests: userInterests, following: userFollowing }}
        discoverableFeeds={discoverableFeeds}
      />

      <section className="space-y-4">

        {notificationQueue.length > 0 ? (
          <div className="cy-card p-4 border border-emerald-400/40">
            <p className="text-sm text-emerald-200">🔔 Subscription matches queued: {notificationQueue.length}</p>
          </div>
        ) : null}

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

        {tagFilteredFeed.map((item) => {
          const media = parseMediaFromFeedItem(item);
          const contentTypes = Array.from(detectContentTypes(item));
          const liveMeta = extractLiveStreamMeta(item);
          const postHashtags = [...new Set((item.tags || []).filter((tag) => tag[0] === 't' && tag[1]).map((tag) => tag[1].toLowerCase()))];
          const displayName = item.profile?.display_name || item.profile?.name || 'nostr user';
          const hasNip05 = Boolean(item.profile?.nip05);
          const shortNpub = truncateNpub(item.pubkey, 10);
          return (
            <article key={item.id} className={`cy-card p-5 ${notifyByEventId.has(item.id) ? 'border border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.22)]' : ''}`}>
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
              {notifyByEventId.has(item.id) ? (
                <div className="mt-2">
                  <span className="text-[11px] rounded-full border border-emerald-400/50 px-2 py-0.5 text-emerald-200 bg-emerald-500/10">
                    🔔 Matched {notifyByEventId.get(item.id)?.type}: {notifyByEventId.get(item.id)?.match}
                  </span>
                </div>
              ) : null}
              <InlineContent
                tokens={media.tokens}
                quotedEvents={quotedEvents}
                quotedProfiles={quotedProfiles}
                quotedLoadingIds={quotedLoadingIds}
                quotedFailedIds={quotedFailedIds}
                onRetryQuote={retryQuotedEvent}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {contentTypes.map((type) => (
                  <span key={`${item.id}-${type}`} className="text-[11px] rounded-full border border-cyan-400/40 px-2 py-0.5 text-cyan-200 bg-cyan-500/10">{CONTENT_TYPE_LABELS[type]}</span>
                ))}
                {postHashtags.slice(0, 5).map((tag) => {
                  const muted = isHashtagMuted(tag);
                  return (
                    <button
                      key={`${item.id}-tag-${tag}`}
                      type="button"
                      className={`text-[11px] rounded-full border px-2 py-0.5 ${muted ? 'border-red-400/50 text-red-200 bg-red-500/10' : 'border-cyan-500/40 text-cyan-300 bg-cyan-500/5 hover:bg-cyan-500/15'}`}
                      title={muted ? 'Muted hashtag' : 'Right-click to mute hashtag'}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        if (!muted) {
                          void muteHashtag(tag);
                        }
                      }}
                    >
                      #{tag} {muted ? '🔇' : ''}
                    </button>
                  );
                })}
              </div>
              {liveMeta ? <LiveStreamCard meta={liveMeta} /> : null}
              <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                <span className="cy-chip" title="Zap totals">
                  {formatZapIndicator(displayZapByEventId.get(item.id))}
                </span>
                <div className="flex gap-2 flex-wrap justify-end">
                  <button className="cy-chip" onClick={() => onAction('like', item)} disabled={busyId === `like-${item.id}`}>Like</button>
                  <button className="cy-chip" onClick={() => onAction('repost', item)} disabled={busyId === `repost-${item.id}`}>Repost</button>
                  <button className="cy-chip" onClick={() => onAction('reply', item)} disabled={busyId === `reply-${item.id}`}>Reply</button>
                  <button className="cy-chip" onClick={() => setZapBreakdownEventId(item.id)}>View zaps</button>
                  <button className="cy-chip" onClick={() => onZap(item)} disabled={busyId === `zap-${item.id}`}>{buildZapButtonLabel(busyId === `zap-${item.id}`)}</button>
                  {item.pubkey === user?.pubkey ? <button className="cy-chip" onClick={() => onPin(item)}>📌 Pin to Profile</button> : null}
                  <BookmarkButton eventId={item.id} pubkey={user?.pubkey} />
                  <PostActionMenu item={item} viewerPubkey={user?.pubkey} />
                </div>
              </div>
            </article>
          );
        })}

        <div ref={observerRef} className="h-4" />
        {loadingMore ? <div className="cy-card p-4 text-sm">Loading more events…</div> : null}
      </section>

      {showMuteModal ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" onClick={() => setShowMuteModal(false)}>
          <div className="cy-card w-full max-w-lg p-4 space-y-4" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-cyan-100">Mute settings</h3>
            <p className="text-sm text-cyan-200">Manage muted words and profiles in Settings.</p>
            <div className="flex justify-between items-center gap-3">
              <Link to="/settings" className="cy-btn">Open Settings</Link>
              <button type="button" className="cy-chip" onClick={() => setShowMuteModal(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {showFiltersModal ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" onClick={() => setShowFiltersModal(false)}>
          <div className="cy-card w-full max-w-2xl p-4 space-y-4 max-h-[85vh] overflow-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-cyan-100">Content filters</h3>
              <button type="button" className="cy-chip" onClick={clearFilters}>Reset all</button>
            </div>
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
            <div className="space-y-2 border-t border-gray-700/60 pt-3">
              <p className="text-sm text-cyan-200">Tag filters</p>
              <div className="flex flex-wrap gap-2">
                {availableTags.slice(0, 80).map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`cy-chip text-xs ${active ? 'border-cyan-300 text-cyan-100' : ''}`}
                      onClick={() => setSelectedTags(active ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag])}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-slate-400">Match logic</span>
                <button type="button" className={`cy-chip text-xs ${logic === 'or' ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => setLogic('or')}>Any</button>
                <button type="button" className={`cy-chip text-xs ${logic === 'and' ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => setLogic('and')}>All</button>
              </div>
            </div>
            <div className="flex justify-end"><button type="button" className="cy-btn" onClick={() => setShowFiltersModal(false)}>Done</button></div>
          </div>
        </div>
      ) : null}

      {showRelayModal ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" onClick={() => setShowRelayModal(false)}>
          <div className="cy-card w-full max-w-2xl p-4 space-y-4 max-h-[85vh] overflow-auto" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-cyan-100">Relay management</h3>
            <p className="text-xs text-slate-400">Connected relays are stored locally and published as kind:10002 when signing is available.</p>
            <div className="flex flex-wrap gap-2">
              {connectedRelays.map((relay) => (
                <span key={relay} className="cy-chip text-xs">
                  {relay.replace('wss://', '')}
                  <button type="button" className="ml-2 text-red-300" onClick={() => void onRemoveRelay(relay)}>×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={relayInput} onChange={(e) => setRelayInput(e.target.value)} placeholder="wss://your-relay.example" className="cy-input" />
              <button type="button" className="cy-btn" onClick={() => void onAddRelay(relayInput)}>Add</button>
            </div>
            <div>
              <p className="text-sm text-cyan-200 mb-2">Known relay suggestions</p>
              <div className="flex flex-wrap gap-2">
                {relaySuggestions.map((relay) => {
                  const selected = connectedRelays.includes(relay);
                  return (
                    <button key={relay} type="button" className={`cy-chip text-xs ${selected ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => void onAddRelay(relay)} disabled={selected}>
                      {selected ? '✓ ' : '+ '}{relay.replace('wss://', '')}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end"><button type="button" className="cy-btn" onClick={() => setShowRelayModal(false)}>Done</button></div>
          </div>
        </div>
      ) : null}

      {zapComposeItem ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" onClick={() => setZapComposeItem(null)}>
          <div className="cy-card w-full max-w-lg p-4 space-y-3" onClick={(event) => event.stopPropagation()}>
            <div>
              <h3 className="text-lg font-semibold text-cyan-100">⚡ Zap this post</h3>
              <p className="text-xs text-cyan-300/80">Sending sats to {shortPubkey(zapComposeItem.pubkey)} ({zapComposeItem.profile?.lud16 || 'no lud16'})</p>
            </div>
            <label className="text-sm text-cyan-200">Amount (sats)</label>
            <input
              type="number"
              min={1}
              value={zapAmountInput}
              onChange={(event) => setZapAmountInput(event.target.value)}
              className="w-full rounded-md bg-slate-950/80 border border-cyan-500/30 px-3 py-2"
            />
            <div className="flex flex-wrap gap-2">
              {getDefaultZapAmountOptions().map((value) => (
                <button key={`preset-${value}`} type="button" className="cy-chip" onClick={() => setZapAmountInput(String(value))}>{value} sats</button>
              ))}
            </div>
            <label className="text-sm text-cyan-200">Message (optional)</label>
            <textarea
              value={zapMessageInput}
              onChange={(event) => setZapMessageInput(event.target.value)}
              className="w-full rounded-md bg-slate-950/80 border border-cyan-500/30 px-3 py-2 min-h-[72px]"
              placeholder="Add an optional zap note"
            />
            {zapStatusLabel ? <p className="text-xs text-cyan-300">{zapStatusLabel}</p> : null}
            {zapError ? <p className="text-xs text-red-300">{zapError}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="cy-chip" onClick={() => setZapComposeItem(null)}>Cancel</button>
              <button type="button" className="cy-btn" onClick={() => void submitZap()} disabled={busyId === `zap-${zapComposeItem.id}`}>
                {buildZapButtonLabel(busyId === `zap-${zapComposeItem.id}`)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {zapBreakdownEventId ? <ZapBreakdownModal eventId={zapBreakdownEventId} onClose={() => setZapBreakdownEventId(null)} /> : null}
    </div>
  );
}
