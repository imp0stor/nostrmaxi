import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { WotService } from '../wot/wot.service';
import { SYNC_CONFIG } from './sync.config';

export interface NoiseCheckResult {
  isNoise: boolean;
  reason?: string;
  confidence: number;
}

@Injectable()
export class NoiseFilterService {
  private readonly pool = new SimplePool();
  private readonly sourceRelays: string[];

  private readonly SPAM_PATTERNS = [
    /buy.*followers/i,
    /free.*bitcoin/i,
    /click.*here.*now/i,
    /airdrop.*claim/i,
    /dm.*for.*profit/i,
  ];

  constructor(
    private readonly wotService: WotService,
    private readonly configService: ConfigService,
  ) {
    this.sourceRelays = (this.configService.get('RELAY_SYNC_SOURCES') || 'wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net')
      .split(',')
      .map((r: string) => r.trim())
      .filter(Boolean);
  }

  async isNoise(event: NostrEvent): Promise<NoiseCheckResult> {
    const followerCount = await this.getFollowerCount(event.pubkey);
    if (followerCount < SYNC_CONFIG.minFollowersForSync) {
      return { isNoise: true, reason: 'zero_followers', confidence: 0.7 };
    }

    if (this.matchesSpamPattern(event.content || '')) {
      return { isNoise: true, reason: 'spam_pattern', confidence: 0.9 };
    }

    if (await this.isOnSpamList(event.pubkey)) {
      return { isNoise: true, reason: 'spam_list', confidence: 0.95 };
    }

    if (await this.isRepetitiveContent(event)) {
      return { isNoise: true, reason: 'repetitive', confidence: 0.8 };
    }

    const wotScore = await this.getWotScore(event.pubkey);
    if (wotScore < SYNC_CONFIG.minWotScoreForSync) {
      return { isNoise: true, reason: 'low_wot', confidence: 0.6 };
    }

    return { isNoise: false, confidence: 0 };
  }

  private matchesSpamPattern(content: string): boolean {
    return this.SPAM_PATTERNS.some((pattern) => pattern.test(content));
  }

  private async getFollowerCount(pubkey: string): Promise<number> {
    try {
      const followers = await this.pool.querySync(this.sourceRelays, {
        kinds: [3],
        '#p': [pubkey],
        limit: 300,
      } as any);

      return new Set((followers as any[]).map((event) => event.pubkey)).size;
    } catch {
      return 0;
    }
  }

  private async isOnSpamList(pubkey: string): Promise<boolean> {
    const spamList = (this.configService.get('SPAM_PUBKEYS') || '')
      .split(',')
      .map((p: string) => p.trim())
      .filter(Boolean);

    return spamList.includes(pubkey);
  }

  private async isRepetitiveContent(event: NostrEvent): Promise<boolean> {
    const normalized = this.normalizeContent(event.content || '');
    if (!normalized) return false;

    try {
      const history = await this.pool.querySync(this.sourceRelays, {
        kinds: [1],
        authors: [event.pubkey],
        since: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
        limit: 50,
      } as any);

      let duplicates = 0;
      for (const item of history as NostrEvent[]) {
        if (this.normalizeContent(item.content || '') === normalized) {
          duplicates++;
        }
        if (duplicates >= 5) return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  private async getWotScore(pubkey: string): Promise<number> {
    try {
      const score = await this.wotService.getScore(pubkey);
      return score.trustScore / 100;
    } catch {
      return 0.5;
    }
  }

  private normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
