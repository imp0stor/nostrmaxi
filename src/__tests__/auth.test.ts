/**
 * Authentication Flow Tests (JWT creation, validation)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { createMockPrismaService } from './mocks/prisma.mock';
import { generateTestKeypair, createNip42AuthEvent, createNip98AuthHeader } from './helpers/test-utils';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { nip19 } from 'nostr-tools';
import * as crypto from 'crypto';

describe('Authentication Flows', () => {
  let controller: AuthController;
  let service: AuthService;
  let prisma: any;
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
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: any = {
                JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
                BASE_URL: 'http://localhost:3000',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);

    testKeypair = generateTestKeypair();
    
    mockRequest = {
      protocol: 'http',
      get: jest.fn(() => 'localhost:3000'),
      originalUrl: '/api/v1/auth/me',
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    };
  });

  afterEach(() => {
    prisma.reset();
  });

  describe('Challenge-Response Authentication (NIP-42)', () => {
    it('should generate a challenge', async () => {
      // Act
      const result = await controller.getChallenge({ pubkey: testKeypair.pubkey });

      // Assert
      expect(result).toHaveProperty('challenge');
      expect(result).toHaveProperty('expiresAt');
      expect(result.challenge).toHaveLength(64); // 32 bytes hex
      expect(typeof result.expiresAt).toBe('number');
      
      // Verify challenge was stored
      expect(prisma.authChallenge.create).toHaveBeenCalled();
    });

    it('should verify a valid signed challenge and return JWT', async () => {
      // Setup: Generate challenge
      const challengeResponse = await controller.getChallenge({});
      const challenge = challengeResponse.challenge;
      
      // Create signed NIP-42 event
      const authEvent = createNip42AuthEvent(challenge, testKeypair.secretKey);

      // Act
      const result = await controller.verifyChallenge(
        { event: authEvent as any },
        mockRequest
      );

      // Assert
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('expiresAt');
      expect(result.user.pubkey).toBe(testKeypair.pubkey);
      expect(result.user.npub).toBe(nip19.npubEncode(testKeypair.pubkey));
      
      // Verify session was created
      expect(prisma.session.create).toHaveBeenCalled();
      
      // Verify challenge was marked as used
      expect(prisma.authChallenge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        })
      );
    });

    it('should reject invalid event kind', async () => {
      // Setup: Create event with wrong kind
      const challenge = crypto.randomBytes(32).toString('hex');
      await prisma.authChallenge.create({
        data: {
          challenge,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      const wrongKindEvent = {
        ...createNip42AuthEvent(challenge, testKeypair.secretKey),
        kind: 1, // Wrong kind
      };

      // Act & Assert
      await expect(
        controller.verifyChallenge({ event: wrongKindEvent as any }, mockRequest)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject expired challenge', async () => {
      // Setup: Create expired challenge
      const challenge = crypto.randomBytes(32).toString('hex');
      await prisma.authChallenge.create({
        data: {
          challenge,
          expiresAt: new Date(Date.now() - 1000), // Already expired
        },
      });

      const authEvent = createNip42AuthEvent(challenge, testKeypair.secretKey);

      // Act & Assert
      await expect(
        controller.verifyChallenge({ event: authEvent as any }, mockRequest)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject reused challenge', async () => {
      // Setup: Create and use a challenge
      const challenge = crypto.randomBytes(32).toString('hex');
      await prisma.authChallenge.create({
        data: {
          challenge,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          usedAt: new Date(), // Already used
        },
      });

      const authEvent = createNip42AuthEvent(challenge, testKeypair.secretKey);

      // Act & Assert
      await expect(
        controller.verifyChallenge({ event: authEvent as any }, mockRequest)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should create user on first authentication', async () => {
      // Setup
      const challengeResponse = await controller.getChallenge({});
      const authEvent = createNip42AuthEvent(challengeResponse.challenge, testKeypair.secretKey);

      // Act
      await controller.verifyChallenge({ event: authEvent as any }, mockRequest);

      // Assert: User should be created with FREE subscription
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pubkey: testKeypair.pubkey,
            npub: nip19.npubEncode(testKeypair.pubkey),
            subscription: expect.objectContaining({
              create: expect.objectContaining({ tier: 'FREE' }),
            }),
          }),
        })
      );
    });
  });

  describe('NIP-98 HTTP Auth', () => {
    it('should verify valid NIP-98 auth header', async () => {
      // Setup
      const url = 'http://localhost:3000/api/v1/auth/verify-nip98';
      const authHeader = createNip98AuthHeader('POST', url, testKeypair.secretKey);
      mockRequest.originalUrl = '/api/v1/auth/verify-nip98';

      // Act
      const result = await controller.verifyNip98Auth(authHeader, mockRequest);

      // Assert
      expect(result.pubkey).toBe(testKeypair.pubkey);
      expect(result.npub).toBe(nip19.npubEncode(testKeypair.pubkey));
    });

    it('should reject NIP-98 with invalid auth header format', async () => {
      // Act & Assert
      await expect(
        service.verifyNip98Auth('Invalid Header', 'POST', 'http://localhost:3000/test')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject NIP-98 with expired timestamp', async () => {
      // Setup: Create event with old timestamp
      const url = 'http://localhost:3000/api/v1/test';
      const authHeader = createNip98AuthHeader('POST', url, testKeypair.secretKey);
      
      // Decode and modify the timestamp
      const base64Event = authHeader.slice(6);
      const event = JSON.parse(Buffer.from(base64Event, 'base64').toString());
      event.created_at = Math.floor(Date.now() / 1000) - 120; // 2 minutes ago
      
      const modifiedHeader = 'Nostr ' + Buffer.from(JSON.stringify(event)).toString('base64');

      // Act & Assert
      await expect(
        service.verifyNip98Auth(modifiedHeader, 'POST', url)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject NIP-98 with wrong method tag', async () => {
      // Setup
      const authHeader = createNip98AuthHeader('POST', 'http://localhost:3000/test', testKeypair.secretKey);

      // Act & Assert: Try to use POST auth for GET request
      await expect(
        service.verifyNip98Auth(authHeader, 'GET', 'http://localhost:3000/test')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject NIP-98 with wrong URL tag', async () => {
      // Setup
      const authHeader = createNip98AuthHeader('POST', 'http://localhost:3000/wrong', testKeypair.secretKey);

      // Act & Assert
      await expect(
        service.verifyNip98Auth(authHeader, 'POST', 'http://localhost:3000/correct')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('JWT Token Validation', () => {
    it('should validate a valid JWT token', async () => {
      // Setup: Generate auth and get token
      const challengeResponse = await controller.getChallenge({});
      const authEvent = createNip42AuthEvent(challengeResponse.challenge, testKeypair.secretKey);
      const authResult = await controller.verifyChallenge({ event: authEvent as any }, mockRequest);
      const token = authResult.token;

      // Act
      const result = await service.verifyJwt(token);

      // Assert
      expect(result.pubkey).toBe(testKeypair.pubkey);
      expect(result.user).toBeDefined();
    });

    it('should reject invalid JWT signature', async () => {
      // Setup: Create a fake token
      const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.invalid';

      // Act & Assert
      await expect(service.verifyJwt(fakeToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject expired JWT token', async () => {
      // Setup: Create token that's already expired
      const payload = {
        sub: testKeypair.pubkey,
        sessionId: 'test-session',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800, // Expired 30 min ago
      };
      
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = crypto
        .createHmac('sha256', 'test-jwt-secret-at-least-32-characters-long')
        .update(`${header}.${body}`)
        .digest('base64url');
      
      const expiredToken = `${header}.${body}.${signature}`;

      // Act & Assert
      await expect(service.verifyJwt(expiredToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user profile with valid JWT', async () => {
      // Setup: Authenticate and get token
      const challengeResponse = await controller.getChallenge({});
      const authEvent = createNip42AuthEvent(challengeResponse.challenge, testKeypair.secretKey);
      const authResult = await controller.verifyChallenge({ event: authEvent as any }, mockRequest);
      
      const authHeader = `Bearer ${authResult.token}`;

      // Act
      const result = await controller.getMe(authHeader, mockRequest);

      // Assert
      expect(result).toMatchObject({
        pubkey: testKeypair.pubkey,
        npub: nip19.npubEncode(testKeypair.pubkey),
        tier: 'FREE',
      });
      expect(result.subscription).toBeDefined();
    });

    it('should reject request without auth header', async () => {
      // Act & Assert
      await expect(controller.getMe('', mockRequest)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Session Management', () => {
    it('should list all active sessions for user', async () => {
      // Setup: Create multiple sessions
      const challengeResponse = await controller.getChallenge({});
      const authEvent = createNip42AuthEvent(challengeResponse.challenge, testKeypair.secretKey);
      const authResult = await controller.verifyChallenge({ event: authEvent as any }, mockRequest);
      
      const authHeader = `Bearer ${authResult.token}`;

      // Act
      const sessions = await controller.getSessions(authHeader, mockRequest);

      // Assert
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0]).toHaveProperty('id');
      expect(sessions[0]).toHaveProperty('userAgent');
      expect(sessions[0]).toHaveProperty('createdAt');
    });

    it('should logout and invalidate session', async () => {
      // Setup
      const challengeResponse = await controller.getChallenge({});
      const authEvent = createNip42AuthEvent(challengeResponse.challenge, testKeypair.secretKey);
      const authResult = await controller.verifyChallenge({ event: authEvent as any }, mockRequest);
      
      const authHeader = `Bearer ${authResult.token}`;

      // Act
      await controller.logout(authHeader);

      // Assert: Token should no longer be valid
      expect(prisma.session.deleteMany).toHaveBeenCalled();
    });

    it('should revoke specific session', async () => {
      // Setup
      const challengeResponse = await controller.getChallenge({});
      const authEvent = createNip42AuthEvent(challengeResponse.challenge, testKeypair.secretKey);
      const authResult = await controller.verifyChallenge({ event: authEvent as any }, mockRequest);
      
      const authHeader = `Bearer ${authResult.token}`;
      const sessions = await controller.getSessions(authHeader, mockRequest);
      const sessionId = sessions[0].id;

      // Act
      await controller.revokeSession(authHeader, mockRequest, sessionId);

      // Assert
      expect(prisma.session.delete).toHaveBeenCalled();
    });

    it('should not allow revoking another user\'s session', async () => {
      // Setup: Create session for different user
      const otherKeypair = generateTestKeypair();
      const otherUser = {
        id: 'user_other',
        pubkey: otherKeypair.pubkey,
        npub: nip19.npubEncode(otherKeypair.pubkey),
      };
      prisma.users.set(otherUser.pubkey, otherUser);
      
      const otherSession = {
        id: 'session_other',
        userId: otherUser.id,
        token: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      prisma.sessions.set(otherSession.token, otherSession);

      // Get auth for our user
      const challengeResponse = await controller.getChallenge({});
      const authEvent = createNip42AuthEvent(challengeResponse.challenge, testKeypair.secretKey);
      const authResult = await controller.verifyChallenge({ event: authEvent as any }, mockRequest);
      const authHeader = `Bearer ${authResult.token}`;

      // Act & Assert: Try to revoke other user's session
      await expect(
        controller.revokeSession(authHeader, mockRequest, otherSession.id)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('LNURL-auth', () => {
    it('should generate LNURL-auth challenge', async () => {
      // Act
      const result = await controller.getLnurlAuth();

      // Assert
      expect(result).toHaveProperty('lnurl');
      expect(result).toHaveProperty('k1');
      expect(result).toHaveProperty('expiresAt');
      expect(result.k1).toHaveLength(64); // 32 bytes hex
      expect(result.lnurl).toMatch(/^lnurl/);
      
      // Verify session was created
      expect(prisma.lnurlSession.create).toHaveBeenCalled();
    });

    it('should poll LNURL-auth status (pending)', async () => {
      // Setup
      const lnurlResponse = await controller.getLnurlAuth();
      
      // Act
      const result = await controller.pollLnurlAuth(lnurlResponse.k1, mockRequest);

      // Assert
      expect(result.status).toBe('pending');
      expect(result.token).toBeUndefined();
    });
  });
});
