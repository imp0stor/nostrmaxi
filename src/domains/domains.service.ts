import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { promises as dns } from 'dns';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type TxtResolver = (hostname: string) => Promise<string[][]>;

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txtResolver: TxtResolver = dns.resolveTxt,
  ) {}

  private normalizeDomain(domain: string): string {
    return domain.trim().toLowerCase();
  }

  private async getUserByPubkey(pubkey: string) {
    const user = await this.prisma.user.findUnique({ where: { pubkey } });
    if (!user) {
      throw new NotFoundException('Authenticated user was not found');
    }
    return user;
  }

  async createDomain(pubkey: string, payload: { domain: string; lightningName?: string }) {
    const user = await this.getUserByPubkey(pubkey);
    const domain = this.normalizeDomain(payload.domain);
    const token = randomBytes(16).toString('hex');

    const existing = await this.prisma.domain.findUnique({ where: { domain } });
    if (existing && existing.userId !== user.id) {
      throw new BadRequestException('Domain is already claimed by another user');
    }

    const created = existing
      ? await this.prisma.domain.update({
          where: { id: existing.id },
          data: {
            verifyToken: existing.verifyToken || token,
            lightningName: payload.lightningName?.toLowerCase(),
          },
        })
      : await this.prisma.domain.create({
          data: {
            domain,
            userId: user.id,
            ownerPubkey: pubkey,
            verifyToken: token,
            lightningName: payload.lightningName?.toLowerCase(),
          },
        });

    return {
      ...created,
      instructions: {
        type: 'TXT',
        name: domain,
        value: `nostrmaxi-verify=${created.verifyToken}`,
      },
    };
  }

  async listDomains(pubkey: string) {
    const user = await this.getUserByPubkey(pubkey);
    return this.prisma.domain.findMany({
      where: { userId: user.id },
      include: { site: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyDomain(pubkey: string, id: string) {
    const user = await this.getUserByPubkey(pubkey);
    const domain = await this.prisma.domain.findFirst({ where: { id, userId: user.id } });

    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    if (!domain.verifyToken) {
      throw new BadRequestException('Domain verification token missing');
    }

    const records = await this.txtResolver(domain.domain).catch(() => [] as string[][]);
    const expectedValue = `nostrmaxi-verify=${domain.verifyToken}`;
    const match = records.some((chunks) => chunks.join('').trim() === expectedValue);

    if (!match) {
      return {
        verified: false,
        domain: domain.domain,
        message: 'TXT record not found yet. Add the record and retry.',
        expected: expectedValue,
      };
    }

    const verified = await this.prisma.domain.update({
      where: { id: domain.id },
      data: { verified: true },
    });

    return {
      verified: true,
      domain: verified.domain,
      message: 'Domain verified successfully',
    };
  }

  async deleteDomain(pubkey: string, id: string) {
    const user = await this.getUserByPubkey(pubkey);
    const domain = await this.prisma.domain.findFirst({ where: { id, userId: user.id } });
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    await this.prisma.domain.delete({ where: { id: domain.id } });
    return { deleted: true, id: domain.id };
  }

  async setLightningName(pubkey: string, id: string, lightningName: string) {
    const user = await this.getUserByPubkey(pubkey);
    const domain = await this.prisma.domain.findFirst({ where: { id, userId: user.id } });
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }
    if (!domain.verified) {
      throw new BadRequestException('Verify domain before assigning lightning name');
    }

    return this.prisma.domain.update({
      where: { id: domain.id },
      data: { lightningName: lightningName.toLowerCase() },
    });
  }

  async getAnalytics(pubkey: string, id: string) {
    const user = await this.getUserByPubkey(pubkey);
    const domain = await this.prisma.domain.findFirst({
      where: { id, userId: user.id },
      include: { site: true },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    return {
      domainId: domain.id,
      domain: domain.domain,
      verified: domain.verified,
      views: domain.site?.views ?? 0,
      template: domain.site?.template ?? null,
      updatedAt: domain.site?.updatedAt ?? domain.updatedAt,
    };
  }

  async upsertSite(pubkey: string, domainId: string, payload: { template?: string; config?: Record<string, unknown> }) {
    const user = await this.getUserByPubkey(pubkey);
    const domain = await this.prisma.domain.findFirst({ where: { id: domainId, userId: user.id } });
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    return this.prisma.site.upsert({
      where: { domainId },
      update: {
        template: payload.template,
        config: payload.config,
      },
      create: {
        userId: user.id,
        domainId,
        template: payload.template || 'personal',
        config: payload.config || {},
      },
    });
  }

  async getSite(pubkey: string, domainId: string) {
    const user = await this.getUserByPubkey(pubkey);
    const domain = await this.prisma.domain.findFirst({
      where: { id: domainId, userId: user.id },
      include: { site: true },
    });
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }
    return domain.site;
  }

  async deleteSite(pubkey: string, domainId: string) {
    const user = await this.getUserByPubkey(pubkey);
    const domain = await this.prisma.domain.findFirst({ where: { id: domainId, userId: user.id } });
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    await this.prisma.site.deleteMany({ where: { domainId } });
    return { deleted: true, domainId };
  }

  async resolveLnurl(host: string, name: string) {
    const domain = host.split(':')[0].toLowerCase();
    const localName = name.toLowerCase();

    const record = await this.prisma.domain.findFirst({
      where: { domain, verified: true, lightningName: localName },
      include: { user: true },
    });

    if (!record || !record.user.lightningAddress) {
      throw new NotFoundException('Lightning address not found');
    }

    const [targetName, targetDomain] = record.user.lightningAddress.split('@');
    if (!targetName || !targetDomain) {
      throw new BadRequestException('User lightning address is invalid');
    }

    const url = `https://${targetDomain}/.well-known/lnurlp/${encodeURIComponent(targetName)}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new BadRequestException(`Failed to resolve upstream LNURL (${response.status})`);
    }

    return response.json();
  }

  async resolveSiteByHost(host: string) {
    const domain = host.split(':')[0].toLowerCase();
    const result = await this.prisma.domain.findFirst({
      where: { domain, verified: true },
      include: { site: true },
    });
    if (!result?.site) {
      throw new NotFoundException('Site not found for this domain');
    }

    await this.prisma.site.update({
      where: { id: result.site.id },
      data: { views: { increment: 1 } },
    });

    return {
      domain: result.domain,
      template: result.site.template,
      config: result.site.config,
      views: result.site.views + 1,
    };
  }
}
