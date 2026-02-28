import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SimplePool } from 'nostr-tools';
import { PremiumService } from '../auth/premium.service';
import { PrismaService } from '../prisma/prisma.service';
import { WotService } from '../wot/wot.service';
import { SYNC_CONFIG } from './sync.config';

export enum SyncTier {
  PAID_USER = 1,
  PAID_USER_WOT = 2,
  COMPANY_WOT = 3,
  OWNER_WOT = 4,
  TANGENTIAL = 5,
  TRENDING = 6,
  BACKGROUND = 7,
}

export enum RetentionPolicy {
  PRIORITY = 'priority',
  BEST_EFFORT = 'best_effort',
  TEMPORARY = 'temporary',
}

export interface SyncPriority {
  pubkey: string;
  tier: SyncTier;
  retention: RetentionPolicy;
  reason: string;
}

@Injectable()
export class SyncPriorityService {
  private readonly logger = new Logger(SyncPriorityService.name);
  private readonly pool = new SimplePool();
  private readonly sourceRelays: string[];
  private readonly companyPubkeys: string[];
  private readonly ownerPubkey: string;

  constructor(
    private readonly premiumService: PremiumService,
    private readonly wotService: WotService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.sourceRelays = (this.configService.get('RELAY_SYNC_SOURCES') || 'wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net')
      .split(',')
      .map((r: string) => r.trim())
      .filter(Boolean);

    this.companyPubkeys = (this.configService.get('COMPANY_PUBKEYS') || SYNC_CONFIG.companyPubkeys.join(','))
      .split(',')
      .map((p: string) => p.trim())
      .filter(Boolean);

    this.ownerPubkey = this.configService.get('OWNER_PUBKEY') || SYNC_CONFIG.ownerPubkey;
  }

  async getPriority(pubkey: string): Promise<SyncPriority> {
    // Active paid members get highest sync priority; no permanent storage guarantees.
    if (await this.premiumService.isPremium(pubkey)) {
      return { pubkey, tier: SyncTier.PAID_USER, retention: RetentionPolicy.PRIORITY, reason: 'paid_user_active' };
    }

    if (await this.isInPaidUsersWot(pubkey)) {
      return { pubkey, tier: SyncTier.PAID_USER_WOT, retention: RetentionPolicy.PRIORITY, reason: 'paid_user_wot' };
    }

    if (this.companyPubkeys.includes(pubkey)) {
      return { pubkey, tier: SyncTier.COMPANY_WOT, retention: RetentionPolicy.PRIORITY, reason: 'company_account' };
    }

    if (await this.isInCompanyWot(pubkey)) {
      return { pubkey, tier: SyncTier.COMPANY_WOT, retention: RetentionPolicy.PRIORITY, reason: 'company_wot' };
    }

    if (await this.isInOwnerWot(pubkey)) {
      return { pubkey, tier: SyncTier.OWNER_WOT, retention: RetentionPolicy.BEST_EFFORT, reason: 'owner_wot' };
    }

    if (await this.isTangential(pubkey)) {
      return { pubkey, tier: SyncTier.TANGENTIAL, retention: RetentionPolicy.BEST_EFFORT, reason: 'tangential' };
    }

    return { pubkey, tier: SyncTier.BACKGROUND, retention: RetentionPolicy.TEMPORARY, reason: 'background' };
  }

  private async isInPaidUsersWot(pubkey: string): Promise<boolean> {
    const premiumDomain = this.configService.get('PREMIUM_DOMAIN') || 'nostrmaxi.com';
    const paidUsers = await this.prisma.user.findMany({
      where: {
        nip05s: {
          some: {
            isActive: true,
            domain: premiumDomain,
          },
        },
      },
      select: { pubkey: true },
      take: 200,
    });

    if (paidUsers.length === 0) return false;

    return this.isFollowedByAny(pubkey, paidUsers.map((u) => u.pubkey));
  }

  private async isInCompanyWot(pubkey: string): Promise<boolean> {
    if (!this.companyPubkeys.length) return false;
    return this.isFollowedByAny(pubkey, this.companyPubkeys);
  }

  private async isInOwnerWot(pubkey: string): Promise<boolean> {
    if (!this.ownerPubkey) return false;
    return this.isFollowedByAny(pubkey, [this.ownerPubkey]);
  }

  private async isTangential(pubkey: string): Promise<boolean> {
    const roots = await this.getRootPubkeys();
    if (roots.length === 0) return false;

    const firstHop = await this.getFollowSet(roots);
    if (firstHop.has(pubkey)) return true;

    const hopCandidates = Array.from(firstHop).slice(0, 200);
    const secondHop = await this.getFollowSet(hopCandidates);
    return secondHop.has(pubkey);
  }

  async getPriorityPubkeys(): Promise<SyncPriority[]> {
    const roots = await this.getRootPubkeys();
    const firstHop = await this.getFollowSet(roots);

    const candidates = new Set<string>([...roots, ...Array.from(firstHop)]);
    const priorities = await Promise.all(Array.from(candidates).map((pubkey) => this.getPriority(pubkey)));

    return priorities.sort((a, b) => a.tier - b.tier);
  }

  private async getRootPubkeys(): Promise<string[]> {
    const premiumDomain = this.configService.get('PREMIUM_DOMAIN') || 'nostrmaxi.com';
    const activePaid = await this.prisma.user.findMany({
      where: {
        nip05s: {
          some: {
            isActive: true,
            domain: premiumDomain,
          },
        },
      },
      select: { pubkey: true },
      take: 200,
    });

    const roots = new Set<string>([
      ...activePaid.map((u) => u.pubkey),
      ...this.companyPubkeys,
      ...(this.ownerPubkey ? [this.ownerPubkey] : []),
    ]);

    return Array.from(roots);
  }

  private async isFollowedByAny(targetPubkey: string, authors: string[]): Promise<boolean> {
    if (!authors.length) return false;

    try {
      const contacts = await this.pool.querySync(this.sourceRelays, {
        kinds: [3],
        authors: authors.slice(0, 250),
        limit: Math.max(authors.length * 3, 200),
      } as any);

      return contacts.some((event: any) =>
        (event.tags || []).some((tag: string[]) => tag[0] === 'p' && tag[1] === targetPubkey),
      );
    } catch (error) {
      this.logger.warn(`Failed WoT follow check: ${(error as Error).message}`);
      return false;
    }
  }

  private async getFollowSet(authors: string[]): Promise<Set<string>> {
    const result = new Set<string>();
    if (!authors.length) return result;

    try {
      const contacts = await this.pool.querySync(this.sourceRelays, {
        kinds: [3],
        authors: authors.slice(0, 250),
        limit: Math.max(authors.length * 3, 200),
      } as any);

      for (const event of contacts as any[]) {
        for (const tag of event.tags || []) {
          if (tag[0] === 'p' && tag[1]) {
            result.add(tag[1]);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed WoT follow set fetch: ${(error as Error).message}`);
    }

    return result;
  }
}
