import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SimplePool } from 'nostr-tools';
import { canDirectlyRegisterName } from '../config/name-pricing';

// Tier limits for NIP-05 identities
const TIER_NIP05_LIMITS: Record<string, number> = {
  FREE: 0,
  PRO: 1,
  BUSINESS: 10,
  LIFETIME: 1,
};


export interface Nip05Response {
  names: Record<string, string>;
  relays?: Record<string, string[]>;
}

export type IdentitySource = 'managed' | 'external';
export type IdentityVerificationStatus = 'verified' | 'failed' | 'pending';

export interface UnifiedIdentity {
  address: string;
  localPart: string;
  domain: string;
  source: IdentitySource;
  platform: 'nostrmaxi' | 'external';
  verificationStatus: IdentityVerificationStatus;
  verified: boolean;
  verificationMessage: string;
  verifiedAt: string | null;
  createdAt: string | null;
  readOnly: boolean;
}

interface VerificationCacheEntry {
  value: {
    verified: boolean;
    status: IdentityVerificationStatus;
    message: string;
    resolvedPubkey?: string;
    verifiedAt: string;
    domain: string;
  };
  expiresAt: number;
}

@Injectable()
export class Nip05Service {
  private defaultDomain: string;
  private defaultRelays: string[];
  private nostrMetadataRelays: string[];
  private verificationCacheTtlMs: number;
  private verificationCache = new Map<string, VerificationCacheEntry>();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.defaultDomain = this.config.get('NIP05_DEFAULT_DOMAIN', 'nostrmaxi.com');
    this.defaultRelays = this.config.get('NIP05_DEFAULT_RELAYS', 
      'wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol'
    ).split(',');
    this.nostrMetadataRelays = this.config
      .get('NOSTR_PROFILE_RELAYS', 'wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net')
      .split(',')
      .map((relay: string) => relay.trim())
      .filter(Boolean);
    this.verificationCacheTtlMs = Number(this.config.get('NIP05_VERIFY_CACHE_TTL_MS', '600000'));
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
    
    // Reserved/marketplace name policy check
    const registrationPolicy = canDirectlyRegisterName(normalizedLocal);
    const dbReserved = await (this.prisma as any).reservedName?.findUnique?.({ where: { name: normalizedLocal } });
    if (!registrationPolicy.allowed || dbReserved) {
      throw new BadRequestException(registrationPolicy.message || `"${normalizedLocal}" is reserved and unavailable`);
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

    // NIP-05 is a paid-only feature
    const now = new Date();
    const tier = user.subscription?.tier || 'FREE';
    const subscriptionActive = !!user.subscription && tier !== 'FREE' && (!user.subscription.expiresAt || user.subscription.expiresAt > now);

    if (!subscriptionActive) {
      throw new ForbiddenException('NIP-05 requires an active paid subscription. Upgrade to Pro, Business, or Lifetime first.');
    }

    // Validate there is a confirmed payment backing this active subscription
    const paidReceipt = await this.prisma.payment.findFirst({
      where: {
        subscriptionId: user.subscription!.id,
        status: 'paid',
      },
      orderBy: {
        paidAt: 'desc',
      },
    });

    if (!paidReceipt) {
      throw new ForbiddenException('No confirmed payment receipt found for your subscription. Complete payment before claiming NIP-05.');
    }

    // Check tier limit
    const limit = TIER_NIP05_LIMITS[tier] || 0;
    const currentCount = user.nip05s?.length || 0;

    if (currentCount >= limit) {
      throw new ForbiddenException(
        `You've reached your NIP-05 limit (${limit}) for the ${tier} tier. Upgrade to get more identities.`
      );
    }

    // Check custom domain permission
    if (targetDomain !== this.defaultDomain) {
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
        paymentId: paidReceipt.id,
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
        details: {
          localPart: normalizedLocal,
          domain: targetDomain,
          pricing: JSON.parse(JSON.stringify(registrationPolicy.quote)),
        },
      },
    });

    return {
      address: `${normalizedLocal}@${targetDomain}`,
      pubkey: user.pubkey,
      npub: user.npub,
      createdAt: nip05.createdAt,
      pricing: registrationPolicy.quote,
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

  private parseAddress(address: string): { localPart: string; domain: string } {
    const normalized = (address || '').trim().toLowerCase();
    const [localPart, domain] = normalized.split('@');

    if (!localPart || !domain || normalized.split('@').length !== 2) {
      throw new BadRequestException(`Invalid NIP-05 address: ${address}`);
    }

    return { localPart, domain };
  }

  private async fetchExternalNip05FromKind0(pubkey: string): Promise<string | null> {
    const pool = new SimplePool();
    try {
      const event = await pool.get(this.nostrMetadataRelays, { kinds: [0], authors: [pubkey] });
      if (!event?.content) {
        return null;
      }

      const metadata = JSON.parse(event.content) as { nip05?: string };
      const nip05 = metadata?.nip05?.trim().toLowerCase();
      return nip05 || null;
    } catch {
      return null;
    } finally {
      pool.close(this.nostrMetadataRelays);
    }
  }

  async verifyAddress(address: string, expectedPubkey?: string): Promise<{
    verified: boolean;
    status: IdentityVerificationStatus;
    message: string;
    resolvedPubkey?: string;
    verifiedAt: string;
    domain: string;
  }> {
    const normalized = address.trim().toLowerCase();
    const cached = this.verificationCache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      const cacheValue = cached.value;
      if (!expectedPubkey || cacheValue.resolvedPubkey === expectedPubkey) {
        return cacheValue;
      }
    }

    const { localPart, domain } = this.parseAddress(normalized);
    const verifiedAt = new Date().toISOString();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(localPart)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const value = {
          verified: false,
          status: 'failed' as IdentityVerificationStatus,
          message: `Could not verify on ${domain} (HTTP ${response.status})`,
          verifiedAt,
          domain,
        };
        this.verificationCache.set(normalized, { value, expiresAt: Date.now() + this.verificationCacheTtlMs });
        return value;
      }

      const payload = await response.json() as { names?: Record<string, string> };
      const resolvedPubkey = payload?.names?.[localPart];

      if (!resolvedPubkey) {
        const value = {
          verified: false,
          status: 'failed' as IdentityVerificationStatus,
          message: `No NIP-05 mapping found for ${localPart}@${domain}`,
          verifiedAt,
          domain,
        };
        this.verificationCache.set(normalized, { value, expiresAt: Date.now() + this.verificationCacheTtlMs });
        return value;
      }

      if (expectedPubkey && resolvedPubkey !== expectedPubkey) {
        const value = {
          verified: false,
          status: 'failed' as IdentityVerificationStatus,
          message: `Resolved pubkey does not match your account for ${localPart}@${domain}`,
          resolvedPubkey,
          verifiedAt,
          domain,
        };
        this.verificationCache.set(normalized, { value, expiresAt: Date.now() + this.verificationCacheTtlMs });
        return value;
      }

      const value = {
        verified: true,
        status: 'verified' as IdentityVerificationStatus,
        message: `Verified on ${domain}`,
        resolvedPubkey,
        verifiedAt,
        domain,
      };
      this.verificationCache.set(normalized, { value, expiresAt: Date.now() + this.verificationCacheTtlMs });
      return value;
    } catch {
      const value = {
        verified: false,
        status: 'failed' as IdentityVerificationStatus,
        message: `Unable to verify ${localPart}@${domain} right now`,
        verifiedAt,
        domain,
      };
      this.verificationCache.set(normalized, { value, expiresAt: Date.now() + this.verificationCacheTtlMs });
      return value;
    }
  }

  async getUnifiedIdentities(pubkey: string): Promise<{ identities: UnifiedIdentity[]; managedCount: number; externalCount: number }> {
    const managed = await this.listByPubkey(pubkey);

    const managedWithVerification = await Promise.all(managed.map(async (identity) => {
      const verification = await this.verifyAddress(identity.address, pubkey);
      return {
        address: identity.address,
        localPart: identity.localPart,
        domain: identity.domain,
        source: 'managed' as IdentitySource,
        platform: 'nostrmaxi' as const,
        verificationStatus: verification.status,
        verified: verification.verified,
        verificationMessage: verification.message,
        verifiedAt: verification.verifiedAt,
        createdAt: identity.createdAt instanceof Date ? identity.createdAt.toISOString() : String(identity.createdAt),
        readOnly: false,
      };
    }));

    const externalAddress = await this.fetchExternalNip05FromKind0(pubkey);
    const external: UnifiedIdentity[] = [];

    if (externalAddress && !managed.some((m) => m.address.toLowerCase() === externalAddress.toLowerCase())) {
      const { localPart, domain } = this.parseAddress(externalAddress);
      const verification = await this.verifyAddress(externalAddress, pubkey);

      external.push({
        address: externalAddress,
        localPart,
        domain,
        source: 'external',
        platform: 'external',
        verificationStatus: verification.status,
        verified: verification.verified,
        verificationMessage: verification.message,
        verifiedAt: verification.verifiedAt,
        createdAt: null,
        readOnly: true,
      });
    }

    return {
      identities: [...managedWithVerification, ...external],
      managedCount: managedWithVerification.length,
      externalCount: external.length,
    };
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
