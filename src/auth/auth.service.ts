import { Injectable, UnauthorizedException, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { verifyEvent, nip19, getPublicKey } from 'nostr-tools';
import { bech32 } from 'bech32';
import * as crypto from 'crypto';
import { safeJsonParse } from '../shared/proven-json';

export interface NostrAuthEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface JwtPayload {
  sub: string; // pubkey
  sessionId: string;
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly sessionDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    // ⭐ ENFORCE JWT_SECRET
    const jwtSecret = this.config.get<string>('JWT_SECRET');
    
    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET environment variable is required. ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
    }
    
    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
    
    this.jwtSecret = jwtSecret;
    
    // Warn about weak secrets
    const weakSecrets = ['test', 'secret', 'dev', 'development'];
    if (weakSecrets.some(weak => this.jwtSecret.toLowerCase().includes(weak))) {
      console.warn('⚠️  WARNING: JWT_SECRET appears to contain weak/test values');
    }
  }

  /**
   * Generate a challenge for signature authentication
   */
  async generateChallenge(pubkey?: string): Promise<{ challenge: string; expiresAt: number }> {
    const challenge = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.prisma.authChallenge.create({
      data: {
        challenge,
        pubkey,
        expiresAt,
      },
    });

    // Cleanup expired challenges
    await this.prisma.authChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return {
      challenge,
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
    };
  }

  /**
   * Verify a signed challenge and issue JWT
   */
  async verifyChallenge(
    event: NostrAuthEvent,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ token: string; user: any; expiresAt: number }> {
    // Verify event is kind 22242 (NIP-42 AUTH)
    if (event.kind !== 22242) {
      throw new UnauthorizedException('Invalid event kind - expected 22242');
    }

    // Verify signature
    const isValid = verifyEvent(event as any);
    if (!isValid) {
      throw new UnauthorizedException('Invalid event signature');
    }

    // Extract challenge from tags
    const challengeTag = event.tags.find((t) => t[0] === 'challenge');
    if (!challengeTag || !challengeTag[1]) {
      throw new UnauthorizedException('Missing challenge tag');
    }

    const challenge = challengeTag[1];

    // Find and validate challenge
    const authChallenge = await this.prisma.authChallenge.findUnique({
      where: { challenge },
    });

    if (!authChallenge) {
      throw new UnauthorizedException('Invalid challenge');
    }

    if (authChallenge.usedAt) {
      throw new UnauthorizedException('Challenge already used');
    }

    if (authChallenge.expiresAt < new Date()) {
      throw new UnauthorizedException('Challenge expired');
    }

    if (authChallenge.pubkey && authChallenge.pubkey !== event.pubkey) {
      throw new UnauthorizedException('Challenge was issued for different pubkey');
    }

    // Mark challenge as used
    await this.prisma.authChallenge.update({
      where: { challenge },
      data: { usedAt: new Date() },
    });

    // Get or create user
    const user = await this.getOrCreateUser(event.pubkey);

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.sessionDurationMs);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: this.hashToken(sessionToken),
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    // Generate JWT
    const jwt = this.generateJwt(event.pubkey, sessionToken, expiresAt);

    return {
      token: jwt,
      user: {
        pubkey: user.pubkey,
        npub: user.npub,
        tier: user.subscription?.tier || 'FREE',
        nip05s: user.nip05s,
        wotScore: user.wotScore?.trustScore || 0,
      },
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
    };
  }

  /**
   * Verify a NIP-98 HTTP Auth event (for per-request auth)
   */
  async verifyNip98Auth(authHeader: string, method: string, url: string): Promise<string> {
    if (!authHeader?.startsWith('Nostr ')) {
      throw new UnauthorizedException('Invalid auth header format');
    }

    const base64Event = authHeader.slice(6);
    let event: NostrAuthEvent;

    try {
      const eventJson = Buffer.from(base64Event, 'base64').toString('utf-8');
      event = safeJsonParse<NostrAuthEvent>(eventJson, "Invalid auth event encoding");
    } catch {
      throw new UnauthorizedException('Invalid auth event encoding');
    }

    // Verify event kind is 27235 (NIP-98)
    if (event.kind !== 27235) {
      throw new UnauthorizedException('Invalid auth event kind');
    }

    // Verify event signature
    const isValid = verifyEvent(event as any);
    if (!isValid) {
      throw new UnauthorizedException('Invalid event signature');
    }

    // ⭐ CHECK FOR REPLAY ATTACKS
    const cacheKey = `nip98:${event.id}`;
    const isUsed = await this.cacheManager.get(cacheKey);
    
    if (isUsed) {
      throw new UnauthorizedException('Auth event already used (replay detected)');
    }
    
    // Mark as used (TTL = 120 seconds to cover clock skew)
    await this.cacheManager.set(cacheKey, true, 120000);

    // Verify timestamp (within 60 seconds)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - event.created_at) > 60) {
      throw new UnauthorizedException('Auth event expired');
    }

    // Exact URL pathname matching
    const urlTag = event.tags.find((t) => t[0] === 'u');
    if (!urlTag || !urlTag[1]) {
      throw new UnauthorizedException('Missing URL tag');
    }

    try {
      const eventUrl = new URL(urlTag[1]);
      const requestUrl = new URL(url);
      
      // Exact pathname match (query params may differ)
      if (eventUrl.pathname !== requestUrl.pathname) {
        throw new UnauthorizedException('URL mismatch');
      }
      
      // Also verify host in production
      if (process.env.NODE_ENV === 'production' && 
          eventUrl.host !== requestUrl.host) {
        throw new UnauthorizedException('Host mismatch');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid URL in auth event');
    }

    // Verify method tag
    const methodTag = event.tags.find((t) => t[0] === 'method');
    if (!methodTag || methodTag[1].toUpperCase() !== method.toUpperCase()) {
      throw new UnauthorizedException('Method mismatch');
    }

    return event.pubkey;
  }

  /**
   * Verify JWT token
   */
  async verifyJwt(token: string): Promise<{ pubkey: string; user: any }> {
    try {
      const payload = this.decodeJwt(token);
      
      if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
        throw new UnauthorizedException('Token expired');
      }

      // Verify session exists and is valid
      const session = await this.prisma.session.findFirst({
        where: {
          token: this.hashToken(payload.sessionId),
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            include: {
              subscription: true,
              nip05s: true,
              wotScore: true,
            },
          },
        },
      });

      if (!session) {
        throw new UnauthorizedException('Session not found or expired');
      }

      // Update last used
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        pubkey: session.user.pubkey,
        user: session.user,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Verify auth from header (JWT or NIP-98)
   */
  async verifyAuth(authHeader: string, method: string, url: string): Promise<string> {
    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    // Check if it's a JWT Bearer token
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { pubkey } = await this.verifyJwt(token);
      return pubkey;
    }

    // Otherwise try NIP-98
    if (authHeader.startsWith('Nostr ')) {
      return this.verifyNip98Auth(authHeader, method, url);
    }

    throw new UnauthorizedException('Invalid authorization format');
  }

  /**
   * Logout - invalidate session
   */
  async logout(token: string): Promise<void> {
    const payload = this.decodeJwt(token);
    if (payload?.sessionId) {
      await this.prisma.session.deleteMany({
        where: { token: this.hashToken(payload.sessionId) },
      });
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(pubkey: string) {
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: {
        sessions: {
          where: { expiresAt: { gt: new Date() } },
          orderBy: { lastUsedAt: 'desc' },
        },
      },
    });

    return user?.sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
    })) || [];
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(pubkey: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        user: { pubkey },
      },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    await this.prisma.session.delete({ where: { id: sessionId } });
  }

  /**
   * Get or create user by pubkey
   */
  async getOrCreateUser(pubkey: string) {
    let user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: {
        subscription: true,
        wotScore: true,
        nip05s: true,
      },
    });

    if (!user) {
      const npub = nip19.npubEncode(pubkey);
      user = await this.prisma.user.create({
        data: {
          pubkey,
          npub,
          subscription: {
            create: { tier: 'FREE' },
          },
          wotScore: {
            create: {},
          },
        },
        include: {
          subscription: true,
          wotScore: true,
          nip05s: true,
        },
      });
    }

    return user;
  }

  // LNURL-auth methods

  /**
   * Generate LNURL-auth challenge
   */
  async generateLnurlAuth(): Promise<{ lnurl: string; k1: string; expiresAt: number }> {
    const k1 = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.prisma.lnurlSession.create({
      data: {
        k1,
        status: 'pending',
        expiresAt,
      },
    });

    // Build LNURL-auth URL
    const baseUrl = this.config.get('BASE_URL') || 'http://localhost:3000';
    const callbackUrl = new URL('/api/v1/auth/lnurl-callback', baseUrl);
    callbackUrl.searchParams.set('tag', 'login');
    callbackUrl.searchParams.set('k1', k1);
    callbackUrl.searchParams.set('action', 'login');

    // Encode as LNURL (bech32)
    const lnurl = this.encodeLnurl(callbackUrl.toString());

    return {
      lnurl,
      k1,
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
    };
  }

  /**
   * Handle LNURL-auth callback from wallet
   */
  async handleLnurlCallback(
    k1: string,
    sig: string,
    key: string,
  ): Promise<{ status: string }> {
    const session = await this.prisma.lnurlSession.findUnique({
      where: { k1 },
    });

    if (!session) {
      throw new BadRequestException('Invalid k1');
    }

    if (session.status !== 'pending') {
      throw new BadRequestException('Session already used');
    }

    if (session.expiresAt < new Date()) {
      throw new BadRequestException('Session expired');
    }

    // Verify signature
    const isValid = this.verifyLnurlSignature(k1, sig, key);
    if (!isValid) {
      throw new BadRequestException('Invalid signature');
    }

    // Update session with linking key
    await this.prisma.lnurlSession.update({
      where: { k1 },
      data: {
        linkingKey: key,
        status: 'verified',
        verifiedAt: new Date(),
      },
    });

    return { status: 'OK' };
  }

  /**
   * Poll LNURL-auth status and get JWT if verified
   */
  async pollLnurlAuth(
    k1: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ status: string; token?: string; user?: any; expiresAt?: number }> {
    const session = await this.prisma.lnurlSession.findUnique({
      where: { k1 },
    });

    if (!session) {
      throw new BadRequestException('Invalid k1');
    }

    if (session.expiresAt < new Date()) {
      return { status: 'expired' };
    }

    if (session.status === 'pending') {
      return { status: 'pending' };
    }

    if (session.status === 'verified' && session.linkingKey) {
      // Get or create user with linking key as pubkey
      const user = await this.getOrCreateUser(session.linkingKey);

      // Link session to user
      await this.prisma.lnurlSession.update({
        where: { k1 },
        data: { userId: user.id },
      });

      // Create auth session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + this.sessionDurationMs);

      await this.prisma.session.create({
        data: {
          userId: user.id,
          token: this.hashToken(sessionToken),
          userAgent,
          ipAddress,
          expiresAt,
        },
      });

      const jwt = this.generateJwt(user.pubkey, sessionToken, expiresAt);

      return {
        status: 'verified',
        token: jwt,
        user: {
          pubkey: user.pubkey,
          npub: user.npub,
          tier: user.subscription?.tier || 'FREE',
          nip05s: user.nip05s,
        },
        expiresAt: Math.floor(expiresAt.getTime() / 1000),
      };
    }

    return { status: session.status };
  }

  // Helper methods

  private generateJwt(pubkey: string, sessionId: string, expiresAt: Date): string {
    const payload: JwtPayload = {
      sub: pubkey,
      sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
    };

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  private decodeJwt(token: string): JwtPayload | null {
    try {
      const [header, body, signature] = token.split('.');
      
      // Verify signature
      const expectedSig = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(`${header}.${body}`)
        .digest('base64url');

      if (signature !== expectedSig) {
        return null;
      }

      return JSON.parse(Buffer.from(body, 'base64url').toString());
    } catch {
      return null;
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // ⭐ USE LIBRARY IMPLEMENTATION
  private encodeLnurl(url: string): string {
    try {
      const urlBuffer = Buffer.from(url, 'utf8');
      const words = bech32.toWords(urlBuffer);
      return bech32.encode('lnurl', words, 2000);  // 2000 char limit
    } catch (error) {
      throw new BadRequestException('Failed to encode LNURL');
    }
  }

  private decodeLnurl(lnurl: string): string {
    try {
      const decoded = bech32.decode(lnurl, 2000);
      if (decoded.prefix !== 'lnurl') {
        throw new Error('Invalid LNURL prefix');
      }
      const urlBuffer = Buffer.from(bech32.fromWords(decoded.words));
      return urlBuffer.toString('utf8');
    } catch (error) {
      throw new BadRequestException('Invalid LNURL format');
    }
  }

  private verifyLnurlSignature(k1: string, sig: string, key: string): boolean {
    try {
      // LNURL-auth uses secp256k1 DER signatures
      // The key is the linking pubkey (hex)
      // For simplicity, we'll verify using nostr-tools
      const { schnorr } = require('@noble/curves/secp256k1');
      const message = Buffer.from(k1, 'hex');
      const signature = Buffer.from(sig, 'hex');
      const pubkey = Buffer.from(key, 'hex');
      
      return schnorr.verify(signature, message, pubkey);
    } catch {
      return false;
    }
  }
}
