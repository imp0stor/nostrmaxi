import { Injectable, Logger } from '@nestjs/common';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { Community, Connector, TimeRange, WotAnalytics } from '../analytics.types';

const LOCAL_RELAY = process.env.LOCAL_RELAY_URL || 'ws://10.1.10.143:7777';

@Injectable()
export class WotAnalyticsService {
  private readonly logger = new Logger(WotAnalyticsService.name);
  private readonly pool = new SimplePool();

  async getWotAnalytics(pubkey: string, timeRange: TimeRange): Promise<WotAnalytics> {
    const direct = await this.getDirectFollows(pubkey);
    const second = await this.getSecondDegree(direct);
    const communities = await this.detectCommunities(pubkey);
    const keyConnectors = await this.getKeyConnectors(pubkey, 10);
    const influenceScore = await this.getInfluenceScore(pubkey);

    const notes = await this.querySafe({
      kinds: [1],
      authors: [pubkey, ...direct],
      since: timeRange.start,
      until: timeRange.end,
      limit: 10000,
    });

    const engagement = await this.querySafe({
      kinds: [7, 6, 9735],
      authors: [...direct, ...second],
      since: timeRange.start,
      until: timeRange.end,
      limit: 10000,
    });

    const mutualFollows = await this.countMutualFollows(pubkey, direct);

    return {
      pubkey,
      timeRange,
      networkSize: new Set([...direct, ...second]).size,
      directFollows: direct.length,
      secondDegree: second.length,
      avgPathLength: second.length > 0 ? 2 : direct.length > 0 ? 1 : 0,
      influenceScore,
      keyConnectors,
      communities,
      wotEngagementRate: notes.length > 0 ? Number((engagement.length / notes.length).toFixed(4)) : 0,
      mutualFollows,
      potentialReach: await this.estimatePotentialReach(second),
    };
  }

  async detectCommunities(pubkey: string): Promise<Community[]> {
    const direct = await this.getDirectFollows(pubkey);
    if (direct.length === 0) return [];

    const chunkSize = Math.max(1, Math.ceil(direct.length / 3));
    return this.chunk(direct, chunkSize).map((members, idx) => ({
      id: `community-${idx + 1}`,
      members: members.length,
      density: Number((Math.min(1, members.length / Math.max(1, direct.length))).toFixed(2)),
      topMembers: members.slice(0, 5),
    }));
  }

  async getInfluenceScore(pubkey: string): Promise<number> {
    const followers = await this.querySafe({ kinds: [3], '#p': [pubkey], limit: 5000 });
    const uniqueFollowers = new Set(followers.map((evt) => evt.pubkey)).size;
    const direct = await this.getDirectFollows(pubkey);
    return Number((uniqueFollowers * 0.7 + direct.length * 0.3).toFixed(2));
  }

  async getKeyConnectors(pubkey: string, limit: number): Promise<Connector[]> {
    const direct = await this.getDirectFollows(pubkey);
    const connectors = new Map<string, number>();

    for (const peer of direct) {
      const follows = await this.getDirectFollows(peer);
      for (const target of follows) {
        if (target !== pubkey) {
          connectors.set(target, (connectors.get(target) || 0) + 1);
        }
      }
    }

    return [...connectors.entries()]
      .map(([connectorPubkey, bridges]) => ({ pubkey: connectorPubkey, bridgeScore: bridges }))
      .sort((a, b) => b.bridgeScore - a.bridgeScore)
      .slice(0, limit);
  }

  private async getDirectFollows(pubkey: string): Promise<string[]> {
    const contacts = await this.querySafe({ kinds: [3], authors: [pubkey], limit: 50 });
    const out = new Set<string>();
    for (const list of contacts) {
      for (const tag of list.tags || []) {
        if (tag[0] === 'p' && tag[1]) out.add(tag[1]);
      }
    }
    return [...out];
  }

  private async getSecondDegree(direct: string[]): Promise<string[]> {
    const out = new Set<string>();
    for (const contact of direct.slice(0, 75)) {
      const follows = await this.getDirectFollows(contact);
      follows.forEach((follow) => out.add(follow));
    }
    direct.forEach((d) => out.delete(d));
    return [...out];
  }

  private async countMutualFollows(pubkey: string, direct: string[]): Promise<number> {
    let mutuals = 0;
    for (const follow of direct) {
      const contacts = await this.getDirectFollows(follow);
      if (contacts.includes(pubkey)) mutuals += 1;
    }
    return mutuals;
  }

  private async estimatePotentialReach(pubkeys: string[]): Promise<number> {
    let reach = 0;
    for (const key of pubkeys.slice(0, 100)) {
      const followers = await this.querySafe({ kinds: [3], '#p': [key], limit: 500 });
      reach += new Set(followers.map((evt) => evt.pubkey)).size;
    }
    return reach;
  }

  private async querySafe(filter: Record<string, unknown>): Promise<NostrEvent[]> {
    try {
      return (await this.pool.querySync([LOCAL_RELAY], filter as any)) as NostrEvent[];
    } catch (error) {
      this.logger.warn(`WoT analytics relay query failed: ${error.message}`);
      return [];
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }
}
