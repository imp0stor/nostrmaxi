import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { nip19, SimplePool } from 'nostr-tools';

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
  private relays: string[];

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.wellKnownPubkeys = this.config.get('WOT_TRUST_ANCHORS', '').split(',').map((s: string) => s.trim()).filter(Boolean);
    this.relays = this.config.get('WOT_RELAYS', 'wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net')
      .split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  async getScore(pubkey: string): Promise<WotScoreResponse> {
    const user = await this.prisma.user.findUnique({ where: { pubkey }, include: { wotScore: true } });
    if (!user || !user.wotScore) {
      return { pubkey, npub: nip19.npubEncode(pubkey), trustScore: 0, followersCount: 0, followingCount: 0, wotDepth: -1, isLikelyBot: false, discountPercent: 0, lastCalculated: new Date(0) };
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

  async verify(pubkey: string, minScore = 50): Promise<{ verified: boolean; score: number; reason?: string }> {
    const score = await this.getScore(pubkey);
    if (score.isLikelyBot) return { verified: false, score: score.trustScore, reason: 'Account flagged as likely bot' };
    if (score.trustScore < minScore) return { verified: false, score: score.trustScore, reason: `Trust score ${score.trustScore} below threshold ${minScore}` };
    return { verified: true, score: score.trustScore };
  }

  async getNetwork(pubkey: string, depth = 1): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { pubkey } });
    if (!user) throw new NotFoundException('User not found');

    const pool = new SimplePool();
    try {
      const selfContact = await pool.get(this.relays, { kinds: [3], authors: [pubkey] });
      const following = (selfContact?.tags || []).filter((t) => t[0] === 'p' && t[1]).map((t) => t[1]);
      const followerEvents = await pool.querySync(this.relays, { kinds: [3], '#p': [pubkey], limit: 500 } as any);
      const followers = [...new Set(followerEvents.map((e) => e.pubkey))];
      return {
        pubkey,
        npub: user.npub,
        depth,
        followersCount: followers.length,
        followingCount: following.length,
        wotDepth: depth,
        followers: followers.slice(0, 50),
        following: following.slice(0, 50),
      };
    } finally {
      pool.close(this.relays);
    }
  }

  private estimateDepth(pubkey: string, following: string[]): number {
    if (this.wellKnownPubkeys.includes(pubkey)) return 0;
    if (following.some((pk) => this.wellKnownPubkeys.includes(pk))) return 1;
    return following.length > 0 ? 2 : 3;
  }

  async recalculate(pubkey: string): Promise<WotScoreResponse> {
    let user = await this.prisma.user.findUnique({ where: { pubkey }, include: { wotScore: true } });
    if (!user) {
      user = await this.prisma.user.create({ data: { pubkey, npub: nip19.npubEncode(pubkey), wotScore: { create: {} } }, include: { wotScore: true } });
    }

    const pool = new SimplePool();
    let followersCount = 0;
    let followingCount = 0;
    let wotDepth = 3;
    let recentNotes = 0;

    try {
      const selfContact = await pool.get(this.relays, { kinds: [3], authors: [pubkey] });
      const following = (selfContact?.tags || []).filter((t) => t[0] === 'p' && t[1]).map((t) => t[1]);
      followingCount = following.length;
      wotDepth = this.estimateDepth(pubkey, following);

      const followers = await pool.querySync(this.relays, { kinds: [3], '#p': [pubkey], limit: 1000 } as any);
      followersCount = new Set(followers.map((e) => e.pubkey)).size;

      const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
      const notes = await pool.querySync(this.relays, { kinds: [1], authors: [pubkey], since: weekAgo, limit: 200 });
      recentNotes = notes.length;
    } finally {
      pool.close(this.relays);
    }

    const followerScore = Math.min(45, Math.log10(Math.max(1, followersCount)) * 18);
    const followingScore = Math.min(20, Math.log10(Math.max(1, followingCount)) * 10);
    const depthScore = Math.max(0, 20 - wotDepth * 5);
    const activityScore = Math.min(15, recentNotes * 1.2);
    const trustScore = Math.max(0, Math.min(100, Math.round(followerScore + followingScore + depthScore + activityScore)));
    const isLikelyBot = recentNotes > 150 || (followingCount > 3000 && followersCount < 10);

    const wotScore = await this.prisma.wotScore.update({
      where: { userId: user.id },
      data: {
        followersCount,
        followingCount,
        wotDepth,
        trustScore,
        isLikelyBot,
        discountPercent: trustScore > 80 ? 20 : trustScore > 55 ? 10 : 0,
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
