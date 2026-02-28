import { useCallback, useEffect, useMemo, useState } from 'react';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { publishEvent, signEvent } from '../lib/nostr';
import { SOCIAL_RELAYS } from '../lib/social';

const PIN_KIND = 10001;
const PIN_DTAG = 'profile-pin';

export interface PinnedPost {
  eventId: string;
  relay?: string;
  pinnedAt: number;
}

export function canPinPost(event: { pubkey: string }, userPubkey: string): boolean {
  return event.pubkey === userPubkey;
}

export function usePinnedPost(pubkey?: string | null) {
  const [pinnedPost, setPinnedPost] = useState<PinnedPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPinnedPost = useCallback(async () => {
    if (!pubkey) {
      setPinnedPost(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const pool = new SimplePool();
    try {
      const events = await pool.querySync(SOCIAL_RELAYS, { kinds: [PIN_KIND], authors: [pubkey], limit: 30 });
      const latest = events
        .filter((evt) => evt.tags.some((t) => t[0] === 'd' && t[1] === PIN_DTAG))
        .sort((a, b) => b.created_at - a.created_at)[0] as NostrEvent | undefined;

      if (!latest) {
        setPinnedPost(null);
        return;
      }

      const eventTag = latest.tags.find((t) => t[0] === 'e' && t[1]);
      if (!eventTag) {
        setPinnedPost(null);
        return;
      }

      setPinnedPost({
        eventId: eventTag[1],
        relay: eventTag[2],
        pinnedAt: latest.created_at,
      });
    } finally {
      pool.close(SOCIAL_RELAYS);
      setIsLoading(false);
    }
  }, [pubkey]);

  const pinPost = useCallback(async (event: { id: string; pubkey: string; relay?: string }) => {
    if (!pubkey) throw new Error('Missing pubkey');
    if (!canPinPost(event, pubkey)) throw new Error('Pinned post must be your own post.');

    const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: PIN_KIND,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', PIN_DTAG],
        ['e', event.id, event.relay || ''],
      ],
      content: '',
    };

    const signed = await signEvent(unsigned);
    if (!signed) throw new Error('Failed to sign pinned post event');
    const result = await publishEvent(signed);
    if (!result?.success) throw new Error('Failed to publish pinned post event');

    setPinnedPost({ eventId: event.id, relay: event.relay, pinnedAt: unsigned.created_at });
  }, [pubkey]);

  const removePin = useCallback(async () => {
    if (!pubkey) throw new Error('Missing pubkey');
    const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: PIN_KIND,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', PIN_DTAG]],
      content: '',
    };

    const signed = await signEvent(unsigned);
    if (!signed) throw new Error('Failed to sign pin removal event');
    const result = await publishEvent(signed);
    if (!result?.success) throw new Error('Failed to remove pinned post');

    setPinnedPost(null);
  }, [pubkey]);

  useEffect(() => {
    void loadPinnedPost();
  }, [loadPinnedPost]);

  return useMemo(() => ({ pinnedPost, isLoading, loadPinnedPost, pinPost, removePin }), [pinnedPost, isLoading, loadPinnedPost, pinPost, removePin]);
}
