import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CommerceService } from '../commerce/commerce.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CommerceService', () => {
  let service: CommerceService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommerceService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: any = {
                PAYMENTS_PROVIDER: 'btcpay',
                BTCPAY_URL: 'https://btcpay.example.com',
                BTCPAY_STORE_ID: 'test-store',
                BTCPAY_API_KEY: 'test-key',
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CommerceService>(CommerceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('Product Catalog', () => {
    it('should return all products', () => {
      const products = service.getProducts();
      expect(products.length).toBeGreaterThan(0);
      expect(products.some(p => p.tier === 'FREE')).toBe(true);
      expect(products.some(p => p.tier === 'PRO')).toBe(true);
      expect(products.some(p => p.tier === 'BUSINESS')).toBe(true);
      expect(products.some(p => p.tier === 'LIFETIME')).toBe(true);
    });

    it('should get product by ID', () => {
      const product = service.getProduct('pro-monthly');
      expect(product).toBeDefined();
      expect(product?.name).toBe('Pro (Monthly)');
      expect(product?.tier).toBe('PRO');
      expect(product?.billingCycle).toBe('monthly');
    });

    it('should return null for non-existent product', () => {
      const product = service.getProduct('invalid-product');
      expect(product).toBeNull();
    });

    it('should get products by tier', () => {
      const proProducts = service.getProductsByTier('PRO');
      expect(proProducts.length).toBeGreaterThan(0);
      expect(proProducts.every(p => p.tier === 'PRO')).toBe(true);
    });

    it('should have correct pricing for PRO monthly', () => {
      const product = service.getProduct('pro-monthly');
      expect(product?.priceUsd).toBe(900); // $9.00
      expect(product?.priceSats).toBe(15000);
    });

    it('should have correct pricing for BUSINESS monthly', () => {
      const product = service.getProduct('business-monthly');
      expect(product?.priceUsd).toBe(2900); // $29.00
      expect(product?.priceSats).toBe(48000);
    });

    it('should have annual products with discounts', () => {
      const proAnnual = service.getProduct('pro-annual');
      const proMonthly = service.getProduct('pro-monthly');
      
      expect(proAnnual).toBeDefined();
      expect(proMonthly).toBeDefined();
      
      // Annual should be less than 12x monthly (discount)
      if (proAnnual && proMonthly) {
        expect(proAnnual.priceUsd).toBeLessThan(proMonthly.priceUsd * 12);
      }
    });

    it('should have lifetime product', () => {
      const lifetime = service.getProduct('lifetime');
      expect(lifetime).toBeDefined();
      expect(lifetime?.billingCycle).toBe('lifetime');
      expect(lifetime?.priceUsd).toBe(9900); // $99.00
    });
  });

  describe('Commerce Configuration', () => {
    it('should return commerce config', () => {
      const config = service.getConfig();
      expect(config.provider).toBe('btcpay');
      expect(config.ready).toBe(true);
      expect(config.features).toContain('lightning');
      expect(config.features).toContain('onchain');
    });

    it('should return payment method features', () => {
      const features = service.getPaymentMethodFeatures();
      expect(features.lightning.enabled).toBe(true);
      expect(features.onchain.enabled).toBe(true);
      expect(features.fiat.enabled).toBe(false);
    });
  });

  describe('Invoice Creation', () => {
    it('should create BTCPay invoice for valid product', async () => {
      const invoice = await service.createBTCPayInvoice('pro-monthly');
      
      expect(invoice).toBeDefined();
      expect(invoice.productId).toBe('pro-monthly');
      expect(invoice.amountUsd).toBe(900);
      expect(invoice.amountSats).toBe(15000);
      expect(invoice.status).toBe('pending');
      expect(invoice.paymentUrl).toContain('btcpay');
    });

    it('should throw error for invalid product', async () => {
      await expect(service.createBTCPayInvoice('invalid-product'))
        .rejects
        .toThrow('Product invalid-product not found');
    });

    it('should set invoice expiration', async () => {
      const invoice = await service.createBTCPayInvoice('pro-monthly');
      const now = new Date();
      const diff = invoice.expiresAt.getTime() - now.getTime();
      
      // Should expire in ~15 minutes
      expect(diff).toBeGreaterThan(14 * 60 * 1000);
      expect(diff).toBeLessThan(16 * 60 * 1000);
    });
  });

  describe('WoT Discount Calculation', () => {
    it('should apply discount for high WoT score', async () => {
      const mockUser = {
        pubkey: 'test-pubkey',
        wotScore: {
          trustScore: 85,
          discountPercent: 20,
        },
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const pricing = await service.calculatePricingWithDiscount('pro-monthly', 'test-pubkey');

      expect(pricing.basePrice).toBe(900);
      expect(pricing.discount).toBe(20);
      expect(pricing.finalPrice).toBe(720); // 20% discount
      expect(pricing.discountReason).toContain('20%');
      expect(pricing.discountReason).toContain('trust score: 85');
    });

    it('should apply medium discount for medium WoT score', async () => {
      const mockUser = {
        pubkey: 'test-pubkey',
        wotScore: {
          trustScore: 60,
          discountPercent: 10,
        },
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const pricing = await service.calculatePricingWithDiscount('pro-monthly', 'test-pubkey');

      expect(pricing.discount).toBe(10);
      expect(pricing.finalPrice).toBe(810); // 10% discount
    });

    it('should apply no discount for low WoT score', async () => {
      const mockUser = {
        pubkey: 'test-pubkey',
        wotScore: {
          trustScore: 30,
          discountPercent: 0,
        },
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      const pricing = await service.calculatePricingWithDiscount('pro-monthly', 'test-pubkey');

      expect(pricing.discount).toBe(0);
      expect(pricing.finalPrice).toBe(900);
      expect(pricing.discountReason).toBe('No discount');
    });

    it('should handle user without WoT score', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const pricing = await service.calculatePricingWithDiscount('pro-monthly', 'new-user');

      expect(pricing.discount).toBe(0);
      expect(pricing.finalPrice).toBe(900);
    });
  });

  describe('Provider Status', () => {
    it('should return provider health status', async () => {
      const status = await service.getProviderStatus();

      expect(status.provider).toBe('btcpay');
      expect(status.configured).toBe(true);
      expect(status.healthy).toBe(true);
      expect(status.details.url).toBe('https://btcpay.example.com');
      expect(status.details.storeId).toBe('test-store');
    });
  });
});
