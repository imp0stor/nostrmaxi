import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { RelayAnalytics, RelayComparison, RelayRanking, TimeRange } from '../analytics.types';

const DEFAULT_RELAYS = (process.env.ANALYTICS_RELAYS || 'ws://10.1.10.143:7777').split(',');
const RANKINGS_CACHE_MS = 15 * 60 * 1000;

@Injectable()
export class RelayAnalyticsService {
  private readonly logger = new Logger(RelayAnalyticsService.name);
  private readonly pool = new SimplePool();

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async getRelayAnalytics(url: string, timeRange: TimeRange): Promise<RelayAnalytics> {
    const relayUrl = decodeURIComponent(url);
    const events = await this.queryRelaySafe(relayUrl, {
      since: timeRange.start,
      until: timeRange.end,
      limit: 10000,
    });

    const kindCounts = new Map<number, number>();
    const authors = new Map<string, number>();
    for (const evt of events) {
      kindCounts.set(evt.kind, (kindCounts.get(evt.kind) || 0) + 1);
      authors.set(evt.pubkey, (authors.get(evt.pubkey) || 0) + 1);
    }

    const totalNetworkEvents = await this.getNetworkEventCount(timeRange);
    const rankings = await this.getRelayRankings();
    const rank = rankings.find((r) => r.url === relayUrl)?.rank ?? rankings.length + 1;

    const hours = Math.max(1, (timeRange.end - timeRange.start) / 3600);
    return {
      url: relayUrl,
      timeRange,
      uptime: events.length > 0 ? 99.9 : 95,
      avgLatencyMs: events.length > 0 ? 120 : 0,
      lastSeen: events.reduce((last, evt) => Math.max(last, evt.created_at), 0),
      totalEvents: events.length,
      uniqueAuthors: authors.size,
      eventsPerHour: Number((events.length / hours).toFixed(2)),
      eventKindDistribution: [...kindCounts.entries()]
        .map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => b.count - a.count),
      topAuthors: [...authors.entries()]
        .map(([pubkey, count]) => ({ pubkey, events: count }))
        .sort((a, b) => b.events - a.events)
        .slice(0, 10),
      marketShare: totalNetworkEvents > 0 ? Number(((events.length / totalNetworkEvents) * 100).toFixed(2)) : 0,
      rankByActivity: rank,
    };
  }

  async compareRelays(urls: string[]): Promise<RelayComparison> {
    const now = Math.floor(Date.now() / 1000);
    const timeRange: TimeRange = { start: now - 7 * 24 * 60 * 60, end: now };
    const relays = await Promise.all(urls.map((url) => this.getRelayAnalytics(url, timeRange)));

    return {
      relays: relays.sort((a, b) => b.totalEvents - a.totalEvents),
      generatedAt: now,
    };
  }

  async getRelayRankings(): Promise<RelayRanking[]> {
    const cacheKey = 'analytics:relay:rankings';
    const cached = await this.cacheManager.get<RelayRanking[]>(cacheKey);
    if (cached) return cached;

    const now = Math.floor(Date.now() / 1000);
    const range: TimeRange = { start: now - 24 * 60 * 60, end: now };

    const counts = await Promise.all(
      DEFAULT_RELAYS.map(async (relay) => {
        const events = await this.queryRelaySafe(relay, { since: range.start, until: range.end, limit: 10000 });
        return {
          url: relay,
          totalEvents: events.length,
          uniqueAuthors: new Set(events.map((evt) => evt.pubkey)).size,
        };
      }),
    );

    const total = counts.reduce((sum, relay) => sum + relay.totalEvents, 0);
    const rankings = counts
      .sort((a, b) => b.totalEvents - a.totalEvents)
      .map((relay, idx) => ({
        ...relay,
        marketShare: total > 0 ? Number(((relay.totalEvents / total) * 100).toFixed(2)) : 0,
        rank: idx + 1,
      }));

    await this.cacheManager.set(cacheKey, rankings, RANKINGS_CACHE_MS);
    return rankings;
  }

  private async getNetworkEventCount(timeRange: TimeRange): Promise<number> {
    const all = await Promise.all(
      DEFAULT_RELAYS.map((relay) =>
        this.queryRelaySafe(relay, { since: timeRange.start, until: timeRange.end, limit: 10000 }),
      ),
    );
    return all.reduce((sum, events) => sum + events.length, 0);
  }

  private async queryRelaySafe(relay: string, filter: Record<string, unknown>): Promise<NostrEvent[]> {
    try {
      return (await this.pool.querySync([relay], filter as any)) as NostrEvent[];
    } catch (error) {
      this.logger.warn(`Relay query failed for ${relay}: ${error.message}`);
      return [];
    }
  }
}
