import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { NetworkAnalytics, TimeRange, TrendingHashtag } from '../analytics.types';
import { detectLanguage, extractHashtags } from '../utils/hashtag-extractor';

const LOCAL_RELAY = process.env.LOCAL_RELAY_URL || 'ws://10.1.10.143:7777';
const NETWORK_CACHE_MS = 5 * 60 * 1000;

@Injectable()
export class NetworkAnalyticsService {
  private readonly logger = new Logger(NetworkAnalyticsService.name);
  private readonly pool = new SimplePool();

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async getNetworkAnalytics(timeRange: TimeRange): Promise<NetworkAnalytics> {
    const cacheKey = `analytics:network:${timeRange.start}:${timeRange.end}`;
    const cached = await this.cacheManager.get<NetworkAnalytics>(cacheKey);
    if (cached) return cached;

    const events = await this.querySafe({ since: timeRange.start, until: timeRange.end, limit: 10000 });
    const notes = events.filter((evt) => evt.kind === 1);
    const reactions = events.filter((evt) => evt.kind === 7);
    const reposts = events.filter((evt) => evt.kind === 6);
    const zaps = events.filter((evt) => evt.kind === 9735);

    const authors = new Set(events.map((evt) => evt.pubkey));
    const activeUsers24h = await this.getActiveUsers('24h');
    const activeUsers7d = await this.getActiveUsers('7d');

    const newUsers = await this.countNewUsers(timeRange);
    const totalZapVolume = zaps.reduce((sum, evt) => sum + this.extractZapAmount(evt), 0);

    const hashtags = this.extractTrendingHashtags(notes, 20);
    const topics = hashtags.slice(0, 10).map((h) => ({ topic: h.tag, score: h.count + h.growth }));

    const languageDistribution = this.buildLanguageDistribution(notes);
    const contentTypeDistribution = this.buildContentTypeDistribution(notes);

    const previous = await this.querySafe({
      since: Math.max(0, timeRange.start - (timeRange.end - timeRange.start)),
      until: timeRange.start,
      limit: 10000,
    });

    const result: NetworkAnalytics = {
      timeRange,
      totalEvents: events.length,
      uniqueAuthors: authors.size,
      activeUsers24h,
      activeUsers7d,
      newUsers,
      totalNotes: notes.length,
      totalReactions: reactions.length,
      totalReposts: reposts.length,
      totalZaps: zaps.length,
      totalZapVolume,
      trendingHashtags: hashtags,
      trendingTopics: topics,
      languageDistribution,
      contentTypeDistribution,
      eventGrowthRate: this.percentChange(previous.length, events.length),
      userGrowthRate: this.percentChange(new Set(previous.map((e) => e.pubkey)).size, authors.size),
      activityTimeline: this.buildActivityTimeline(events),
    };

    await this.cacheManager.set(cacheKey, result, NETWORK_CACHE_MS);
    return result;
  }

  async getTrendingHashtags(limit: number): Promise<TrendingHashtag[]> {
    const now = Math.floor(Date.now() / 1000);
    const recent = await this.querySafe({ kinds: [1], since: now - 7 * 24 * 60 * 60, until: now, limit: 10000 });
    return this.extractTrendingHashtags(recent, limit);
  }

  async getActiveUsers(period: '24h' | '7d' | '30d'): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const periods: Record<'24h' | '7d' | '30d', number> = {
      '24h': 24 * 60 * 60,
      '7d': 7 * 24 * 60 * 60,
      '30d': 30 * 24 * 60 * 60,
    };

    const events = await this.querySafe({ since: now - periods[period], until: now, limit: 10000 });
    return new Set(events.map((evt) => evt.pubkey)).size;
  }

  private async countNewUsers(timeRange: TimeRange): Promise<number> {
    const events = await this.querySafe({ kinds: [0, 1], since: timeRange.start, until: timeRange.end, limit: 15000 });
    const seen = new Set<string>();
    let count = 0;

    for (const evt of events.sort((a, b) => a.created_at - b.created_at)) {
      if (seen.has(evt.pubkey)) continue;
      const historical = await this.querySafe({ authors: [evt.pubkey], until: timeRange.start - 1, limit: 1 });
      seen.add(evt.pubkey);
      if (historical.length === 0) count += 1;
    }

    return count;
  }

  private buildActivityTimeline(events: NostrEvent[]): { date: string; events: number; users: number }[] {
    const daily = new Map<string, { date: string; events: number; users: Set<string> }>();
    for (const evt of events) {
      const date = new Date(evt.created_at * 1000).toISOString().slice(0, 10);
      if (!daily.has(date)) daily.set(date, { date, events: 0, users: new Set<string>() });
      const bucket = daily.get(date)!;
      bucket.events += 1;
      bucket.users.add(evt.pubkey);
    }

    return [...daily.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ date: d.date, events: d.events, users: d.users.size }));
  }

  private buildLanguageDistribution(notes: NostrEvent[]): { lang: string; percent: number }[] {
    const counts = new Map<string, number>();
    for (const note of notes) {
      const lang = detectLanguage(note.content || '');
      counts.set(lang, (counts.get(lang) || 0) + 1);
    }
    return this.toPercentDistribution(counts, notes.length).slice(0, 10);
  }

  private buildContentTypeDistribution(notes: NostrEvent[]): { type: string; percent: number }[] {
    const counts = new Map<string, number>([
      ['text', 0],
      ['image', 0],
      ['video', 0],
      ['link', 0],
    ]);

    for (const note of notes) {
      const content = (note.content || '').toLowerCase();
      const hasVideo = /\.(mp4|mov|webm|m3u8)(\?|$)/i.test(content);
      const hasImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(content);
      const hasLink = /https?:\/\//i.test(content);
      if (hasVideo) counts.set('video', (counts.get('video') || 0) + 1);
      else if (hasImage) counts.set('image', (counts.get('image') || 0) + 1);
      else if (hasLink) counts.set('link', (counts.get('link') || 0) + 1);
      else counts.set('text', (counts.get('text') || 0) + 1);
    }

    return this.toPercentDistribution(counts, notes.length).map((entry) => ({ type: entry.lang, percent: entry.percent }));
  }

  private extractTrendingHashtags(notes: NostrEvent[], limit: number): TrendingHashtag[] {
    const now = Math.floor(Date.now() / 1000);
    const split = now - 24 * 60 * 60;
    const current = new Map<string, number>();
    const previous = new Map<string, number>();

    for (const note of notes) {
      const tags = extractHashtags(note.content || '');
      for (const tag of tags) {
        const target = note.created_at >= split ? current : previous;
        target.set(tag, (target.get(tag) || 0) + 1);
      }
    }

    return [...current.entries()]
      .map(([tag, count]) => ({
        tag,
        count,
        growth: this.percentChange(previous.get(tag) || 0, count),
      }))
      .sort((a, b) => b.count + b.growth - (a.count + a.growth))
      .slice(0, limit);
  }

  private toPercentDistribution(counts: Map<string, number>, total: number) {
    if (!total) return [];
    return [...counts.entries()]
      .map(([lang, count]) => ({ lang, percent: Number(((count / total) * 100).toFixed(2)) }))
      .sort((a, b) => b.percent - a.percent);
  }

  private percentChange(before: number, after: number): number {
    if (before === 0) return after > 0 ? 100 : 0;
    return Number((((after - before) / before) * 100).toFixed(2));
  }

  private extractZapAmount(event: NostrEvent): number {
    const amountTag = event.tags.find((tag) => tag[0] === 'amount')?.[1];
    const amount = Number(amountTag);
    return Number.isFinite(amount) ? amount : 0;
  }

  private async querySafe(filter: Record<string, unknown>): Promise<NostrEvent[]> {
    try {
      return (await this.pool.querySync([LOCAL_RELAY], filter as any)) as NostrEvent[];
    } catch (error) {
      this.logger.warn(`Network analytics relay query failed: ${error.message}`);
      return [];
    }
  }
}
