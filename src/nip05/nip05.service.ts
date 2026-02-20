import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

// Tier limits for NIP-05 identities
const TIER_NIP05_LIMITS: Record<string, number> = {
  FREE: 1,
  PRO: 1,
  BUSINESS: 10,
  LIFETIME: 1,
};

// ⭐ RESERVED NIP-05 NAMES
const RESERVED_NAMES = new Set([
  'admin', 'administrator', 'root', 'postmaster', 'noreply', 'no-reply',
  'support', 'info', 'contact', 'webmaster', 'security', 'abuse',
  'api', 'www', 'mail', 'ftp', 'smtp', 'pop', 'imap',
  '_domainkey', '_dmarc', 'dmarc', 'autoconfig', 'autodiscover',
  'help', 'sales', 'billing', 'feedback', 'hello', 'welcome'
]);

export interface Nip05Response {
  names: Record<string, string>;
  relays?: Record<string, string[]>;
}

@Injectable()
export class Nip05Service {
  private defaultDomain: string;
  private defaultRelays: string[];

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.defaultDomain = this.config.get('NIP05_DEFAULT_DOMAIN', 'nostrmaxi.com');
    this.defaultRelays = this.config.get('NIP05_DEFAULT_RELAYS', 
      'wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol'
    ).split(',');
  }

  /**
   * Standard NIP-05 lookup (/.well-known/nostr.json)
   */
  async lookup(name: string, domain?: string): Promise<Nip05Response> {
    const targetDomain = domain || this.defaultDomain;
    
    const nip05 = await this.prisma.nip05.findFirst({
      where: {
        localPart: name.toLowerCase(),
        domain: targetDomain,
        isActive: true,
      },
      include: {
        user: true,
      },
    });

    if (!nip05) {
      throw new NotFoundException(`NIP-05 identity not found: ${name}@${targetDomain}`);
    }

    return {
      names: {
        [name]: nip05.user.pubkey,
      },
      relays: {
        [nip05.user.pubkey]: this.defaultRelays,
      },
    };
  }

  /**
   * Provision a new NIP-05 identity
   */
  async provision(pubkey: string, localPart: string, domain?: string) {
    const targetDomain = domain || this.defaultDomain;
    
    // ⭐ IMPROVED SANITIZATION
    const normalizedLocal = localPart
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '');  // Only alphanumeric, underscore, and hyphen
    
    // Length validation
    if (normalizedLocal.length < 2) {
      throw new BadRequestException('Local part must be at least 2 characters');
    }
    
    if (normalizedLocal.length > 32) {
      throw new BadRequestException('Local part must be at most 32 characters');
    }
    
    // Format validation
    if (normalizedLocal.startsWith('-') || normalizedLocal.endsWith('-')) {
      throw new BadRequestException('Local part cannot start or end with hyphen');
    }
    
    if (normalizedLocal.includes('--')) {
      throw new BadRequestException('Local part cannot contain consecutive hyphens');
    }
    
    // Reserved names check
    if (RESERVED_NAMES.has(normalizedLocal)) {
      throw new BadRequestException(`"${normalizedLocal}" is a reserved name`);
    }

    // Check if already taken
    const existing = await this.prisma.nip05.findFirst({
      where: {
        localPart: normalizedLocal,
        domain: targetDomain,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException(`${normalizedLocal}@${targetDomain} is already taken`);
    }

    // Get or create user
    let user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: {
        subscription: true,
        nip05s: { where: { isActive: true } },
      },
    });
    
    if (!user) {
      const { nip19 } = await import('nostr-tools');
      user = await this.prisma.user.create({
        data: {
          pubkey,
          npub: nip19.npubEncode(pubkey),
          subscription: {
            create: { tier: 'FREE' },
          },
        },
        include: {
          subscription: true,
          nip05s: { where: { isActive: true } },
        },
      });
    }

    // Check tier limit
    const tier = user.subscription?.tier || 'FREE';
    const limit = TIER_NIP05_LIMITS[tier] || 1;
    const currentCount = user.nip05s?.length || 0;

    if (currentCount >= limit) {
      throw new ForbiddenException(
        `You've reached your NIP-05 limit (${limit}) for the ${tier} tier. Upgrade to get more identities.`
      );
    }

    // Check custom domain permission
    if (targetDomain !== this.defaultDomain) {
      if (tier === 'FREE') {
        throw new ForbiddenException('Custom domains require a Pro or higher subscription.');
      }
      
      // Verify domain ownership
      const domainRecord = await this.prisma.domain.findFirst({
        where: {
          domain: targetDomain,
          ownerPubkey: pubkey,
          verified: true,
        },
      });

      if (!domainRecord) {
        throw new ForbiddenException(`Domain ${targetDomain} is not verified for your account.`);
      }
    }

    // Create NIP-05
    const nip05 = await this.prisma.nip05.create({
      data: {
        localPart: normalizedLocal,
        domain: targetDomain,
        userId: user.id,
      },
      include: {
        user: true,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'nip05.provision',
        entity: 'Nip05',
        entityId: nip05.id,
        actorPubkey: pubkey,
        details: { localPart: normalizedLocal, domain: targetDomain },
      },
    });

    return {
      address: `${normalizedLocal}@${targetDomain}`,
      pubkey: user.pubkey,
      npub: user.npub,
      createdAt: nip05.createdAt,
    };
  }

  /**
   * Delete a NIP-05 identity
   */
  async delete(pubkey: string, localPart: string, domain?: string) {
    const targetDomain = domain || this.defaultDomain;

    const nip05 = await this.prisma.nip05.findFirst({
      where: {
        localPart: localPart.toLowerCase(),
        domain: targetDomain,
        user: { pubkey },
      },
    });

    if (!nip05) {
      throw new NotFoundException('NIP-05 identity not found or not owned by you');
    }

    await this.prisma.nip05.update({
      where: { id: nip05.id },
      data: { isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'nip05.delete',
        entity: 'Nip05',
        entityId: nip05.id,
        actorPubkey: pubkey,
      },
    });

    return { deleted: true };
  }

  /**
   * List NIP-05 identities for a pubkey
   */
  async listByPubkey(pubkey: string) {
    const nip05s = await this.prisma.nip05.findMany({
      where: {
        user: { pubkey },
        isActive: true,
      },
    });

    return nip05s.map((n) => ({
      address: `${n.localPart}@${n.domain}`,
      localPart: n.localPart,
      domain: n.domain,
      createdAt: n.createdAt,
    }));
  }

  /**
   * Verify a domain for custom NIP-05
   */
  async verifyDomain(pubkey: string, domain: string) {
    // Get or create domain record
    let domainRecord = await this.prisma.domain.findUnique({ where: { domain } });

    if (!domainRecord) {
      const verifyToken = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');
      domainRecord = await this.prisma.domain.create({
        data: {
          domain,
          ownerPubkey: pubkey,
          verifyToken,
        },
      });
    }

    if (domainRecord.ownerPubkey !== pubkey) {
      throw new BadRequestException('Domain owned by another user');
    }

    // Return verification instructions
    return {
      domain,
      verified: domainRecord.verified,
      instructions: domainRecord.verified ? null : {
        type: 'TXT',
        name: '_nostrmaxi',
        value: `nostrmaxi-verify=${domainRecord.verifyToken}`,
      },
    };
  }
}
