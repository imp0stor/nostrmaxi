import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import type { Cache } from 'cache-manager';
import { type Event as NostrEvent, type SimplePool as SimplePoolType } from 'nostr-tools';
import { PrismaService } from '../prisma/prisma.service';

// Enable WebSocket for Node.js - must import SimplePool from same module
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { useWebSocketImplementation, SimplePool } = require('nostr-tools/pool') as {
  useWebSocketImplementation: (ws: unknown) => void;
  SimplePool: new () => SimplePoolType;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
useWebSocketImplementation(require('ws'));

const LOCAL_RELAY = process.env.LOCAL_RELAY_URL || 'ws://10.1.10.143:7777';
const LATEST_CACHE_KEY = 'analytics:network:latest';
const HISTORY_CACHE_PREFIX = 'analytics:network:history';
const RELAY_QUERY_LIMIT = 20000;

@Injectable()
export class NetworkAnalyticsSnapshotService {
  private readonly logger = new Logger(NetworkAnalyticsSnapshotService.name);
  private readonly pool = new SimplePool();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @Cron('*/15 * * * *')
  async computeScheduledSnapshot(): Promise<void> {
    await this.computeAndStoreSnapshot();
  }

  async computeAndStoreSnapshot(): Promise<void> {
    try {
      const startedAt = Date.now();
      const now = Math.floor(Date.now() / 1000);
      const weekAgo = now - 7 * 24 * 60 * 60;
      const dayAgo = now - 24 * 60 * 60;
      const hourAgo = now - 60 * 60;

      const [weekEvents, dayEvents, latencyMs] = await Promise.all([
        this.querySafe({ since: weekAgo, until: now, limit: RELAY_QUERY_LIMIT }),
        this.querySafe({ since: dayAgo, until: now, limit: RELAY_QUERY_LIMIT }),
        this.measureRelayLatency(),
      ]);

      const eventsByKind = this.groupEventsByKind(weekEvents);
      const notes = weekEvents.filter((event) => event.kind === 1);
      const zaps = weekEvents.filter((event) => event.kind === 9735);

      const hourlyEvents = this.computeHourlyTimeline(dayEvents, now);
      const dailyEvents = this.computeDailyTimeline(weekEvents, now);
      const activeUsersHour = this.countActiveUsers(weekEvents, hourAgo);
      const activeUsersDay = this.countActiveUsers(weekEvents, dayAgo);
      const activeUsersWeek = new Set(weekEvents.map((event) => event.pubkey)).size;
      const zapSummary = this.computeZapStats(zaps);
      const topHashtags = this.computeTopHashtags(notes);
      const mediaPostCount = this.countMediaPosts(notes);
      const eventsPerMinute = Number((dayEvents.length / (24 * 60)).toFixed(2));

      const snapshot = await this.prisma.networkAnalytics.create({
        data: {
          totalEvents: weekEvents.length,
          eventsByKind: eventsByKind as Prisma.JsonObject,
          hourlyEvents: hourlyEvents as Prisma.JsonArray,
          dailyEvents: dailyEvents as Prisma.JsonArray,
          activeUsersHour,
          activeUsersDay,
          activeUsersWeek,
          totalZapSats: BigInt(zapSummary.totalZapSats),
          zapCount: zapSummary.zapCount,
          avgZapSats: zapSummary.avgZapSats,
          topZappedPosts: zapSummary.topZappedPosts as Prisma.JsonArray,
          topHashtags: topHashtags as Prisma.JsonArray,
          mediaPostCount,
          relayLatencyMs: latencyMs,
          eventsPerMinute,
        },
      });

      await this.cacheManager.set(LATEST_CACHE_KEY, snapshot, 15 * 60 * 1000);
      await this.cacheManager.del(`${HISTORY_CACHE_PREFIX}:24`);

      const elapsedMs = Date.now() - startedAt;
      this.logger.log(`Network analytics snapshot computed in ${elapsedMs}ms`);
    } catch (error) {
      this.logger.error(`Failed to compute network analytics snapshot: ${error.message}`);
    }
  }

  async getLatestSnapshot() {
    const cached = await this.cacheManager.get<any>(LATEST_CACHE_KEY);
    if (cached) return this.serializeSnapshot(cached);

    const latest = await this.prisma.networkAnalytics.findFirst({
      orderBy: { computedAt: 'desc' },
    });

    if (!latest) {
      await this.computeAndStoreSnapshot();
      const fallback = await this.prisma.networkAnalytics.findFirst({ orderBy: { computedAt: 'desc' } });
      return fallback ? this.serializeSnapshot(fallback) : null;
    }

    await this.cacheManager.set(LATEST_CACHE_KEY, latest, 15 * 60 * 1000);
    return this.serializeSnapshot(latest);
  }

  async getSnapshotHistory(hours: number) {
    const safeHours = Math.max(1, Math.min(168, Number.isFinite(hours) ? Math.floor(hours) : 24));
    const cacheKey = `${HISTORY_CACHE_PREFIX}:${safeHours}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) return cached.map((entry) => this.serializeSnapshot(entry));

    const fromDate = new Date(Date.now() - safeHours * 60 * 60 * 1000);
    const rows = await this.prisma.networkAnalytics.findMany({
      where: { computedAt: { gte: fromDate } },
      orderBy: { computedAt: 'asc' },
    });

    await this.cacheManager.set(cacheKey, rows, 60 * 1000);
    return rows.map((entry) => this.serializeSnapshot(entry));
  }

  async getDrillDown(metric: string, live = false) {
    if (live) {
      const result = await this.computeLiveDrillDown(metric);
      if (result) return result;
    }

    const latest = await this.getLatestSnapshot();
    if (!latest) return { metric, data: null };

    switch (metric) {
      case 'event-volume':
        return { metric, data: latest.eventsByKind };
      case 'activity':
        return { metric, data: { hourlyEvents: latest.hourlyEvents, dailyEvents: latest.dailyEvents } };
      case 'users':
        return {
          metric,
          data: {
            activeUsersHour: latest.activeUsersHour,
            activeUsersDay: latest.activeUsersDay,
            activeUsersWeek: latest.activeUsersWeek,
          },
        };
      case 'zaps':
        return {
          metric,
          data: {
            totalZapSats: latest.totalZapSats,
            zapCount: latest.zapCount,
            avgZapSats: latest.avgZapSats,
            topZappedPosts: latest.topZappedPosts,
          },
        };
      case 'hashtags':
        return { metric, data: latest.topHashtags };
      case 'content-distribution': {
        const computed = await this.computeLiveDrillDown('content-distribution');
        return computed || { metric, data: null };
      }
      case 'network-health':
        return {
          metric,
          data: {
            relayLatencyMs: latest.relayLatencyMs,
            eventsPerMinute: latest.eventsPerMinute,
          },
        };
      default:
        return { metric, data: null, message: 'Unsupported metric' };
    }
  }

  private async computeLiveDrillDown(metric: string) {
    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 24 * 60 * 60;
    const weekAgo = now - 7 * 24 * 60 * 60;

    if (metric === 'hashtags') {
      const events = await this.querySafe({ kinds: [1], since: dayAgo, until: now, limit: RELAY_QUERY_LIMIT });
      return { metric, data: this.computeTopHashtags(events) };
    }

    if (metric === 'zaps') {
      const zaps = await this.querySafe({ kinds: [9735], since: weekAgo, until: now, limit: RELAY_QUERY_LIMIT });
      return { metric, data: this.computeZapStats(zaps) };
    }

    if (metric === 'event-volume') {
      const events = await this.querySafe({ since: dayAgo, until: now, limit: RELAY_QUERY_LIMIT });
      return { metric, data: this.groupEventsByKind(events) };
    }

    if (metric === 'content-distribution') {
      const events = await this.querySafe({ since: dayAgo, until: now, limit: RELAY_QUERY_LIMIT });
      const notes = events.filter((event) => event.kind === 1);
      const reposts = events.filter((event) => event.kind === 6);
      return { metric, data: this.computeContentDistribution(notes, reposts.length) };
    }

    return null;
  }

  private groupEventsByKind(events: NostrEvent[]): Record<string, number> {
    return events.reduce<Record<string, number>>((acc, event) => {
      const key = String(event.kind);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  private computeHourlyTimeline(events: NostrEvent[], now: number) {
    const buckets = new Map<string, number>();
    for (let i = 23; i >= 0; i -= 1) {
      const hourDate = new Date((now - i * 3600) * 1000);
      hourDate.setMinutes(0, 0, 0);
      buckets.set(hourDate.toISOString(), 0);
    }

    for (const event of events) {
      const d = new Date(event.created_at * 1000);
      d.setMinutes(0, 0, 0);
      const key = d.toISOString();
      if (!buckets.has(key)) continue;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    return [...buckets.entries()].map(([hour, count]) => ({ hour, count }));
  }

  private computeDailyTimeline(events: NostrEvent[], now: number) {
    const buckets = new Map<string, number>();
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date((now - i * 86400) * 1000).toISOString().slice(0, 10);
      buckets.set(day, 0);
    }

    for (const event of events) {
      const day = new Date(event.created_at * 1000).toISOString().slice(0, 10);
      if (!buckets.has(day)) continue;
      buckets.set(day, (buckets.get(day) || 0) + 1);
    }

    return [...buckets.entries()].map(([date, count]) => ({ date, count }));
  }

  private countActiveUsers(events: NostrEvent[], sinceEpoch: number): number {
    return new Set(events.filter((event) => event.created_at >= sinceEpoch).map((event) => event.pubkey)).size;
  }

  private computeContentDistribution(notes: NostrEvent[], repostCount: number) {
    const replies = notes.filter((note) => note.tags.some((tag) => tag[0] === 'e')).length;
    const noteOnly = Math.max(0, notes.length - replies);
    const total = noteOnly + replies + repostCount;

    if (total === 0) {
      return { notesPct: 0, repliesPct: 0, repostsPct: 0 };
    }

    return {
      notesPct: Number(((noteOnly / total) * 100).toFixed(2)),
      repliesPct: Number(((replies / total) * 100).toFixed(2)),
      repostsPct: Number(((repostCount / total) * 100).toFixed(2)),
    };
  }

  private computeZapStats(zaps: NostrEvent[]) {
    let totalZapSats = 0;
    const postMap = new Map<string, { eventId: string; sats: number; author?: string }>();

    for (const zap of zaps) {
      const sats = this.extractZapSats(zap);
      totalZapSats += sats;

      const eventId = zap.tags.find((tag) => tag[0] === 'e')?.[1];
      if (!eventId) continue;

      const existing = postMap.get(eventId) || { eventId, sats: 0, author: zap.tags.find((tag) => tag[0] === 'p')?.[1] };
      existing.sats += sats;
      postMap.set(eventId, existing);
    }

    const topZappedPosts = [...postMap.values()].sort((a, b) => b.sats - a.sats).slice(0, 10);

    return {
      totalZapSats,
      zapCount: zaps.length,
      avgZapSats: zaps.length > 0 ? Math.round(totalZapSats / zaps.length) : 0,
      topZappedPosts,
    };
  }

  private extractZapSats(event: NostrEvent): number {
    const amountTag = event.tags.find((tag) => tag[0] === 'amount')?.[1];
    const amount = Number(amountTag);
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    if (amount >= 1000) {
      return Math.floor(amount / 1000);
    }

    return Math.floor(amount);
  }

  private computeTopHashtags(notes: NostrEvent[]) {
    const counts = new Map<string, number>();

    for (const note of notes) {
      const fromTags = note.tags.filter((tag) => tag[0] === 't' && tag[1]).map((tag) => tag[1].toLowerCase());
      const fromBody = (note.content || '').match(/#([\p{L}\p{N}_-]+)/gu)?.map((tag) => tag.replace('#', '').toLowerCase()) || [];

      for (const tag of [...fromTags, ...fromBody]) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private countMediaPosts(notes: NostrEvent[]): number {
    return notes.filter((note) => {
      const content = (note.content || '').toLowerCase();
      return /(https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|m3u8))/i.test(content);
    }).length;
  }

  private async measureRelayLatency(): Promise<number> {
    const start = Date.now();
    await this.querySafe({ limit: 1 });
    return Date.now() - start;
  }

  private async querySafe(filter: Record<string, unknown>): Promise<NostrEvent[]> {
    try {
      return (await this.pool.querySync([LOCAL_RELAY], filter as any)) as NostrEvent[];
    } catch (error) {
      this.logger.warn(`Relay query failed: ${error.message}`);
      return [];
    }
  }

  private serializeSnapshot(snapshot: any) {
    return {
      ...snapshot,
      totalZapSats: snapshot.totalZapSats?.toString?.() ?? '0',
    };
  }
}
