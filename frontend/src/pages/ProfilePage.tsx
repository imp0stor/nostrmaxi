import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { decodeNpub, fetchProfile, publishEvent, signEvent, truncateNpub } from '../lib/nostr';
import { fetchProfilesBatchCached, isValidNip05 } from '../lib/profileCache';
import { extractQuoteRefsFromTokens, parseMediaFromFeedItem } from '../lib/media';
import { followPubkey, loadContactGraphStats, loadFollowers, loadFollowing, loadProfileActivity, toNpub, type FeedItem, unfollowPubkey } from '../lib/social';
import { requestIdentityRefresh } from '../lib/identityRefresh';
import { resolveQuotedEvents } from '../lib/quotes';
import { Avatar } from '../components/Avatar';
import { InlineContent } from '../components/InlineContent';
import { aggregateZaps, buildZapButtonLabel, formatZapIndicator, getDefaultZapAmountOptions, getZapPreferences, loadZapReceipts, sendZap, subscribeToZaps, type ZapAggregate } from '../lib/zaps';
import { ExternalIdentityPanel } from '../components/profile/ExternalIdentityPanel';
import { useExternalIdentities } from '../hooks/useExternalIdentities';
import { usePinnedPost } from '../hooks/usePinnedPost';
import { usePublicLists } from '../hooks/usePublicLists';
import { useContentFilters } from '../hooks/useContentFilters';

type PanelMode = 'followers' | 'following' | null;
type PanelSort = 'name' | 'followers' | 'following';

const PANEL_PAGE_SIZE = 18;

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

export function ProfilePage() {
  const { npub } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [activity, setActivity] = useState<FeedItem[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [viewerFollowing, setViewerFollowing] = useState<string[]>([]);

  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [panelSearch, setPanelSearch] = useState('');
  const [panelSort, setPanelSort] = useState<PanelSort>('followers');
  const [panelVisibleCount, setPanelVisibleCount] = useState(PANEL_PAGE_SIZE);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelProfiles, setPanelProfiles] = useState<Map<string, any>>(new Map());
  const [panelStats, setPanelStats] = useState<Map<string, { followers: number; following: number }>>(new Map());
  const [busyFollowPubkey, setBusyFollowPubkey] = useState<string | null>(null);
  const [zapBusy, setZapBusy] = useState(false);

  const [quotedEvents, setQuotedEvents] = useState<Map<string, FeedItem>>(new Map());
  const [quotedProfiles, setQuotedProfiles] = useState<Map<string, any>>(new Map());
  const [zapByEventId, setZapByEventId] = useState<Map<string, ZapAggregate>>(new Map());
  const [profileZapTotal, setProfileZapTotal] = useState<ZapAggregate | null>(null);

  const targetPubkey = useMemo(() => {
    if (!npub || npub === 'me') return user?.pubkey || '';
    if (npub.startsWith('npub')) return decodeNpub(npub) || npub;
    return npub;
  }, [npub, user?.pubkey]);

  const { pinnedPost } = usePinnedPost(targetPubkey);
  const { lists: curatedLists } = usePublicLists(user?.pubkey, targetPubkey);
  const { filters: contentFilters } = useContentFilters(user?.pubkey);

  const {
    identities: externalIdentities,
    isVerifying: externalVerifying,
    verifyAll: verifyExternalIdentities,
    upsertIdentity,
    buildIdentityProofGuidance,
  } = useExternalIdentities(profile);

  const canEditExternalIdentities = Boolean(user?.pubkey && targetPubkey && user.pubkey === targetPubkey);

  useEffect(() => {
    const run = async () => {
      if (!targetPubkey || !user?.pubkey) return;
      const [p, a, flw, flr, viewerFollows] = await Promise.all([
        fetchProfile(targetPubkey),
        loadProfileActivity(targetPubkey, undefined, contentFilters),
        loadFollowing(targetPubkey),
        loadFollowers(targetPubkey),
        loadFollowing(user.pubkey),
      ]);
      setProfile(p);
      setActivity(a);
      setFollowing(flw);
      setFollowers(flr);
      setViewerFollowing(viewerFollows);
    };
    run();
  }, [targetPubkey, user?.pubkey, contentFilters]);

  useEffect(() => {
    const loadQuotes = async () => {
      const refs = [...new Set(activity.flatMap((item) => extractQuoteRefsFromTokens(parseMediaFromFeedItem(item).tokens)))];
      if (refs.length === 0) {
        setQuotedEvents(new Map());
        setQuotedProfiles(new Map());
        return;
      }

      const relayHintsById = collectQuoteRelayHints(activity);
      const resolved = await resolveQuotedEvents(refs, undefined, { relayHintsById });
      const feedMap = new Map<string, FeedItem>();
      resolved.forEach((evt, id) => {
        feedMap.set(id, evt as FeedItem);
      });
      setQuotedEvents(feedMap);

      const profiles = await fetchProfilesBatchCached([...new Set([...resolved.values()].map((e) => e.pubkey))]);
      setQuotedProfiles(profiles);
    };

    void loadQuotes();
  }, [activity]);

  useEffect(() => {
    const loadZaps = async () => {
      const eventIds = activity.map((a) => a.id);
      const receipts = await loadZapReceipts(eventIds, targetPubkey ? [targetPubkey] : []);
      const { byEventId, byProfile } = aggregateZaps(receipts);
      setZapByEventId(byEventId);
      setProfileZapTotal(byProfile.get(targetPubkey) || null);

      return subscribeToZaps({
        eventIds,
        profilePubkeys: targetPubkey ? [targetPubkey] : [],
        onReceipt: () => {
          void loadZaps();
        },
      });
    };
    if (!targetPubkey) return;

    let unsubscribe: (() => void) | undefined;
    void loadZaps().then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => unsubscribe?.();
  }, [activity, targetPubkey]);

  const activePanelList = panelMode === 'followers' ? followers : panelMode === 'following' ? following : [];

  useEffect(() => {
    const run = async () => {
      if (!panelMode) return;
      setPanelLoading(true);
      try {
        const listSlice = activePanelList.slice(0, panelVisibleCount);
        const [profiles, stats] = await Promise.all([
          fetchProfilesBatchCached(listSlice),
          loadContactGraphStats(listSlice),
        ]);
        setPanelProfiles((prev) => new Map([...prev, ...profiles]));
        setPanelStats((prev) => new Map([...prev, ...stats]));
      } finally {
        setPanelLoading(false);
      }
    };
    void run();
  }, [panelMode, panelVisibleCount, followers, following]);

  const panelCards = useMemo(() => {
    const cards = activePanelList.map((pubkey) => {
      const p = panelProfiles.get(pubkey);
      const stats = panelStats.get(pubkey) || { followers: 0, following: 0 };
      const name = (isValidNip05(p?.nip05) ? p?.nip05 : undefined) || p?.display_name || p?.name || truncateNpub(toNpub(pubkey), 10);
      return {
        pubkey,
        name,
        nip05: isValidNip05(p?.nip05) ? p?.nip05 : undefined,
        about: p?.about,
        followers: stats.followers,
        following: stats.following,
      };
    });

    const q = panelSearch.trim().toLowerCase();
    let out = q
      ? cards.filter((c) => c.name.toLowerCase().includes(q)
        || c.nip05?.toLowerCase().includes(q)
        || toNpub(c.pubkey).toLowerCase().includes(q))
      : cards;

    out = [...out].sort((a, b) => {
      if (panelSort === 'name') return a.name.localeCompare(b.name);
      if (panelSort === 'following') return b.following - a.following || b.followers - a.followers;
      return b.followers - a.followers || b.following - a.following;
    });

    return out.slice(0, panelVisibleCount);
  }, [activePanelList, panelProfiles, panelStats, panelSearch, panelSort, panelVisibleCount]);

  const togglePanel = (mode: Exclude<PanelMode, null>) => {
    setPanelMode((prev) => (prev === mode ? null : mode));
    setPanelVisibleCount(PANEL_PAGE_SIZE);
    setPanelSearch('');
  };

  const onToggleFollow = async (pubkey: string) => {
    if (!user?.pubkey || pubkey === user.pubkey) return;
    const isFollowingNow = viewerFollowing.includes(pubkey);
    setBusyFollowPubkey(pubkey);

    const nextViewerFollowing = isFollowingNow
      ? viewerFollowing.filter((pk) => pk !== pubkey)
      : [...viewerFollowing, pubkey];
    setViewerFollowing(nextViewerFollowing);

    if (targetPubkey === user.pubkey) {
      if (isFollowingNow) setFollowing((prev) => prev.filter((pk) => pk !== pubkey));
      else setFollowing((prev) => (prev.includes(pubkey) ? prev : [...prev, pubkey]));
    }

    const ok = isFollowingNow
      ? await unfollowPubkey(user.pubkey, pubkey, signEvent, publishEvent)
      : await followPubkey(user.pubkey, pubkey, signEvent, publishEvent);

    if (!ok) {
      setViewerFollowing(viewerFollowing);
      if (targetPubkey === user.pubkey) setFollowing(await loadFollowing(targetPubkey));
      setBusyFollowPubkey(null);
      return;
    }

    if (targetPubkey === pubkey) {
      setFollowers(await loadFollowers(targetPubkey));
    }

    requestIdentityRefresh(user.pubkey);
    setBusyFollowPubkey(null);
  };

  const onZapProfile = async () => {
    if (!user?.pubkey || !targetPubkey) return;
    const options = getDefaultZapAmountOptions();
    const prefs = getZapPreferences();
    const amountRaw = prompt(`Zap amount (sats) [${options.join(', ')}]:`, String(prefs.lastAmountSat || options[0]));
    if (!amountRaw) return;
    const amountSat = Number(amountRaw);
    if (!Number.isFinite(amountSat) || amountSat <= 0) {
      alert('Enter a valid sats amount');
      return;
    }

    setZapBusy(true);
    try {
      await sendZap({
        senderPubkey: user.pubkey,
        recipientPubkey: targetPubkey,
        recipientProfile: profile,
        amountSat,
        preferredWallet: prefs.lastWalletKind,
        signEventFn: signEvent,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to send zap');
    } finally {
      setZapBusy(false);
    }
  };

  if (!isAuthenticated || !user) {
    return <div className="max-w-4xl mx-auto px-4 py-10"><div className="cy-card p-6">Sign in first.</div></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="cy-card p-5">
        <p className="cy-kicker">PROFILE SURFACE</p>
        <div className="mt-2 flex items-center gap-4">
          <Avatar pubkey={targetPubkey} size={120} clickable={false} />
          <div>
            <h1 className="cy-title">{(isValidNip05(profile?.nip05) ? profile?.nip05 : undefined) || profile?.display_name || profile?.name || truncateNpub(toNpub(targetPubkey), 6)}</h1>
            <p className="cy-mono text-xs text-cyan-400 mt-2">{truncateNpub(toNpub(targetPubkey), 12)}</p>
          </div>
        </div>
        {profile?.about ? <p className="text-gray-300 mt-3">{profile.about}</p> : null}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="cy-chip">{formatZapIndicator(profileZapTotal)}</span>
          <button type="button" className="cy-chip" onClick={onZapProfile} disabled={targetPubkey === user.pubkey || zapBusy}>{targetPubkey === user.pubkey ? '⚡ Zap profile' : buildZapButtonLabel(zapBusy)}</button>
        </div>
      </div>

      <div className="cy-card p-5 space-y-4">
        <div>
          <h2 className="text-cyan-100 font-semibold">📌 Pinned Post</h2>
          {pinnedPost?.eventId ? (
            <p className="text-sm text-cyan-300/90 break-all mt-1">{pinnedPost.eventId}</p>
          ) : <p className="text-sm text-cyan-300/70 mt-1">No pinned post</p>}
        </div>
        <div>
          <h3 className="text-cyan-100 font-semibold">📚 Curated Lists</h3>
          {curatedLists.length === 0 ? <p className="text-sm text-cyan-300/70 mt-1">No public lists yet.</p> : (
            <ul className="mt-2 space-y-1 text-sm text-cyan-200">
              {curatedLists.slice(0, 5).map((list) => <li key={list.id}>• {list.title} ({list.eventIds.length} posts)</li>)}
            </ul>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <button type="button" onClick={() => togglePanel('followers')} className={`cy-panel p-4 text-left transition border ${panelMode === 'followers' ? 'border-cyan-300/70' : 'border-cyan-500/20'}`}>
          <p className="cy-kicker">FOLLOWERS</p>
          <p className="text-2xl text-green-300 font-bold">{followers.length}</p>
        </button>
        <button type="button" onClick={() => togglePanel('following')} className={`cy-panel p-4 text-left transition border ${panelMode === 'following' ? 'border-cyan-300/70' : 'border-cyan-500/20'}`}>
          <p className="cy-kicker">FOLLOWING</p>
          <p className="text-2xl text-cyan-300 font-bold">{following.length}</p>
        </button>
        <div className="cy-panel p-4"><p className="cy-kicker">POSTS</p><p className="text-2xl text-blue-300 font-bold">{activity.length}</p></div>
        <div className="cy-panel p-4"><p className="cy-kicker">⚡ ZAPS</p><p className="text-2xl text-yellow-300 font-bold">{profileZapTotal?.totalSat?.toLocaleString() || 0}</p></div>
      </div>

      <ExternalIdentityPanel
        identities={externalIdentities}
        isVerifying={externalVerifying}
        onVerifyAll={verifyExternalIdentities}
        canEdit={canEditExternalIdentities}
        onUpsert={upsertIdentity}
        proofGuidance={buildIdentityProofGuidance}
      />

      {panelMode && (
        <section className="cy-card p-5" data-testid="profile-contact-panel">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-cyan-100 font-semibold">{panelMode === 'followers' ? 'Followers' : 'Following'}</h2>
            <button type="button" className="cy-chip" onClick={() => setPanelMode(null)}>Close</button>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <input value={panelSearch} onChange={(e) => setPanelSearch(e.target.value)} placeholder="Search NIP-05, name, npub..." className="md:col-span-2 bg-slate-950/70 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white" />
            <select value={panelSort} onChange={(e) => setPanelSort(e.target.value as PanelSort)} className="bg-slate-950/70 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-cyan-100">
              <option value="followers">Sort: Followers</option>
              <option value="following">Sort: Following</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {panelCards.map((card) => {
              const isFollowingNow = viewerFollowing.includes(card.pubkey);
              return (
                <article key={card.pubkey} className="rounded-xl border border-cyan-400/25 bg-slate-950/85 shadow-[0_0_18px_rgba(34,211,238,0.12)] p-4">
                  <Link to={`/profile/${card.pubkey}`} className="block">
                    <div className="flex items-start gap-3">
                      <Avatar pubkey={card.pubkey} size={52} clickable={false} className="shrink-0" />
                      <div className="min-w-0">
                        <p className="text-cyan-100 font-semibold truncate">{card.name}</p>
                        {card.nip05 && card.nip05 !== card.name && <p className="text-sm text-slate-300 truncate">{card.nip05}</p>}
                        <p className="mt-2 text-sm text-slate-400 line-clamp-2">{card.about || 'No bio provided yet.'}</p>
                      </div>
                    </div>
                  </Link>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>{card.followers.toLocaleString()} followers</span>
                    <span>{card.following.toLocaleString()} following</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleFollow(card.pubkey)}
                    disabled={busyFollowPubkey === card.pubkey || card.pubkey === user.pubkey}
                    className={`mt-3 w-full rounded-md px-3 py-2 text-sm font-semibold transition ${isFollowingNow ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700' : 'bg-cyan-500/20 text-cyan-100 border border-cyan-300/60 hover:bg-cyan-500/35'} disabled:opacity-60`}
                  >
                    {card.pubkey === user.pubkey ? 'You' : (busyFollowPubkey === card.pubkey ? 'Updating…' : (isFollowingNow ? 'Unfollow' : 'Follow'))}
                  </button>
                </article>
              );
            })}
          </div>

          {panelLoading ? <p className="text-xs text-cyan-300 mt-3">Loading…</p> : null}
          {panelCards.length < activePanelList.length ? (
            <button type="button" onClick={() => setPanelVisibleCount((n) => n + PANEL_PAGE_SIZE)} className="cy-btn-secondary mt-4">Load more</button>
          ) : <p className="text-xs text-cyan-300 mt-3">End of list</p>}
        </section>
      )}

      <section className="cy-card p-5">
        <h2 className="text-cyan-300 font-semibold mb-3">Recent activity</h2>
        <div className="space-y-3">
          {activity.length === 0 ? <p className="cy-muted">No posts found.</p> : activity.map((evt) => {
            const media = parseMediaFromFeedItem(evt);
            return (
              <article key={evt.id} className="cy-panel p-3">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar pubkey={evt.pubkey} size={40} />
                  <p className="cy-mono text-xs text-gray-500">{new Date(evt.created_at * 1000).toLocaleString()}</p>
                </div>
                <InlineContent tokens={media.tokens} quotedEvents={quotedEvents} quotedProfiles={quotedProfiles} />
                <div className="mt-3 flex items-center gap-2">
                  <span className="cy-chip">{formatZapIndicator(zapByEventId.get(evt.id))}</span>
                  <button type="button" className="cy-chip" onClick={onZapProfile} disabled={targetPubkey === user.pubkey || zapBusy}>{buildZapButtonLabel(zapBusy)}</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="flex gap-3 flex-wrap">
        <Link to="/dashboard" className="cy-btn-secondary inline-block">Manage identity</Link>
        <Link to="/pricing" className="cy-btn-secondary inline-block">Get NIP-05 + Lightning Address</Link>
      </div>
    </div>
  );
}
