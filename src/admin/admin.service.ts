import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WotService } from '../wot/wot.service';
import { AuctionService } from '../auctions/auction.service';
import { AuctionState } from '../auctions/auction.types';

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly bootstrapAdminPubkeys: string[];

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private wotService: WotService,
    private readonly auctionService: AuctionService,
  ) {
    this.bootstrapAdminPubkeys = (this.config.get<string>('ADMIN_PUBKEYS', '') || '')
      .split(',')
      .map((pubkey) => pubkey.trim().toLowerCase())
      .filter(Boolean);
  }

  async onModuleInit() {
    await this.syncBootstrapAdminsToDatabase();
  }

  private async syncBootstrapAdminsToDatabase() {
    if (!this.bootstrapAdminPubkeys.length) {
      return;
    }

    await Promise.all(
      this.bootstrapAdminPubkeys.map((pubkey) =>
        this.prisma.user.upsert({
          where: { pubkey },
          update: { isAdmin: true },
          create: {
            pubkey,
            npub: `npub_${pubkey.slice(0, 16)}`,
            isAdmin: true,
          },
        }),
      ),
    );
  }

  async logAdminAction(adminId: string, action: string, targetId?: string, details?: unknown) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        targetId,
        details: details as any,
      },
    });
  }

  async getStats() {
    const [totalUsers, totalNip05s, totalSubscriptions, recentUsers, tierCounts] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.nip05.count({ where: { isActive: true } }),
      this.prisma.subscription.count({ where: { tier: { not: 'FREE' } } }),
      this.prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      this.prisma.subscription.groupBy({ by: ['tier'], _count: true }),
    ]);

    return {
      totalUsers,
      totalNip05s,
      paidSubscriptions: totalSubscriptions,
      newUsersLast7Days: recentUsers,
      tierDistribution: tierCounts.reduce((acc, t) => {
        acc[t.tier] = t._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async listUsers(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { subscription: true, nip05s: { where: { isActive: true } } },
      }),
      this.prisma.user.count(),
    ]);

    const usersWithWot = await Promise.all(users.map(async (u) => ({ user: u, wot: await this.wotService.getScore(u.pubkey) })));

    return {
      users: usersWithWot.map(({ user: u, wot }) => ({
        id: u.id,
        pubkey: u.pubkey,
        npub: u.npub,
        tier: u.subscription?.tier || 'FREE',
        isAdmin: u.isAdmin,
        nip05s: u.nip05s.map((n) => `${n.localPart}@${n.domain}`),
        wotScore: wot.trustScore || 0,
        createdAt: u.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listUsersWithRoles(page = 1, limit = 50) {
    return this.listUsers(page, limit);
  }

  async updateUserRole(pubkey: string, updates: { isAdmin?: boolean; tier?: string }) {
    const normalizedPubkey = pubkey.trim().toLowerCase();

    if (typeof updates.isAdmin !== 'boolean' && !updates.tier) {
      throw new BadRequestException('At least one of isAdmin or tier is required');
    }

    const user = await this.prisma.user.findUnique({ where: { pubkey: normalizedPubkey } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data: { isAdmin?: boolean } = {};
    if (typeof updates.isAdmin === 'boolean') {
      data.isAdmin = updates.isAdmin;
    }

    const updatedUser = Object.keys(data).length
      ? await this.prisma.user.update({
          where: { pubkey: normalizedPubkey },
          data,
        })
      : user;

    if (updates.tier) {
      await this.prisma.subscription.upsert({
        where: { userId: user.id },
        update: { tier: updates.tier },
        create: {
          userId: user.id,
          tier: updates.tier,
        },
      });
    }

    const subscription = await this.prisma.subscription.findUnique({ where: { userId: user.id } });

    return {
      pubkey: updatedUser.pubkey,
      isAdmin: updatedUser.isAdmin,
      tier: subscription?.tier || 'FREE',
    };
  }

  async listNip05s(page = 1, limit = 50) {
    return this.listNip05Registrations({ page, limit });
  }

  async listNip05Registrations(params: { page?: number; limit?: number; username?: string; pubkey?: string; domain?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 25;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.username) where.localPart = { contains: params.username, mode: 'insensitive' };
    if (params.domain) where.domain = { contains: params.domain, mode: 'insensitive' };
    if (params.pubkey) where.user = { pubkey: { contains: params.pubkey, mode: 'insensitive' } };

    const [rows, total] = await Promise.all([
      this.prisma.nip05.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      }),
      this.prisma.nip05.count({ where }),
    ]);

    const data = await Promise.all(
      rows.map(async (n) => {
        const sub = await this.prisma.subscription.findUnique({ where: { userId: n.userId } });
        const tier = sub?.tier || 'FREE';
        const expires = sub?.expiresAt || null;
        return {
          id: n.id,
          username: n.localPart,
          domain: n.domain,
          pubkey: n.user.pubkey,
          tier,
          created: n.createdAt,
          expires,
          status: n.isActive ? 'active' : 'suspended',
        };
      }),
    );

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getNip05Registration(id: string) {
    const n = await this.prisma.nip05.findUnique({ where: { id }, include: { user: true } });
    if (!n) throw new NotFoundException('NIP-05 registration not found');
    const sub = await this.prisma.subscription.findUnique({ where: { userId: n.userId } });
    return {
      id: n.id,
      username: n.localPart,
      domain: n.domain,
      pubkey: n.user.pubkey,
      tier: sub?.tier || 'FREE',
      created: n.createdAt,
      expires: sub?.expiresAt || null,
      status: n.isActive ? 'active' : 'suspended',
    };
  }

  async updateNip05Registration(id: string, updates: { tier?: string; extendDays?: number }) {
    const n = await this.prisma.nip05.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('NIP-05 registration not found');

    const sub = await this.prisma.subscription.upsert({
      where: { userId: n.userId },
      update: {
        ...(updates.tier ? { tier: updates.tier } : {}),
        ...(updates.extendDays
          ? {
              expiresAt: new Date((n.updatedAt?.getTime?.() || Date.now()) + updates.extendDays * 24 * 60 * 60 * 1000),
            }
          : {}),
      },
      create: {
        userId: n.userId,
        tier: updates.tier || 'FREE',
        expiresAt: updates.extendDays ? new Date(Date.now() + updates.extendDays * 24 * 60 * 60 * 1000) : null,
      },
    });

    return { id, tier: sub.tier, expires: sub.expiresAt };
  }

  async deleteNip05Registration(id: string) {
    await this.prisma.nip05.delete({ where: { id } });
    return { ok: true };
  }

  async suspendNip05Registration(id: string, suspended: boolean) {
    const n = await this.prisma.nip05.update({ where: { id }, data: { isActive: !suspended } });
    return { id: n.id, status: n.isActive ? 'active' : 'suspended' };
  }

  async transferNip05Registration(id: string, pubkey: string) {
    const npub = `npub_${pubkey.slice(0, 16)}`;
    const user = await this.prisma.user.upsert({
      where: { pubkey },
      update: {},
      create: { pubkey, npub },
    });
    const n = await this.prisma.nip05.update({ where: { id }, data: { userId: user.id } });
    return { id: n.id, pubkey };
  }

  async getNameList(list: 'reserved' | 'premium' | 'blocked', search?: string) {
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : undefined;
    if (list === 'reserved') return this.prisma.reservedName.findMany({ where, orderBy: { createdAt: 'desc' } });
    if (list === 'premium') return this.prisma.premiumName.findMany({ where, orderBy: { createdAt: 'desc' } });
    return this.prisma.blockedName.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async addNameToList(list: 'reserved' | 'premium' | 'blocked', payload: { name: string; reason?: string; minimumPrice?: number }) {
    const name = payload.name.trim().toLowerCase();
    if (!name) throw new BadRequestException('Name is required');
    if (list === 'reserved') return this.prisma.reservedName.create({ data: { name, reason: payload.reason } });
    if (list === 'premium') return this.prisma.premiumName.create({ data: { name, reason: payload.reason, minimumPrice: payload.minimumPrice } });
    return this.prisma.blockedName.create({ data: { name, reason: payload.reason } });
  }

  async removeNameFromList(list: 'reserved' | 'premium' | 'blocked', name: string) {
    const key = name.trim().toLowerCase();
    if (list === 'reserved') await this.prisma.reservedName.delete({ where: { name: key } });
    else if (list === 'premium') await this.prisma.premiumName.delete({ where: { name: key } });
    else await this.prisma.blockedName.delete({ where: { name: key } });
    return { ok: true };
  }

  async importNames(payload: { list: 'reserved' | 'premium' | 'blocked'; format?: 'json' | 'csv'; content: string }) {
    const rows: Array<{ name: string; reason?: string; minimumPrice?: number }> = [];
    if ((payload.format || 'json') === 'json') {
      const parsed = JSON.parse(payload.content) as Array<{ name: string; reason?: string; minimumPrice?: number }>;
      rows.push(...parsed);
    } else {
      const lines = payload.content.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines.slice(1)) {
        const [name, reason, minimumPrice] = line.split(',');
        rows.push({ name, reason, minimumPrice: minimumPrice ? Number(minimumPrice) : undefined });
      }
    }

    for (const row of rows) {
      await this.addNameToList(payload.list, row);
    }
    return { imported: rows.length };
  }

  async exportNames(list: 'reserved' | 'premium' | 'blocked', format: 'json' | 'csv' = 'json') {
    const rows = await this.getNameList(list);
    if (format === 'json') return rows;

    const header = 'name,reason,minimumPrice';
    const csv = [
      header,
      ...rows.map((r: any) => `${r.name},${(r.reason || '').replace(/,/g, ' ')},${r.minimumPrice || ''}`),
    ].join('\n');
    return { csv };
  }

  async listAuctions(params: { page?: number; limit?: number; status?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 25;
    const all = this.auctionService.listAuctions();
    const normalized = params.status?.toUpperCase();
    const filtered = normalized ? all.filter((a) => a.state === normalized) : all;
    const start = (page - 1) * limit;
    const rows = filtered.slice(start, start + limit);

    return {
      data: rows.map((a) => {
        const bids = this.auctionService.getBids(a.id);
        const top = bids[0];
        return {
          id: a.id,
          name: a.name,
          status: a.state,
          currentBid: top?.bidAmountSats || 0,
          topBidder: top?.bidderPubkey || null,
          startTime: a.startsAt,
          endTime: a.endsAt,
        };
      }),
      total: filtered.length,
      page,
      totalPages: Math.ceil(filtered.length / limit),
    };
  }

  async getAuction(id: string) {
    return this.auctionService.getAuction(id);
  }

  async updateAuction(id: string, updates: { startsAt?: number; endsAt?: number; reservePriceSats?: number; startingPriceSats?: number }) {
    const auctionDetail = this.auctionService.getAuction(id);
    const auction = auctionDetail.auction;
    const map = (this.auctionService as any).auctions as Map<string, any>;
    map.set(id, { ...auction, ...updates });
    return this.auctionService.getAuction(id);
  }

  async extendAuction(id: string, extendSeconds: number) {
    const auctionDetail = this.auctionService.getAuction(id);
    const map = (this.auctionService as any).auctions as Map<string, any>;
    map.set(id, { ...auctionDetail.auction, endsAt: auctionDetail.auction.endsAt + extendSeconds });
    return this.auctionService.getAuction(id);
  }

  async cancelAuction(id: string) {
    const auctionDetail = this.auctionService.getAuction(id);
    const map = (this.auctionService as any).auctions as Map<string, any>;
    map.set(id, { ...auctionDetail.auction, state: AuctionState.FAILED, failedAt: Math.floor(Date.now() / 1000) });
    return { ok: true };
  }

  async finalizeAuction(id: string) {
    return this.auctionService.settleAuction(id);
  }

  async getAuctionBids(id: string) {
    return this.auctionService.getBids(id);
  }

  async salesSummary() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const [payments, weekPayments, monthPayments, activeSubscriptions, registrations, revenueByTier, recentTransactions] = await Promise.all([
      this.prisma.payment.findMany({ where: { status: 'paid' } }),
      this.prisma.payment.findMany({ where: { status: 'paid', paidAt: { gte: weekAgo } } }),
      this.prisma.payment.findMany({ where: { status: 'paid', paidAt: { gte: monthAgo } } }),
      this.prisma.subscription.count({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
      this.prisma.nip05.count(),
      this.prisma.subscription.groupBy({ by: ['tier'], _count: true }),
      this.prisma.payment.findMany({ where: { status: 'paid' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    const toSats = (p: any) => p.amountSats || Math.round((p.amountUsd || 0) * 10);

    return {
      totalRevenue: payments.reduce((sum, p) => sum + toSats(p), 0),
      revenueThisMonth: monthPayments.reduce((sum, p) => sum + toSats(p), 0),
      revenueThisWeek: weekPayments.reduce((sum, p) => sum + toSats(p), 0),
      activeSubscriptions,
      registrations,
      revenueByTier,
      recentTransactions,
    };
  }

  async salesRevenue(days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const rows = await this.prisma.payment.findMany({ where: { status: 'paid', paidAt: { gte: since } }, orderBy: { paidAt: 'asc' } });
    const bucket = new Map<string, number>();
    for (const r of rows) {
      const key = (r.paidAt || r.createdAt).toISOString().slice(0, 10);
      const amt = r.amountSats || Math.round((r.amountUsd || 0) * 10);
      bucket.set(key, (bucket.get(key) || 0) + amt);
    }
    return Array.from(bucket.entries()).map(([date, revenue]) => ({ date, revenue }));
  }

  async salesTransactions(limit = 50) {
    return this.prisma.payment.findMany({ where: { status: 'paid' }, orderBy: { createdAt: 'desc' }, take: limit });
  }

  async salesSubscriptions() {
    return this.prisma.subscription.findMany({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, include: { user: true } });
  }

  async getAuditLog(page = 1, limit = 100) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count(),
    ]);
    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getPayments(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { subscription: { include: { user: true } } },
      }),
      this.prisma.payment.count(),
    ]);

    return {
      payments: payments.map((p) => ({
        id: p.id,
        pubkey: p.subscription.user.pubkey,
        amount: p.amountSats || p.amountUsd,
        currency: p.amountSats ? 'sats' : 'usd',
        method: p.method,
        status: p.status,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
