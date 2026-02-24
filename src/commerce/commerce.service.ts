import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface Product {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  priceSats: number;
  tier: string;
  billingCycle?: 'monthly' | 'annual' | 'lifetime';
  features: string[];
  popular?: boolean;
}

export interface CommerceConfig {
  provider: 'btcpay' | 'lnbits';
  btcpayUrl?: string;
  btcpayStoreId?: string;
  btcpayApiKey?: string;
  lnbitsUrl?: string;
  lnbitsApiKey?: string;
}

export interface Invoice {
  id: string;
  productId: string;
  amountSats: number;
  amountUsd: number;
  status: 'pending' | 'paid' | 'expired' | 'invalid';
  paymentUrl?: string;
  invoiceString?: string;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class CommerceService {
  private readonly logger = new Logger(CommerceService.name);
  private config: CommerceConfig;
  private productCatalog: Map<string, Product>;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.config = {
      provider: this.configService.get('PAYMENTS_PROVIDER', 'btcpay') as any,
      btcpayUrl: this.configService.get('BTCPAY_URL'),
      btcpayStoreId: this.configService.get('BTCPAY_STORE_ID'),
      btcpayApiKey: this.configService.get('BTCPAY_API_KEY'),
      lnbitsUrl: this.configService.get('LNBITS_URL'),
      lnbitsApiKey: this.configService.get('LNBITS_API_KEY'),
    };

    this.productCatalog = this.initializeProductCatalog();
    this.logger.log(`Commerce service initialized with provider: ${this.config.provider}`);
  }

  /**
   * Initialize product catalog with NostrMaxi tiers
   */
  private initializeProductCatalog(): Map<string, Product> {
    const catalog = new Map<string, Product>();

    // FREE tier
    catalog.set('free', {
      id: 'free',
      name: 'Free',
      description: 'Get started with basic identity',
      priceUsd: 0,
      priceSats: 0,
      tier: 'FREE',
      features: [
        '1 NIP-05 Identity',
        'Basic WoT Scoring',
        'API Access (100 req/hour)',
        'Community Support',
      ],
    });

    // PRO tier - Monthly
    catalog.set('pro-monthly', {
      id: 'pro-monthly',
      name: 'Pro (Monthly)',
      description: 'Advanced features for power users',
      priceUsd: 900, // $9.00 in cents
      priceSats: 15000, // ~$9 at $60k BTC
      tier: 'PRO',
      billingCycle: 'monthly',
      features: [
        '1 NIP-05 Identity',
        'Custom Domain Support',
        'Advanced WoT Analytics',
        'API Access (1,000 req/hour)',
        'Priority Support',
        'Analytics Dashboard',
      ],
      popular: true,
    });

    // PRO tier - Annual
    catalog.set('pro-annual', {
      id: 'pro-annual',
      name: 'Pro (Annual)',
      description: 'Save 17% with annual billing',
      priceUsd: 9000, // $90.00 in cents (2 months free)
      priceSats: 150000,
      tier: 'PRO',
      billingCycle: 'annual',
      features: [
        'All Pro Monthly features',
        'Save $18/year',
        'Annual billing discount',
      ],
    });

    // BUSINESS tier - Monthly
    catalog.set('business-monthly', {
      id: 'business-monthly',
      name: 'Business (Monthly)',
      description: 'For teams and organizations',
      priceUsd: 2900, // $29.00 in cents
      priceSats: 48000,
      tier: 'BUSINESS',
      billingCycle: 'monthly',
      features: [
        '10 NIP-05 Identities',
        'Custom Domains',
        'Team Management',
        'API Access (10,000 req/hour)',
        'Priority Support',
        'Advanced Analytics',
        'Webhook Integration',
        'Audit Logs',
      ],
    });

    // BUSINESS tier - Annual
    catalog.set('business-annual', {
      id: 'business-annual',
      name: 'Business (Annual)',
      description: 'Save 17% with annual billing',
      priceUsd: 29000, // $290.00 in cents
      priceSats: 480000,
      tier: 'BUSINESS',
      billingCycle: 'annual',
      features: [
        'All Business Monthly features',
        'Save $58/year',
        'Annual billing discount',
      ],
    });

    // LIFETIME tier
    catalog.set('lifetime', {
      id: 'lifetime',
      name: 'Lifetime',
      description: 'One-time payment, lifetime access',
      priceUsd: 9900, // $99.00 in cents
      priceSats: 165000,
      tier: 'LIFETIME',
      billingCycle: 'lifetime',
      features: [
        'All Pro features',
        'Lifetime access',
        'One-time payment',
        'Grandfathered pricing',
        'Priority support',
      ],
    });

    return catalog;
  }

  /**
   * Get all products
   */
  getProducts(): Product[] {
    return Array.from(this.productCatalog.values());
  }

  /**
   * Get product by ID
   */
  getProduct(productId: string): Product | null {
    return this.productCatalog.get(productId) || null;
  }

  /**
   * Get products by tier
   */
  getProductsByTier(tier: string): Product[] {
    return Array.from(this.productCatalog.values()).filter((p) => p.tier === tier);
  }

  /**
   * Get commerce configuration (sanitized for frontend)
   */
  getConfig(): { provider: string; ready: boolean; features: string[] } {
    const ready = this.config.provider === 'btcpay' 
      ? !!(this.config.btcpayUrl && this.config.btcpayStoreId && this.config.btcpayApiKey)
      : !!(this.config.lnbitsUrl && this.config.lnbitsApiKey);

    return {
      provider: this.config.provider,
      ready,
      features: this.config.provider === 'btcpay' 
        ? ['lightning', 'onchain', 'invoices', 'webhooks', 'refunds']
        : ['lightning', 'invoices', 'webhooks'],
    };
  }

  /**
   * Create BTCPay invoice
   */
  async createBTCPayInvoice(productId: string, metadata?: Record<string, any>): Promise<Invoice> {
    const product = this.getProduct(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    if (!this.config.btcpayUrl || !this.config.btcpayStoreId || !this.config.btcpayApiKey) {
      throw new Error('BTCPay Server not configured');
    }

    try {
      // In production, call BTCPay API
      // For now, return mock invoice structure
      const invoiceId = `btcpay_${Date.now()}`;
      
      this.logger.log(`Creating BTCPay invoice for product ${productId}`);
      this.logger.log(`Amount: ${product.priceUsd} USD / ${product.priceSats} sats`);
      
      // Mock invoice response
      const invoice: Invoice = {
        id: invoiceId,
        productId,
        amountSats: product.priceSats,
        amountUsd: product.priceUsd,
        status: 'pending',
        paymentUrl: `${this.config.btcpayUrl}/i/${invoiceId}`,
        invoiceString: 'lnbc...', // Would be real BOLT11 invoice
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
        createdAt: new Date(),
      };

      return invoice;
    } catch (error) {
      this.logger.error(`Failed to create BTCPay invoice: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get payment method features
   */
  getPaymentMethodFeatures(): {
    lightning: { enabled: boolean; features: string[] };
    onchain: { enabled: boolean; features: string[] };
    fiat: { enabled: boolean; features: string[] };
  } {
    const isBTCPay = this.config.provider === 'btcpay';
    
    return {
      lightning: {
        enabled: true,
        features: [
          'Instant settlement',
          'Low fees',
          'BOLT11 invoices',
          ...(isBTCPay ? ['LNURL support'] : []),
        ],
      },
      onchain: {
        enabled: isBTCPay,
        features: isBTCPay 
          ? ['Native segwit', 'RBF support', '1-3 confirmations'] 
          : [],
      },
      fiat: {
        enabled: false,
        features: ['Coming soon'],
      },
    };
  }

  /**
   * Calculate pricing with WoT discount
   */
  async calculatePricingWithDiscount(
    productId: string,
    pubkey: string,
  ): Promise<{
    basePrice: number;
    discount: number;
    finalPrice: number;
    discountReason: string;
  }> {
    const product = this.getProduct(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Get user's WoT score
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { wotScore: true },
    });

    const discount = user?.wotScore?.discountPercent || 0;
    const basePrice = product.priceUsd;
    const finalPrice = Math.round(basePrice * (1 - discount / 100));

    let discountReason = 'No discount';
    if (discount > 0 && user?.wotScore) {
      discountReason = `${discount}% WoT discount (trust score: ${user.wotScore.trustScore})`;
    }

    return {
      basePrice,
      discount,
      finalPrice,
      discountReason,
    };
  }

  /**
   * Get payment provider status
   */
  async getProviderStatus(): Promise<{
    provider: string;
    healthy: boolean;
    configured: boolean;
    lastCheck: Date;
    details?: any;
  }> {
    const configured = this.config.provider === 'btcpay'
      ? !!(this.config.btcpayUrl && this.config.btcpayStoreId && this.config.btcpayApiKey)
      : !!(this.config.lnbitsUrl && this.config.lnbitsApiKey);

    // In production, ping the actual provider
    const healthy = configured; // Assume healthy if configured

    return {
      provider: this.config.provider,
      healthy,
      configured,
      lastCheck: new Date(),
      details: {
        url: this.config.provider === 'btcpay' ? this.config.btcpayUrl : this.config.lnbitsUrl,
        storeId: this.config.provider === 'btcpay' ? this.config.btcpayStoreId : undefined,
      },
    };
  }
}
