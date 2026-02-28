import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SimplePool, type Event as NostrEvent, type Filter } from 'nostr-tools';

const LOCAL_RELAY = 'ws://10.1.10.143:7777';

export interface UserMetrics {
  pubkey: string;
  computedAt: number;

  // Follower metrics
  followerCount: number;
  followerGrowth7d: number;
  followerGrowth30d: number;
  followingCount: number;

  // Content metrics
  totalNotes: number;
  notesLast7d: number;
  notesLast30d: number;
  avgNotesPerDay: number;

  // Engagement metrics
  totalReactions: number;
  totalReposts: number;
  totalZaps: number;
  totalZapAmount: number;
  avgEngagementPerPost: number;
  engagementRate: number;

  // Timing analysis
  bestHours: { hour: number; engagement: number }[];
  bestDays: { day: string; engagement: number }[];

  // Top content
  topPosts: {
    id: string;
    content: string;
    reactions: number;
    reposts: number;
    zaps: number;
    zapAmount: number;
    score: number;
  }[];

  // Content analysis
  topHashtags: { tag: string; count: number; engagement: number }[];
  contentTypes: { text: number; image: number; video: number; link: number };
  avgPostLength: number;

  // Network
  reach: number; // Total followers of followers
  networkSize: number;
  influenceScore: number;
}

@Injectable()
export class AnalyticsDataService {
  private readonly logger = new Logger(AnalyticsDataService.name);
  private readonly cache = new Map<string, { data: UserMetrics; expires: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private readonly pool: SimplePool;

  constructor() {
    this.pool = new SimplePool();
  }

  async getUserMetrics(pubkey: string, forceRefresh = false): Promise<UserMetrics> {
    const cached = this.cache.get(pubkey);
    if (cached && cached.expires > Date.now() && !forceRefresh) {
      return cached.data;
    }

    const metrics = await this.computeUserMetrics(pubkey);
    this.cache.set(pubkey, {
      data: metrics,
      expires: Date.now() + this.CACHE_TTL,
    });

    return metrics;
  }

  private async computeUserMetrics(pubkey: string): Promise<UserMetrics> {
    const now = Math.floor(Date.now() / 1000);
    const day7ago = now - 7 * 24 * 60 * 60;
    const day30ago = now - 30 * 24 * 60 * 60;

    const [
      _profile,
      notes,
      followers,
      following,
      reactions,
      reposts,
      zaps,
    ] = await Promise.all([
      this.queryLocal({ kinds: [0], authors: [pubkey], limit: 1 }),
      this.queryLocal({ kinds: [1], authors: [pubkey], since: day30ago, limit: 500 }),
      this.queryLocal({ kinds: [3], '#p': [pubkey], limit: 1000 }),
      this.queryLocal({ kinds: [3], authors: [pubkey], limit: 1 }),
      this.queryLocal({ kinds: [7], '#p': [pubkey], since: day30ago, limit: 1000 }),
      this.queryLocal({ kinds: [6], '#p': [pubkey], since: day30ago, limit: 500 }),
      this.queryLocal({ kinds: [9735], '#p': [pubkey], since: day30ago, limit: 500 }),
    ]);

    const noteIds = new Set(notes.map((note) => note.id));
    const notesLast7d = notes.filter((note) => note.created_at >= day7ago).length;

    const reactionsToMyPosts = reactions.filter((reaction) =>
      reaction.tags.some((tag) => tag[0] === 'e' && tag[1] && noteIds.has(tag[1])),
    );

    const repostsOfMyPosts = reposts.filter((repost) =>
      repost.tags.some((tag) => tag[0] === 'e' && tag[1] && noteIds.has(tag[1])),
    );

    const zapsToMyPosts = zaps.filter((zap) =>
      zap.tags.some((tag) => tag[0] === 'e' && tag[1] && noteIds.has(tag[1])),
    );

    let totalZapAmount = 0;
    for (const zap of zapsToMyPosts) {
      const amountTag = zap.tags.find((tag) => tag[0] === 'amount');
      if (amountTag?.[1]) {
        totalZapAmount += Number.parseInt(amountTag[1], 10) / 1000;
      }
    }

    const followingPubkeys =
      following[0]?.tags.filter((tag) => tag[0] === 'p' && tag[1]).map((tag) => tag[1]) ?? [];

    const hourEngagement = new Map<number, { posts: number; engagement: number }>();
    const dayEngagement = new Map<string, { posts: number; engagement: number }>();

    for (const note of notes) {
      const date = new Date(note.created_at * 1000);
      const hour = date.getHours();
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];

      const noteReactions = reactionsToMyPosts.filter((reaction) =>
        reaction.tags.some((tag) => tag[0] === 'e' && tag[1] === note.id),
      ).length;

      const noteReposts = repostsOfMyPosts.filter((repost) =>
        repost.tags.some((tag) => tag[0] === 'e' && tag[1] === note.id),
      ).length;

      const engagement = noteReactions + noteReposts * 2;

      const hourData = hourEngagement.get(hour) ?? { posts: 0, engagement: 0 };
      hourData.posts += 1;
      hourData.engagement += engagement;
      hourEngagement.set(hour, hourData);

      const dayData = dayEngagement.get(day) ?? { posts: 0, engagement: 0 };
      dayData.posts += 1;
      dayData.engagement += engagement;
      dayEngagement.set(day, dayData);
    }

    const postScores = notes
      .map((note) => {
        const noteReactions = reactionsToMyPosts.filter((reaction) =>
          reaction.tags.some((tag) => tag[0] === 'e' && tag[1] === note.id),
        ).length;

        const noteReposts = repostsOfMyPosts.filter((repost) =>
          repost.tags.some((tag) => tag[0] === 'e' && tag[1] === note.id),
        ).length;

        const noteZaps = zapsToMyPosts.filter((zap) =>
          zap.tags.some((tag) => tag[0] === 'e' && tag[1] === note.id),
        );

        let noteZapAmount = 0;
        for (const zap of noteZaps) {
          const amountTag = zap.tags.find((tag) => tag[0] === 'amount');
          if (amountTag?.[1]) {
            noteZapAmount += Number.parseInt(amountTag[1], 10) / 1000;
          }
        }

        return {
          id: note.id,
          content: (note.content ?? '').slice(0, 200),
          reactions: noteReactions,
          reposts: noteReposts,
          zaps: noteZaps.length,
          zapAmount: noteZapAmount,
          score: noteReactions + noteReposts * 2 + noteZaps.length * 3 + Math.floor(noteZapAmount / 100),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const hashtagStats = new Map<string, { count: number; engagement: number }>();
    for (const note of notes) {
      const tags = note.tags
        .filter((tag) => tag[0] === 't' && typeof tag[1] === 'string')
        .map((tag) => String(tag[1]).toLowerCase());

      const noteEngagement = postScores.find((post) => post.id === note.id)?.score ?? 0;

      for (const tag of tags) {
        const existing = hashtagStats.get(tag) ?? { count: 0, engagement: 0 };
        existing.count += 1;
        existing.engagement += noteEngagement;
        hashtagStats.set(tag, existing);
      }
    }

    const contentTypes = { text: 0, image: 0, video: 0, link: 0 };
    let totalLength = 0;
    for (const note of notes) {
      const content = note.content ?? '';
      totalLength += content.length;

      if (/\.(jpg|jpeg|png|gif|webp)/i.test(content)) {
        contentTypes.image += 1;
      } else if (/\.(mp4|webm|mov)/i.test(content)) {
        contentTypes.video += 1;
      } else if (/https?:\/\//.test(content)) {
        contentTypes.link += 1;
      } else {
        contentTypes.text += 1;
      }
    }

    const totalEngagement = reactionsToMyPosts.length + repostsOfMyPosts.length + zapsToMyPosts.length;
    const avgEngagementPerPost = notes.length > 0 ? totalEngagement / notes.length : 0;
    const engagementRate = notes.length > 0 && followers.length > 0
      ? (avgEngagementPerPost / followers.length) * 100
      : 0;

    return {
      pubkey,
      computedAt: Date.now(),

      followerCount: followers.length,
      followerGrowth7d: 0,
      followerGrowth30d: 0,
      followingCount: followingPubkeys.length,

      totalNotes: notes.length,
      notesLast7d,
      notesLast30d: notes.length,
      avgNotesPerDay: notes.length / 30,

      totalReactions: reactionsToMyPosts.length,
      totalReposts: repostsOfMyPosts.length,
      totalZaps: zapsToMyPosts.length,
      totalZapAmount,
      avgEngagementPerPost,
      engagementRate,

      bestHours: Array.from(hourEngagement.entries())
        .map(([hour, data]) => ({
          hour,
          engagement: data.posts > 0 ? data.engagement / data.posts : 0,
        }))
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5),

      bestDays: Array.from(dayEngagement.entries())
        .map(([day, data]) => ({
          day,
          engagement: data.posts > 0 ? data.engagement / data.posts : 0,
        }))
        .sort((a, b) => b.engagement - a.engagement),

      topPosts: postScores,

      topHashtags: Array.from(hashtagStats.entries())
        .map(([tag, data]) => ({ tag, count: data.count, engagement: data.engagement }))
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 10),

      contentTypes,
      avgPostLength: notes.length > 0 ? totalLength / notes.length : 0,

      reach: 0,
      networkSize: followingPubkeys.length + followers.length,
      influenceScore: Math.log10(Math.max(1, followers.length * (totalEngagement + 1))),
    };
  }

  @Cron('0 * * * *')
  async precomputeActiveUserAnalytics(): Promise<void> {
    const activeUsers = await this.getRecentActiveUsers();
    this.logger.debug(`Precomputing analytics for ${Math.min(activeUsers.length, 100)} active users`);

    for (const pubkey of activeUsers.slice(0, 100)) {
      await this.getUserMetrics(pubkey, true);
      await this.sleep(500);
    }
  }

  private async getRecentActiveUsers(): Promise<string[]> {
    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 24 * 60 * 60;
    const recentNotes = await this.queryLocal({ kinds: [1], since: dayAgo, limit: 500 });

    const seen = new Set<string>();
    for (const note of recentNotes) {
      if (note.pubkey) {
        seen.add(note.pubkey);
      }
    }

    return Array.from(seen);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async queryLocal(filter: Filter): Promise<NostrEvent[]> {
    try {
      const events = await Promise.race([
        this.pool.querySync([LOCAL_RELAY], filter),
        new Promise<NostrEvent[]>((resolve) => setTimeout(() => resolve([]), 5000)),
      ]);

      return events;
    } catch (error) {
      this.logger.warn(`Local relay query failed: ${(error as Error)?.message ?? 'unknown error'}`);
      return [];
    }
  }
}
