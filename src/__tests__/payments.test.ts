/**
 * Payment Webhook Handling Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from '../payments/payments.controller';
import { PaymentsService } from '../payments/payments.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { createMockPrismaService } from './mocks/prisma.mock';
import { generateTestKeypair, createNip98AuthHeader, mockLnbitsInvoice } from './helpers/test-utils';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { nip19 } from 'nostr-tools';
import * as crypto from 'crypto';

// Mock fetch for LNbits API calls
global.fetch = jest.fn();

describe('Payment Webhook Handling', () => {
  let controller: PaymentsController;
  let service: PaymentsService;
  let authService: AuthService;
  let prisma: any;
  let testUser: any;
  let testKeypair: any;
  let mockRequest: any;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    
    // Mock cache manager
    const cache = new Map<string, any>();
    const mockCacheManager = {
      get: jest.fn((key: string) => Promise.resolve(cache.get(key))),
      set: jest.fn((key: string, value: any, ttl?: number) => {
        cache.set(key, value);
        return Promise.resolve();
      }),
      del: jest.fn((key: string) => {
        cache.delete(key);
        return Promise.resolve();
      }),
    };
    
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: any = {
                JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
                LNBITS_URL: 'https://test.lnbits.com',
                LNBITS_API_KEY: '', // Empty to use mocks
                BASE_URL: 'http://localhost:3000',
                WEBHOOK_SECRET: 'test-webhook-secret',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get<PaymentsService>(PaymentsService);
    authService = module.get<AuthService>(AuthService);

    testKeypair = generateTestKeypair();
    testUser = {
      id: 'user_test_1',
      pubkey: testKeypair.pubkey,
      npub: nip19.npubEncode(testKeypair.pubkey),
      subscription: {
        id: 'sub_test_1',
        tier: 'FREE',
        userId: 'user_test_1',
      },
    };
    
    prisma.seed({ users: [testUser] });
    
    mockRequest = {
      protocol: 'http',
      get: jest.fn(() => 'localhost:3000'),
      originalUrl: '/api/v1/payments/invoice',
    };

    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    prisma.reset();
  });

  describe('GET /api/v1/payments/tiers', () => {
    it('should return all available subscription tiers', async () => {
      // Act
      const tiers = await controller.getTiers();

      // Assert
      expect(Array.isArray(tiers)).toBe(true);
      expect(tiers.length).toBeGreaterThan(0);
      
      const freeTier = tiers.find((t) => t.tier === 'FREE');
      expect(freeTier).toBeDefined();
      expect(freeTier?.priceUsd).toBe(0);
      expect(freeTier?.priceSats).toBe(0);
      
      const proTier = tiers.find((t) => t.tier === 'PRO');
      expect(proTier).toBeDefined();
      expect(proTier?.priceUsd).toBeGreaterThan(0);
      expect(proTier?.customDomain).toBe(true);
    });
  });

  describe('POST /api/v1/payments/invoice', () => {
    it('should create Lightning invoice for PRO subscription', async () => {
      // Setup
      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/payments/invoice',
        testKeypair.secretKey
      );

      // Act
      const result = await controller.createInvoice(
        authHeader,
        mockRequest,
        { tier: 'PRO', applyWotDiscount: false }
      );

      // Assert
      expect(result).toHaveProperty('paymentId');
      expect(result).toHaveProperty('invoice');
      expect(result).toHaveProperty('paymentHash');
      expect(result).toHaveProperty('amountSats');
      expect(result.amountSats).toBe(21000); // PRO tier price
      expect(result.discountPercent).toBe(0);
      
      // Verify payment record was created
      expect(prisma.payment.create).toHaveBeenCalled();
    });

    it('should apply WoT discount when eligible', async () => {
      // Setup: Add WoT score to user
      testUser.wotScore = {
        trustScore: 75,
        discountPercent: 20,
      };

      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/payments/invoice',
        testKeypair.secretKey
      );

      // Act
      const result = await controller.createInvoice(
        authHeader,
        mockRequest,
        { tier: 'PRO', applyWotDiscount: true }
      );

      // Assert
      expect(result.discountPercent).toBe(20);
      expect(result.amountSats).toBe(16800); // 21000 * 0.8 = 16800
    });

    it('should cap WoT discount at 50%', async () => {
      // Setup: Add excessive discount
      testUser.wotScore = {
        trustScore: 95,
        discountPercent: 80, // Trying to get 80% discount
      };

      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/payments/invoice',
        testKeypair.secretKey
      );

      // Act
      const result = await controller.createInvoice(
        authHeader,
        mockRequest,
        { tier: 'PRO', applyWotDiscount: true }
      );

      // Assert
      expect(result.discountPercent).toBe(50); // Capped at 50%
      expect(result.amountSats).toBe(10500); // 21000 * 0.5
    });

    it('should reject invoice creation for FREE tier', async () => {
      // Setup
      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/payments/invoice',
        testKeypair.secretKey
      );

      // Act & Assert
      await expect(
        controller.createInvoice(authHeader, mockRequest, {
          tier: 'FREE',
          applyWotDiscount: false,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should create LIFETIME subscription invoice', async () => {
      // Setup
      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/payments/invoice',
        testKeypair.secretKey
      );

      // Act
      const result = await controller.createInvoice(
        authHeader,
        mockRequest,
        { tier: 'LIFETIME', applyWotDiscount: false }
      );

      // Assert
      expect(result.amountSats).toBe(210000); // LIFETIME tier price
    });
  });

  describe('GET /api/v1/payments/invoice/:id', () => {
    it('should return pending status for unpaid invoice', async () => {
      // Setup: Create a payment
      const payment = {
        id: 'payment_1',
        subscriptionId: testUser.subscription.id,
        amountSats: 21000,
        status: 'pending',
        paymentHash: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
      };
      prisma.payments.set(payment.id, payment);

      // Mock LNbits response (unpaid)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paid: false, pending: true }),
      });

      // Act
      const result = await controller.checkInvoice(payment.id);

      // Assert
      expect(result.status).toBe('pending');
      expect(result.paid).toBe(false);
    });

    it('should process payment when manually marked as paid', async () => {
      // Setup: Create a payment
      const payment = {
        id: 'payment_2',
        subscriptionId: testUser.subscription.id,
        amountSats: 21000,
        status: 'pending',
        paymentHash: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
      };
      prisma.payments.set(payment.id, payment);
      prisma.subscriptions.set(testUser.subscription.id, testUser.subscription);

      // Store tier info in audit log (as service does)
      await prisma.auditLog.create({
        data: {
          action: 'payment.created',
          entityId: payment.id,
          actorPubkey: testUser.pubkey,
          details: { tier: 'PRO', amountSats: 21000 },
        },
      });

      // Directly process the payment (simulating webhook confirmation)
      await service['processPayment'](payment.id);

      // Act: Now check the status
      const result = await controller.checkInvoice(payment.id);

      // Assert
      expect(result.status).toBe('paid');
      expect(result.paid).toBe(true);
      expect(result.tier).toBe('PRO');
      expect(result.expiresAt).toBeDefined();
      
      // Verify subscription was updated
      expect(prisma.subscription.update).toHaveBeenCalled();
    });

    it('should mark invoice as expired after 10 minutes', async () => {
      // Setup: Create old payment
      const oldDate = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      const payment = {
        id: 'payment_3',
        subscriptionId: testUser.subscription.id,
        amountSats: 21000,
        status: 'pending',
        paymentHash: crypto.randomBytes(32).toString('hex'),
        createdAt: oldDate,
      };
      prisma.payments.set(payment.id, payment);

      // Act
      const result = await controller.checkInvoice(payment.id);

      // Assert
      expect(result.status).toBe('expired');
      expect(result.paid).toBe(false);
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'expired' },
        })
      );
    });

    it('should return cached result for already-paid invoice', async () => {
      // Setup: Create paid payment
      const payment = {
        id: 'payment_4',
        subscriptionId: testUser.subscription.id,
        amountSats: 21000,
        status: 'paid',
        paidAt: new Date(),
        paymentHash: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(Date.now() - 1000),
      };
      prisma.payments.set(payment.id, payment);
      prisma.subscriptions.set(testUser.subscription.id, {
        ...testUser.subscription,
        tier: 'PRO',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Act
      const result = await controller.checkInvoice(payment.id);

      // Assert
      expect(result.status).toBe('paid');
      expect(result.paid).toBe(true);
      
      // Should not call LNbits for already-paid invoices
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/payments/webhook', () => {
    it('should process webhook with valid signature', async () => {
      // Setup: Create pending payment
      const paymentHash = crypto.randomBytes(32).toString('hex');
      const payment = {
        id: 'payment_5',
        subscriptionId: testUser.subscription.id,
        amountSats: 21000,
        status: 'pending',
        paymentHash,
        createdAt: new Date(),
      };
      prisma.payments.set(payment.id, payment);
      prisma.subscriptions.set(testUser.subscription.id, testUser.subscription);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'payment.created',
          entityId: payment.id,
          actorPubkey: testUser.pubkey,
          details: { tier: 'PRO', amountSats: 21000 },
        },
      });

      // Generate valid signature
      const signature = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(paymentHash)
        .digest('hex');

      // Mock provider verification (returns paid)
      const provider = (service as any).providerRegistry.get('lnbits');
      const providerSpy = jest.spyOn(provider, 'getInvoiceStatus');
      providerSpy.mockResolvedValueOnce({
        provider: 'lnbits',
        providerInvoiceId: paymentHash,
        state: 'paid',
      });

      // Act
      const result = await controller.handleWebhook(
        { payment_hash: paymentHash },
        signature
      );

      // Assert
      expect(result.success).toBe(true);
      expect(prisma.subscription.update).toHaveBeenCalled();
      
      // Cleanup
      providerSpy.mockRestore();
    });

    it('should reject webhook with invalid signature', async () => {
      // Setup
      const paymentHash = crypto.randomBytes(32).toString('hex');
      const invalidSignature = 'invalid-signature';

      // Act & Assert
      await expect(
        controller.handleWebhook({ payment_hash: paymentHash }, invalidSignature)
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle webhook for non-existent payment', async () => {
      // Setup
      const paymentHash = crypto.randomBytes(32).toString('hex');
      const signature = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(paymentHash)
        .digest('hex');

      // Act
      const result = await controller.handleWebhook({ payment_hash: paymentHash }, signature);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should ignore duplicate webhook for already-paid invoice', async () => {
      // Setup: Already paid payment
      const paymentHash = crypto.randomBytes(32).toString('hex');
      const payment = {
        id: 'payment_6',
        subscriptionId: testUser.subscription.id,
        amountSats: 21000,
        status: 'paid', // Already paid
        paymentHash,
        paidAt: new Date(),
        createdAt: new Date(),
      };
      prisma.payments.set(payment.id, payment);

      const signature = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(paymentHash)
        .digest('hex');

      // Act
      const result = await controller.handleWebhook({ payment_hash: paymentHash }, signature);

      // Assert
      expect(result.success).toBe(true);
      
      // Should not try to process again
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('Payment Processing', () => {
    it('should upgrade subscription tier when payment is processed', async () => {
      // Setup
      const payment = {
        id: 'payment_7',
        subscriptionId: testUser.subscription.id,
        amountSats: 21000,
        status: 'pending',
        paymentHash: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
      };
      prisma.payments.set(payment.id, payment);
      prisma.subscriptions.set(testUser.subscription.id, testUser.subscription);

      await prisma.auditLog.create({
        data: {
          action: 'payment.created',
          entityId: payment.id,
          actorPubkey: testUser.pubkey,
          details: { tier: 'PRO', amountSats: 21000 },
        },
      });

      // Act
      const result = await service['processPayment'](payment.id);

      // Assert
      expect(result.tier).toBe('PRO');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.receiptNumber).toMatch(/^NM-/);
      
      // Verify subscription update
      const updateCall = prisma.subscription.update.mock.calls.find(
        (call: any) => call[0].where.id === testUser.subscription.id
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0].data.tier).toBe('PRO');
      expect(updateCall[0].data.expiresAt).toBeInstanceOf(Date);
    });

    it('should set 100-year expiry for LIFETIME subscriptions', async () => {
      // Setup
      const payment = {
        id: 'payment_8',
        subscriptionId: testUser.subscription.id,
        amountSats: 210000,
        status: 'pending',
        paymentHash: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
      };
      prisma.payments.set(payment.id, payment);
      prisma.subscriptions.set(testUser.subscription.id, testUser.subscription);

      await prisma.auditLog.create({
        data: {
          action: 'payment.created',
          entityId: payment.id,
          actorPubkey: testUser.pubkey,
          details: { tier: 'LIFETIME', amountSats: 210000 },
        },
      });

      // Act
      const result = await service['processPayment'](payment.id);

      // Assert
      expect(result.tier).toBe('LIFETIME');
      
      // Expiry should be ~100 years in the future
      const yearsDiff =
        (result.expiresAt.getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
      expect(yearsDiff).toBeGreaterThan(90);
    });

    it('should extend existing subscription when renewing', async () => {
      // Setup: User has existing subscription expiring in 10 days
      const currentExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      testUser.subscription.expiresAt = currentExpiry;
      testUser.subscription.tier = 'PRO';
      prisma.subscriptions.set(testUser.subscription.id, testUser.subscription);

      const payment = {
        id: 'payment_9',
        subscriptionId: testUser.subscription.id,
        amountSats: 21000,
        status: 'pending',
        paymentHash: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
      };
      prisma.payments.set(payment.id, payment);

      await prisma.auditLog.create({
        data: {
          action: 'payment.created',
          entityId: payment.id,
          actorPubkey: testUser.pubkey,
          details: { tier: 'PRO', amountSats: 21000 },
        },
      });

      // Act
      const result = await service['processPayment'](payment.id);

      // Assert: Should extend from current expiry, not from now
      const expectedExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
      const actualExpiry = result.expiresAt;
      
      // Allow 1 second tolerance
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });
  });
});
