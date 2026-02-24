import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface IdentityHealthMetrics {
  totalUsers: number;
  totalIdentities: number;
  identitiesPerUser: number;
  activeIdentities: number;
  inactiveIdentities: number;
  customDomains: number;
  verifiedDomains: number;
  pendingDomains: number;
}

export interface GrowthMetrics {
  usersToday: number;
  usersThisWeek: number;
  usersThisMonth: number;
  identityGrowthRate: number;
  paymentGrowthRate: number;
  dailySignups: Array<{ date: string; count: number }>;
  weeklySignups: Array<{ week: string; count: number }>;
}

export interface ConversionMetrics {
  freeToProConversion: number;
  freeToBusinessConversion: number;
  freeToLifetimeConversion: number;
  averageTimeToConversion: number;
  conversionFunnel: Array<{ step: string; count: number; percentage: number }>;
}

export interface RetentionMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  churnRate: number;
  retentionByTier: Array<{ tier: string; retention: number }>;
}

export interface RevenueMetrics {
  totalRevenueSats: number;
  totalRevenueUsd: number;
  monthlyRecurringSats: number;
  monthlyRecurringUsd: number;
  revenueByTier: Array<{ tier: string; sats: number; usd: number }>;
  lifetimeValueByTier: Array<{ tier: string; ltv: number }>;
}

export interface TierDistribution {
  tier: string;
  userCount: number;
  percentage: number;
  identityCount: number;
  revenue: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get identity health metrics
   */
  async getIdentityHealth(): Promise<IdentityHealthMetrics> {
    const [
      totalUsers,
      totalIdentities,
      activeIdentities,
      totalDomains,
      verifiedDomains,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.nip05.count(),
      this.prisma.nip05.count({ where: { isActive: true } }),
      this.prisma.domain.count(),
      this.prisma.domain.count({ where: { verified: true } }),
    ]);

    return {
      totalUsers,
      totalIdentities,
      identitiesPerUser: totalUsers > 0 ? totalIdentities / totalUsers : 0,
      activeIdentities,
      inactiveIdentities: totalIdentities - activeIdentities,
      customDomains: totalDomains,
      verifiedDomains,
      pendingDomains: totalDomains - verifiedDomains,
    };
  }

  /**
   * Get growth metrics
   */
  async getGrowthMetrics(): Promise<GrowthMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [usersToday, usersThisWeek, usersThisMonth] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    ]);

    // Get daily signups for last 30 days
    const dailySignups = await this.getDailySignups(30);

    // Get weekly signups for last 12 weeks
    const weeklySignups = await this.getWeeklySignups(12);

    // Calculate growth rates
    const usersLastMonth = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(monthAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
          lt: monthAgo,
        },
      },
    });

    const identityGrowthRate =
      usersLastMonth > 0 ? ((usersThisMonth - usersLastMonth) / usersLastMonth) * 100 : 0;

    const paymentsThisMonth = await this.prisma.payment.count({
      where: {
        status: 'paid',
        paidAt: { gte: monthAgo },
      },
    });

    const paymentsLastMonth = await this.prisma.payment.count({
      where: {
        status: 'paid',
        paidAt: {
          gte: new Date(monthAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
          lt: monthAgo,
        },
      },
    });

    const paymentGrowthRate =
      paymentsLastMonth > 0
        ? ((paymentsThisMonth - paymentsLastMonth) / paymentsLastMonth) * 100
        : 0;

    return {
      usersToday,
      usersThisWeek,
      usersThisMonth,
      identityGrowthRate,
      paymentGrowthRate,
      dailySignups,
      weeklySignups,
    };
  }

  /**
   * Get conversion metrics
   */
  async getConversionMetrics(): Promise<ConversionMetrics> {
    const totalUsers = await this.prisma.user.count();

    const tierCounts = await this.prisma.subscription.groupBy({
      by: ['tier'],
      _count: true,
    });

    const free = tierCounts.find((t) => t.tier === 'FREE')?._count || 0;
    const pro = tierCounts.find((t) => t.tier === 'PRO')?._count || 0;
    const business = tierCounts.find((t) => t.tier === 'BUSINESS')?._count || 0;
    const lifetime = tierCounts.find((t) => t.tier === 'LIFETIME')?._count || 0;

    // Calculate conversion rates
    const freeToProConversion = totalUsers > 0 ? (pro / totalUsers) * 100 : 0;
    const freeToBusinessConversion = totalUsers > 0 ? (business / totalUsers) * 100 : 0;
    const freeToLifetimeConversion = totalUsers > 0 ? (lifetime / totalUsers) * 100 : 0;

    // Average time to conversion
    const conversions = await this.prisma.subscription.findMany({
      where: {
        tier: { not: 'FREE' },
      },
      select: {
        createdAt: true,
        user: {
          select: { createdAt: true },
        },
      },
    });

    const avgTimeMs =
      conversions.length > 0
        ? conversions.reduce(
            (sum, c) => sum + (c.createdAt.getTime() - c.user.createdAt.getTime()),
            0,
          ) / conversions.length
        : 0;

    const averageTimeToConversion = avgTimeMs / (1000 * 60 * 60 * 24); // days

    // Conversion funnel
    const conversionFunnel = [
      { step: 'Signed Up', count: totalUsers, percentage: 100 },
      {
        step: 'Created Identity',
        count: await this.prisma.nip05.count(),
        percentage: totalUsers > 0 ? (await this.prisma.nip05.count() / totalUsers) * 100 : 0,
      },
      {
        step: 'Any Paid Tier',
        count: pro + business + lifetime,
        percentage: totalUsers > 0 ? ((pro + business + lifetime) / totalUsers) * 100 : 0,
      },
    ];

    return {
      freeToProConversion,
      freeToBusinessConversion,
      freeToLifetimeConversion,
      averageTimeToConversion,
      conversionFunnel,
    };
  }

  /**
   * Get retention metrics
   */
  async getRetentionMetrics(): Promise<RetentionMetrics> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dailyActiveSessions, weeklyActiveSessions, monthlyActiveSessions] = await Promise.all([
      this.prisma.session.findMany({
        where: { lastUsedAt: { gte: dayAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.session.findMany({
        where: { lastUsedAt: { gte: weekAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.session.findMany({
        where: { lastUsedAt: { gte: monthAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const dailyActiveUsers = dailyActiveSessions.length;
    const weeklyActiveUsers = weeklyActiveSessions.length;
    const monthlyActiveUsers = monthlyActiveSessions.length;

    // Calculate churn rate
    const activeLastMonthSessions = await this.prisma.session.findMany({
      where: {
        lastUsedAt: {
          gte: new Date(monthAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
          lt: monthAgo,
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    const activeLastMonth = activeLastMonthSessions.length;

    const churnRate = activeLastMonth > 0 ? ((activeLastMonth - monthlyActiveUsers) / activeLastMonth) * 100 : 0;

    // Retention by tier
    const retentionByTier = await Promise.all(
      ['FREE', 'PRO', 'BUSINESS', 'LIFETIME'].map(async (tier) => {
        const tierUsers = await this.prisma.subscription.count({
          where: { tier },
        });

        const activeInTierSessions = await this.prisma.session.findMany({
          where: {
            lastUsedAt: { gte: monthAgo },
            user: {
              subscription: { tier },
            },
          },
          select: { userId: true },
          distinct: ['userId'],
        });
        const activeInTier = activeInTierSessions.length;

        return {
          tier,
          retention: tierUsers > 0 ? (activeInTier / tierUsers) * 100 : 0,
        };
      }),
    );

    return {
      dailyActiveUsers,
      weeklyActiveUsers,
      monthlyActiveUsers,
      churnRate,
      retentionByTier,
    };
  }

  /**
   * Get revenue metrics
   */
  async getRevenueMetrics(): Promise<RevenueMetrics> {
    const allPayments = await this.prisma.payment.findMany({
      where: { status: 'paid' },
      include: {
        subscription: true,
      },
    });

    const totalRevenueSats = allPayments.reduce((sum, p) => sum + (p.amountSats || 0), 0);
    const totalRevenueUsd = allPayments.reduce((sum, p) => sum + (p.amountUsd || 0), 0);

    // Monthly recurring revenue
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: {
        tier: { not: 'FREE' },
        expiresAt: { gt: new Date() },
        cancelledAt: null,
      },
    });

    const monthlyRecurringSats = activeSubscriptions.reduce((sum, s) => sum + (s.priceSats || 0), 0);
    const monthlyRecurringUsd = activeSubscriptions.reduce((sum, s) => sum + (s.priceUsd || 0), 0);

    // Revenue by tier
    const revenueByTier = await Promise.all(
      ['PRO', 'BUSINESS', 'LIFETIME'].map(async (tier) => {
        const tierPayments = allPayments.filter((p) => p.subscription.tier === tier);
        return {
          tier,
          sats: tierPayments.reduce((sum, p) => sum + (p.amountSats || 0), 0),
          usd: tierPayments.reduce((sum, p) => sum + (p.amountUsd || 0), 0),
        };
      }),
    );

    // Lifetime value by tier
    const lifetimeValueByTier = await Promise.all(
      ['PRO', 'BUSINESS', 'LIFETIME'].map(async (tier) => {
        const tierSubs = await this.prisma.subscription.count({ where: { tier } });
        const tierRevenue = revenueByTier.find((r) => r.tier === tier)?.usd || 0;
        return {
          tier,
          ltv: tierSubs > 0 ? tierRevenue / tierSubs : 0,
        };
      }),
    );

    return {
      totalRevenueSats,
      totalRevenueUsd,
      monthlyRecurringSats,
      monthlyRecurringUsd,
      revenueByTier,
      lifetimeValueByTier,
    };
  }

  /**
   * Get tier distribution
   */
  async getTierDistribution(): Promise<TierDistribution[]> {
    const tiers = ['FREE', 'PRO', 'BUSINESS', 'LIFETIME'];
    const totalUsers = await this.prisma.user.count();

    return Promise.all(
      tiers.map(async (tier) => {
        const userCount = await this.prisma.subscription.count({ where: { tier } });
        const identityCount = await this.prisma.nip05.count({
          where: {
            user: {
              subscription: { tier },
            },
          },
        });

        const payments = await this.prisma.payment.findMany({
          where: {
            status: 'paid',
            subscription: { tier },
          },
        });

        const revenue = payments.reduce((sum, p) => sum + (p.amountUsd || 0), 0);

        return {
          tier,
          userCount,
          percentage: totalUsers > 0 ? (userCount / totalUsers) * 100 : 0,
          identityCount,
          revenue,
        };
      }),
    );
  }

  /**
   * Helper: Get daily signups
   */
  private async getDailySignups(days: number): Promise<Array<{ date: string; count: number }>> {
    const results: Array<{ date: string; count: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const count = await this.prisma.user.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      });

      results.push({
        date: startOfDay.toISOString().split('T')[0],
        count,
      });
    }

    return results;
  }

  /**
   * Helper: Get weekly signups
   */
  private async getWeeklySignups(weeks: number): Promise<Array<{ week: string; count: number }>> {
    const results: Array<{ week: string; count: number }> = [];
    const now = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

      const count = await this.prisma.user.count({
        where: {
          createdAt: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
      });

      results.push({
        week: `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`,
        count,
      });
    }

    return results;
  }
}
