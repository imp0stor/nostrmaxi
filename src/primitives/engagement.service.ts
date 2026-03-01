import { Injectable } from '@nestjs/common';
import {
  aggregateZapContributors,
  buildContributorDrilldowns,
  summarizeInteractions,
  type InteractionRecord,
  type ZapContribution,
} from '@strangesignal/nostr-engagement';
import { SimplePool, nip19, type Event } from 'nostr-tools';

interface ParsedZapReceipt {
  amountMsat: number;
  senderPubkey: string;
  recipientPubkey: string;
  targetEventId?: string;
}

@Injectable()
export class PrimitiveEngagementService {
  private readonly relays = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

  private normalizePubkey(pubkey: string): string {
    if (pubkey.startsWith('npub1')) {
      const decoded = nip19.decode(pubkey);
      return decoded.data as string;
    }
    return pubkey;
  }

  private parseZapReceipt(evt: Event): ParsedZapReceipt | null {
    if (evt.kind !== 9735) return null;
    const descriptionTag = (evt.tags || []).find((tag) => tag[0] === 'description' && tag[1]);
    if (!descriptionTag?.[1]) return null;

    try {
      const request = JSON.parse(descriptionTag[1]) as Event;
      const amountTag = (request.tags || []).find((tag) => tag[0] === 'amount' && tag[1]);
      const recipientTag = (request.tags || []).find((tag) => tag[0] === 'p' && tag[1]);
      if (!amountTag?.[1] || !recipientTag?.[1]) return null;

      const targetTag = (request.tags || []).find((tag) => tag[0] === 'e' && tag[1]);
      const amountMsat = Number(amountTag[1]);
      if (!Number.isFinite(amountMsat) || amountMsat <= 0) return null;

      return {
        amountMsat,
        senderPubkey: request.pubkey,
        recipientPubkey: recipientTag[1],
        targetEventId: targetTag?.[1],
      };
    } catch {
      return null;
    }
  }

  async getProfileAnalytics(pubkeyOrNpub: string, limit = 80) {
    const pubkey = this.normalizePubkey(pubkeyOrNpub);
    const pool = new SimplePool();

    try {
      const profileEvents = await pool.querySync(this.relays, {
        kinds: [1],
        authors: [pubkey],
        limit: Math.max(20, Math.min(limit, 200)),
      } as any) as Event[];

      const eventIds = profileEvents.map((evt) => evt.id).slice(0, 150);
      const [reactionEvents, repostEvents, zapEvents] = await Promise.all([
        eventIds.length
          ? pool.querySync(this.relays, { kinds: [7], '#e': eventIds, limit: 2500 } as any) as Promise<Event[]>
          : Promise.resolve([]),
        eventIds.length
          ? pool.querySync(this.relays, { kinds: [6], '#e': eventIds, limit: 2500 } as any) as Promise<Event[]>
          : Promise.resolve([]),
        eventIds.length
          ? pool.querySync(this.relays, { kinds: [9735], '#e': eventIds, limit: 3000 } as any) as Promise<Event[]>
          : Promise.resolve([]),
      ]);

      const interactions: InteractionRecord[] = [
        ...reactionEvents.map((evt) => ({
          id: evt.id,
          actorPubkey: evt.pubkey,
          targetPubkey: pubkey,
          targetEventId: (evt.tags || []).find((tag) => tag[0] === 'e' && tag[1])?.[1],
          type: 'reaction' as const,
          createdAt: evt.created_at,
          relayHint: (evt.tags || []).find((tag) => tag[0] === 'e' && tag[2])?.[2],
        })),
        ...repostEvents.map((evt) => ({
          id: evt.id,
          actorPubkey: evt.pubkey,
          targetPubkey: pubkey,
          targetEventId: (evt.tags || []).find((tag) => tag[0] === 'e' && tag[1])?.[1],
          type: 'repost' as const,
          createdAt: evt.created_at,
          relayHint: (evt.tags || []).find((tag) => tag[0] === 'e' && tag[2])?.[2],
        })),
      ];

      const zapContributions: ZapContribution[] = [];
      for (const evt of zapEvents) {
        const parsed = this.parseZapReceipt(evt);
        if (!parsed) continue;
        zapContributions.push({
          id: evt.id,
          payerPubkey: parsed.senderPubkey,
          payeePubkey: parsed.recipientPubkey,
          amountMsats: parsed.amountMsat,
          createdAt: evt.created_at,
          targetEventId: parsed.targetEventId,
          relayHint: (evt.tags || []).find((tag) => tag[0] === 'e' && tag[2])?.[2],
        });
      }

      return {
        pubkey,
        postsAnalyzed: eventIds.length,
        interactionSummary: summarizeInteractions(interactions),
        topZappers: aggregateZapContributors(zapContributions, 'payer').slice(0, 8),
        contributorDrilldowns: buildContributorDrilldowns(interactions, zapContributions).slice(0, 16),
        totals: {
          reactions: interactions.filter((i) => i.type === 'reaction').length,
          reposts: interactions.filter((i) => i.type === 'repost').length,
          zaps: zapContributions.length,
          zapMsats: zapContributions.reduce((sum, z) => sum + z.amountMsats, 0),
        },
      };
    } finally {
      pool.close(this.relays);
    }
  }
}
