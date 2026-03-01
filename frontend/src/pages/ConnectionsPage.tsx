import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SimplePool } from 'nostr-tools';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { encodeNpub, truncateNpub } from '../lib/nostr';
import { fetchProfilesBatchCached } from '../lib/profileCache';
import { getDefaultRelays, getRelaysForUser } from '../lib/relayConfig';
import { loadFollowers, loadFollowing } from '../lib/social';
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
  mutedBlocked: string[];
  profiles: Map<string, NostrProfile | null>;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
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

function ConnectionColumn({
  title,
  cards,
  loading,
  emptyLabel,
}: {
  title: string;
  cards: ConnectionCard[];
  loading: boolean;
  emptyLabel: string;
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
              <li key={card.pubkey}>
                <Link
                  to={`/profile/${card.pubkey}`}
                  className="block rounded-lg border border-swordfish-muted/35 bg-black/20 hover:border-orange-400/55 hover:bg-orange-500/10 px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/80"
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
    mutedBlocked: [],
    profiles: new Map(),
  });

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
        const [following, followers] = await Promise.all([
          loadFollowing(user.pubkey, relays),
          loadFollowers(user.pubkey, relays),
        ]);

        const pool = new SimplePool();
        let listEvents: Array<{ kind: number; tags: string[][] }> = [];
        try {
          listEvents = await pool.querySync(relays, { kinds: [10000, 10001], authors: [user.pubkey], limit: 60 });
        } finally {
          pool.close(relays);
        }

        const { muted, blocked } = parsePubkeysFromListEvents(listEvents);
        const followingSet = new Set(following);
        const followersSet = new Set(followers);
        const mutuals = following.filter((pubkey) => followersSet.has(pubkey));
        const mutedBlocked = unique([...muted, ...blocked]);

        const allPubkeys = unique([...following, ...followers, ...mutuals, ...mutedBlocked]);
        const profiles = allPubkeys.length > 0
          ? await fetchProfilesBatchCached(allPubkeys, relays)
          : new Map<string, NostrProfile | null>();

        if (cancelled) return;

        setState({
          following: unique([...followingSet]),
          followers: unique([...followersSet]),
          mutuals,
          mutedBlocked,
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
  const mutedBlockedCards = useMemo(() => state.mutedBlocked.map((pk) => buildCard(pk, state.profiles)), [state.mutedBlocked, state.profiles]);

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
        <p className="cy-muted mt-2">Follow graph snapshot from kind:3 contact lists and kind:10000/10001 list events.</p>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ConnectionColumn title="Following" cards={followingCards} loading={loading} emptyLabel="You are not following anyone yet." />
        <ConnectionColumn title="Mutuals" cards={mutualCards} loading={loading} emptyLabel="No mutual follows yet." />
        <ConnectionColumn title="Followers" cards={followerCards} loading={loading} emptyLabel="No followers found yet." />
        <ConnectionColumn title="Muted / Blocked" cards={mutedBlockedCards} loading={loading} emptyLabel="No muted or blocked users in your lists." />
      </div>
    </div>
  );
}
