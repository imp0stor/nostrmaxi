import { SimplePool } from 'nostr-tools';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { signEvent, publishEvent, truncateNpub } from '../lib/nostr';
import { followPubkey, invalidateDiscoverCache, loadCuratedDiscoverUsers, loadFollowing, loadNetworkPosts, loadSuggestedTopics, toNpub, type DiscoverUser, type NetworkPost } from '../lib/social';
import { fetchProfilesBatchCached, isValidNip05, profileDisplayName } from '../lib/profileCache';
import { addRelay, fetchRelayMetricsSeed, rankTopics, suggestedRelays, type RankedRelayRecommendation, type RelayFilter, type RelayMetricsSeed, type RelaySortMode, type SimilarTopic } from '../lib/discoverEntities';
import { discoverSortLabel, excludeFollowedDiscoverUsers, hydrateFollowerCount, optimisticFollowUpdate, sortDiscoverUsers } from '../lib/discoverState';
import { requestIdentityRefresh } from '../lib/identityRefresh';
import { CONTENT_TYPE_LABELS, type ContentType } from '../lib/contentTypes';
import type { DiscoverCardDataLike } from '../types/discover';
import { useBeaconSearch } from '../lib/beaconSearch';
import { ConfigAccordion } from '../components/ConfigAccordion';
import { ProfileCard, type WotHop } from '../components/ProfileCard';
import { DiscoverSection } from '../components/discover/DiscoverSection';
import { FilterBar } from '../components/filters/FilterBar';
import { useTagFilter } from '../hooks/useTagFilter';
import { useConfig } from '../hooks/useConfig';

interface DiscoverCardData extends DiscoverUser, DiscoverCardDataLike {
  name: string;
  nip05?: string;
  about?: string;
  picture?: string;
}

type EntityTab = 'users' | 'relays' | 'posts';
type DiscoverTab = 'for-you' | 'wot' | 'general' | 'following';

const PAGE_SIZE = 24;
type DiscoverPostFilter = Exclude<ContentType, 'live' | 'longform' | 'events' | 'polls'>;
const DISCOVER_POST_FILTERS: DiscoverPostFilter[] = ['text', 'images', 'videos', 'audio', 'links'];
const DEFAULT_RELAY_DISCOVERY_RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.snort.social', 'wss://nostr.wine'];

const normalizeRelay = (relay: string): string => relay.trim().toLowerCase().replace(/\/+$/, '');

function userRegionFromLocale(): string {
  const locale = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';
  const upper = locale.toUpperCase();
  if (upper.endsWith('-US') || upper.endsWith('-CA')) return 'US';
  if (upper.endsWith('-GB') || upper.endsWith('-DE') || upper.endsWith('-FR') || upper.endsWith('-NL') || upper.endsWith('-SE')) return 'EU';
  if (upper.endsWith('-JP') || upper.endsWith('-KR') || upper.endsWith('-SG')) return 'APAC';
  return 'Global';
}

async function fetchUserRelayList(pubkey: string, fallbackRelays: string[], discoveryRelays: string[]): Promise<string[]> {
  const pool = new SimplePool();
  const discovered = new Set<string>();
  try {
    const nip65 = await pool.get(discoveryRelays, { kinds: [10002], authors: [pubkey] });
    for (const tag of nip65?.tags || []) {
      if (tag[0] !== 'r' || !tag[1]) continue;
      discovered.add(normalizeRelay(tag[1]));
    }
  } catch {
    // fallback below
  } finally {
    pool.close(discoveryRelays);
  }

  if (discovered.size > 0) return [...discovered];
  return [...new Set(fallbackRelays.map(normalizeRelay))];
}

export function DiscoverPage() {
  const { user, isAuthenticated } = useAuth();
  const { value: relayDiscoveryRelays } = useConfig<string[]>('relays.discovery', DEFAULT_RELAY_DISCOVERY_RELAYS);
  const [following, setFollowing] = useState<string[]>([]);
  const [poolCards, setPoolCards] = useState<Record<Exclude<DiscoverTab, 'following'>, DiscoverCardData[]>>({
    'for-you': [],
    wot: [],
    general: [],
  });
  const [followingCards, setFollowingCards] = useState<DiscoverCardData[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');
  const [entityTab, setEntityTab] = useState<EntityTab>('users');
  const [tab, setTab] = useState<DiscoverTab>('for-you');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [connectedRelays, setConnectedRelays] = useState<string[]>([]);
  const [similarTopics, setSimilarTopics] = useState<SimilarTopic[]>([]);
  const [networkPosts, setNetworkPosts] = useState<NetworkPost[]>([]);
  const [relaySort, setRelaySort] = useState<RelaySortMode>('overall');
  const [relayRegionFilter, setRelayRegionFilter] = useState('all');
  const [relayPricingFilter, setRelayPricingFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [relayNipFilter, setRelayNipFilter] = useState('all');
  const [relayMetricsUniverse, setRelayMetricsUniverse] = useState<RelayMetricsSeed[]>([]);
  const [selectedRelay, setSelectedRelay] = useState<RankedRelayRecommendation | null>(null);
  const [postFilters, setPostFilters] = useState<Set<DiscoverPostFilter>>(new Set());
  const { selectedTags, logic, setSelectedTags, setLogic } = useTagFilter({
    storageKey: 'nostrmaxi.discover.tag-filter',
    defaultLogic: 'or',
  });
  
  // Beacon search integration
  const beaconSearch = useBeaconSearch(search, 300);

  const refresh = async (opts?: { background?: boolean }) => {
    if (!user?.pubkey) return;
    if (!opts?.background) setLoading(true);
    try {
      const [followingList, curated, topicCounts, posts] = await Promise.all([
        loadFollowing(user.pubkey),
        loadCuratedDiscoverUsers(user.pubkey),
        loadSuggestedTopics(user.pubkey),
        loadNetworkPosts(user.pubkey),
      ]);
      setFollowing(followingList);

      const allUsers = [...curated.blended, ...curated.wot, ...curated.general];
      const byPubkey = new Map(allUsers.map((u) => [u.pubkey, hydrateFollowerCount(u)]));
      const uniquePubkeys = [...new Set([...followingList, ...allUsers.map((u) => u.pubkey)])];
      const profileMap = await fetchProfilesBatchCached(uniquePubkeys);

      const hydrate = (list: DiscoverUser[]) => excludeFollowedDiscoverUsers(list, followingList)
        .map((raw) => {
          const u = hydrateFollowerCount(raw);
          const profile = profileMap.get(u.pubkey);
          return {
            ...u,
            name: profileDisplayName(u.pubkey, profile),
            nip05: isValidNip05(profile?.nip05) ? profile?.nip05 : undefined,
            about: profile?.about,
            picture: profile?.picture,
          };
        });

      const followingHydrated = followingList.map((pk) => {
        const profile = profileMap.get(pk);
        const base = byPubkey.get(pk);
        return {
          pubkey: pk,
          followers: base?.followers ?? 0,
          following: base?.following ?? 0,
          activity: base?.activity ?? 0,
          freshnessScore: base?.freshnessScore ?? 0,
          overlapScore: base?.overlapScore ?? 0,
          secondHopCount: base?.secondHopCount ?? 0,
          wotFollowerCount: base?.wotFollowerCount ?? 0,
          proximityScore: base?.proximityScore ?? 0,
          interactionScore: base?.interactionScore ?? 0,
          relayAffinityScore: base?.relayAffinityScore ?? 0,
          forYouScore: base?.forYouScore ?? 0,
          wotScore: base?.wotScore ?? 0,
          score: base?.score ?? 0,
          verifiedNip05: Boolean(profile?.nip05 && profile.nip05.includes('@')),
          name: profileDisplayName(pk, profile),
          nip05: isValidNip05(profile?.nip05) ? profile?.nip05 : undefined,
          about: profile?.about,
          picture: profile?.picture,
        };
      });

      setPoolCards({
        'for-you': hydrate(curated.blended),
        wot: hydrate(curated.wot),
        general: hydrate(curated.general),
      });
      setFollowingCards(followingHydrated);
      const rankedTopics = rankTopics(topicCounts);
      setSimilarTopics(rankedTopics);
      setNetworkPosts(posts.sort((a, b) => (b.proximityScore + b.interactionScore) - (a.proximityScore + a.interactionScore)));
      setVisibleCount(PAGE_SIZE);

      const configuredFromNip65 = await fetchUserRelayList(user.pubkey, connectedRelays, relayDiscoveryRelays);
      setConnectedRelays(configuredFromNip65);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nostrmaxi_connected_relays', JSON.stringify(configuredFromNip65));
      }
    } finally {
      if (!opts?.background) setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user?.pubkey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('nostrmaxi_connected_relays');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setConnectedRelays(parsed.filter((r) => typeof r === 'string').map(normalizeRelay));
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchRelayMetricsSeed(controller.signal).then((relays) => {
      setRelayMetricsUniverse(relays);
    });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, tab, entityTab]);

  const onFollow = async (pubkey: string) => {
    if (!user?.pubkey || following.includes(pubkey)) return;
    const snapshot = following;
    setFollowing((prev) => [...prev, pubkey]);
    setPoolCards((prev) => ({
      'for-you': optimisticFollowUpdate(prev['for-you'], pubkey),
      wot: optimisticFollowUpdate(prev.wot, pubkey),
      general: optimisticFollowUpdate(prev.general, pubkey),
    }));

    const ok = await followPubkey(user.pubkey, pubkey, signEvent, publishEvent);
    if (!ok) {
      setFollowing(snapshot);
      await refresh({ background: true });
      return;
    }

    invalidateDiscoverCache(user.pubkey);
    requestIdentityRefresh(user.pubkey);
    void refresh({ background: true });
  };

  const onAddRelay = async (relayUrl: string) => {
    if (!user?.pubkey) return;
    const next = addRelay(connectedRelays, normalizeRelay(relayUrl));
    setConnectedRelays(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nostrmaxi_connected_relays', JSON.stringify(next));
    }

    const unsigned = {
      kind: 10002,
      content: '',
      tags: next.map((relay) => ['r', relay]),
      pubkey: user.pubkey,
      created_at: Math.floor(Date.now() / 1000),
    };

    try {
      const signed = await signEvent(unsigned);
      if (signed) await publishEvent(signed, relayDiscoveryRelays);
    } catch {
      // local persistence still succeeds even if signer/publish unavailable
    }
  };

  const recommendedCards = useMemo(() => {
    const sourceCards = tab === 'following'
      ? followingCards
      : (tab === 'wot' && poolCards.wot.length === 0 ? poolCards.general : poolCards[tab]);
    let out = tab === 'following' ? [...sourceCards] : excludeFollowedDiscoverUsers([...sourceCards], following);

    if (verifiedOnly) out = out.filter((c) => c.verifiedNip05);
    if (activeOnly) out = out.filter((c) => c.activity > 2);

    const sorted = sortDiscoverUsers(out, tab);
    return [...sorted].sort((a, b) => {
      const hopA = a.secondHopCount > 0 ? 2 : 3;
      const hopB = b.secondHopCount > 0 ? 2 : 3;
      if (hopA !== hopB) return hopA - hopB;
      return (b.wotScore ?? b.score) - (a.wotScore ?? a.score);
    });
  }, [poolCards, followingCards, following, tab, verifiedOnly, activeOnly]);

  const searchResultCards = useMemo(() => {
    const q = search.trim();
    if (!q) return [] as DiscoverCardData[];

    if (beaconSearch.results?.results?.length) {
      let out: DiscoverCardData[] = beaconSearch.results.results.map((result) => ({
        pubkey: result.pubkey,
        followers: 0,
        following: 0,
        activity: 0,
        freshnessScore: result.score || 0,
        overlapScore: 0,
        secondHopCount: 0,
        wotFollowerCount: 0,
        proximityScore: 0,
        interactionScore: 0,
        relayAffinityScore: 0,
        forYouScore: result.score || 0,
        wotScore: 0,
        score: result.score || 0,
        verifiedNip05: Boolean(result.nip05),
        name: result.name || truncateNpub(result.npub),
        nip05: result.nip05,
        about: result.about,
        picture: result.picture,
      }));

      if (verifiedOnly) out = out.filter((c) => c.verifiedNip05);
      if (activeOnly) out = out.filter((c) => c.activity > 2);
      return out;
    }

    const qLower = q.toLowerCase();
    return recommendedCards.filter((c) => c.name.toLowerCase().includes(qLower)
      || c.nip05?.toLowerCase().includes(qLower)
      || toNpub(c.pubkey).toLowerCase().includes(qLower));
  }, [search, beaconSearch.results, recommendedCards, verifiedOnly, activeOnly]);

  const relaySuggestions = useMemo<RankedRelayRecommendation[]>(() => {
    const filter: RelayFilter = {
      pricing: relayPricingFilter,
      regions: relayRegionFilter === 'all' ? undefined : [relayRegionFilter],
      nips: relayNipFilter === 'all' ? undefined : [Number(relayNipFilter)],
    };

    return suggestedRelays({
      configuredRelays: connectedRelays,
      preferredTopics: similarTopics.slice(0, 6).map((topic) => topic.topic),
      userRegion: userRegionFromLocale(),
      limit: 12,
      sortBy: relaySort,
      filters: filter,
      relayUniverse: relayMetricsUniverse.length > 0 ? relayMetricsUniverse : undefined,
    });
  }, [connectedRelays, similarTopics, relaySort, relayPricingFilter, relayRegionFilter, relayNipFilter, relayMetricsUniverse]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>(similarTopics.map((topic) => topic.topic.toLowerCase()));
    for (const card of recommendedCards) {
      const aboutTags = (card.about || '').match(/#[a-z0-9_]+/gi) || [];
      aboutTags.forEach((tag) => tags.add(tag.slice(1).toLowerCase()));
    }
    return Array.from(tags).slice(0, 60);
  }, [similarTopics, recommendedCards]);

  const applyTagFilterToCards = (cards: DiscoverCardData[]) => {
    if (selectedTags.length === 0) return cards;
    return cards.filter((card) => {
      const haystack = `${card.name} ${card.about || ''} ${card.nip05 || ''}`.toLowerCase();
      if (logic === 'and') return selectedTags.every((tag) => haystack.includes(tag.toLowerCase()));
      return selectedTags.some((tag) => haystack.includes(tag.toLowerCase()));
    });
  };

  const filteredRecommendedCards = applyTagFilterToCards(recommendedCards);
  const filteredSearchCards = applyTagFilterToCards(searchResultCards);

  const isSearching = search.trim().length > 0;
  const visibleRecommendedCards = filteredRecommendedCards.slice(0, visibleCount);
  const visibleSearchCards = filteredSearchCards.slice(0, visibleCount);
  const activeListCount = isSearching ? filteredSearchCards.length : filteredRecommendedCards.length;
  const hasMore = visibleCount < activeListCount;

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loading || loadingMore || !hasMore || entityTab !== 'users') return;

    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (!first?.isIntersecting) return;
      setLoadingMore(true);
      window.setTimeout(() => {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, activeListCount));
        setLoadingMore(false);
      }, 220);
    }, { rootMargin: '220px 0px 220px 0px' });

    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, activeListCount, entityTab]);

  const wotHopForCard = (card: DiscoverCardData): WotHop => {
    if (following.includes(card.pubkey) || tab === 'following') return 1;
    if (card.secondHopCount > 0 || card.overlapScore > 0 || card.wotFollowerCount > 0) return 2;
    return 3;
  };

  const detectPostTypes = (post: NetworkPost): Set<DiscoverPostFilter> => {
    const text = (post.content || '').toLowerCase();
    const out = new Set<DiscoverPostFilter>();
    if (/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i.test(text)) out.add('images');
    if (/https?:\/\/[^\s]+\.(mp4|webm|mov)|youtube\.com|youtu\.be|vimeo\.com|twitch\.tv/i.test(text)) out.add('videos');
    if (/https?:\/\/[^\s]+\.(mp3|wav|m4a|aac)|spotify\.com|soundcloud\.com|wavlake\.com/i.test(text)) out.add('audio');
    if (/https?:\/\//i.test(text)) out.add('links');
    if (out.size === 0) out.add('text');
    return out;
  };

  const visibleNetworkPosts = networkPosts.filter((post) => {
    if (postFilters.size === 0) return true;
    const kinds = detectPostTypes(post);
    return Array.from(postFilters).some((f) => kinds.has(f));
  });

  const reasonLabel = (card: DiscoverCardData): string => {
    if (tab === 'for-you') {
      if (card.verifiedNip05) return 'For You: Verified NIP-05';
      if (card.activity > 0) return `For You: Active (${card.activity})`;
      return `For You: Global relevance (${card.followers})`;
    }
    if (tab === 'wot') {
      if (card.overlapScore > 0) return `WoT: ${card.overlapScore} mutual follows`;
      if (card.interactionScore > 0.1) return 'WoT: Interacted with by your follows';
      if (card.relayAffinityScore > 0.1) return 'WoT: Relay affinity';
      return `WoT: 2-hop proximity (${card.wotFollowerCount})`;
    }
    if (card.verifiedNip05) return 'Verified NIP-05';
    if (card.activity > 0) return 'Active this week';
    return 'Trending profile';
  };

  if (!isAuthenticated || !user) return <div className="max-w-3xl mx-auto px-4 py-8"><div className="cy-card p-6">Login required for discovery.</div></div>;

  return (
    <div className="nm-page max-w-6xl">
      <header className="cy-card p-5">
        <p className="cy-kicker">DISCOVER</p>
        <h1 className="cy-title">Curated Nostr Accounts</h1>
        <p className="nm-subtitle mt-2">Suggested creators and operators based on reputation, activity, and graph overlap.</p>
      </header>

      <ConfigAccordion
        id="discover-filters-modes"
        title="Discover Filters & Modes"
        subtitle="Compact top controls — expand to tune users/relay/post discovery."
        summary={<span>Active mode: {entityTab}</span>}
        defaultOpen={false}
        rightSlot={<span className="text-xs text-cyan-300">Mode: {entityTab}</span>}
      >
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'users', label: 'Users' },
            { key: 'relays', label: 'Relays' },
            { key: 'posts', label: 'Posts' },
          ] as const).map((item) => (
            <button key={item.key} type="button" onClick={() => setEntityTab(item.key)} className={`rounded-lg px-3 py-1.5 text-sm border ${entityTab === item.key ? 'bg-fuchsia-500/20 border-fuchsia-300 text-fuchsia-100' : 'bg-slate-950/70 border-slate-700 text-slate-300'}`}>
              {item.label}
            </button>
          ))}
        </div>

        {entityTab === 'users' && (
          <>
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'for-you', label: 'For You' },
                { key: 'wot', label: 'WoT' },
                { key: 'general', label: 'Global' },
                { key: 'following', label: 'Following' },
              ] as const).map((item) => (
                <button key={item.key} type="button" onClick={() => { setTab(item.key); setVisibleCount(PAGE_SIZE); }} className={`rounded-lg px-3 py-1.5 text-sm border ${tab === item.key ? 'bg-cyan-500/20 border-cyan-300 text-cyan-100' : 'bg-slate-950/70 border-slate-700 text-slate-300'}`}>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2 relative">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search NIP-05, name, npub..." className="w-full bg-slate-950/70 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white" />
                {search.trim() && beaconSearch.results && beaconSearch.results.beaconAvailable && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                    🔍 Beacon
                  </div>
                )}
                {search.trim() && beaconSearch.loading && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-cyan-400">
                    Searching...
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setVerifiedOnly((v) => !v)} className={`rounded-lg px-3 py-2 text-sm border ${verifiedOnly ? 'bg-cyan-500/20 border-cyan-300 text-cyan-100' : 'bg-slate-950/70 border-cyan-500/30 text-cyan-200'}`}>
                {verifiedOnly ? 'Verified only ✓' : 'Verified only'}
              </button>
            </div>

            <p className="text-xs text-cyan-300">
              {search.trim() && beaconSearch.results 
                ? `${beaconSearch.results.total} results from ${beaconSearch.results.source === 'beacon' ? 'Beacon search' : 'local cache'}`
                : discoverSortLabel(tab)}
            </p>

            <button type="button" onClick={() => setActiveOnly((v) => !v)} className={`rounded-lg px-3 py-2 text-sm border ${activeOnly ? 'bg-fuchsia-500/20 border-fuchsia-300 text-fuchsia-100' : 'bg-slate-950/70 border-fuchsia-500/40 text-fuchsia-200'}`}>
              {activeOnly ? 'Active users ✓' : 'Active users'}
            </button>

            <FilterBar
              title="Discover Topic Filter"
              availableTags={availableTags}
              selectedTags={selectedTags}
              logic={logic}
              onTagsChange={setSelectedTags}
              onLogicChange={setLogic}
              onApply={() => setVisibleCount(PAGE_SIZE)}
            />
          </>
        )}
      </ConfigAccordion>

      <section className="cy-card p-4">
        <div className="max-h-[68vh] overflow-y-auto pr-1">
          {entityTab === 'users' && (
            loading ? <div className="py-16 text-center text-cyan-200">Loading curated suggestions…</div> : (
              <div className="space-y-7">
                <DiscoverSection
                  title="Recommended"
                  subtitle="Curated accounts prioritized by Web-of-Trust proximity and profile quality."
                >
                  {visibleRecommendedCards.length === 0 ? (
                    <div className="py-10 text-center text-cyan-200">No recommendations match this filter yet.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {visibleRecommendedCards.map((card) => (
                        <ProfileCard
                          key={`rec-${card.pubkey}`}
                          user={card}
                          hop={wotHopForCard(card)}
                          reason={reasonLabel(card)}
                          isFollowing={following.includes(card.pubkey)}
                          onFollow={onFollow}
                        />
                      ))}
                    </div>
                  )}
                </DiscoverSection>

                {isSearching && (
                  <DiscoverSection
                    title="Search Results"
                    subtitle="Beacon-powered profile search rendered in the same curated card layout."
                  >
                    {visibleSearchCards.length === 0 ? (
                      <div className="py-10 text-center text-cyan-200">No search results yet.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {visibleSearchCards.map((card) => (
                          <ProfileCard
                            key={`search-${card.pubkey}`}
                            user={card}
                            hop={wotHopForCard(card)}
                            reason="Search match"
                            isFollowing={following.includes(card.pubkey)}
                            onFollow={onFollow}
                          />
                        ))}
                      </div>
                    )}
                  </DiscoverSection>
                )}

                <div ref={loadMoreRef} className="py-4 text-center text-sm text-cyan-200">
                  {loadingMore && 'Loading more profiles…'}
                  {!loadingMore && !hasMore && 'End of suggestions'}
                </div>
              </div>
            )
          )}

          {entityTab === 'relays' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-400/25 bg-slate-950/85 p-4">
                <p className="text-emerald-100 font-semibold">Suggested Relays</p>
                <p className="text-sm text-slate-300 mt-1">Multi-dimensional ranking across performance, geography, content support, feature depth, community quality, and trust signals.</p>
                <p className="text-xs text-slate-400 mt-2">Configured: {connectedRelays.length === 0 ? 'none yet' : connectedRelays.join(', ')}</p>
                <div className="grid md:grid-cols-4 gap-2 mt-3 text-xs">
                  <select value={relaySort} onChange={(e) => setRelaySort(e.target.value as RelaySortMode)} className="bg-slate-900 border border-emerald-500/30 rounded px-2 py-1 text-emerald-100">
                    <option value="overall">Sort: Overall</option>
                    <option value="uptime">Sort: Uptime</option>
                    <option value="latency">Sort: Latency</option>
                    <option value="popularity">Sort: Popularity</option>
                    <option value="features">Sort: Features</option>
                  </select>
                  <select value={relayRegionFilter} onChange={(e) => setRelayRegionFilter(e.target.value)} className="bg-slate-900 border border-emerald-500/30 rounded px-2 py-1 text-emerald-100">
                    <option value="all">Region: All</option>
                    <option value="US">US</option>
                    <option value="EU">EU</option>
                    <option value="APAC">APAC</option>
                    <option value="Global">Global</option>
                  </select>
                  <select value={relayPricingFilter} onChange={(e) => setRelayPricingFilter(e.target.value as 'all' | 'free' | 'paid')} className="bg-slate-900 border border-emerald-500/30 rounded px-2 py-1 text-emerald-100">
                    <option value="all">Pricing: All</option>
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                  <select value={relayNipFilter} onChange={(e) => setRelayNipFilter(e.target.value)} className="bg-slate-900 border border-emerald-500/30 rounded px-2 py-1 text-emerald-100">
                    <option value="all">NIP: Any</option>
                    <option value="1">NIP-01</option>
                    <option value="11">NIP-11</option>
                    <option value="42">NIP-42</option>
                    <option value="57">NIP-57</option>
                    <option value="65">NIP-65</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {relaySuggestions.map((relay) => {
                  const connected = connectedRelays.includes(normalizeRelay(relay.url));
                  return (
                    <article key={relay.url} className="rounded-xl border border-emerald-400/25 bg-slate-950/85 p-4">
                      <p className="text-emerald-200 font-semibold truncate">{relay.name}</p>
                      <p className="text-xs text-slate-400 mt-1 break-all">{relay.url}</p>
                      <p className="text-sm text-slate-300 mt-2">{relay.description}</p>
                      <p className="text-amber-300 text-sm mt-2">{'★'.repeat(relay.stars)}{'☆'.repeat(5 - relay.stars)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {relay.badges.map((badge) => <span key={`${relay.url}-${badge}`} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-300/30 text-emerald-100">{badge}</span>)}
                      </div>
                      <div className="mt-2 text-xs text-slate-300 space-y-1">
                        <p>Uptime {relay.metrics.performance.uptimePct.toFixed(1)}% · latency {relay.metrics.performance.latencyMs}ms · throughput {relay.metrics.performance.throughputEventsPerSec}/s</p>
                        <p>Region {relay.metrics.geographic.region} · MAU {relay.metrics.community.activeUsers.toLocaleString()} · events/day {relay.metrics.community.eventVolumeDaily.toLocaleString()}</p>
                        <p>NIPs {relay.metrics.feature.nips.slice(0, 6).join(', ')} · {relay.metrics.feature.paid ? 'Paid' : 'Free'} · {relay.metrics.feature.authRequired ? 'Auth required' : 'No auth required'}</p>
                        <p className="text-emerald-300">Why suggested: {relay.reason}</p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" disabled={connected} onClick={() => void onAddRelay(relay.url)} className={`rounded-md px-3 py-2 text-sm font-semibold ${connected ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/60 hover:bg-emerald-500/35'}`}>
                          {connected ? 'Added' : 'Add Relay'}
                        </button>
                        <button type="button" onClick={() => setSelectedRelay(relay)} className="rounded-md px-3 py-2 text-sm font-semibold bg-slate-900 text-cyan-100 border border-cyan-300/40 hover:bg-slate-800">
                          Details
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {selectedRelay && (
                <div className="rounded-xl border border-cyan-400/35 bg-slate-950/90 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-cyan-100 font-semibold">{selectedRelay.name} detailed metrics</p>
                    <button type="button" onClick={() => setSelectedRelay(null)} className="text-xs text-slate-300 border border-slate-700 rounded px-2 py-1">Close</button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 break-all">{selectedRelay.url}</p>
                  <div className="grid md:grid-cols-2 gap-3 mt-3 text-xs text-slate-200">
                    <div className="rounded border border-slate-700 p-3">Performance: uptime {selectedRelay.metrics.performance.uptimePct.toFixed(2)}%, latency {selectedRelay.metrics.performance.latencyMs}ms, throughput {selectedRelay.metrics.performance.throughputEventsPerSec}/s, stability {(selectedRelay.metrics.performance.connectionStability * 100).toFixed(1)}%</div>
                    <div className="rounded border border-slate-700 p-3">Geographic: {selectedRelay.metrics.geographic.region}, CDN {selectedRelay.metrics.geographic.cdnEdge ? 'yes' : 'no'}, user latency {selectedRelay.metrics.geographic.latencyToUserMs}ms</div>
                    <div className="rounded border border-slate-700 p-3">Content: {selectedRelay.metrics.content.storageCapacityGb}GB, retention {selectedRelay.metrics.content.retentionDays} days, completeness {(selectedRelay.metrics.content.dataCompleteness * 100).toFixed(1)}%, kinds {selectedRelay.metrics.content.supportedEventKinds.slice(0, 10).join(', ')}</div>
                    <div className="rounded border border-slate-700 p-3">Features/Trust: NIPs {selectedRelay.metrics.feature.nips.join(', ')}, read {selectedRelay.metrics.feature.read ? 'yes' : 'no'}, write {selectedRelay.metrics.feature.write ? 'yes' : 'no'}, auth {selectedRelay.metrics.feature.authRequired ? 'required' : 'optional'}, privacy {(selectedRelay.metrics.trust.privacyPolicyScore * 100).toFixed(0)}%</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {entityTab === 'posts' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {DISCOVER_POST_FILTERS.map((filter) => {
                  const active = postFilters.has(filter);
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setPostFilters((prev) => {
                        const next = new Set(prev);
                        if (next.has(filter)) next.delete(filter);
                        else next.add(filter);
                        return next;
                      })}
                      className={`rounded-full border px-2 py-1 text-xs ${active ? 'border-indigo-300 bg-indigo-500/20 text-indigo-100' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
                    >
                      {CONTENT_TYPE_LABELS[filter]}
                    </button>
                  );
                })}
              </div>
              {visibleNetworkPosts.slice(0, 30).map((post) => {
                const badges = Array.from(detectPostTypes(post));
                return (
                  <article key={post.id} className="rounded-xl border border-indigo-400/25 bg-slate-950/85 p-4">
                    <p className="text-xs text-indigo-200 mb-2">Network post · proximity {post.proximityScore.toFixed(2)} · interactions {post.interactionScore.toFixed(2)}</p>
                    <div className="mb-2 flex flex-wrap gap-1">{badges.map((b) => <span key={`${post.id}-${b}`} className="text-[10px] rounded-full border border-indigo-400/40 px-2 py-0.5 text-indigo-200">{CONTENT_TYPE_LABELS[b]}</span>)}</div>
                    <p className="text-sm text-slate-100 whitespace-pre-wrap">{post.content || '(no content)'}</p>
                  </article>
                );
              })}
              <div className="text-xs text-fuchsia-200">Topics signal: {similarTopics.slice(0, 5).map((t) => `#${t.topic}`).join(', ') || 'none yet'}</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
