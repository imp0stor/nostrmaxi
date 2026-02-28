import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { PremiumGuard } from '../auth/guards/premium.guard';
import {
  Interval,
  NetworkAnalytics,
  RelayAnalytics,
  RelayRanking,
  TimeRange,
  TopicAnalytics,
  TrendingHashtag,
  TrendingPost,
  TrendingTopic,
  UserAnalytics,
  WotAnalytics,
} from './analytics.types';
import { UserAnalyticsService } from './user-analytics.service';
import { NetworkAnalyticsService } from './scopes/network-analytics.service';
import { RelayAnalyticsService } from './scopes/relay-analytics.service';
import { WotAnalyticsService } from './scopes/wot-analytics.service';
import { TopicAnalyticsService } from './scopes/topic-analytics.service';
import { AnalyticsDataService } from './analytics-data.service';

const TRENDING_CACHE_MS = 5 * 60 * 1000;

@Controller('api/analytics')
export class AnalyticsController {
  constructor(
    private readonly userAnalytics: UserAnalyticsService,
    private readonly networkAnalytics: NetworkAnalyticsService,
    private readonly relayAnalytics: RelayAnalyticsService,
    private readonly wotAnalytics: WotAnalyticsService,
    private readonly topicAnalytics: TopicAnalyticsService,
    private readonly analyticsData: AnalyticsDataService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @Get('user')
  @UseGuards(PremiumGuard)
  async getUserAnalytics(
    @Query('pubkey') pubkey: string,
    @Query('interval') interval?: string,
  ): Promise<UserAnalytics> {
    this.ensurePubkey(pubkey);
    return this.userAnalytics.getUserAnalytics(pubkey, this.normalizeInterval(interval));
  }

  @Get('user/:pubkey')
  async getUserAnalyticsByPubkey(
    @Param('pubkey') pubkey: string,
    @Query('refresh') refresh?: string,
  ) {
    this.ensurePubkey(pubkey);
    return this.analyticsData.getUserMetrics(pubkey, refresh === 'true');
  }

  @Get('user/:pubkey/insights')
  async getUserInsights(@Param('pubkey') pubkey: string) {
    this.ensurePubkey(pubkey);
    const metrics = await this.analyticsData.getUserMetrics(pubkey);

    const insights: string[] = [];

    if (metrics.bestHours.length > 0) {
      const bestHour = metrics.bestHours[0].hour;
      insights.push(`Your posts perform best around ${bestHour}:00 - consider posting then.`);
    }

    if (metrics.topHashtags.length > 0) {
      const topTag = metrics.topHashtags[0];
      insights.push(
        `#${topTag.tag} content gets ${Math.round(topTag.engagement / topTag.count)}x more engagement.`,
      );
    }

    if (metrics.avgNotesPerDay < 1) {
      insights.push(
        `You average ${metrics.avgNotesPerDay.toFixed(1)} posts/day. Posting daily could increase your reach.`,
      );
    }

    if (metrics.engagementRate > 5) {
      insights.push(
        `Great engagement rate of ${metrics.engagementRate.toFixed(1)}%! Your audience is highly active.`,
      );
    }

    return { metrics, insights };
  }

  @Get('network')
  async getNetworkAnalytics(@Query('interval') interval?: string): Promise<NetworkAnalytics> {
    return this.networkAnalytics.getNetworkAnalytics(this.resolveTimeRange(this.normalizeInterval(interval)));
  }

  @Get('relay/:url')
  async getRelayAnalytics(@Param('url') url: string, @Query('interval') interval?: string): Promise<RelayAnalytics> {
    return this.relayAnalytics.getRelayAnalytics(url, this.resolveTimeRange(this.normalizeInterval(interval)));
  }

  @Get('relays/rankings')
  async getRelayRankings(): Promise<RelayRanking[]> {
    return this.relayAnalytics.getRelayRankings();
  }

  @Get('wot')
  @UseGuards(PremiumGuard)
  async getWotAnalytics(@Query('pubkey') pubkey: string, @Query('interval') interval?: string): Promise<WotAnalytics> {
    this.ensurePubkey(pubkey);
    return this.wotAnalytics.getWotAnalytics(pubkey, this.resolveTimeRange(this.normalizeInterval(interval)));
  }

  @Get('topic/:hashtag')
  async getTopicAnalytics(
    @Param('hashtag') hashtag: string,
    @Query('interval') interval?: string,
  ): Promise<TopicAnalytics> {
    return this.topicAnalytics.getTopicAnalytics(hashtag, this.resolveTimeRange(this.normalizeInterval(interval)));
  }

  @Get('trending')
  async getTrending(): Promise<{ hashtags: TrendingHashtag[]; topics: TrendingTopic[]; posts: TrendingPost[] }> {
    const cacheKey = 'analytics:trending';
    const cached = await this.cacheManager.get<{ hashtags: TrendingHashtag[]; topics: TrendingTopic[]; posts: TrendingPost[] }>(cacheKey);
    if (cached) return cached;

    const [hashtags, topics, posts] = await Promise.all([
      this.networkAnalytics.getTrendingHashtags(20),
      this.topicAnalytics.getTrendingTopics(20),
      this.topicAnalytics.getTrendingPosts(20),
    ]);

    const payload = { hashtags, topics, posts };
    await this.cacheManager.set(cacheKey, payload, TRENDING_CACHE_MS);
    return payload;
  }

  private ensurePubkey(pubkey: string): void {
    if (!pubkey) {
      throw new BadRequestException('pubkey is required');
    }
  }

  private normalizeInterval(interval?: string): Interval {
    const allowed: Interval[] = ['24h', '7d', '30d', '90d', '1y', 'all'];
    if (!interval) return '30d';
    if (allowed.includes(interval as Interval)) return interval as Interval;
    throw new BadRequestException('interval must be one of 24h, 7d, 30d, 90d, 1y, all');
  }

  private resolveTimeRange(interval: Interval): TimeRange {
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
}
