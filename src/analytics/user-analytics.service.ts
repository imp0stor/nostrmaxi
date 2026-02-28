import { Injectable, Logger } from '@nestjs/common';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { Interval, TimeRange, TopPost, TimelineDataPoint, UserAnalytics } from './analytics.types';

const LOCAL_RELAY = process.env.LOCAL_RELAY_URL || 'ws://10.1.10.143:7777';

@Injectable()
export class UserAnalyticsService {
  private readonly logger = new Logger(UserAnalyticsService.name);
  private readonly pool = new SimplePool();

  async getUserAnalytics(pubkey: string, interval: Interval = '30d', explicit?: TimeRange): Promise<UserAnalytics> {
    const timeRange = this.resolveTimeRange(interval, explicit);

    const posts = await this.querySafe({
      kinds: [1],
      authors: [pubkey],
      since: timeRange.start,
      until: timeRange.end,
      limit: 5000,
    });

    const followers = await this.querySafe({ kinds: [3], '#p': [pubkey], limit: 5000 });
    const followersBefore = await this.querySafe({ kinds: [3], '#p': [pubkey], until: timeRange.start, limit: 5000 });
    const contacts = await this.querySafe({ kinds: [3], authors: [pubkey], limit: 200 });

    const interactions = await this.fetchInteractions(posts.map((post) => post.id), timeRange);
    const reactions = interactions.filter((evt) => evt.kind === 7);
    const reposts = interactions.filter((evt) => evt.kind === 6);
    const zaps = interactions.filter((evt) => evt.kind === 9735);

    const totalZapAmount = zaps.reduce((sum, z) => sum + this.extractZapAmount(z), 0);
    const engagement = reactions.length + reposts.length + zaps.length;
    const reach = new Set(interactions.map((evt) => evt.pubkey)).size;
    const following = this.extractFollowingCount(contacts);

    return {
      pubkey,
      timeRange,
      followers: new Set(followers.map((evt) => evt.pubkey)).size,
      followerGrowth:
        new Set(followers.map((evt) => evt.pubkey)).size - new Set(followersBefore.map((evt) => evt.pubkey)).size,
      following,
      totalPosts: posts.length,
      totalReactions: reactions.length,
      totalReposts: reposts.length,
      totalZaps: zaps.length,
      totalZapAmount,
      avgEngagementRate: posts.length > 0 ? Number((engagement / posts.length).toFixed(4)) : 0,
      reach,
      impressions: engagement,
      bestPostingHours: this.buildBestPostingHours(posts, interactions),
      bestPostingDays: this.buildBestPostingDays(posts, interactions),
      contentTypes: this.buildContentTypes(posts),
      topPosts: this.buildTopPosts(posts, reactions, reposts, zaps),
      timeline: this.buildTimeline(posts, reactions, reposts, zaps),
    };
  }

  private async fetchInteractions(postIds: string[], range: TimeRange): Promise<NostrEvent[]> {
    if (postIds.length === 0) return [];

    const chunks = this.chunk(postIds, 100);
    const results = await Promise.all(
      chunks.map((ids) =>
        this.querySafe({
          kinds: [7, 6, 9735],
          '#e': ids,
          since: range.start,
          until: range.end,
          limit: 5000,
        }),
      ),
    );

    const deduped = new Map<string, NostrEvent>();
    for (const list of results) {
      for (const evt of list) deduped.set(evt.id, evt);
    }
    return [...deduped.values()];
  }

  private buildTimeline(
    posts: NostrEvent[],
    reactions: NostrEvent[],
    reposts: NostrEvent[],
    zaps: NostrEvent[],
  ): TimelineDataPoint[] {
    const buckets = new Map<string, TimelineDataPoint>();
    const ensure = (date: string) => {
      if (!buckets.has(date)) {
        buckets.set(date, { date, posts: 0, reactions: 0, reposts: 0, zaps: 0, zapAmount: 0 });
      }
      return buckets.get(date)!;
    };

    posts.forEach((evt) => ensure(this.toDay(evt.created_at)).posts++);
    reactions.forEach((evt) => ensure(this.toDay(evt.created_at)).reactions++);
    reposts.forEach((evt) => ensure(this.toDay(evt.created_at)).reposts++);
    zaps.forEach((evt) => {
      const bucket = ensure(this.toDay(evt.created_at));
      bucket.zaps++;
      bucket.zapAmount += this.extractZapAmount(evt);
    });

    return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  private buildTopPosts(
    posts: NostrEvent[],
    reactions: NostrEvent[],
    reposts: NostrEvent[],
    zaps: NostrEvent[],
  ): TopPost[] {
    const byPost = new Map<string, { reactions: number; reposts: number; zaps: number; zapAmount: number }>();
    const bump = (event: NostrEvent, key: 'reactions' | 'reposts' | 'zaps') => {
      const target = event.tags.find((tag) => tag[0] === 'e')?.[1];
      if (!target) return;
      if (!byPost.has(target)) byPost.set(target, { reactions: 0, reposts: 0, zaps: 0, zapAmount: 0 });
      byPost.get(target)![key] += 1;
      if (key === 'zaps') byPost.get(target)!.zapAmount += this.extractZapAmount(event);
    };

    reactions.forEach((evt) => bump(evt, 'reactions'));
    reposts.forEach((evt) => bump(evt, 'reposts'));
    zaps.forEach((evt) => bump(evt, 'zaps'));

    return posts
      .map((post) => {
        const stats = byPost.get(post.id) || { reactions: 0, reposts: 0, zaps: 0, zapAmount: 0 };
        const score = stats.reactions * 2 + stats.reposts * 3 + stats.zaps * 5;
        return {
          id: post.id,
          content: post.content?.slice(0, 280) || '',
          reactions: stats.reactions,
          reposts: stats.reposts,
          zaps: stats.zaps,
          zapAmount: stats.zapAmount,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  private buildContentTypes(posts: NostrEvent[]): UserAnalytics['contentTypes'] {
    const contentTypes = { text: 0, image: 0, video: 0, link: 0 };

    for (const post of posts) {
      const lower = (post.content || '').toLowerCase();
      const hasLink = /https?:\/\//i.test(lower);
      const hasImage =
        /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(lower) ||
        post.tags.some((tag) => tag[0] === 'm' && tag[1]?.startsWith('image/'));
      const hasVideo =
        /\.(mp4|mov|webm|m3u8)(\?|$)/i.test(lower) ||
        post.tags.some((tag) => tag[0] === 'm' && tag[1]?.startsWith('video/'));

      if (hasVideo) contentTypes.video += 1;
      else if (hasImage) contentTypes.image += 1;
      else if (hasLink) contentTypes.link += 1;
      else contentTypes.text += 1;
    }

    return contentTypes;
  }

  private buildBestPostingHours(posts: NostrEvent[], interactions: NostrEvent[]) {
    const postHours = new Map<number, Set<string>>();
    for (const post of posts) {
      const hour = new Date(post.created_at * 1000).getUTCHours();
      if (!postHours.has(hour)) postHours.set(hour, new Set());
      postHours.get(hour)!.add(post.id);
    }

    const engagementsByPost = new Map<string, number>();
    for (const interaction of interactions) {
      const postId = interaction.tags.find((t) => t[0] === 'e')?.[1];
      if (!postId) continue;
      engagementsByPost.set(postId, (engagementsByPost.get(postId) || 0) + 1);
    }

    return [...postHours.entries()]
      .map(([hour, ids]) => ({
        hour,
        engagement: [...ids].reduce((sum, id) => sum + (engagementsByPost.get(id) || 0), 0),
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5);
  }

  private buildBestPostingDays(posts: NostrEvent[], interactions: NostrEvent[]) {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const postsByDay = new Map<number, Set<string>>();
    for (const post of posts) {
      const day = new Date(post.created_at * 1000).getUTCDay();
      if (!postsByDay.has(day)) postsByDay.set(day, new Set());
      postsByDay.get(day)!.add(post.id);
    }

    const engagementsByPost = new Map<string, number>();
    for (const interaction of interactions) {
      const postId = interaction.tags.find((t) => t[0] === 'e')?.[1];
      if (!postId) continue;
      engagementsByPost.set(postId, (engagementsByPost.get(postId) || 0) + 1);
    }

    return [...postsByDay.entries()]
      .map(([day, ids]) => ({
        day: labels[day],
        engagement: [...ids].reduce((sum, id) => sum + (engagementsByPost.get(id) || 0), 0),
      }))
      .sort((a, b) => b.engagement - a.engagement);
  }

  private extractFollowingCount(contacts: NostrEvent[]): number {
    const out = new Set<string>();
    for (const list of contacts) {
      for (const tag of list.tags || []) {
        if (tag[0] === 'p' && tag[1]) out.add(tag[1]);
      }
    }
    return out.size;
  }

  private resolveTimeRange(interval: Interval, explicit?: TimeRange): TimeRange {
    if (explicit) return explicit;

    const now = Math.floor(Date.now() / 1000);
    const byInterval: Record<Exclude<Interval, 'all'>, number> = {
      '24h': 24 * 60 * 60,
      '7d': 7 * 24 * 60 * 60,
      '30d': 30 * 24 * 60 * 60,
      '90d': 90 * 24 * 60 * 60,
      '1y': 365 * 24 * 60 * 60,
    };

    if (interval === 'all') return { start: 0, end: now };
    return { start: now - byInterval[interval], end: now };
  }

  private async querySafe(filter: Record<string, unknown>): Promise<NostrEvent[]> {
    try {
      return (await this.pool.querySync([LOCAL_RELAY], filter as any)) as NostrEvent[];
    } catch (error) {
      this.logger.warn(`Local relay query failed: ${error.message}`);
      return [];
    }
  }

  private extractZapAmount(event: NostrEvent): number {
    const amountTag = event.tags.find((tag) => tag[0] === 'amount')?.[1];
    const amount = Number(amountTag);
    return Number.isFinite(amount) ? amount : 0;
  }

  private toDay(unixTs: number): string {
    return new Date(unixTs * 1000).toISOString().slice(0, 10);
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }
}
