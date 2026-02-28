import { Injectable, Logger } from '@nestjs/common';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { RelatedTopic, TimeRange, TopicAnalytics, TrendingPost, TrendingTopic } from '../analytics.types';
import { extractHashtags } from '../utils/hashtag-extractor';

const LOCAL_RELAY = process.env.LOCAL_RELAY_URL || 'ws://10.1.10.143:7777';

@Injectable()
export class TopicAnalyticsService {
  private readonly logger = new Logger(TopicAnalyticsService.name);
  private readonly pool = new SimplePool();

  async getTopicAnalytics(hashtag: string, timeRange: TimeRange): Promise<TopicAnalytics> {
    const tag = hashtag.replace(/^#/, '').toLowerCase();
    const notes = await this.querySafe({ kinds: [1], since: timeRange.start, until: timeRange.end, limit: 15000 });
    const tagged = notes.filter((note) => extractHashtags(note.content || '').includes(tag));
    const postIds = tagged.map((evt) => evt.id);

    const interactions = postIds.length
      ? await this.querySafe({ kinds: [7, 6, 9735], '#e': postIds, since: timeRange.start, until: timeRange.end, limit: 15000 })
      : [];

    const topAuthorsMap = new Map<string, { posts: number; engagement: number }>();
    const engagementByPost = new Map<string, number>();
    for (const interaction of interactions) {
      const postId = interaction.tags.find((t) => t[0] === 'e')?.[1];
      if (postId) engagementByPost.set(postId, (engagementByPost.get(postId) || 0) + 1);
    }

    for (const note of tagged) {
      const cur = topAuthorsMap.get(note.pubkey) || { posts: 0, engagement: 0 };
      cur.posts += 1;
      cur.engagement += engagementByPost.get(note.id) || 0;
      topAuthorsMap.set(note.pubkey, cur);
    }

    const timeline = this.buildTimeline(tagged, engagementByPost);
    const peakTime = this.findPeakTime(tagged);
    const trendScore = tagged.length * 0.6 + interactions.length * 0.4;

    return {
      hashtag: tag,
      timeRange,
      totalPosts: tagged.length,
      uniqueAuthors: new Set(tagged.map((evt) => evt.pubkey)).size,
      engagement: interactions.length,
      trendScore: Number(trendScore.toFixed(2)),
      velocity: this.calculateVelocity(timeline),
      peakTime,
      topAuthors: [...topAuthorsMap.entries()]
        .map(([pubkey, stats]) => ({ pubkey, ...stats }))
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 10),
      relatedHashtags: await this.getRelatedTopics(tag),
      timeline,
    };
  }

  async getTrendingTopics(limit: number): Promise<TrendingTopic[]> {
    const now = Math.floor(Date.now() / 1000);
    const notes = await this.querySafe({ kinds: [1], since: now - 24 * 60 * 60, until: now, limit: 15000 });
    const counts = new Map<string, number>();

    for (const note of notes) {
      for (const tag of extractHashtags(note.content || '')) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([topic, count]) => ({ topic, score: count }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getTrendingPosts(limit: number): Promise<TrendingPost[]> {
    const now = Math.floor(Date.now() / 1000);
    const notes = await this.querySafe({ kinds: [1], since: now - 24 * 60 * 60, until: now, limit: 10000 });
    const noteIds = notes.map((n) => n.id);
    const interactions = noteIds.length
      ? await this.querySafe({ kinds: [7, 6, 9735], '#e': noteIds, since: now - 24 * 60 * 60, until: now, limit: 20000 })
      : [];

    const byPost = new Map<string, number>();
    for (const interaction of interactions) {
      const target = interaction.tags.find((t) => t[0] === 'e')?.[1];
      if (target) byPost.set(target, (byPost.get(target) || 0) + 1);
    }

    return notes
      .map((note) => ({
        id: note.id,
        pubkey: note.pubkey,
        content: (note.content || '').slice(0, 280),
        score: byPost.get(note.id) || 0,
        createdAt: note.created_at,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getRelatedTopics(hashtag: string): Promise<RelatedTopic[]> {
    const tag = hashtag.replace(/^#/, '').toLowerCase();
    const now = Math.floor(Date.now() / 1000);
    const notes = await this.querySafe({ kinds: [1], since: now - 30 * 24 * 60 * 60, until: now, limit: 20000 });

    const cooccurrence = new Map<string, number>();
    for (const note of notes) {
      const tags = extractHashtags(note.content || '');
      if (!tags.includes(tag)) continue;
      for (const other of tags) {
        if (other === tag) continue;
        cooccurrence.set(other, (cooccurrence.get(other) || 0) + 1);
      }
    }

    return [...cooccurrence.entries()]
      .map(([related, count]) => ({ tag: related, cooccurrence: count }))
      .sort((a, b) => b.cooccurrence - a.cooccurrence)
      .slice(0, 10);
  }

  private buildTimeline(tagged: NostrEvent[], engagementByPost: Map<string, number>) {
    const daily = new Map<string, { posts: number; engagement: number }>();
    for (const note of tagged) {
      const date = new Date(note.created_at * 1000).toISOString().slice(0, 10);
      if (!daily.has(date)) daily.set(date, { posts: 0, engagement: 0 });
      const bucket = daily.get(date)!;
      bucket.posts += 1;
      bucket.engagement += engagementByPost.get(note.id) || 0;
    }

    return [...daily.entries()]
      .map(([date, value]) => ({ date, posts: value.posts, engagement: value.engagement }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private findPeakTime(notes: NostrEvent[]): number {
    const byHour = new Map<number, number>();
    for (const note of notes) {
      const hour = new Date(note.created_at * 1000).getUTCHours();
      byHour.set(hour, (byHour.get(hour) || 0) + 1);
    }

    let peakHour = 0;
    let max = 0;
    for (const [hour, count] of byHour.entries()) {
      if (count > max) {
        max = count;
        peakHour = hour;
      }
    }
    return peakHour;
  }

  private calculateVelocity(timeline: { date: string; posts: number }[]): number {
    if (timeline.length < 2) return 0;
    const first = timeline[0].posts;
    const last = timeline[timeline.length - 1].posts;
    if (first === 0) return last > 0 ? 100 : 0;
    return Number((((last - first) / first) * 100).toFixed(2));
  }

  private async querySafe(filter: Record<string, unknown>): Promise<NostrEvent[]> {
    try {
      return (await this.pool.querySync([LOCAL_RELAY], filter as any)) as NostrEvent[];
    } catch (error) {
      this.logger.warn(`Topic analytics relay query failed: ${error.message}`);
      return [];
    }
  }
}
