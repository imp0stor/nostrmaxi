import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NostrService } from '../nostr/nostr.service';
import { WotService } from '../wot/wot.service';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';

export interface FeedConfig {
  pubkey: string;
  contentTypes: string[]; // "episode", "show", "note", "product", "bounty", "qa"
  filterMode: 'wot' | 'genuine' | 'firehose'; // Web of Trust, genuine (low-bot), all
  wotDepth: number; // 1-5
  sortBy: 'newest' | 'oldest' | 'popular' | 'trending'; // For MVP, implement newest
  limit: number;
  offset: number;
}

export interface FeedItem {
  id: string;
  kind: number;
  pubkey: string;
  createdAt: number;
  title?: string;
  summary?: string;
  content: string;
  tags: string[][];
  url?: string;
  image?: string;
  duration?: number; // For episodes
  wotScore?: number; // Trust score of author
  isLikelyBot?: boolean;
}

/**
 * Feed generation service
 * Generates personalized feeds based on WoT, content types, and user preferences
 */
@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private prisma: PrismaService,
    private nostr: NostrService,
    private wot: WotService,
  ) {}

  /**
   * Generate personalized feed
   */
  async generateFeed(userPubkey: string, config: Partial<FeedConfig>): Promise<FeedItem[]> {
    const feedConfig = this.normalizeFeedConfig(userPubkey, config);

    // Get user's trust network for WoT filtering
    let trustedPubkeys: string[] | null = null;
    if (feedConfig.filterMode === 'wot') {
      trustedPubkeys = await this.getUserTrustNetwork(userPubkey, feedConfig.wotDepth);
    }

    // Fetch events of specified content types
    const events = await this.fetchContentEvents(feedConfig, trustedPubkeys);

    // Score and filter events
    const scoredEvents = await this.scoreEvents(events, userPubkey, feedConfig);

    // Sort
    const sorted = this.sortEvents(scoredEvents, feedConfig.sortBy);

    // Paginate
    const paginated = sorted.slice(feedConfig.offset, feedConfig.offset + feedConfig.limit);

    return paginated;
  }

  /**
   * Get user's trust network (followers within depth)
   */
  private async getUserTrustNetwork(userPubkey: string, depth: number): Promise<string[]> {
    const network = new Set<string>();
    network.add(userPubkey);

    let currentLayer = [userPubkey];
    for (let i = 0; i < depth; i++) {
      const nextLayer = new Set<string>();
      for (const pubkey of currentLayer) {
        try {
          const follows = await this.nostr.getUserFollows(pubkey, 3000);
          follows.forEach((pk) => {
            if (!network.has(pk)) {
              nextLayer.add(pk);
              network.add(pk);
            }
          });
        } catch (error) {
          this.logger.warn(`Failed to fetch follows for ${pubkey}: ${error instanceof Error ? error.message : error}`);
        }
      }
      currentLayer = Array.from(nextLayer);
    }

    return Array.from(network);
  }

  /**
   * Fetch content events based on type filters
   */
  private async fetchContentEvents(config: FeedConfig, trustedPubkeys: string[] | null): Promise<NDKEvent[]> {
    const events: NDKEvent[] = [];
    const kindMap: Record<string, number> = {
      episode: 31901,
      show: 31900,
      note: 1,
      product: 30018,
      bounty: 31903,
      qa: 31905,
    };

    const kinds = config.contentTypes.map((type) => kindMap[type]).filter(Boolean) as any[];
    if (kinds.length === 0) {
      return [];
    }

    const past24h = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    try {
      // Fetch from relays
      const results = await this.nostr.queryEvents(
        {
          kinds,
          since: past24h,
          limit: 100,
          ...(trustedPubkeys && trustedPubkeys.length > 0 && { authors: trustedPubkeys }),
        },
        5000,
      );

      events.push(...results);
    } catch (error) {
      this.logger.error(`Failed to fetch content events: ${error instanceof Error ? error.message : error}`);
    }

    return events;
  }

  /**
   * Score events based on WoT and other signals
   */
  private async scoreEvents(events: NDKEvent[], userPubkey: string, config: FeedConfig): Promise<(FeedItem & { score: number })[]> {
    const scored: (FeedItem & { score: number })[] = [];

    for (const event of events) {
      const item = this.parseEvent(event);
      let score = 50; // Base score

      // WoT scoring
      if (config.filterMode !== 'firehose') {
        try {
          const wotScore = await this.wot.getScore(event.pubkey);
          score += wotScore.trustScore;

          // Filter out likely bots if using genuine filter
          if (config.filterMode === 'genuine' && wotScore.isLikelyBot) {
            continue;
          }

          item.wotScore = wotScore.trustScore;
          item.isLikelyBot = wotScore.isLikelyBot;
        } catch (error) {
          this.logger.debug(`Failed to get WoT score for ${event.pubkey}: ${error instanceof Error ? error.message : error}`);
        }
      }

      // Engagement signals (zaps, replies, etc.)
      // TODO: Implement when event stats available
      const tagCount = event.tags.length;
      score += Math.min(10, tagCount / 5); // Small boost for engagement

      scored.push({ ...item, score });
    }

    return scored;
  }

  /**
   * Sort events by specified order
   */
  private sortEvents(events: (FeedItem & { score: number })[], sortBy: string): (FeedItem & { score: number })[] {
    switch (sortBy) {
      case 'newest':
        return events.sort((a, b) => b.createdAt - a.createdAt);
      case 'oldest':
        return events.sort((a, b) => a.createdAt - b.createdAt);
      case 'popular':
      case 'trending':
        return events.sort((a, b) => b.score - a.score);
      default:
        return events.sort((a, b) => b.createdAt - a.createdAt);
    }
  }

  /**
   * Parse NDK event to FeedItem
   */
  private parseEvent(event: NDKEvent): FeedItem {
    const getTag = (name: string) => event.tags.find((t) => t[0] === name)?.[1];

    return {
      id: event.id || event.tagId() || event.pubkey,
      kind: event.kind || 1,
      pubkey: event.pubkey,
      createdAt: event.created_at || Math.floor(Date.now() / 1000),
      title: getTag('title') || getTag('subject'),
      summary: getTag('summary'),
      content: event.content || '',
      tags: event.tags || [],
      url: getTag('url'),
      image: getTag('image'),
      duration: getTag('duration') ? parseInt(getTag('duration')!) : undefined,
    };
  }

  /**
   * Normalize feed config with defaults
   */
  private normalizeFeedConfig(userPubkey: string, partial: Partial<FeedConfig>): FeedConfig {
    return {
      pubkey: userPubkey,
      contentTypes: partial.contentTypes || ['episode', 'note', 'show'],
      filterMode: partial.filterMode || 'wot',
      wotDepth: partial.wotDepth || 2,
      sortBy: partial.sortBy || 'newest',
      limit: Math.min(partial.limit || 20, 100),
      offset: partial.offset || 0,
    };
  }

  /**
   * Save user feed configuration
   */
  async saveFeedConfig(userPubkey: string, config: Partial<FeedConfig>): Promise<void> {
    // TODO: Implement when FeedConfig DB model is added
  }

  /**
   * Get saved feed configurations for user
   */
  async getSavedFeeds(userPubkey: string): Promise<FeedConfig[]> {
    // TODO: Implement when FeedConfig DB model is added
    return [];
  }
}
