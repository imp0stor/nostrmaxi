import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import {
  PaymentProvider,
  PaymentProviderRegistry,
  PaymentProviderType,
} from './providers';
import { BtcpayProvider } from './providers/btcpay.provider';
import { LnbitsProvider } from './providers/lnbits.provider';

export type SubscriptionTier = 'FREE' | 'PRO' | 'BUSINESS' | 'LIFETIME';
export type BillingCycle = 'monthly' | 'annual' | 'lifetime';

export interface TierInfo {
  tier: SubscriptionTier;
  name: string;
  description: string;
  priceUsd: number; // cents
  priceSats: number;
  features: string[];
  nip05Limit: number;
  customDomain: boolean;
  analytics: boolean;
  apiAccess: boolean;
  isLifetime?: boolean;
}

const ANNUAL_MULTIPLIER = 10; // 12 months - 2 months free
const ANNUAL_MONTHS_FREE = 2;

const TIERS: Record<SubscriptionTier, TierInfo> = {
  FREE: {
    tier: 'FREE',
    name: 'Free',
    description: 'Get started with basic NIP-05 verification',
    priceUsd: 0,
    priceSats: 0,
    features: [
      'Basic NIP-05 identity (user@nostrmaxi.com)',
      'Lightning address forwarding',
      'WoT score viewing',
    ],
    nip05Limit: 1,
    customDomain: false,
    analytics: false,
    apiAccess: false,
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro',
    description: 'For creators who want their own domain',
    priceUsd: 900, // $9/month
    priceSats: 21000,
    features: [
      'Custom domain NIP-05 (you@yourdomain.com)',
      'Lightning address forwarding',
      'Basic analytics dashboard',
      'Priority support',
      'WoT-based discounts',
    ],
    nip05Limit: 1,
    customDomain: true,
    analytics: true,
    apiAccess: false,
  },
  BUSINESS: {
    tier: 'BUSINESS',
    name: 'Business',
    description: 'For teams and power users',
    priceUsd: 2900, // $29/month
    priceSats: 69000,
    features: [
      'Up to 10 NIP-05 identities',
      'Multiple custom domains',
      'Full analytics dashboard',
      'API access with 10,000 requests/day',
      'Priority relay access',
      'Dedicated support',
    ],
    nip05Limit: 10,
    customDomain: true,
    analytics: true,
    apiAccess: true,
  },
  LIFETIME: {
    tier: 'LIFETIME',
    name: 'Lifetime Pro',
    description: 'One-time payment, forever access',
    priceUsd: 9900, // $99 one-time
    priceSats: 210000,
    features: [
      'All Pro features forever',
      'Custom domain NIP-05',
      'Analytics dashboard',
      'No recurring payments',
      'Locked-in pricing',
    ],
    nip05Limit: 1,
    customDomain: true,
    analytics: true,
    apiAccess: false,
    isLifetime: true,
  },
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly providerRegistry: PaymentProviderRegistry;
  private readonly defaultProviderType: PaymentProviderType;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const lnbitsUrl = this.config.get('LNBITS_URL'); // only set if explicitly configured
    const lnbitsApiKey = this.config.get('LNBITS_API_KEY') || '';
    const lnbitsWebhookSecret =
      this.config.get('LNBITS_WEBHOOK_SECRET') ||
      this.config.get('WEBHOOK_SECRET') ||
      crypto.randomBytes(32).toString('hex');

    const btcpayBaseUrl =
      this.config.get('BTCPAY_URL') ||
      this.config.get('BTCPAY_BASE_URL') ||
      this.config.get('BTCPAY_SERVER_URL');
    const btcpayApiKey = this.config.get('BTCPAY_API_KEY');
    const btcpayStoreId = this.config.get('BTCPAY_STORE_ID');
    const btcpayWebhookSecret =
      this.config.get('BTCPAY_WEBHOOK_SECRET') || this.config.get('WEBHOOK_SECRET');

    this.providerRegistry = new PaymentProviderRegistry();

    if (lnbitsUrl && lnbitsApiKey) {
      this.providerRegistry.register(
        new LnbitsProvider({
          baseUrl: lnbitsUrl,
          apiKey: lnbitsApiKey,
          webhookSecret: lnbitsWebhookSecret,
        }),
      );
    }

    // Always register BTCPay — provider uses mock mode when credentials are absent
    this.providerRegistry.register(
      new BtcpayProvider({
        baseUrl: btcpayBaseUrl || 'http://localhost:49392',
        apiKey: btcpayApiKey || '',
        storeId: btcpayStoreId || '',
        webhookSecret: btcpayWebhookSecret,
      }),
    );

    this.defaultProviderType =
      (this.config.get('PAYMENTS_PROVIDER') ||
        this.config.get('PAYMENT_PROVIDER') ||
        'btcpay') as PaymentProviderType;
  }

  /**
   * Get all available tiers
   */
  getTiers(): TierInfo[] {
    return Object.values(TIERS);
  }

  /**
   * Get specific tier info
   */
  getTier(tier: SubscriptionTier): TierInfo {
    return TIERS[tier];
  }

  /**
   * Create a Lightning invoice for subscription upgrade
   */
  async createInvoice(
    pubkey: string,
    tier: SubscriptionTier,
    applyWotDiscount = true,
    billingCycle: BillingCycle = 'monthly',
  ): Promise<{
    paymentId: string;
    invoice: string;
    paymentHash?: string;
    amountSats: number;
    amountUsd: number;
    discountPercent: number;
    expiresAt: number;
    provider: PaymentProviderType;
    billingCycle: BillingCycle;
  }> {
    if (tier === 'FREE') {
      throw new BadRequestException('Cannot create invoice for free tier');
    }

    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { subscription: true, wotScore: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let resolvedTier = tier;
    if (billingCycle === 'lifetime' && tier !== 'LIFETIME') {
      resolvedTier = 'LIFETIME';
    }

    const tierInfo = TIERS[resolvedTier];
    const resolvedBillingCycle: BillingCycle = tierInfo.isLifetime ? 'lifetime' : billingCycle;

    // Apply WoT discount if eligible
    let discountPercent = 0;
    if (applyWotDiscount && user.wotScore?.discountPercent) {
      discountPercent = Math.min(user.wotScore.discountPercent, 50); // Max 50% discount
    }

    const cycleMultiplier = resolvedBillingCycle === 'annual' ? ANNUAL_MULTIPLIER : 1;
    const amountSats = Math.round(tierInfo.priceSats * cycleMultiplier * (1 - discountPercent / 100));
    const amountUsd = Math.round(tierInfo.priceUsd * cycleMultiplier * (1 - discountPercent / 100));

    const provider = this.getProvider();

    // Create invoice via provider
    const description = `NostrMaxi ${tierInfo.name} - ${resolvedBillingCycle === 'annual' ? `Annual (${ANNUAL_MONTHS_FREE} months free)` : resolvedBillingCycle === 'lifetime' ? 'Lifetime' : 'Monthly'} Subscription`;
    const invoice = await provider.createInvoice({
      amountSats,
      memo: description,
      expiresInSeconds: 600,
      webhookUrl: `${this.config.get('BASE_URL')}/api/v1/payments/webhook?provider=${provider.type}`,
      metadata: {
        tier: resolvedTier,
        pubkey,
        amountSats,
        amountUsd,
        billingCycle: resolvedBillingCycle,
      },
    });

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        subscriptionId: user.subscription!.id,
        amountSats,
        amountUsd,
        method: 'lightning',
        invoice: invoice.bolt11,
        paymentHash: invoice.paymentHash,
        provider: provider.type,
        providerInvoiceId: invoice.providerInvoiceId,
        providerPaymentId: invoice.paymentHash,
        lnbitsPaymentId: provider.type === 'lnbits' ? invoice.providerInvoiceId : null,
        status: 'pending',
      },
    });

    // Store tier info for when payment is confirmed
    await this.prisma.auditLog.create({
      data: {
        action: 'payment.created',
        entity: 'Payment',
        entityId: payment.id,
        actorPubkey: pubkey,
        details: {
          tier: resolvedTier,
          billingCycle: resolvedBillingCycle,
          amountSats,
          discountPercent,
          provider: provider.type,
        },
      },
    });

    return {
      paymentId: payment.id,
      invoice: invoice.bolt11,
      paymentHash: invoice.paymentHash,
      amountSats,
      amountUsd,
      discountPercent,
      expiresAt: Math.floor((invoice.expiresAt?.getTime() || Date.now() + 600_000) / 1000),
      provider: provider.type,
      billingCycle: resolvedBillingCycle,
    };
  }

  /**
   * Check invoice status
   */
  async checkInvoiceStatus(paymentId: string): Promise<{
    status: string;
    paid: boolean;
    paidAt?: Date;
    tier?: string;
    expiresAt?: Date;
    provider?: PaymentProviderType;
  }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // If already processed, return current status
    if (payment.status === 'paid') {
      return {
        status: 'paid',
        paid: true,
        paidAt: payment.paidAt || undefined,
        tier: payment.subscription.tier,
        expiresAt: payment.subscription.expiresAt || undefined,
        provider: (payment.provider as PaymentProviderType) || undefined,
      };
    }

    if (payment.status === 'expired' || payment.status === 'failed') {
      return { status: payment.status, paid: false };
    }

    const provider = this.getProvider(
      (payment.provider as PaymentProviderType) || undefined,
    );
    const providerInvoiceId =
      payment.providerInvoiceId || payment.lnbitsPaymentId || payment.paymentHash || '';

    if (!providerInvoiceId) {
      return { status: 'pending', paid: false };
    }

    const status = await provider.getInvoiceStatus(
      providerInvoiceId,
      payment.paymentHash || undefined,
    );

    if (status.state === 'paid') {
      const result = await this.processPayment(payment.id);
      return {
        status: 'paid',
        paid: true,
        paidAt: new Date(),
        tier: result.tier,
        expiresAt: result.expiresAt,
        provider: provider.type,
      };
    }

    if (status.state === 'expired' || status.state === 'failed') {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: status.state },
      });
      return { status: status.state, paid: false, provider: provider.type };
    }

    // Check if expired (10 minutes) when provider doesn't say otherwise
    const createdAt = new Date(payment.createdAt);
    if (Date.now() - createdAt.getTime() > 10 * 60 * 1000) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'expired' },
      });
      return { status: 'expired', paid: false, provider: provider.type };
    }

    return { status: 'pending', paid: false, provider: provider.type };
  }

  /**
   * Handle webhook from payment providers
   */
  async handleWebhook(
    payload: any,
    signature?: string,
    providerType?: PaymentProviderType,
  ): Promise<{ success: boolean }> {
    const provider = providerType
      ? this.getProvider(providerType)
      : this.getProviderFromPayload(payload);

    if (!provider) {
      this.logger.warn('Webhook received but no matching provider found');
      return { success: false };
    }

    if (provider.verifyWebhookSignature && !provider.verifyWebhookSignature(payload, signature)) {
      this.logger.warn('Invalid webhook signature');
      throw new BadRequestException('Invalid signature');
    }

    const event = provider.parseWebhookEvent(payload);
    if (!event) {
      this.logger.warn('Webhook payload did not match provider event format');
      return { success: false };
    }

    const whereOr: any[] = [{ providerInvoiceId: event.providerInvoiceId }];
    if (event.paymentHash) {
      whereOr.push({ paymentHash: event.paymentHash });
    }
    if (event.providerInvoiceId) {
      whereOr.push({ lnbitsPaymentId: event.providerInvoiceId });
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: whereOr,
      },
    });

    if (!payment) {
      this.logger.warn(`No pending payment found for provider invoice: ${event.providerInvoiceId}`);
      return { success: false };
    }

    if (payment.status === 'paid') {
      return { success: true };
    }

    if (event.state === 'expired' || event.state === 'failed') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: { status: event.state },
      });
      return { success: true };
    }

    // Verify with provider before confirming payment
    const status = await provider.getInvoiceStatus(
      payment.providerInvoiceId || payment.lnbitsPaymentId || payment.paymentHash || '',
      payment.paymentHash || undefined,
    );

    if (status.state !== 'paid') {
      return { success: false };
    }

    await this.processPayment(payment.id);
    return { success: true };
  }

  /**
   * Process a confirmed payment
   */
  async processPayment(paymentId: string): Promise<{
    tier: string;
    expiresAt: Date;
    receiptNumber: string;
  }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: { include: { user: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === 'paid') {
      return {
        tier: payment.subscription.tier,
        expiresAt: payment.subscription.expiresAt!,
        receiptNumber: payment.receiptNumber!,
      };
    }

    // Get tier from audit log
    const auditLog = await this.prisma.auditLog.findFirst({
      where: {
        action: 'payment.created',
        entityId: paymentId,
      },
      orderBy: { createdAt: 'desc' },
    });

    const tier = (auditLog?.details as any)?.tier || 'PRO';
    const billingCycle = (auditLog?.details as any)?.billingCycle as BillingCycle | undefined;
    const tierInfo = TIERS[tier as SubscriptionTier];
    const resolvedBilling: BillingCycle = tierInfo.isLifetime ? 'lifetime' : billingCycle || 'monthly';

    // Calculate expiry
    const now = new Date();
    let newExpiry: Date;

    if (resolvedBilling === 'lifetime') {
      // Lifetime subscriptions expire in 100 years
      newExpiry = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);
    } else if (resolvedBilling === 'annual') {
      const currentExpiry = payment.subscription.expiresAt;
      const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
      newExpiry = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    } else {
      // Monthly: extend from current expiry or now
      const currentExpiry = payment.subscription.expiresAt;
      const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
      newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // Generate receipt number
    const receiptNumber = `NM-${Date.now().toString(36).toUpperCase()}-${payment.id.slice(-4).toUpperCase()}`;

    // Update subscription
    await this.prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: {
        tier,
        expiresAt: newExpiry,
        cancelledAt: null, // Reactivate if cancelled
      },
    });

    // Mark payment as paid
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'paid',
        paidAt: now,
        receiptNumber,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'payment.confirmed',
        entity: 'Payment',
        entityId: paymentId,
        actorPubkey: payment.subscription.user.pubkey,
        details: {
          tier,
          billingCycle: resolvedBilling,
          amountSats: payment.amountSats,
          expiresAt: newExpiry.toISOString(),
          receiptNumber,
          provider: payment.provider,
        },
      },
    });

    this.logger.log(`Payment ${paymentId} processed: ${tier} tier until ${newExpiry}`);

    return {
      tier,
      expiresAt: newExpiry,
      receiptNumber,
    };
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(pubkey: string, limit = 20) {
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: {
        subscription: {
          include: {
            payments: {
              orderBy: { createdAt: 'desc' },
              take: limit,
            },
          },
        },
      },
    });

    if (!user?.subscription) {
      return [];
    }

    return user.subscription.payments.map((p) => ({
      id: p.id,
      amountSats: p.amountSats,
      amountUsd: p.amountUsd,
      method: p.method,
      status: p.status,
      receiptNumber: p.receiptNumber,
      createdAt: p.createdAt,
      paidAt: p.paidAt,
      provider: p.provider,
    }));
  }

  /**
   * Generate receipt
   */
  async getReceipt(pubkey: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        subscription: { user: { pubkey } },
        status: 'paid',
      },
      include: {
        subscription: {
          include: { user: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Receipt not found');
    }

    const auditLog = await this.prisma.auditLog.findFirst({
      where: {
        action: 'payment.confirmed',
        entityId: paymentId,
      },
    });

    const tier = (auditLog?.details as any)?.tier || payment.subscription.tier;
    const billingCycle = (auditLog?.details as any)?.billingCycle as BillingCycle | undefined;
    const tierInfo = TIERS[tier as SubscriptionTier];
    const receiptCycle = tierInfo.isLifetime ? 'Lifetime' : billingCycle === 'annual' ? 'Annual' : 'Monthly';

    return {
      receiptNumber: payment.receiptNumber,
      date: payment.paidAt,
      item: `${tierInfo.name} Subscription (${receiptCycle})`,
      description: tierInfo.description,
      amountSats: payment.amountSats,
      amountUsd: payment.amountUsd,
      paymentMethod: 'Lightning Network',
      paymentHash: payment.paymentHash,
      provider: payment.provider,
      customer: {
        npub: payment.subscription.user.npub,
      },
    };
  }

  private getProvider(preferredType?: PaymentProviderType): PaymentProvider {
    const requested = preferredType || this.defaultProviderType;

    if (requested) {
      const provider = this.providerRegistry.get(requested);
      if (provider) {
        return provider;
      }
      this.logger.warn(`Preferred payment provider ${requested} not configured; falling back.`);
    }

    const fallback =
      this.providerRegistry.get('btcpay') ||
      this.providerRegistry.get('lnbits') ||
      this.providerRegistry.list()[0];

    if (!fallback) {
      throw new BadRequestException('No payment providers configured');
    }

    return fallback;
  }

  private getProviderFromPayload(payload: any): PaymentProvider | undefined {
    for (const provider of this.providerRegistry.list()) {
      if (provider.parseWebhookEvent(payload)) {
        return provider;
      }
    }
    return undefined;
  }
}
