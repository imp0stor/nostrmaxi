import { BadRequestException, Injectable } from '@nestjs/common';
import { nip19 } from 'nostr-tools';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { WotService } from '../wot/wot.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { VerifyIdentityDto } from './dto/identity.dto';

@Injectable()
export class IdentityService {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly wotService: WotService,
    private readonly webhooks: WebhooksService,
  ) {}

  async verifyIdentity(dto: VerifyIdentityDto) {
    const { pubkey, npub } = this.resolveKeys(dto.npub);
    const minScore = dto.minScore ?? 50;

    const user = await this.authService.getOrCreateUser(pubkey);
    const verification = await this.wotService.verify(pubkey, minScore);

    const result = {
      pubkey,
      npub,
      verified: verification.verified,
      score: verification.score,
      minScore,
      reason: verification.reason,
      tier: user.subscription?.tier || 'FREE',
      nip05s: user.nip05s.filter((n) => n.isActive).map((n) => `${n.localPart}@${n.domain}`),
    };

    await this.webhooks.emit('identity.verification.completed', result, dto.callbackUrl);
    return result;
  }

  async getIdentity(npubOrPubkey: string) {
    const { pubkey, npub } = this.resolveKeys(npubOrPubkey);

    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: {
        nip05s: { where: { isActive: true } },
        subscription: true,
        wotScore: true,
      },
    });

    if (!user) {
      return {
        found: false,
        pubkey,
        npub,
      };
    }

    return {
      found: true,
      pubkey: user.pubkey,
      npub: user.npub,
      createdAt: user.createdAt,
      subscription: user.subscription,
      nip05s: user.nip05s.map((n) => ({
        address: `${n.localPart}@${n.domain}`,
        createdAt: n.createdAt,
      })),
      wot: user.wotScore
        ? {
            trustScore: user.wotScore.trustScore,
            isLikelyBot: user.wotScore.isLikelyBot,
            discountPercent: user.wotScore.discountPercent,
            lastCalculated: user.wotScore.lastCalculated,
          }
        : null,
    };
  }

  private resolveKeys(value: string): { pubkey: string; npub: string } {
    if (!value) throw new BadRequestException('npub (or pubkey) is required');

    if (value.startsWith('npub1')) {
      const decoded = nip19.decode(value);
      if (decoded.type !== 'npub') throw new BadRequestException('Invalid npub');
      return { pubkey: decoded.data as string, npub: value };
    }

    if (/^[a-f0-9]{64}$/i.test(value)) {
      return { pubkey: value.toLowerCase(), npub: nip19.npubEncode(value.toLowerCase()) };
    }

    throw new BadRequestException('Invalid npub/pubkey format');
  }
}
