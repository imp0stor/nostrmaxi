import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService, TierInfo, SubscriptionTier } from '../payments/payments.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WotService } from '../wot/wot.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
    private webhooks: WebhooksService,
    private wotService: WotService,
  ) {}

  /**
   * Get all available tiers
   */
  getTiers(): TierInfo[] {
    return this.paymentsService.getTiers();
  }

  /**
   * Get tier info
   */
  getTier(tier: SubscriptionTier): TierInfo {
    return this.paymentsService.getTier(tier);
  }

  /**
   * Get current subscription for a user
   */
  async getCurrentSubscription(pubkey: string) {
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: {
        subscription: {
          include: {
            payments: {
              where: { status: 'paid' },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        nip05s: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tier = (user.subscription?.tier || 'FREE') as SubscriptionTier;
    const tierInfo = this.paymentsService.getTier(tier);
    const nip05Count = user.nip05s.filter((n) => n.isActive).length;

    const now = new Date();
    const isActive = user.subscription?.expiresAt 
      ? user.subscription.expiresAt > now 
      : tier === 'FREE';

    // Calculate days remaining
    let daysRemaining: number | null = null;
    if (user.subscription?.expiresAt && user.subscription.expiresAt > now) {
      daysRemaining = Math.ceil(
        (user.subscription.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
    }

    const wotScore = await this.wotService.getScore(pubkey);

    return {
      tier,
      tierInfo,
      nip05Count,
      nip05Limit: tierInfo.nip05Limit,
      nip05Remaining: Math.max(0, tierInfo.nip05Limit - nip05Count),
      expiresAt: user.subscription?.expiresAt,
      isActive,
      isCancelled: !!user.subscription?.cancelledAt,
      daysRemaining,
      wotDiscount: wotScore.discountPercent || 0,
      recentPayments: user.subscription?.payments.map((p) => ({
        id: p.id,
        amountSats: p.amountSats,
        receiptNumber: p.receiptNumber,
        paidAt: p.paidAt,
      })) || [],
    };
  }

  /**
   * Upgrade subscription (creates payment invoice)
   */
  async upgrade(pubkey: string, tier: SubscriptionTier, applyWotDiscount = true) {
    // Use payments service to create invoice
    return this.paymentsService.createInvoice(pubkey, tier, applyWotDiscount);
  }

  /**
   * Downgrade to free tier (at end of billing period)
   */
  async downgrade(pubkey: string) {
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { subscription: true },
    });

    if (!user || !user.subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (user.subscription.tier === 'FREE') {
      throw new BadRequestException('Already on free tier');
    }

    // Mark as cancelled (will downgrade when expires)
    await this.prisma.subscription.update({
      where: { id: user.subscription.id },
      data: { cancelledAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'subscription.downgrade_scheduled',
        entity: 'Subscription',
        entityId: user.subscription.id,
        actorPubkey: pubkey,
        details: {
          currentTier: user.subscription.tier,
          expiresAt: user.subscription.expiresAt,
        },
      },
    });

    const result = {
      scheduled: true,
      currentTier: user.subscription.tier,
      willDowngradeAt: user.subscription.expiresAt,
      message: 'Your subscription will be downgraded to Free at the end of your billing period.',
    };

    await this.webhooks.emit('subscription.changed', {
      action: 'downgrade_scheduled',
      pubkey,
      ...result,
    });

    return result;
  }

  /**
   * Cancel subscription (immediate)
   */
  async cancel(pubkey: string) {
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { subscription: true },
    });

    if (!user || !user.subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (user.subscription.tier === 'FREE') {
      throw new BadRequestException('Cannot cancel free tier');
    }

    await this.prisma.subscription.update({
      where: { id: user.subscription.id },
      data: {
        cancelledAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'subscription.cancel',
        entity: 'Subscription',
        entityId: user.subscription.id,
        actorPubkey: pubkey,
      },
    });

    const result = {
      cancelled: true,
      expiresAt: user.subscription.expiresAt,
      message: 'Your subscription has been cancelled. You will retain access until your current period ends.',
    };

    await this.webhooks.emit('subscription.changed', {
      action: 'cancelled',
      pubkey,
      tier: user.subscription.tier,
      ...result,
    });

    return result;
  }

  /**
   * Reactivate a cancelled subscription
   */
  async reactivate(pubkey: string) {
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { subscription: true },
    });

    if (!user || !user.subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (!user.subscription.cancelledAt) {
      throw new BadRequestException('Subscription is not cancelled');
    }

    // Only allow reactivation if not expired
    if (user.subscription.expiresAt && user.subscription.expiresAt < new Date()) {
      throw new BadRequestException('Subscription has already expired. Please create a new subscription.');
    }

    await this.prisma.subscription.update({
      where: { id: user.subscription.id },
      data: { cancelledAt: null },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'subscription.reactivate',
        entity: 'Subscription',
        entityId: user.subscription.id,
        actorPubkey: pubkey,
      },
    });

    const result = {
      reactivated: true,
      tier: user.subscription.tier,
      expiresAt: user.subscription.expiresAt,
    };

    await this.webhooks.emit('subscription.changed', {
      action: 'reactivated',
      pubkey,
      ...result,
    });

    return result;
  }

  async getEntitlement(pubkey: string) {
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tier = (user.subscription?.tier || 'FREE') as SubscriptionTier;
    return {
      pubkey,
      tier,
      isPaid: tier !== 'FREE',
      expiresAt: user.subscription?.expiresAt || null,
      cancelledAt: user.subscription?.cancelledAt || null,
    };
  }

  async setEntitlement(pubkey: string, tier: SubscriptionTier, actorPubkey: string) {
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = user.subscription
      ? await this.prisma.subscription.update({
          where: { id: user.subscription.id },
          data: {
            tier,
            startsAt: new Date(),
            expiresAt: tier === 'FREE' ? null : user.subscription.expiresAt,
            cancelledAt: null,
          },
        })
      : await this.prisma.subscription.create({
          data: {
            userId: user.id,
            tier,
            startsAt: new Date(),
            expiresAt: tier === 'FREE' ? null : null,
          },
        });

    await this.prisma.auditLog.create({
      data: {
        action: 'subscription.entitlement_set',
        entity: 'Subscription',
        entityId: updated.id,
        actorPubkey,
        details: {
          targetPubkey: pubkey,
          tier,
        },
      },
    });

    return {
      pubkey,
      tier: updated.tier,
      isPaid: updated.tier !== 'FREE',
      expiresAt: updated.expiresAt,
    };
  }

  /**
   * Process expired subscriptions (cron job)
   */
  async processExpiredSubscriptions() {
    const now = new Date();

    // Find expired subscriptions
    const expired = await this.prisma.subscription.findMany({
      where: {
        tier: { not: 'FREE' },
        expiresAt: { lt: now },
      },
      include: { user: true },
    });

    for (const sub of expired) {
      // Check if cancelled or just needs renewal reminder
      if (sub.cancelledAt) {
        // Downgrade to free
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            tier: 'FREE',
            cancelledAt: null,
            expiresAt: null,
          },
        });

        // NIP-05 is paid-only. Deactivate all active NIP-05 identities on downgrade to FREE.
        await this.prisma.nip05.updateMany({
          where: { userId: sub.userId, isActive: true },
          data: { isActive: false },
        });

        await this.prisma.auditLog.create({
          data: {
            action: 'subscription.expired',
            entity: 'Subscription',
            entityId: sub.id,
            details: { previousTier: sub.tier },
          },
        });

        await this.webhooks.emit('subscription.changed', {
          action: 'expired_to_free',
          pubkey: sub.user.pubkey,
          previousTier: sub.tier,
          currentTier: 'FREE',
        });
      }
    }

    return { processed: expired.length };
  }
}
