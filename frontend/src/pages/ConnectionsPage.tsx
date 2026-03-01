import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SimplePool } from 'nostr-tools';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { encodeNpub, publishEvent, signEvent, truncateNpub } from '../lib/nostr';
import { fetchProfilesBatchCached } from '../lib/profileCache';
import { getDefaultRelays, getRelaysForUser } from '../lib/relayConfig';
import { followPubkey, loadFollowersWithDiagnostics, loadFollowing, unfollowPubkey } from '../lib/social';
import type { NostrProfile } from '../types';
import connectionsIcon from '../assets/icons/connections.png';

type ConnectionCard = {
  pubkey: string;
  name: string;
  npub: string;
};

type ConnectionsState = {
  following: string[];
  followers: string[];
  mutuals: string[];
  muted: string[];
  blocked: string[];
  profiles: Map<string, NostrProfile | null>;
};

type BusyAction = 'follow' | 'unfollow' | 'mute' | 'unmute' | 'block' | 'unblock';

function normalizePubkey(value: string): string {
  return value.trim().toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean).map(normalizePubkey))];
}

function parsePubkeysFromListEvents(events: Array<{ kind: number; tags: string[][] }>): { muted: string[]; blocked: string[] } {
  const muted = new Set<string>();
  const blocked = new Set<string>();

  for (const event of events) {
    const pTags = event.tags.filter((tag) => tag[0] === 'p' && tag[1]).map((tag) => tag[1]);

    if (event.kind === 10000) {
      pTags.forEach((pubkey) => muted.add(pubkey));
    } else if (event.kind === 10001) {
      pTags.forEach((pubkey) => blocked.add(pubkey));
    }
  }

  return {
    muted: [...muted],
    blocked: [...blocked],
  };
}

function buildCard(pubkey: string, profiles: Map<string, NostrProfile | null>): ConnectionCard {
  const profile = profiles.get(pubkey);
  const encoded = encodeNpub(pubkey);
  return {
    pubkey,
    name: profile?.display_name || profile?.name || profile?.nip05 || truncateNpub(encoded, 7),
    npub: truncateNpub(encoded, 7),
  };
}

async function publishPubkeyListUpdate(kind: 10000 | 10001, ownerPubkey: string, nextPubkeys: string[]) {
  const unsigned = {
    kind,
    content: '',
    tags: unique(nextPubkeys).map((pk) => ['p', pk]),
    pubkey: ownerPubkey,
    created_at: Math.floor(Date.now() / 1000),
  };

  const signed = await signEvent(unsigned);
  if (!signed) return false;
  const result = await publishEvent(signed);
  return Boolean(result?.success);
}

function ConnectionColumn({
  title,
  cards,
  loading,
  emptyLabel,
  renderActions,
}: {
  title: string;
  cards: ConnectionCard[];
  loading: boolean;
  emptyLabel: string;
  renderActions?: (card: ConnectionCard) => ReactNode;
}) {
  return (
    <section className="cy-card nm-surface p-4 md:p-5 flex flex-col min-h-[320px]" aria-label={`${title} connections`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-orange-100 text-sm md:text-base font-semibold tracking-[0.08em] uppercase">{title}</h2>
        <span className="nm-pill text-xs" aria-label={`${cards.length} ${title.toLowerCase()} users`}>{cards.length}</span>
      </div>

      {loading ? (
        <div className="cy-muted cy-loading text-sm py-3 flex items-center gap-2"><img src={connectionsIcon} alt="" aria-hidden className="nm-icon animate-pulse" />Loading from relays…</div>
      ) : null}

      {!loading ? (
        cards.length > 0 ? (
          <ul className="space-y-2 overflow-y-auto pr-1 max-h-[58vh]" aria-live="polite">
            {cards.map((card) => (
              <li key={card.pubkey} className="rounded-lg border border-swordfish-muted/35 bg-black/20 hover:border-orange-400/55 hover:bg-orange-500/10 px-3 py-2 transition group">
                <div className="flex items-center gap-2 justify-between">
                  <Link
                    to={`/profile/${card.pubkey}`}
                    className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/80"
                    aria-label={`Open profile for ${card.name}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar pubkey={card.pubkey} size={36} clickable={false} className="shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-orange-100 font-medium truncate">{card.name}</p>
                        <p className="text-xs text-swordfish-muted truncate font-mono">{card.npub}</p>
                      </div>
                    </div>
                  </Link>
                  {renderActions ? <div className="flex items-center gap-1 flex-wrap justify-end">{renderActions(card)}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cy-muted text-sm py-6">{emptyLabel}</div>
        )
      ) : null}
    </section>
  );
}

export function ConnectionsPage() {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [state, setState] = useState<ConnectionsState>({
    following: [],
    followers: [],
    mutuals: [],
    muted: [],
    blocked: [],
    profiles: new Map(),
  });
  const [busyByPubkey, setBusyByPubkey] = useState<Record<string, BusyAction | undefined>>({});

  useEffect(() => {
    let cancelled = false;

    const loadConnections = async () => {
      if (!user?.pubkey) {
        if (!cancelled) setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const relays = await getRelaysForUser(user.pubkey).catch(() => getDefaultRelays());
        const [following, followersResult] = await Promise.all([
          loadFollowing(user.pubkey, relays),
          loadFollowersWithDiagnostics(user.pubkey, relays),
        ]);
        const followers = followersResult.followers;

        if (followersResult.diagnostics.usedCached) {
          setError('Live follower query timed out on relays. Showing recently cached followers.');
        } else if (followersResult.diagnostics.hadPartialSuccess) {
          setError('Some relays failed during follower lookup. Showing partial results from reachable relays.');
        }

        const pool = new SimplePool();
        let listEvents: Array<{ kind: number; tags: string[][] }> = [];
        try {
          listEvents = await pool.querySync(relays, { kinds: [10000, 10001], authors: [user.pubkey], limit: 60 });
        } finally {
          pool.close(relays);
        }

        const { muted, blocked } = parsePubkeysFromListEvents(listEvents);
        const normalizedFollowing = unique(following);
        const normalizedFollowers = unique(followers);
        const followingSet = new Set(normalizedFollowing);
        const followersSet = new Set(normalizedFollowers);
        const mutuals = normalizedFollowing.filter((pubkey) => followersSet.has(pubkey));

        const allPubkeys = unique([...normalizedFollowing, ...normalizedFollowers, ...mutuals, ...muted, ...blocked]);
        const profiles = allPubkeys.length > 0
          ? await fetchProfilesBatchCached(allPubkeys, relays)
          : new Map<string, NostrProfile | null>();

        if (cancelled) return;

        setState({
          following: unique([...followingSet]),
          followers: unique([...followersSet]),
          mutuals,
          muted,
          blocked,
          profiles,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load connections from relays.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadConnections();

    return () => {
      cancelled = true;
    };
  }, [user?.pubkey]);

  const followingCards = useMemo(() => state.following.map((pk) => buildCard(pk, state.profiles)), [state.following, state.profiles]);
  const mutualCards = useMemo(() => state.mutuals.map((pk) => buildCard(pk, state.profiles)), [state.mutuals, state.profiles]);
  const followerCards = useMemo(() => state.followers.map((pk) => buildCard(pk, state.profiles)), [state.followers, state.profiles]);
  const followingSet = useMemo(() => new Set(state.following.map(normalizePubkey)), [state.following]);
  const mutedBlockedPubkeys = useMemo(() => unique([...state.muted, ...state.blocked]), [state.muted, state.blocked]);
  const mutedBlockedCards = useMemo(() => mutedBlockedPubkeys.map((pk) => buildCard(pk, state.profiles)), [mutedBlockedPubkeys, state.profiles]);

  const setBusy = (pubkey: string, action?: BusyAction) => {
    setBusyByPubkey((prev) => ({ ...prev, [pubkey]: action }));
  };

  const updateFollowOptimistic = (targetPubkey: string, shouldFollow: boolean) => {
    const normalizedTarget = normalizePubkey(targetPubkey);
    setState((prev) => {
      const nextFollowing = shouldFollow
        ? unique([...prev.following, normalizedTarget])
        : prev.following.filter((pk) => pk !== normalizedTarget);
      const nextFollowers = prev.followers;
      const followersSet = new Set(nextFollowers);
      return {
        ...prev,
        following: nextFollowing,
        mutuals: nextFollowing.filter((pk) => followersSet.has(pk)),
      };
    });
  };

  const updateListOptimistic = (kind: 10000 | 10001, targetPubkey: string, include: boolean) => {
    const normalizedTarget = normalizePubkey(targetPubkey);
    setState((prev) => {
      if (kind === 10000) {
        const next = include
          ? unique([...prev.muted, normalizedTarget])
          : prev.muted.filter((pk) => pk !== normalizedTarget);
        return { ...prev, muted: next };
      }
      const next = include
        ? unique([...prev.blocked, normalizedTarget])
        : prev.blocked.filter((pk) => pk !== normalizedTarget);
      return { ...prev, blocked: next };
    });
  };

  const onToggleFollow = async (targetPubkey: string, shouldFollow: boolean) => {
    if (!user?.pubkey) return;
    if (!shouldFollow && !window.confirm('Unfollow this user?')) return;

    const normalizedTarget = normalizePubkey(targetPubkey);
    const previous = state;
    setBusy(normalizedTarget, shouldFollow ? 'follow' : 'unfollow');
    updateFollowOptimistic(normalizedTarget, shouldFollow);

    const ok = shouldFollow
      ? await followPubkey(user.pubkey, normalizedTarget, signEvent, publishEvent)
      : await unfollowPubkey(user.pubkey, normalizedTarget, signEvent, publishEvent);

    if (!ok) {
      setState(previous);
      setError(`Failed to ${shouldFollow ? 'follow' : 'unfollow'} user. Please try again.`);
    }

    setBusy(normalizedTarget, undefined);
  };

  const onToggleList = async (kind: 10000 | 10001, targetPubkey: string, include: boolean) => {
    if (!user?.pubkey) return;

    const label = kind === 10000 ? 'mute' : 'block';
    if (include && !window.confirm(`Are you sure you want to ${label} this user?`)) return;

    const normalizedTarget = normalizePubkey(targetPubkey);
    const previous = state;
    setBusy(normalizedTarget, include ? label as BusyAction : (`un${label}` as BusyAction));
    updateListOptimistic(kind, normalizedTarget, include);

    const currentList = kind === 10000 ? previous.muted : previous.blocked;
    const nextList = include
      ? unique([...currentList, normalizedTarget])
      : currentList.filter((pk) => pk !== normalizedTarget);

    const ok = await publishPubkeyListUpdate(kind, user.pubkey, nextList);

    if (!ok) {
      setState(previous);
      setError(`Failed to ${include ? label : `un${label}`} user. Please try again.`);
    }

    setBusy(normalizedTarget, undefined);
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <section className="cy-card nm-surface p-6">
          <h1 className="text-2xl font-semibold text-orange-100 flex items-center gap-2"><img src={connectionsIcon} alt="" aria-hidden className="nm-icon" />Connections</h1>
          <p className="cy-muted mt-2">Sign in to view your social graph.</p>
          <Link to="/" className="cy-btn mt-4 inline-block">Return home</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1640px] p-4 md:p-6 space-y-4">
      <section className="cy-card nm-surface p-5">
        <h1 className="text-2xl md:text-3xl text-orange-100 font-semibold tracking-[0.06em] uppercase flex items-center gap-2"><img src={connectionsIcon} alt="" aria-hidden className="nm-icon" />Connections</h1>
        <p className="cy-muted mt-2">Follow graph snapshot from kind:3 contact lists and kind:10000 mute list.</p>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ConnectionColumn
          title="Following"
          cards={followingCards}
          loading={loading}
          emptyLabel="You are not following anyone yet."
          renderActions={(card) => (
            <button
              type="button"
              className="cy-chip"
              onClick={() => void onToggleFollow(card.pubkey, false)}
              disabled={Boolean(busyByPubkey[card.pubkey])}
            >
              {busyByPubkey[card.pubkey] === 'unfollow' ? 'Updating…' : '➖ Unfollow'}
            </button>
          )}
        />
        <ConnectionColumn
          title="Mutuals"
          cards={mutualCards}
          loading={loading}
          emptyLabel="No mutual follows yet."
          renderActions={(card) => (
            <>
              <button
                type="button"
                className="cy-chip"
                onClick={() => void onToggleFollow(card.pubkey, false)}
                disabled={Boolean(busyByPubkey[card.pubkey])}
              >
                {busyByPubkey[card.pubkey] === 'unfollow' ? 'Updating…' : '➖ Unfollow'}
              </button>
              <button
                type="button"
                className="nm-pill text-xs"
                onClick={() => void onToggleList(10000, card.pubkey, true)}
                disabled={Boolean(busyByPubkey[card.pubkey]) || state.muted.includes(card.pubkey)}
              >
                {busyByPubkey[card.pubkey] === 'mute' ? 'Updating…' : (state.muted.includes(card.pubkey) ? 'Muted' : '🔇 Mute')}
              </button>
            </>
          )}
        />
        <ConnectionColumn
          title="Followers"
          cards={followerCards}
          loading={loading}
          emptyLabel="No followers found yet."
          renderActions={(card) => {
            const alreadyFollowing = followingSet.has(normalizePubkey(card.pubkey));
            return (
              <>
                {!alreadyFollowing ? (
                  <button
                    type="button"
                    className="cy-chip"
                    onClick={() => void onToggleFollow(card.pubkey, true)}
                    disabled={Boolean(busyByPubkey[card.pubkey])}
                  >
                    {busyByPubkey[card.pubkey] === 'follow' ? 'Updating…' : '➕ Follow back'}
                  </button>
                ) : null}
                {!state.muted.includes(card.pubkey) && (
                  <button
                    type="button"
                    className="nm-pill text-xs"
                    onClick={() => void onToggleList(10000, card.pubkey, true)}
                    disabled={Boolean(busyByPubkey[card.pubkey])}
                  >
                    {busyByPubkey[card.pubkey] === 'mute' ? 'Updating…' : '🔇 Mute'}
                  </button>
                )}
              </>
            );
          }}
        />
        <ConnectionColumn
          title="Muted"
          cards={mutedBlockedCards}
          loading={loading}
          emptyLabel="No muted users in your list."
          renderActions={(card) => (
            <button
              type="button"
              className="nm-pill text-xs"
              onClick={() => void onToggleList(10000, card.pubkey, false)}
              disabled={Boolean(busyByPubkey[card.pubkey])}
            >
              {busyByPubkey[card.pubkey] === 'unmute' ? 'Updating…' : '🔈 Unmute'}
            </button>
          )}
        />
      </div>
    </div>
  );
}
