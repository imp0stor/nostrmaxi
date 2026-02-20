import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface WotScoreResponse {
  pubkey: string;
  npub: string;
  trustScore: number;
  followersCount: number;
  followingCount: number;
  wotDepth: number;
  isLikelyBot: boolean;
  discountPercent: number;
  lastCalculated: Date;
}

@Injectable()
export class WotService {
  private wellKnownPubkeys: string[];

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    // Well-known Nostr accounts used as trust anchors
    this.wellKnownPubkeys = this.config.get('WOT_TRUST_ANCHORS', 
      // Default: fiatjaf, jb55, ODELL (example pubkeys)
      'a5c7...,32e1...,04c9...'
    ).split(',');
  }

  /**
   * Get WoT score for a pubkey
   */
  async getScore(pubkey: string): Promise<WotScoreResponse> {
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { wotScore: true },
    });

    if (!user || !user.wotScore) {
      // Return default scores for unknown users
      return {
        pubkey,
        npub: '',
        trustScore: 0,
        followersCount: 0,
        followingCount: 0,
        wotDepth: -1,
        isLikelyBot: false,
        discountPercent: 0,
        lastCalculated: new Date(0),
      };
    }

    return {
      pubkey: user.pubkey,
      npub: user.npub,
      trustScore: user.wotScore.trustScore,
      followersCount: user.wotScore.followersCount,
      followingCount: user.wotScore.followingCount,
      wotDepth: user.wotScore.wotDepth,
      isLikelyBot: user.wotScore.isLikelyBot,
      discountPercent: user.wotScore.discountPercent,
      lastCalculated: user.wotScore.lastCalculated,
    };
  }

  /**
   * Verify if a pubkey is trusted (WoT score > threshold)
   */
  async verify(pubkey: string, minScore = 50): Promise<{ verified: boolean; score: number; reason?: string }> {
    const score = await this.getScore(pubkey);

    if (score.isLikelyBot) {
      return { verified: false, score: score.trustScore, reason: 'Account flagged as likely bot' };
    }

    if (score.trustScore < minScore) {
      return { verified: false, score: score.trustScore, reason: `Trust score ${score.trustScore} below threshold ${minScore}` };
    }

    return { verified: true, score: score.trustScore };
  }

  /**
   * Get WoT network (followers/following) for a pubkey
   */
  async getNetwork(pubkey: string, depth = 1): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { wotScore: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // In a real implementation, this would query Nostr relays for follow lists
    // For now, return the stored score data
    return {
      pubkey,
      npub: user.npub,
      depth,
      followersCount: user.wotScore?.followersCount || 0,
      followingCount: user.wotScore?.followingCount || 0,
      wotDepth: user.wotScore?.wotDepth || -1,
      // In production: followers: [...], following: [...]
    };
  }

  /**
   * Recalculate WoT score for a user
   * In production, this would query Nostr relays
   */
  async recalculate(pubkey: string): Promise<WotScoreResponse> {
    let user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { wotScore: true },
    });

    if (!user) {
      const { nip19 } = await import('nostr-tools');
      user = await this.prisma.user.create({
        data: {
          pubkey,
          npub: nip19.npubEncode(pubkey),
          wotScore: { create: {} },
        },
        include: { wotScore: true },
      });
    }

    // TODO: In production, query relays for:
    // 1. Follower count (kind 3 events mentioning this pubkey)
    // 2. Following count (kind 3 event from this pubkey)
    // 3. WoT depth (hops to trust anchors)
    // 4. Account activity (recent events)
    // 5. Bot detection signals

    // For now, use placeholder calculation
    const mockFollowers = Math.floor(Math.random() * 1000);
    const mockFollowing = Math.floor(Math.random() * 500);
    const mockWotDepth = Math.floor(Math.random() * 5);
    const trustScore = Math.min(100, (mockFollowers / 10) + (mockWotDepth < 3 ? 20 : 0));

    const wotScore = await this.prisma.wotScore.update({
      where: { userId: user.id },
      data: {
        followersCount: mockFollowers,
        followingCount: mockFollowing,
        wotDepth: mockWotDepth,
        trustScore,
        discountPercent: trustScore > 80 ? 20 : trustScore > 50 ? 10 : 0,
        lastCalculated: new Date(),
      },
    });

    return {
      pubkey: user.pubkey,
      npub: user.npub,
      trustScore: wotScore.trustScore,
      followersCount: wotScore.followersCount,
      followingCount: wotScore.followingCount,
      wotDepth: wotScore.wotDepth,
      isLikelyBot: wotScore.isLikelyBot,
      discountPercent: wotScore.discountPercent,
      lastCalculated: wotScore.lastCalculated,
    };
  }
}
