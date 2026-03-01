import { Injectable } from '@nestjs/common';
import { buildFollowGraph, calculateWoTDistance, calculateWoTMultiplier, getWoTLabel } from '@strangesignal/nostr-wot-voting';
import { SimplePool, nip19 } from 'nostr-tools';

interface CacheRow {
  expiresAt: number;
  value: any;
}

interface ContactEvent {
  pubkey: string;
  created_at?: number;
  tags: string[][];
}

@Injectable()
export class PrimitiveWotService {
  private readonly relays = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];
  private readonly cache = new Map<string, CacheRow>();

  private normalizePubkey(pubkey: string): string {
    if (pubkey.startsWith('npub1')) {
      const decoded = nip19.decode(pubkey);
      return decoded.data as string;
    }
    return pubkey;
  }

  private dedupeLatestContacts(events: ContactEvent[]): ContactEvent[] {
    const latestByAuthor = new Map<string, ContactEvent>();
    for (const evt of events) {
      const prev = latestByAuthor.get(evt.pubkey);
      if (!prev || (evt.created_at || 0) > (prev.created_at || 0)) {
        latestByAuthor.set(evt.pubkey, evt);
      }
    }
    return [...latestByAuthor.values()];
  }

  private followsFromEvent(event?: ContactEvent): string[] {
    if (!event) return [];
    return Array.from(new Set((event.tags || [])
      .filter((tag) => tag[0] === 'p' && tag[1])
      .map((tag) => tag[1])));
  }

  async getScore(pubkeyOrNpub: string, anchorPubkeyOrNpub?: string) {
    const pubkey = this.normalizePubkey(pubkeyOrNpub);
    const anchorPubkey = this.normalizePubkey(anchorPubkeyOrNpub || pubkey);
    const cacheKey = `${anchorPubkey}:${pubkey}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.value;

    const pool = new SimplePool();
    try {
      const baseContacts = await pool.querySync(this.relays, { kinds: [3], authors: [anchorPubkey, pubkey], limit: 10 } as any) as ContactEvent[];
      const dedupedBase = this.dedupeLatestContacts(baseContacts);
      const anchorContacts = dedupedBase.find((evt) => evt.pubkey === anchorPubkey);
      const firstHop = this.followsFromEvent(anchorContacts).slice(0, 120);

      const expandedContacts = firstHop.length > 0
        ? await pool.querySync(this.relays, { kinds: [3], authors: firstHop, limit: Math.max(300, firstHop.length * 3) } as any) as ContactEvent[]
        : [];

      const followerEvents = await pool.querySync(this.relays, { kinds: [3], '#p': [pubkey], limit: 500 } as any) as ContactEvent[];
      const contactEvents = this.dedupeLatestContacts([...dedupedBase, ...expandedContacts]);
      const followGraph = buildFollowGraph(contactEvents.map((evt) => ({ pubkey: evt.pubkey, tags: evt.tags })));
      const distance = calculateWoTDistance(anchorPubkey, pubkey, followGraph, 4);
      const multiplier = calculateWoTMultiplier(pubkey, anchorPubkey, followGraph, 0.1);
      const followers = new Set(followerEvents.map((evt) => evt.pubkey));

      const hasPath = distance >= 0;
      const rawScore = Math.max(0, Math.min(100, Math.round(multiplier * 100)));
      const trustScore = hasPath ? rawScore : null;
      const scoreState: 'calculated' | 'unknown' = hasPath ? 'calculated' : 'unknown';

      const value = {
        pubkey,
        anchorPubkey,
        trustScore,
        scoreState,
        wotMultiplier: Number(multiplier.toFixed(3)),
        distance,
        distanceLabel: hasPath ? getWoTLabel(distance) : 'unknown',
        followersCount: followers.size,
        rationale: {
          inAnchorFollowList: Boolean(followGraph[anchorPubkey]?.includes(pubkey)),
          depthSignals: hasPath ? [`Distance ${distance} (${getWoTLabel(distance)})`] : ['No path found in current graph sample'],
          graphSampleSize: Object.keys(followGraph).length,
          firstHopSampleSize: firstHop.length,
        },
        generatedAt: new Date().toISOString(),
      };

      this.cache.set(cacheKey, { value, expiresAt: now + 60_000 });
      return value;
    } finally {
      pool.close(this.relays);
    }
  }
}
