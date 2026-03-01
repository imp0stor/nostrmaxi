import { Injectable } from '@nestjs/common';
import { buildFollowGraph, calculateWoTDistance, calculateWoTMultiplier, getWoTLabel } from '@strangesignal/nostr-wot-voting';
import { SimplePool, nip19 } from 'nostr-tools';

interface CacheRow {
  expiresAt: number;
  value: any;
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

  async getScore(pubkeyOrNpub: string, anchorPubkeyOrNpub?: string) {
    const pubkey = this.normalizePubkey(pubkeyOrNpub);
    const anchorPubkey = this.normalizePubkey(anchorPubkeyOrNpub || pubkey);
    const cacheKey = `${anchorPubkey}:${pubkey}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.value;

    const pool = new SimplePool();
    try {
      const contactEvents = await pool.querySync(this.relays, { kinds: [3], authors: [anchorPubkey, pubkey], limit: 2 } as any);
      const followerEvents = await pool.querySync(this.relays, { kinds: [3], '#p': [pubkey], limit: 500 } as any);
      const followGraph = buildFollowGraph(contactEvents.map((evt) => ({ pubkey: evt.pubkey, tags: evt.tags })));
      const distance = calculateWoTDistance(anchorPubkey, pubkey, followGraph, 4);
      const multiplier = calculateWoTMultiplier(pubkey, anchorPubkey, followGraph, 0.1);
      const followers = new Set(followerEvents.map((evt) => evt.pubkey));

      const score = Math.max(0, Math.min(100, Math.round(multiplier * 100)));
      const value = {
        pubkey,
        anchorPubkey,
        trustScore: score,
        wotMultiplier: Number(multiplier.toFixed(3)),
        distance,
        distanceLabel: getWoTLabel(distance),
        followersCount: followers.size,
        rationale: {
          inAnchorFollowList: Boolean(followGraph[anchorPubkey]?.includes(pubkey)),
          depthSignals: distance >= 0 ? [`Distance ${distance} (${getWoTLabel(distance)})`] : ['No path found in current graph sample'],
          graphSampleSize: Object.keys(followGraph).length,
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
