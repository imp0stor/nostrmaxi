import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PremiumService {
  private readonly premiumDomain = 'nostrmaxi.com';

  constructor(private readonly prisma: PrismaService) {}

  // Check if pubkey has a registered NIP-05 on our domain
  async isPremium(pubkey: string): Promise<boolean> {
    const activeIdentity = await this.prisma.nip05.findFirst({
      where: {
        isActive: true,
        domain: this.premiumDomain,
        user: {
          pubkey,
        },
      },
      select: { id: true },
    });

    return Boolean(activeIdentity);
  }

  // Get user's NIP-05 if they have one
  async getPremiumIdentity(pubkey: string): Promise<string | null> {
    const identity = await this.prisma.nip05.findFirst({
      where: {
        isActive: true,
        domain: this.premiumDomain,
        user: {
          pubkey,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        localPart: true,
        domain: true,
      },
    });

    if (!identity) {
      return null;
    }

    return `${identity.localPart}@${identity.domain}`;
  }
}
