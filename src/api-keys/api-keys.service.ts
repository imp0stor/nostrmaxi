import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface ApiKeyWithSecret {
  id: string;
  name: string;
  keyPrefix: string;
  key: string; // Only returned on creation
  permissions: string[];
  rateLimit: number;
  createdAt: Date;
  expiresAt?: Date;
}

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new API key
   */
  async createApiKey(
    pubkey: string,
    name: string,
    permissions: string[] = ['read'],
    expiresAt?: Date,
  ): Promise<ApiKeyWithSecret> {
    // Check if user has Business tier
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { subscription: true, apiKeys: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.subscription?.tier !== 'BUSINESS') {
      throw new ForbiddenException('API keys require Business tier subscription');
    }

    // Check key limit (10 keys for Business tier)
    const activeKeys = user.apiKeys.filter((k) => !k.revokedAt);
    if (activeKeys.length >= 10) {
      throw new BadRequestException('Maximum API key limit reached (10 keys)');
    }

    // Generate API key
    const rawKey = `nm_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId: user.id,
        name,
        keyHash,
        keyPrefix,
        permissions,
        rateLimit: 1000, // 1000 requests per hour
        expiresAt,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'apikey.created',
        entity: 'ApiKey',
        entityId: apiKey.id,
        actorPubkey: pubkey,
        details: { name, permissions },
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      key: rawKey, // Only returned once!
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt || undefined,
    };
  }

  /**
   * List user's API keys
   */
  async listApiKeys(pubkey: string) {
    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: {
        apiKeys: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.apiKeys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      permissions: k.permissions,
      rateLimit: k.rateLimit,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
    }));
  }

  /**
   * Get API key usage stats
   */
  async getApiKeyUsage(pubkey: string, keyId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: keyId,
        user: { pubkey },
        revokedAt: null,
      },
      include: {
        usageLogs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    // Calculate usage stats
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const hourlyUsage = apiKey.usageLogs.filter((l) => l.createdAt >= hourAgo).length;
    const dailyUsage = apiKey.usageLogs.filter((l) => l.createdAt >= dayAgo).length;

    // Endpoint breakdown
    const endpointCounts: Record<string, number> = {};
    for (const log of apiKey.usageLogs) {
      const key = `${log.method} ${log.endpoint}`;
      endpointCounts[key] = (endpointCounts[key] || 0) + 1;
    }

    return {
      keyId: apiKey.id,
      name: apiKey.name,
      rateLimit: apiKey.rateLimit,
      hourlyUsage,
      dailyUsage,
      remainingHourly: Math.max(0, apiKey.rateLimit - hourlyUsage),
      recentRequests: apiKey.usageLogs.slice(0, 20).map((l) => ({
        endpoint: l.endpoint,
        method: l.method,
        statusCode: l.statusCode,
        timestamp: l.createdAt,
      })),
      endpointBreakdown: Object.entries(endpointCounts)
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(pubkey: string, keyId: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: keyId,
        user: { pubkey },
        revokedAt: null,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'apikey.revoked',
        entity: 'ApiKey',
        entityId: keyId,
        actorPubkey: pubkey,
      },
    });
  }

  /**
   * Verify an API key and return user info
   */
  async verifyApiKey(key: string): Promise<{
    valid: boolean;
    user?: any;
    permissions?: string[];
    rateLimit?: number;
    remaining?: number;
  }> {
    if (!key.startsWith('nm_')) {
      return { valid: false };
    }

    const keyHash = this.hashKey(key);
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null,
      },
      include: {
        user: {
          include: { subscription: true },
        },
      },
    });

    if (!apiKey) {
      return { valid: false };
    }

    // Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false };
    }

    // Check subscription is still Business tier
    if (apiKey.user.subscription?.tier !== 'BUSINESS') {
      return { valid: false };
    }

    // Check rate limit
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentUsage = await this.prisma.apiKeyUsage.count({
      where: {
        apiKeyId: apiKey.id,
        createdAt: { gte: hourAgo },
      },
    });

    const remaining = Math.max(0, apiKey.rateLimit - recentUsage);

    // Update last used
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      valid: true,
      user: apiKey.user,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
      remaining,
    };
  }

  /**
   * Log API key usage
   */
  async logUsage(key: string, endpoint: string, method: string, statusCode: number): Promise<void> {
    const keyHash = this.hashKey(key);
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { keyHash },
    });

    if (apiKey) {
      await this.prisma.apiKeyUsage.create({
        data: {
          apiKeyId: apiKey.id,
          endpoint,
          method,
          statusCode,
        },
      });
    }
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}
