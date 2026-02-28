import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { RelayDiscoveryService } from './relay-discovery.service';
import { WotService } from '../wot/wot.service';

export interface WotRelayScore {
  url: string;
  score: number;
  usedByFollows: number;
  usedBy2ndDegree: number;
  writeRelay: boolean;
  readRelay: boolean;
}

interface RelayAggregate {
  url: string;
  score: number;
  usedByFollows: Set<string>;
  usedBy2ndDegree: Set<string>;
  writeVotes: number;
  readVotes: number;
}

@Injectable()
export class WotRelayService {
  private readonly relays: string[];

  constructor(
    private readonly relayDiscovery: RelayDiscoveryService,
    private readonly wotService: WotService,
    private readonly configService: ConfigService,
  ) {
    this.relays = (this.configService.get('WOT_RELAYS') || 'wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  async getRelaysForWot(pubkey: string): Promise<WotRelayScore[]> {
    await this.wotService.getScore(pubkey);

    const pool = new SimplePool();
    try {
      const follows = await this.getDirectFollows(pool, pubkey);
      const secondDegree = await this.getSecondDegree(pool, follows, pubkey);

      const directRelays = await this.getLatestRelayLists(pool, follows);
      const secondRelays = await this.getLatestRelayLists(pool, [...secondDegree]);

      const aggregate = new Map<string, RelayAggregate>();
      this.tallyRelayUsage(aggregate, directRelays, 3);
      this.tallyRelayUsage(aggregate, secondRelays, 1);

      const scores = [...aggregate.values()]
        .map((entry) => ({
          url: entry.url,
          score: entry.score,
          usedByFollows: entry.usedByFollows.size,
          usedBy2ndDegree: entry.usedBy2ndDegree.size,
          writeRelay: entry.writeVotes >= entry.readVotes,
          readRelay: entry.readVotes > 0,
        }))
        .sort((a, b) => b.score - a.score || b.usedByFollows - a.usedByFollows);

      return scores;
    } finally {
      pool.close(this.relays);
    }
  }

  async getBestWriteRelays(pubkey: string, limit: number): Promise<string[]> {
    const pool = new SimplePool();
    try {
      const followerContactEvents = (await pool.querySync(this.relays, {
        kinds: [3],
        '#p': [pubkey],
        limit: 1000,
      } as any)) as NostrEvent[];

      const followers = [...new Set(followerContactEvents.map((evt) => evt.pubkey))];
      if (followers.length === 0) return [];

      const relayEvents = await this.getLatestRelayLists(pool, followers);
      const counts = new Map<string, number>();

      for (const event of relayEvents.values()) {
        for (const relay of this.relayDiscovery.extractRelayEntries(event)) {
          if (relay.read) {
            counts.set(relay.url, (counts.get(relay.url) || 0) + 1);
          }
        }
      }

      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.max(0, limit))
        .map(([url]) => url);
    } finally {
      pool.close(this.relays);
    }
  }

  async getBestReadRelays(pubkey: string, limit: number): Promise<string[]> {
    const pool = new SimplePool();
    try {
      const follows = await this.getDirectFollows(pool, pubkey);
      if (follows.length === 0) return [];

      const relayEvents = await this.getLatestRelayLists(pool, follows);
      const counts = new Map<string, number>();

      for (const event of relayEvents.values()) {
        for (const relay of this.relayDiscovery.extractRelayEntries(event)) {
          if (relay.write) {
            counts.set(relay.url, (counts.get(relay.url) || 0) + 1);
          }
        }
      }

      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.max(0, limit))
        .map(([url]) => url);
    } finally {
      pool.close(this.relays);
    }
  }

  async getRelayOverlap(pubkey1: string, pubkey2: string): Promise<string[]> {
    const pool = new SimplePool();
    try {
      const relayEvents = await this.getLatestRelayLists(pool, [pubkey1, pubkey2]);
      const first = relayEvents.get(pubkey1);
      const second = relayEvents.get(pubkey2);
      if (!first || !second) return [];

      const relays1 = new Set(this.relayDiscovery.extractRelayEntries(first).map((r) => r.url));
      const relays2 = new Set(this.relayDiscovery.extractRelayEntries(second).map((r) => r.url));

      return [...relays1].filter((url) => relays2.has(url));
    } finally {
      pool.close(this.relays);
    }
  }

  private async getDirectFollows(pool: SimplePool, pubkey: string): Promise<string[]> {
    const event = (await pool.get(this.relays, { kinds: [3], authors: [pubkey] } as any)) as NostrEvent | null;
    return [...new Set((event?.tags || []).filter((tag) => tag[0] === 'p' && tag[1]).map((tag) => tag[1]))];
  }

  private async getSecondDegree(pool: SimplePool, follows: string[], root: string): Promise<Set<string>> {
    if (follows.length === 0) return new Set<string>();

    const second = new Set<string>();
    const contactEvents = (await pool.querySync(this.relays, {
      kinds: [3],
      authors: follows.slice(0, 500),
      limit: 1000,
    } as any)) as NostrEvent[];

    for (const event of contactEvents) {
      for (const tag of event.tags || []) {
        if (tag[0] !== 'p' || !tag[1]) continue;
        if (tag[1] !== root && !follows.includes(tag[1])) {
          second.add(tag[1]);
        }
      }
    }

    return second;
  }

  private async getLatestRelayLists(pool: SimplePool, pubkeys: string[]): Promise<Map<string, NostrEvent>> {
    if (pubkeys.length === 0) return new Map<string, NostrEvent>();

    const events = (await pool.querySync(this.relays, {
      kinds: [10002],
      authors: pubkeys.slice(0, 500),
      limit: 2000,
    } as any)) as NostrEvent[];

    const latest = new Map<string, NostrEvent>();
    for (const event of events) {
      const current = latest.get(event.pubkey);
      if (!current || current.created_at < event.created_at) {
        latest.set(event.pubkey, event);
      }

      await this.relayDiscovery.processRelayList(event);
    }

    return latest;
  }

  private tallyRelayUsage(target: Map<string, RelayAggregate>, relayEvents: Map<string, NostrEvent>, depthWeight: number): void {
    for (const [author, event] of relayEvents.entries()) {
      const entries = this.relayDiscovery.extractRelayEntries(event);

      for (const relay of entries) {
        const aggregate = target.get(relay.url) || {
          url: relay.url,
          score: 0,
          usedByFollows: new Set<string>(),
          usedBy2ndDegree: new Set<string>(),
          writeVotes: 0,
          readVotes: 0,
        };

        const writeWeight = relay.write ? 2 : 0;
        const readWeight = relay.read ? 1 : 0;
        aggregate.score += depthWeight * (writeWeight + readWeight);

        if (depthWeight === 3) {
          aggregate.usedByFollows.add(author);
        } else {
          aggregate.usedBy2ndDegree.add(author);
        }

        if (relay.write) aggregate.writeVotes++;
        if (relay.read) aggregate.readVotes++;

        target.set(relay.url, aggregate);
      }
    }
  }
}
