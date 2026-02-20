# Security Audit Report - NostrMaxi Platform

**Date:** 2026-02-13  
**Auditor:** Security Testing Agent  
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Executive Summary

NostrMaxi demonstrates **better security practices** than NostrCast with proper NIP-98 implementation, audit logging, and session management. However, **10 vulnerabilities** were identified, primarily around CORS misconfigurations, rate limiting weaknesses, and potential privilege escalation.

**Risk Distribution:**
- 🔴 Critical: 0
- 🟠 High: 3
- 🟡 Medium: 5
- 🟢 Low: 2

---

## 1. Authentication & Authorization

### 🟠 HIGH: NIP-98 URL Validation Weakness
**File:** `src/auth/auth.service.ts` (Lines 163-165)  
**Attack Vector:** URL Path Manipulation

```typescript
// VULNERABLE: Checks pathname substring instead of exact match
const urlTag = event.tags.find((t) => t[0] === 'u');
if (!urlTag || !url.includes(new URL(urlTag[1]).pathname)) {
  throw new UnauthorizedException('URL mismatch');
}
```

**Exploitation:**
- Event signed for `/api/v1/nip05/mine`
- Can be used for `/api/v1/nip05/mine/settings` or any path containing `/mine`
- Allows privilege escalation across endpoints

**Fix:**
```typescript
// Parse both URLs and compare pathname exactly
const eventUrl = new URL(urlTag[1]);
const requestUrl = new URL(url);

// Exact pathname match (query params may differ)
if (eventUrl.pathname !== requestUrl.pathname) {
  throw new UnauthorizedException('URL mismatch');
}

// Optional: Also verify host in production
if (process.env.NODE_ENV === 'production' && 
    eventUrl.host !== requestUrl.host) {
  throw new UnauthorizedException('Host mismatch');
}
```

---

### 🟡 MEDIUM: Missing NIP-98 Replay Protection
**File:** `src/auth/auth.service.ts` (Lines 145-172)  
**Attack Vector:** Replay Attacks

NIP-98 events have 60-second freshness window but no reuse prevention.

**Exploitation:**
1. Intercept valid NIP-98 authorization
2. Replay within 60 seconds
3. Perform multiple operations

**Fix:**
```typescript
// Add to verifyNip98Auth after signature verification
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class AuthService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    // ... other deps
  ) {}

  async verifyNip98Auth(authHeader: string, method: string, url: string): Promise<string> {
    // ... existing validation ...

    // Check if event already used
    const cacheKey = `nip98:${event.id}`;
    const isUsed = await this.cacheManager.get(cacheKey);
    if (isUsed) {
      throw new UnauthorizedException('Auth event already used');
    }

    // Mark as used (TTL = 120s to cover clock skew)
    await this.cacheManager.set(cacheKey, true, 120000);

    return event.pubkey;
  }
}
```

**Required:** Install and configure cache manager:
```bash
npm install @nestjs/cache-manager cache-manager
```

---

### 🟡 MEDIUM: JWT Secret Generation Timing
**File:** `src/auth/auth.service.ts` (Lines 23-24)  
**Attack Vector:** Weak Secrets on Startup

```typescript
this.jwtSecret = this.config.get('JWT_SECRET') || crypto.randomBytes(32).toString('hex');
```

**Issues:**
- Random secret generated on startup
- Changes on every restart
- Invalidates all existing sessions
- Leads to poor UX and potential DoS

**Fix:**
```typescript
constructor(
  private prisma: PrismaService,
  private config: ConfigService,
) {
  this.jwtSecret = this.config.get('JWT_SECRET');
  
  if (!this.jwtSecret) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  
  if (this.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
}
```

---

### ✅ GOOD: Proper Session Management
**Files:** `src/auth/auth.service.ts`, `prisma/schema.prisma`

NostrMaxi implements proper session tracking with:
- Session table for revocation
- Token hashing (prevents DB compromise = token compromise)
- IP and User-Agent tracking
- Expiry management

**Example:**
```typescript
const sessionToken = crypto.randomBytes(32).toString('hex');
await this.prisma.session.create({
  data: {
    userId: user.id,
    token: this.hashToken(sessionToken),  // ← Hashed
    userAgent,
    ipAddress,
    expiresAt,
  },
});
```

**Recommendation:** ✅ Keep this implementation

---

## 2. CORS & Security Headers

### 🔴 HIGH: Wildcard CORS in Production
**File:** `src/main.ts` (Lines 14-17)  
**Attack Vector:** Cross-Origin Attacks

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',  // ← WILDCARD DEFAULT
  credentials: true,
});
```

**Current .env:**
```
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Critical Issues:**
- Defaults to `*` (all origins) if env var missing
- Allows credentials with wildcard (browser will block, but logic is wrong)
- Localhost in production config

**Fix:**
```typescript
const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim());

if (!allowedOrigins || allowedOrigins.length === 0) {
  throw new Error('CORS_ORIGINS environment variable is required');
}

// Validate origins
allowedOrigins.forEach(origin => {
  if (origin === '*') {
    throw new Error('Wildcard CORS origin not allowed with credentials');
  }
  if (!origin.match(/^https?:\/\//)) {
    throw new Error(`Invalid CORS origin: ${origin}`);
  }
});

// Warn about localhost in production
if (process.env.NODE_ENV === 'production' && 
    allowedOrigins.some(o => o.includes('localhost'))) {
  console.error('⚠️  WARNING: localhost in CORS_ORIGINS in production!');
}

app.enableCors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

---

### 🟡 MEDIUM: Missing Security Headers
**File:** `src/main.ts`

No `helmet` or security header middleware detected.

**Fix:**
```bash
npm install helmet
```

```typescript
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Add security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],  // For Swagger
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // ... rest of bootstrap
}
```

---

## 3. Rate Limiting

### 🟠 HIGH: In-Memory Rate Limiting (Multi-Instance Issue)
**File:** `src/common/guards/rate-limit.guard.ts`  
**Attack Vector:** Rate Limit Bypass

```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();  // ← In-memory
  
  // ...
}
```

**Issues:**
- State doesn't persist across restarts
- Doesn't work in multi-instance deployments
- Attacker can bypass by hitting different instances

**Fix:**
```typescript
import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

interface RateLimitOptions {
  ttl: number;  // seconds
  limit: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private redis: Redis;
  private readonly defaultLimit: number;
  private readonly defaultTtl: number;

  constructor(
    private reflector: Reflector,
    private config: ConfigService,
  ) {
    this.redis = new Redis(this.config.get('REDIS_URL') || 'redis://localhost:6379');
    this.defaultLimit = parseInt(process.env.RATE_LIMIT_MAX || '100');
    this.defaultTtl = parseInt(process.env.RATE_LIMIT_TTL || '60');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = this.getKey(request);
    
    // Use Redis for distributed rate limiting
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, this.defaultTtl);
    }
    
    if (current > this.defaultLimit) {
      const ttl = await this.redis.ttl(key);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    
    return true;
  }

  private getKey(request: any): string {
    const ip = request.ip || request.connection.remoteAddress;
    const path = request.route?.path || request.url;
    return `ratelimit:${ip}:${path}`;
  }
}
```

**Also Add Redis Module:**
```bash
npm install ioredis
```

---

### 🟡 MEDIUM: No Per-User Rate Limiting
**File:** `src/common/guards/rate-limit.guard.ts`

Current implementation uses only IP + path. Authenticated users should have separate limits.

**Fix:**
```typescript
private getKey(request: any): string {
  const ip = request.ip || request.connection.remoteAddress;
  const path = request.route?.path || request.url;
  
  // Use pubkey for authenticated requests (more generous limits)
  const pubkey = (request as any).pubkey;
  if (pubkey) {
    return `ratelimit:user:${pubkey}:${path}`;
  }
  
  // IP-based for unauthenticated
  return `ratelimit:ip:${ip}:${path}`;
}
```

Then use custom limits per endpoint:
```typescript
@UseGuards(RateLimitGuard)
@RateLimit({ ttl: 60, limit: 20 })  // Custom decorator
@Post('api/v1/nip05/provision')
```

---

## 4. Authorization & Access Control

### 🟡 MEDIUM: Incomplete Admin Verification
**File:** `src/admin/admin.controller.ts` (Lines 13-17)  
**Attack Vector:** Partial NIP-98 Verification

```typescript
private async requireAdmin(authHeader: string, method: string, url: string) {
  const pubkey = await this.authService.verifyNip98Auth(authHeader, method, url);
  this.adminService.requireAdmin(pubkey);  // ← What if this throws?
  return pubkey;
}
```

**Issue:** Missing error handling. If `requireAdmin` throws, it might not be a proper HTTP exception.

**Check admin.service.ts:**
```typescript
// Ensure requireAdmin throws proper NestJS exceptions
requireAdmin(pubkey: string): void {
  const adminPubkeys = this.config.get('ADMIN_PUBKEYS')?.split(',') || [];
  
  if (!adminPubkeys.includes(pubkey)) {
    throw new ForbiddenException('Admin access required');
  }
}
```

**Current .env:**
```
ADMIN_PUBKEYS=
```

⚠️ **No admins configured!** Anyone passing auth can access admin endpoints if `includes('')` check is weak.

**Fix:**
```typescript
requireAdmin(pubkey: string): void {
  const adminPubkeys = this.config.get('ADMIN_PUBKEYS')?.split(',').filter(Boolean) || [];
  
  if (adminPubkeys.length === 0) {
    throw new ForbiddenException('No admins configured');
  }
  
  if (!adminPubkeys.includes(pubkey)) {
    throw new ForbiddenException('Admin access required');
  }
}
```

---

### ✅ GOOD: Audit Logging
**Files:** `src/nip05/nip05.service.ts`, `prisma/schema.prisma`

NostrMaxi implements comprehensive audit logging:
```typescript
await this.prisma.auditLog.create({
  data: {
    action: 'nip05.provision',
    entity: 'Nip05',
    entityId: nip05.id,
    actorPubkey: pubkey,
    details: { localPart, domain },
  },
});
```

**Recommendation:** ✅ Excellent practice, keep it

---

## 5. Input Validation & Sanitization

### 🟡 MEDIUM: NIP-05 Local Part Sanitization
**File:** `src/nip05/nip05.service.ts` (Line 63)  
**Attack Vector:** Character Bypass

```typescript
const normalizedLocal = localPart.toLowerCase().replace(/[^a-z0-9_-]/g, '');
```

**Issues:**
- Allows `_` and `-` which might have special meaning in some contexts
- No check for reserved names (admin, root, postmaster, etc.)
- No check for confusable Unicode (already converted to lowercase, but good to verify)

**Fix:**
```typescript
// Reserved NIP-05 names
const RESERVED_NAMES = [
  'admin', 'root', 'postmaster', 'noreply', 'support', 'info',
  'webmaster', 'security', 'abuse', 'api', 'www', '_domainkey'
];

async provision(pubkey: string, localPart: string, domain?: string) {
  const targetDomain = domain || this.defaultDomain;
  
  // Normalize and sanitize
  const normalizedLocal = localPart.toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '');  // Only alphanumeric and hyphen
  
  // Additional validation
  if (RESERVED_NAMES.includes(normalizedLocal)) {
    throw new BadRequestException(`"${normalizedLocal}" is a reserved name`);
  }
  
  if (normalizedLocal.startsWith('-') || normalizedLocal.endsWith('-')) {
    throw new BadRequestException('Name cannot start or end with hyphen');
  }
  
  // ... rest of validation
}
```

---

### 🟢 LOW: Query Parameter Validation
**File:** Multiple controllers

Query parameters lack validation in some places:
```typescript
@Get('users')
async listUsers(
  @Query('page') page?: string,  // ← No validation
  @Query('limit') limit?: string,
) {
  return this.adminService.listUsers(
    page ? parseInt(page) : undefined,
    limit ? parseInt(limit) : undefined,
  );
}
```

**Fix:**
```typescript
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

@Get('users')
async listUsers(@Query() pagination: PaginationDto) {
  return this.adminService.listUsers(pagination.page, pagination.limit);
}
```

---

## 6. Cryptography & Secrets

### 🟡 MEDIUM: Weak LNURL Bech32 Implementation
**File:** `src/auth/auth.service.ts` (Lines 380-449)  
**Attack Vector:** Implementation Bugs

Custom bech32 implementation for LNURL encoding:
```typescript
private encodeLnurl(url: string): string {
  // Simple LNURL encoding (in production, use proper bech32 library)
  const words = this.convertBits(Buffer.from(url, 'utf8'), 8, 5, true);
  return 'lnurl' + this.bech32Encode('lnurl', words);
}
```

**Issues:**
- Comment says "use proper bech32 library"
- Custom crypto implementations are prone to bugs
- bech32 has subtle edge cases

**Fix:**
```bash
npm install bech32
```

```typescript
import { bech32 } from 'bech32';

private encodeLnurl(url: string): string {
  const words = bech32.toWords(Buffer.from(url, 'utf8'));
  return bech32.encode('lnurl', words, 2000);  // 2000 char limit
}
```

---

### ✅ GOOD: Token Hashing
**File:** `src/auth/auth.service.ts` (Line 321)

Session tokens are properly hashed before storage:
```typescript
private hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

**Recommendation:** ✅ Good practice

---

## 7. Dependency Vulnerabilities

### npm audit results:

```
12 vulnerabilities (6 low, 4 moderate, 2 high)

glob 10.2.0 - 10.4.5 (high)
- Command injection via -c/--cmd
- Fix: npm audit fix --force

js-yaml 4.0.0 - 4.1.0 (moderate)
- Prototype pollution in merge
- Fix: npm audit fix --force

lodash 4.0.0 - 4.17.21 (moderate)
- Prototype pollution in _.unset and _.omit
- Fix: npm audit fix --force

qs 6.7.0 - 6.14.1 (low)
- arrayLimit bypass DoS
- Fix: npm audit fix

tmp <=0.2.3 (low)
- Arbitrary file/directory write via symlink
- Fix: npm audit fix --force

webpack 5.49.0 - 5.104.0 (low/moderate)
- buildHttp SSRF vulnerabilities
- Fix: npm audit fix --force
```

**Recommendation:**
```bash
cd ~/strangesignal/projects/nostrmaxi
npm audit fix
npm audit fix --force  # Review breaking changes
npm audit
```

Most vulnerabilities are in dev dependencies (@nestjs/cli, @nestjs/swagger) which are not runtime risks, but should still be updated.

---

## 8. Error Handling & Information Disclosure

### ✅ GOOD: Exception Filtering
**File:** NestJS Global Exception Filter (default)

NestJS automatically handles exceptions and sanitizes error responses in production.

**Recommendation:** Ensure `NODE_ENV=production` is set in deployment

---

## 9. Database Security

### ✅ GOOD: Parameterized Queries
All queries use Prisma ORM with proper parameterization. No SQL injection risk detected.

**Example:**
```typescript
const nip05 = await this.prisma.nip05.findFirst({
  where: {
    localPart: name.toLowerCase(),  // ← Safe
    domain: targetDomain,
    isActive: true,
  },
});
```

---

### 🟢 LOW: PostgreSQL vs SQLite
**File:** `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Current .env:**
```
DATABASE_URL="file:./dev.db"
```

⚠️ **Mismatch:** Schema says PostgreSQL, .env has SQLite

**Fix:**
Ensure production uses PostgreSQL:
```
DATABASE_URL="postgresql://user:password@localhost:5432/nostrmaxi?schema=public"
```

---

## 10. LNURL-Auth Security

### 🟡 MEDIUM: LNURL Signature Verification
**File:** `src/auth/auth.service.ts` (Lines 427-445)

```typescript
private verifyLnurlSignature(k1: string, sig: string, key: string): boolean {
  try {
    const { schnorr } = require('@noble/curves/secp256k1');
    const message = Buffer.from(k1, 'hex');
    const signature = Buffer.from(sig, 'hex');
    const pubkey = Buffer.from(key, 'hex');
    
    return schnorr.verify(signature, message, pubkey);
  } catch {
    return false;  // ← Silent failure
  }
}
```

**Issues:**
- Dynamic require (should be at top)
- Silent failure hides real errors
- No logging for debugging

**Fix:**
```typescript
import { schnorr } from '@noble/curves/secp256k1';

private verifyLnurlSignature(k1: string, sig: string, key: string): boolean {
  try {
    // Validate hex inputs
    if (!/^[0-9a-f]+$/i.test(k1) || !/^[0-9a-f]+$/i.test(sig) || !/^[0-9a-f]+$/i.test(key)) {
      this.logger.warn('Invalid hex in LNURL signature verification');
      return false;
    }
    
    const message = Buffer.from(k1, 'hex');
    const signature = Buffer.from(sig, 'hex');
    const pubkey = Buffer.from(key, 'hex');
    
    return schnorr.verify(signature, message, pubkey);
  } catch (error) {
    this.logger.error('LNURL signature verification failed', error);
    return false;
  }
}
```

---

## Remediation Priority

### Immediate (Before Production):
1. 🔴 Fix CORS wildcard default
2. 🟠 Fix NIP-98 URL validation (exact matching)
3. 🟠 Implement Redis-based rate limiting
4. 🟡 Add NIP-98 replay protection
5. 🟡 Enforce JWT_SECRET requirement
6. 🟡 Configure admin pubkeys properly

### High Priority:
1. 🟡 Add security headers (Helmet)
2. 🟡 Fix NIP-05 sanitization and reserved names
3. 🟡 Replace custom bech32 with library
4. 🟡 Add per-user rate limiting

### Medium Priority:
1. 🟢 Add query parameter validation DTOs
2. 🟢 Ensure PostgreSQL in production
3. Update dependencies (npm audit fix)
4. Improve LNURL signature verification error handling

---

## Testing Recommendations

### Manual Testing:
```bash
# Test CORS wildcard
unset CORS_ORIGINS
# Start server - should fail, not default to *

# Test NIP-98 URL manipulation
# Sign event for /api/v1/nip05/mine
# Try using for /api/v1/nip05/mine/extra/path

# Test admin access with empty ADMIN_PUBKEYS
curl -H "Authorization: Nostr <valid_event>" \
  http://localhost:3000/api/v1/admin/stats

# Test rate limiting across instances
# Start multiple instances, hit same endpoint
```

### Automated Testing:
```bash
# Run existing tests
npm test

# Add security-specific tests
npm install --save-dev @nestjs/testing supertest
```

---

## Positive Security Findings

NostrMaxi demonstrates several **excellent security practices**:

1. ✅ **Session Management:** Proper session table with token hashing
2. ✅ **Audit Logging:** Comprehensive activity tracking
3. ✅ **Validation Pipes:** Global validation enabled
4. ✅ **NestJS Framework:** Built-in security features
5. ✅ **Tier-Based Limits:** Business logic enforces subscription tiers
6. ✅ **Parameterized Queries:** No SQL injection vectors
7. ✅ **Challenge-Response Auth:** Proper NIP-42 implementation

---

## Conclusion

NostrMaxi has a **strong security foundation** with proper session management, audit logging, and input validation. The main concerns are:
- **CORS misconfiguration** (defaults to wildcard)
- **Rate limiting** not production-ready (in-memory)
- **NIP-98 URL validation** needs exact matching

**Estimated Remediation Time:** 6-8 hours

**Overall Security Posture:** 🟢 **GOOD** (with fixes applied)

NostrMaxi is significantly more secure than NostrCast out of the box, but the identified issues must be addressed before production deployment.

---

**Report Generated:** 2026-02-13 02:51 EST  
**Framework:** NestJS + Prisma + TypeScript  
**Database:** PostgreSQL (configured), SQLite (current dev)  
**Architecture:** Modular, well-structured, follows NestJS best practices
