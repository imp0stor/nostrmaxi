/**
 * NIP-05 Verification Endpoint Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Nip05Controller } from '../nip05/nip05.controller';
import { Nip05Service } from '../nip05/nip05.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { createMockPrismaService } from './mocks/prisma.mock';
import { generateTestKeypair, createNip98AuthHeader } from './helpers/test-utils';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { nip19 } from 'nostr-tools';

describe('NIP-05 Verification Endpoint', () => {
  let controller: Nip05Controller;
  let service: Nip05Service;
  let authService: AuthService;
  let prisma: any;
  let testUser: any;
  let testKeypair: any;

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
      controllers: [Nip05Controller],
      providers: [
        Nip05Service,
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: any = {
                NIP05_DEFAULT_DOMAIN: 'test.nostrmaxi.com',
                NIP05_DEFAULT_RELAYS: 'wss://relay.test.com,wss://relay2.test.com',
                NIP05_DOMAIN_CATALOG_JSON: JSON.stringify({
                  domains: [
                    { domain: 'test.nostrmaxi.com', label: 'Test NostrMaxi', category: 'nostrmaxi' },
                    { domain: 'nostrmaxi.com', label: 'NostrMaxi', category: 'nostrmaxi' },
                  ],
                }),
                JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
                BASE_URL: 'http://localhost:3000',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<Nip05Controller>(Nip05Controller);
    service = module.get<Nip05Service>(Nip05Service);
    authService = module.get<AuthService>(AuthService);

    // Create test user
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
      nip05s: [],
    };
    
    prisma.seed({
      users: [testUser],
    });
  });

  afterEach(() => {
    prisma.reset();
  });

  describe('GET /.well-known/nostr.json', () => {
    it('should return NIP-05 identity for existing user', async () => {
      // Setup: Create a NIP-05 identity
      const nip05 = {
        id: 'nip05_1',
        localPart: 'alice',
        domain: 'test.nostrmaxi.com',
        userId: testUser.id,
        isActive: true,
      };
      prisma.nip05s.set(nip05.id, nip05);

      // Act
      const result = await controller.wellKnown({ name: 'alice' });

      // Assert
      expect(result).toEqual({
        names: {
          alice: testUser.pubkey,
        },
        relays: {
          [testUser.pubkey]: ['wss://relay.test.com', 'wss://relay2.test.com'],
        },
      });
    });

    it('should throw NotFoundException for non-existent identity', async () => {
      // Act & Assert
      await expect(controller.wellKnown({ name: 'nonexistent' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should not return inactive identities', async () => {
      // Setup: Create an inactive NIP-05 identity
      const nip05 = {
        id: 'nip05_2',
        localPart: 'bob',
        domain: 'test.nostrmaxi.com',
        userId: testUser.id,
        isActive: false,
      };
      prisma.nip05s.set(nip05.id, nip05);

      // Act & Assert
      await expect(controller.wellKnown({ name: 'bob' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should be case-insensitive for lookups', async () => {
      // Setup
      const nip05 = {
        id: 'nip05_3',
        localPart: 'alice',
        domain: 'test.nostrmaxi.com',
        userId: testUser.id,
        isActive: true,
      };
      prisma.nip05s.set(nip05.id, nip05);

      // Act
      const result = await controller.wellKnown({ name: 'ALICE' });

      // Assert
      expect(result.names.ALICE).toBe(testUser.pubkey);
    });
  });

  describe('GET /api/v1/nip05/domains', () => {
    it('should return the domain catalog', async () => {
      const result = await controller.listDomains();
      expect(result.defaultDomain).toBe('test.nostrmaxi.com');
      expect(result.domains).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ domain: 'test.nostrmaxi.com' }),
          expect.objectContaining({ domain: 'nostrmaxi.com' }),
        ])
      );
    });
  });

  describe('POST /api/v1/nip05/provision', () => {
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        protocol: 'http',
        get: jest.fn(() => 'localhost:3000'),
        originalUrl: '/api/v1/nip05/provision',
      };
    });

    it('should provision a new NIP-05 identity with valid auth', async () => {
      // Setup
      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/nip05/provision',
        testKeypair.secretKey
      );

      // Act
      const result = await controller.provision(
        authHeader,
        mockRequest,
        { localPart: 'alice', domain: 'test.nostrmaxi.com' }
      );

      // Assert
      expect(result).toMatchObject({
        address: 'alice@test.nostrmaxi.com',
        pubkey: testUser.pubkey,
        npub: testUser.npub,
      });
      expect(result.createdAt).toBeDefined();
      
      // Verify it was created in the database
      expect(prisma.nip05.create).toHaveBeenCalled();
    });

    it('should normalize local part (lowercase, alphanumeric)', async () => {
      // Setup
      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/nip05/provision',
        testKeypair.secretKey
      );

      // Act
      const result = await controller.provision(
        authHeader,
        mockRequest,
        { localPart: 'Alice_123!@#', domain: 'test.nostrmaxi.com' }
      );

      // Assert
      expect(result.address).toBe('alice_123@test.nostrmaxi.com');
    });

    it('should reject local parts that are too short', async () => {
      // Setup
      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/nip05/provision',
        testKeypair.secretKey
      );

      // Act & Assert
      await expect(
        controller.provision(authHeader, mockRequest, {
          localPart: 'a',
          domain: 'test.nostrmaxi.com',
        })
      ).rejects.toThrow('Local part must be at least 2 characters');
    });

    it('should reject duplicate NIP-05 identities', async () => {
      // Setup: Create existing NIP-05
      const nip05 = {
        id: 'nip05_4',
        localPart: 'alice',
        domain: 'test.nostrmaxi.com',
        userId: 'other_user',
        isActive: true,
      };
      prisma.nip05s.set(nip05.id, nip05);

      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/nip05/provision',
        testKeypair.secretKey
      );

      // Act & Assert
      await expect(
        controller.provision(authHeader, mockRequest, {
          localPart: 'alice',
          domain: 'test.nostrmaxi.com',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should enforce tier limits for FREE users (1 identity max)', async () => {
      // Setup: User already has 1 NIP-05 (FREE limit)
      const nip05 = {
        id: 'nip05_5',
        localPart: 'existing',
        domain: 'test.nostrmaxi.com',
        userId: testUser.id,
        isActive: true,
      };
      prisma.nip05s.set(nip05.id, nip05);
      testUser.nip05s = [nip05];

      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/nip05/provision',
        testKeypair.secretKey
      );

      // Act & Assert
      await expect(
        controller.provision(authHeader, mockRequest, {
          localPart: 'second',
          domain: 'test.nostrmaxi.com',
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow PRO users to create up to 3 identities', async () => {
      // Setup: Upgrade to PRO
      testUser.subscription.tier = 'PRO';
      
      // Create first two identities
      const nip05_1 = {
        id: 'nip05_10',
        localPart: 'first',
        domain: 'test.nostrmaxi.com',
        userId: testUser.id,
        isActive: true,
      };
      const nip05_2 = {
        id: 'nip05_11',
        localPart: 'second',
        domain: 'test.nostrmaxi.com',
        userId: testUser.id,
        isActive: true,
      };
      prisma.nip05s.set(nip05_1.id, nip05_1);
      prisma.nip05s.set(nip05_2.id, nip05_2);
      testUser.nip05s = [nip05_1, nip05_2];

      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/nip05/provision',
        testKeypair.secretKey
      );

      // Act - Should succeed (3rd identity)
      const result = await controller.provision(
        authHeader,
        mockRequest,
        { localPart: 'third', domain: 'test.nostrmaxi.com' }
      );

      // Assert
      expect(result.address).toBe('third@test.nostrmaxi.com');
    });

    it('should enforce PRO tier limit at 3 identities', async () => {
      // Setup: Upgrade to PRO with 3 existing identities
      testUser.subscription.tier = 'PRO';
      
      const identities = [
        { id: 'nip05_12', localPart: 'first', domain: 'test.nostrmaxi.com', userId: testUser.id, isActive: true },
        { id: 'nip05_13', localPart: 'second', domain: 'test.nostrmaxi.com', userId: testUser.id, isActive: true },
        { id: 'nip05_14', localPart: 'third', domain: 'test.nostrmaxi.com', userId: testUser.id, isActive: true },
      ];
      identities.forEach((n) => prisma.nip05s.set(n.id, n));
      testUser.nip05s = identities;

      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/nip05/provision',
        testKeypair.secretKey
      );

      // Act & Assert - Should fail (4th identity)
      await expect(
        controller.provision(authHeader, mockRequest, {
          localPart: 'fourth',
          domain: 'test.nostrmaxi.com',
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow custom domains for PRO users with verified domain', async () => {
      // Setup: Upgrade to PRO
      testUser.subscription.tier = 'PRO';
      
      // Add verified domain
      prisma.domains.set('custom.com', {
        id: 'domain_1',
        domain: 'custom.com',
        ownerPubkey: testUser.pubkey,
        verified: true,
      });

      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/nip05/provision',
        testKeypair.secretKey
      );

      // Act
      const result = await controller.provision(
        authHeader,
        mockRequest,
        { localPart: 'alice', domain: 'custom.com' }
      );

      // Assert
      expect(result.address).toBe('alice@custom.com');
    });

    it('should reject custom domains for FREE users', async () => {
      // Setup
      const authHeader = createNip98AuthHeader(
        'POST',
        'http://localhost:3000/api/v1/nip05/provision',
        testKeypair.secretKey
      );

      // Act & Assert
      await expect(
        controller.provision(authHeader, mockRequest, {
          localPart: 'alice',
          domain: 'custom.com',
        })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('DELETE /api/v1/nip05', () => {
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        protocol: 'http',
        get: jest.fn(() => 'localhost:3000'),
        originalUrl: '/api/v1/nip05',
      };
    });

    it('should delete owned NIP-05 identity', async () => {
      // Setup
      const nip05 = {
        id: 'nip05_6',
        localPart: 'alice',
        domain: 'test.nostrmaxi.com',
        userId: testUser.id,
        isActive: true,
      };
      prisma.nip05s.set(nip05.id, nip05);

      const authHeader = createNip98AuthHeader(
        'DELETE',
        'http://localhost:3000/api/v1/nip05',
        testKeypair.secretKey
      );

      // Act
      const result = await controller.delete(
        authHeader,
        mockRequest,
        { localPart: 'alice', domain: 'test.nostrmaxi.com' }
      );

      // Assert
      expect(result).toEqual({ deleted: true });
      expect(prisma.nip05.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        })
      );
    });

    it('should not delete NIP-05 owned by another user', async () => {
      // Setup: NIP-05 owned by different user
      const nip05 = {
        id: 'nip05_7',
        localPart: 'bob',
        domain: 'test.nostrmaxi.com',
        userId: 'other_user_id',
        isActive: true,
      };
      prisma.nip05s.set(nip05.id, nip05);

      const authHeader = createNip98AuthHeader(
        'DELETE',
        'http://localhost:3000/api/v1/nip05',
        testKeypair.secretKey
      );

      // Act & Assert
      await expect(
        controller.delete(authHeader, mockRequest, {
          localPart: 'bob',
          domain: 'test.nostrmaxi.com',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /api/v1/nip05/mine', () => {
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        protocol: 'http',
        get: jest.fn(() => 'localhost:3000'),
        originalUrl: '/api/v1/nip05/mine',
      };
    });

    it('should list all active NIP-05 identities for authenticated user', async () => {
      // Setup
      const nip05s = [
        {
          id: 'nip05_8',
          localPart: 'alice',
          domain: 'test.nostrmaxi.com',
          userId: testUser.id,
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'nip05_9',
          localPart: 'inactive',
          domain: 'test.nostrmaxi.com',
          userId: testUser.id,
          isActive: false,
          createdAt: new Date(),
        },
      ];
      nip05s.forEach((n) => prisma.nip05s.set(n.id, n));

      const authHeader = createNip98AuthHeader(
        'GET',
        'http://localhost:3000/api/v1/nip05/mine',
        testKeypair.secretKey
      );

      // Act
      const result = await controller.listMine(authHeader, mockRequest);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        address: 'alice@test.nostrmaxi.com',
        localPart: 'alice',
        domain: 'test.nostrmaxi.com',
      });
    });

    it('should return empty array for user with no NIP-05 identities', async () => {
      // Setup
      const authHeader = createNip98AuthHeader(
        'GET',
        'http://localhost:3000/api/v1/nip05/mine',
        testKeypair.secretKey
      );

      // Act
      const result = await controller.listMine(authHeader, mockRequest);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
