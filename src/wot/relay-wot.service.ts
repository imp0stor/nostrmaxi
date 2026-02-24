import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NostrService } from '../nostr/nostr.service';
import { PrismaService } from '../prisma/prisma.service';
import NDK from '@nostr-dev-kit/ndk';

/**
 * Real Web-of-Trust implementation using Nostr relay queries
 * Uses NDK for all relay operations
 */
@Injectable()
export class RelayWotService {
  private readonly logger = new Logger(RelayWotService.name);
  private trustAnchors: string[];

  constructor(
    private nostr: NostrService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    // Trust anchors - well-known pubkeys
    this.trustAnchors = this.config
      .get(
        'WOT_TRUST_ANCHORS',
        // Example: fiatjaf, jb55, ODELL, Will, preston
        '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d,' +
          '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245,' +
          '04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9',
      )
      .split(',');

    this.logger.log(`Initialized RelayWotService with ${this.trustAnchors.length} trust anchors`);
  }

  /**
   * Calculate WoT score by querying relays for follow graphs
   */
  async calculateScore(pubkey: string): Promise<{
    followersCount: number;
    followingCount: number;
    wotDepth: number;
    trustScore: number;
    isLikelyBot: boolean;
    accountAgeScore: number;
    activityScore: number;
  }> {
    try {
      const [followers, following, profile, recentActivity] = await Promise.all([
        this.getFollowers(pubkey),
        this.getFollowing(pubkey),
        this.getProfile(pubkey),
        this.getRecentActivity(pubkey),
      ]);

      const followersCount = followers.length;
      const followingCount = following.length;
      
      // Calculate WoT depth (hops to trust anchors)
      const wotDepth = await this.calculateWotDepth(pubkey, followers);
      
      // Bot detection signals
      const isLikelyBot = this.detectBot(followersCount, followingCount, recentActivity.length);
      
      // Account age score (based on oldest event)
      const accountAgeScore = this.calculateAccountAge(recentActivity);
      
      // Activity score (based on recent events)
      const activityScore = this.calculateActivityScore(recentActivity);
      
      // Trust score calculation (0-100)
      const trustScore = this.calculateTrustScore({
        followersCount,
        followingCount,
        wotDepth,
        accountAgeScore,
        activityScore,
        isLikelyBot,
      });

      return {
        followersCount,
        followingCount,
        wotDepth,
        trustScore,
        isLikelyBot,
        accountAgeScore,
        activityScore,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate WoT score for ${pubkey}: ${error.message}`);
      // Return default scores on error
      return {
        followersCount: 0,
        followingCount: 0,
        wotDepth: -1,
        trustScore: 0,
        isLikelyBot: false,
        accountAgeScore: 0,
        activityScore: 0,
      };
    }
  }

  /**
   * Get followers (pubkeys that follow this pubkey)
   */
  private async getFollowers(pubkey: string, timeoutMs = 5000): Promise<string[]> {
    try {
      const followers = await this.nostr.getUserFollowers(pubkey, 1000, timeoutMs);
      return followers;
    } catch (error) {
      this.logger.warn(`Failed to fetch followers: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Get following (pubkeys this pubkey follows)
   */
  private async getFollowing(pubkey: string, timeoutMs = 5000): Promise<string[]> {
    try {
      const following = await this.nostr.getUserFollows(pubkey, timeoutMs);
      return following;
    } catch (error) {
      this.logger.warn(`Failed to fetch following: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Get profile metadata
   */
  private async getProfile(pubkey: string): Promise<any> {
    try {
      const profile = await this.nostr.getUserProfile(pubkey);
      return profile;
    } catch (error) {
      this.logger.warn(`Failed to fetch profile: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  /**
   * Get recent activity
   */
  private async getRecentActivity(pubkey: string, days = 30): Promise<any[]> {
    try {
      const events = await this.nostr.getRecentActivity(pubkey, days);
      return events;
    } catch (error) {
      this.logger.warn(`Failed to fetch recent activity: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Calculate WoT depth (hops to trust anchors)
   */
  private async calculateWotDepth(pubkey: string, followers: string[]): Promise<number> {
    // Direct trust anchor check
    if (this.trustAnchors.includes(pubkey)) return 0;

    // Check if followed by any trust anchor
    const followedByAnchor = followers.some((f) => this.trustAnchors.includes(f));
    if (followedByAnchor) return 1;

    // For deeper WoT, would need recursive BFS
    // For MVP, limit to 2 hops
    for (const follower of followers.slice(0, 10)) {
      const followerFollowers = await this.getFollowers(follower);
      if (followerFollowers.some((f) => this.trustAnchors.includes(f))) {
        return 2;
      }
    }

    return -1; // Not in WoT
  }

  /**
   * Bot detection heuristics
   */
  private detectBot(followers: number, following: number, activityCount: number): boolean {
    // Suspicious patterns
    const followRatio = following > 0 ? followers / following : 0;
    
    // Bot signals:
    // - Very low followers with high following
    // - Perfect ratios (1:1, 2:1, etc.) with high counts
    // - No recent activity despite high counts
    
    if (followers < 10 && following > 100) return true;
    if (followers > 1000 && activityCount === 0) return true;
    if (following > 5000 && followers < 50) return true;
    
    return false;
  }

  /**
   * Calculate account age score
   */
  private calculateAccountAge(events: any[]): number {
    if (events.length === 0) return 0;
    
    const oldestEvent = Math.min(...events.map((e) => (e.created_at || e.createdAt || 0)));
    const ageInDays = (Date.now() / 1000 - oldestEvent) / (24 * 60 * 60);
    
    // Score increases with age, max at 365 days
    return Math.min(100, (ageInDays / 365) * 100);
  }

  /**
   * Calculate activity score
   */
  private calculateActivityScore(events: Event[]): number {
    if (events.length === 0) return 0;
    
    // Score based on event count in last 30 days
    // 1+ per day = 100 score
    const dailyAverage = events.length / 30;
    return Math.min(100, dailyAverage * 100);
  }

  /**
   * Calculate overall trust score
   */
  private calculateTrustScore(metrics: {
    followersCount: number;
    followingCount: number;
    wotDepth: number;
    accountAgeScore: number;
    activityScore: number;
    isLikelyBot: boolean;
  }): number {
    if (metrics.isLikelyBot) return 0;
    
    let score = 0;
    
    // Followers contribution (max 30 points)
    score += Math.min(30, metrics.followersCount / 10);
    
    // WoT depth contribution (max 30 points)
    if (metrics.wotDepth === 0) score += 30;
    else if (metrics.wotDepth === 1) score += 25;
    else if (metrics.wotDepth === 2) score += 15;
    
    // Account age contribution (max 20 points)
    score += metrics.accountAgeScore * 0.2;
    
    // Activity contribution (max 20 points)
    score += metrics.activityScore * 0.2;
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Batch WoT calculation for multiple pubkeys
   */
  async calculateBatch(pubkeys: string[]): Promise<Map<string, any>> {
    const results = new Map();
    
    // Process in parallel with limit
    const batchSize = 5;
    for (let i = 0; i < pubkeys.length; i += batchSize) {
      const batch = pubkeys.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (pubkey) => {
          const score = await this.calculateScore(pubkey);
          return [pubkey, score];
        }),
      );
      
      batchResults.forEach(([pubkey, score]) => results.set(pubkey, score));
    }
    
    return results;
  }

}
