import { useCallback, useEffect, useMemo, useState } from 'react';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { publishEvent, signEvent } from '../lib/nostr';
import { SOCIAL_RELAYS } from '../lib/social';

const PUBLIC_LIST_KIND = 30001;

export interface PublicCuratedList {
  id: string;
  title: string;
  description?: string;
  eventIds: string[];
  relayHints: Record<string, string | undefined>;
  updatedAt: number;
  ownerPubkey: string;
}

function parseList(event: NostrEvent): PublicCuratedList | null {
  const id = event.tags.find((t) => t[0] === 'd')?.[1];
  if (!id) return null;
  const title = event.tags.find((t) => t[0] === 'title')?.[1] || id;
  const description = event.tags.find((t) => t[0] === 'description')?.[1];
  const eTags = event.tags.filter((t) => t[0] === 'e' && t[1]);
  const relayHints: Record<string, string | undefined> = {};
  eTags.forEach((tag) => { relayHints[tag[1]] = tag[2]; });

  return {
    id,
    title,
    description,
    eventIds: eTags.map((t) => t[1]),
    relayHints,
    updatedAt: event.created_at,
    ownerPubkey: event.pubkey,
  };
}

export function usePublicLists(pubkey?: string | null, ownerPubkey?: string | null) {
  const [lists, setLists] = useState<PublicCuratedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const targetOwner = ownerPubkey || pubkey;

  const loadLists = useCallback(async () => {
    if (!targetOwner) {
      setLists([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const pool = new SimplePool();
    try {
      const events = await pool.querySync(SOCIAL_RELAYS, { kinds: [PUBLIC_LIST_KIND], authors: [targetOwner], limit: 100 });
      const parsed = events
        .map((evt) => parseList(evt as NostrEvent))
        .filter((item): item is PublicCuratedList => Boolean(item))
        .sort((a, b) => b.updatedAt - a.updatedAt);

      const byId = new Map<string, PublicCuratedList>();
      parsed.forEach((list) => {
        if (!byId.has(list.id)) byId.set(list.id, list);
      });
      setLists(Array.from(byId.values()));
    } finally {
      pool.close(SOCIAL_RELAYS);
      setIsLoading(false);
    }
  }, [targetOwner]);

  const saveList = useCallback(async (list: { id: string; title: string; description?: string; eventIds: Array<{ id: string; relay?: string }>; }) => {
    if (!pubkey) throw new Error('Missing pubkey');

    const tags: string[][] = [
      ['d', list.id],
      ['title', list.title],
      ...(list.description ? [['description', list.description]] : []),
      ...list.eventIds.map((item) => ['e', item.id, item.relay || '']),
    ];

    const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: PUBLIC_LIST_KIND,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: '',
    };

    const signed = await signEvent(unsigned);
    if (!signed) throw new Error('Failed to sign public list');
    const result = await publishEvent(signed);
    if (!result?.success) throw new Error('Failed to publish public list');

    await loadLists();
  }, [loadLists, pubkey]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  return useMemo(() => ({ lists, isLoading, loadLists, saveList }), [lists, isLoading, loadLists, saveList]);
}
