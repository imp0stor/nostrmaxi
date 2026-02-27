import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WotService } from '../wot/wot.service';

@Injectable()
export class AdminService {
  private adminPubkeys: string[];

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private wotService: WotService,
  ) {
    this.adminPubkeys = this.config.get('ADMIN_PUBKEYS', '').split(',').filter(Boolean);
  }

  /**
   * Check if pubkey is admin
   */
  isAdmin(pubkey: string): boolean {
    return this.adminPubkeys.includes(pubkey);
  }

  /**
   * Verify if pubkey is admin with enhanced security
   */
  requireAdmin(pubkey: string): void {
    const adminPubkeysStr = this.config.get('ADMIN_PUBKEYS');
    
    if (!adminPubkeysStr || adminPubkeysStr.trim() === '') {
      throw new ForbiddenException(
        'No admins configured. Set ADMIN_PUBKEYS environment variable.'
      );
    }
    
    const adminPubkeys = adminPubkeysStr
      .split(',')
      .map(pk => pk.trim())
      .filter(pk => pk.length > 0);
    
    if (adminPubkeys.length === 0) {
      throw new ForbiddenException('No valid admin pubkeys configured');
    }
    
    if (!adminPubkeys.includes(pubkey)) {
      // Log attempted admin access
      console.warn(`Unauthorized admin access attempt by pubkey: ${pubkey}`);
      throw new ForbiddenException('Admin access required');
    }
  }

  /**
   * Get dashboard stats
   */
  async getStats() {
    const [
      totalUsers,
      totalNip05s,
      totalSubscriptions,
      recentUsers,
      tierCounts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.nip05.count({ where: { isActive: true } }),
      this.prisma.subscription.count({ where: { tier: { not: 'FREE' } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.subscription.groupBy({
        by: ['tier'],
        _count: true,
      }),
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

  /**
   * List all users (paginated)
   */
  async listUsers(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: true,
          nip05s: { where: { isActive: true } },
        },
      }),
      this.prisma.user.count(),
    ]);

    const usersWithWot = await Promise.all(users.map(async (u) => ({
      user: u,
      wot: await this.wotService.getScore(u.pubkey),
    })));

    return {
      users: usersWithWot.map(({ user: u, wot }) => ({
        id: u.id,
        pubkey: u.pubkey,
        npub: u.npub,
        tier: u.subscription?.tier || 'FREE',
        nip05s: u.nip05s.map((n) => `${n.localPart}@${n.domain}`),
        wotScore: wot.trustScore || 0,
        createdAt: u.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * List all NIP-05 identities (paginated)
   */
  async listNip05s(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [nip05s, total] = await Promise.all([
      this.prisma.nip05.findMany({
        skip,
        take: limit,
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      }),
      this.prisma.nip05.count({ where: { isActive: true } }),
    ]);

    return {
      nip05s: nip05s.map((n) => ({
        id: n.id,
        address: `${n.localPart}@${n.domain}`,
        pubkey: n.user.pubkey,
        npub: n.user.npub,
        createdAt: n.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit log
   */
  async getAuditLog(page = 1, limit = 100) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get payment history
   */
  async getPayments(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: {
            include: { user: true },
          },
        },
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
