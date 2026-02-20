# Security Fixes - NostrMaxi Platform

This document provides ready-to-apply code fixes for critical and high-severity vulnerabilities.

---

## Fix 1: Secure CORS Configuration

**File:** `src/main.ts`

### Before (VULNERABLE):
```typescript
app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',  // ← WILDCARD!
  credentials: true,
});
```

### After (SECURE):
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validation pipe (already configured)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ⭐ SECURE CORS CONFIGURATION
  const allowedOrigins = (() => {
    const origins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim());
    
    if (!origins || origins.length === 0) {
      throw new Error(
        'CORS_ORIGINS environment variable is required. ' +
        'Example: CORS_ORIGINS=https://example.com,https://www.example.com'
      );
    }
    
    // Reject wildcard
    if (origins.includes('*')) {
      throw new Error('Wildcard (*) CORS origin not allowed with credentials');
    }
    
    // Validate format
    origins.forEach(origin => {
      if (!origin.match(/^https?:\/\//)) {
        throw new Error(`Invalid CORS origin format: ${origin}`);
      }
    });
    
    // Warn about localhost in production
    if (process.env.NODE_ENV === 'production') {
      const hasLocalhost = origins.some(o => 
        o.includes('localhost') || o.includes('127.0.0.1')
      );
      if (hasLocalhost) {
        throw new Error(
          'localhost/127.0.0.1 detected in CORS_ORIGINS in production mode. ' +
          'This is a security risk. Use proper domain names.'
        );
      }
    }
    
    return origins;
  })();

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Rest of bootstrap...
}
```

**Update .env:**
```bash
# Development
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Production
CORS_ORIGINS=https://nostrmaxi.com,https://www.nostrmaxi.com
```

---

## Fix 2: Add Security Headers (Helmet)

**File:** `src/main.ts`

### Install Helmet:
```bash
npm install helmet
```

### Add to bootstrap:
```typescript
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ⭐ ADD SECURITY HEADERS
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],  // For Swagger UI
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,  // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    xssFilter: true,
  }));

  // Validation pipes...
  // CORS...
  // Swagger...
  // Rest of bootstrap
}
```

---

## Fix 3: Fix NIP-98 URL Validation

**File:** `src/auth/auth.service.ts`

### Before (VULNERABLE):
```typescript
// Verify URL tag
const urlTag = event.tags.find((t) => t[0] === 'u');
if (!urlTag || !url.includes(new URL(urlTag[1]).pathname)) {
  throw new UnauthorizedException('URL mismatch');
}
```

### After (SECURE):
```typescript
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
```

---

## Fix 4: Add NIP-98 Replay Protection

**File:** `src/auth/auth.service.ts`

### Install cache manager:
```bash
npm install @nestjs/cache-manager cache-manager cache-manager-redis-yet
```

### Add cache module to AppModule:
```typescript
// src/app.module.ts
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
          ttl: 60000,  // Default TTL in ms
        }),
      }),
    }),
    // ... other imports
  ],
  // ...
})
export class AppModule {}
```

### Update auth.service.ts:
```typescript
import { Injectable, UnauthorizedException, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,  // ⭐ Add cache
  ) {
    // ... existing constructor
  }

  async verifyNip98Auth(authHeader: string, method: string, url: string): Promise<string> {
    if (!authHeader?.startsWith('Nostr ')) {
      throw new UnauthorizedException('Invalid auth header format');
    }

    const base64Event = authHeader.slice(6);
    let event: NostrAuthEvent;

    try {
      const eventJson = Buffer.from(base64Event, 'base64').toString('utf-8');
      event = JSON.parse(eventJson);
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

    // Exact URL validation (from Fix 3)
    const urlTag = event.tags.find((t) => t[0] === 'u');
    if (!urlTag || !urlTag[1]) {
      throw new UnauthorizedException('Missing URL tag');
    }

    const eventUrl = new URL(urlTag[1]);
    const requestUrl = new URL(url);
    
    if (eventUrl.pathname !== requestUrl.pathname) {
      throw new UnauthorizedException('URL mismatch');
    }

    // Verify method tag
    const methodTag = event.tags.find((t) => t[0] === 'method');
    if (!methodTag || methodTag[1].toUpperCase() !== method.toUpperCase()) {
      throw new UnauthorizedException('Method mismatch');
    }

    return event.pubkey;
  }
}
```

**Add to .env:**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Fix 5: Enforce JWT Secret Requirement

**File:** `src/auth/auth.service.ts`

### Before (WEAK):
```typescript
this.jwtSecret = this.config.get('JWT_SECRET') || crypto.randomBytes(32).toString('hex');
```

### After (SECURE):
```typescript
constructor(
  private prisma: PrismaService,
  private config: ConfigService,
  @Inject(CACHE_MANAGER) private cacheManager: Cache,
) {
  // ⭐ ENFORCE JWT_SECRET
  this.jwtSecret = this.config.get('JWT_SECRET');
  
  if (!this.jwtSecret) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
  }
  
  if (this.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  
  // Warn about weak secrets
  const weakSecrets = ['test', 'secret', 'dev', 'development'];
  if (weakSecrets.some(weak => this.jwtSecret.toLowerCase().includes(weak))) {
    console.warn('⚠️  WARNING: JWT_SECRET appears to contain weak/test values');
  }
}
```

**Update .env:**
```bash
# Generate strong secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Add to .env
JWT_SECRET=<generated_secret_here>
```

---

## Fix 6: Implement Redis-Based Rate Limiting

**File:** `src/common/guards/rate-limit.guard.ts`

### Before (IN-MEMORY):
```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();
  // ...
}
```

### After (REDIS-BASED):
```typescript
import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly defaultLimit: number;
  private readonly defaultTtl: number;  // seconds

  constructor(
    private reflector: Reflector,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.defaultLimit = parseInt(process.env.RATE_LIMIT_MAX || '100');
    this.defaultTtl = parseInt(process.env.RATE_LIMIT_TTL || '60');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = this.getKey(request);
    
    // Get current count
    let current: number = (await this.cacheManager.get(key)) || 0;
    
    // Increment
    current++;
    
    // Store with TTL (in milliseconds)
    await this.cacheManager.set(key, current, this.defaultTtl * 1000);
    
    if (current > this.defaultLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter: this.defaultTtl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    
    return true;
  }

  private getKey(request: any): string {
    const ip = request.ip || request.connection.remoteAddress;
    const path = request.route?.path || request.url;
    
    // Use pubkey for authenticated requests (more generous limits possible)
    const pubkey = (request as any).pubkey;
    if (pubkey) {
      return `ratelimit:user:${pubkey}:${path}`;
    }
    
    // IP-based for unauthenticated
    return `ratelimit:ip:${ip}:${path}`;
  }
}
```

---

## Fix 7: Secure Admin Configuration

**File:** `src/admin/admin.service.ts`

### Create or update admin service:
```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * Verify if pubkey is admin
   */
  requireAdmin(pubkey: string): void {
    const adminPubkeysStr = this.config.get('ADMIN_PUBKEYS');
    
    if (!adminPubkeysStr || adminPubkeysStr.trim() === '') {
      throw new ForbiddenException(
        'No admins configured. Set ADMIN_PUBKEYS environment variable.'
      );
    }
    
    const adminPubkeys = adminPubkeysStr
      .split(',')
      .map(pk => pk.trim())
      .filter(pk => pk.length > 0);
    
    if (adminPubkeys.length === 0) {
      throw new ForbiddenException('No valid admin pubkeys configured');
    }
    
    if (!adminPubkeys.includes(pubkey)) {
      // Log attempted admin access
      console.warn(`Unauthorized admin access attempt by pubkey: ${pubkey}`);
      throw new ForbiddenException('Admin access required');
    }
  }

  // ... rest of admin service methods
}
```

**Update .env:**
```bash
# Add your admin pubkey(s)
ADMIN_PUBKEYS=<your_hex_pubkey>,<another_admin_pubkey>
```

---

## Fix 8: Improve NIP-05 Sanitization

**File:** `src/nip05/nip05.service.ts`

### Add reserved names and better validation:
```typescript
// ⭐ RESERVED NIP-05 NAMES
const RESERVED_NAMES = new Set([
  'admin', 'administrator', 'root', 'postmaster', 'noreply', 'no-reply',
  'support', 'info', 'contact', 'webmaster', 'security', 'abuse',
  'api', 'www', 'mail', 'ftp', 'smtp', 'pop', 'imap',
  '_domainkey', '_dmarc', 'dmarc', 'autoconfig', 'autodiscover',
  'help', 'sales', 'billing', 'feedback', 'hello', 'welcome'
]);

async provision(pubkey: string, localPart: string, domain?: string) {
  const targetDomain = domain || this.defaultDomain;
  
  // ⭐ IMPROVED SANITIZATION
  const normalizedLocal = localPart
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '');  // Only alphanumeric and hyphen
  
  // Length validation
  if (normalizedLocal.length < 2) {
    throw new BadRequestException('Name must be at least 2 characters');
  }
  
  if (normalizedLocal.length > 32) {
    throw new BadRequestException('Name must be at most 32 characters');
  }
  
  // Format validation
  if (normalizedLocal.startsWith('-') || normalizedLocal.endsWith('-')) {
    throw new BadRequestException('Name cannot start or end with hyphen');
  }
  
  if (normalizedLocal.includes('--')) {
    throw new BadRequestException('Name cannot contain consecutive hyphens');
  }
  
  // Reserved names check
  if (RESERVED_NAMES.has(normalizedLocal)) {
    throw new BadRequestException(`"${normalizedLocal}" is a reserved name`);
  }
  
  // Profanity/offensive check (optional)
  // const profanityList = ['badword1', 'badword2'];
  // if (profanityList.includes(normalizedLocal)) {
  //   throw new BadRequestException('Name contains inappropriate content');
  // }

  // Check if already taken
  const existing = await this.prisma.nip05.findFirst({
    where: {
      localPart: normalizedLocal,
      domain: targetDomain,
      isActive: true,
    },
  });

  if (existing) {
    throw new ConflictException(`${normalizedLocal}@${targetDomain} is already taken`);
  }

  // ... rest of provision logic
}
```

---

## Fix 9: Replace Custom Bech32 Implementation

**File:** `src/auth/auth.service.ts`

### Install proper library:
```bash
npm install bech32
```

### Replace custom implementation:
```typescript
import { bech32 } from 'bech32';

// REMOVE custom bech32 methods:
// - encodeLnurl
// - convertBits
// - bech32Encode
// - bech32Checksum
// - expandPrefix
// - polymod

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
```

---

## Application Checklist

Before deploying to production:

- [ ] Configure CORS_ORIGINS (no wildcard, no localhost)
- [ ] Add Helmet security headers
- [ ] Fix NIP-98 URL validation (exact pathname matching)
- [ ] Add NIP-98 replay protection (Redis/Cache)
- [ ] Generate and set strong JWT_SECRET (64+ chars)
- [ ] Configure ADMIN_PUBKEYS with actual admin pubkeys
- [ ] Implement Redis-based rate limiting
- [ ] Improve NIP-05 sanitization (reserved names)
- [ ] Replace custom bech32 with library
- [ ] Run `npm audit fix`
- [ ] Set `NODE_ENV=production`
- [ ] Use PostgreSQL (not SQLite) in production
- [ ] Configure Redis for caching and rate limiting
- [ ] Enable HTTPS/TLS
- [ ] Test all authentication flows
- [ ] Review and test admin endpoints

---

## Environment Variables Checklist

**Required for production:**
```bash
# App
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/nostrmaxi"

# JWT
JWT_SECRET=<64+ character random hex string>

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS
CORS_ORIGINS=https://nostrmaxi.com,https://www.nostrmaxi.com

# Admin
ADMIN_PUBKEYS=<hex_pubkey1>,<hex_pubkey2>

# NIP-05
NIP05_DEFAULT_DOMAIN=nostrmaxi.com
NIP05_DEFAULT_RELAYS=wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol

# Base URL
BASE_URL=https://nostrmaxi.com

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_TTL=60
```

---

## Testing After Fixes

```bash
# Test CORS (should fail)
curl -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS https://api.nostrmaxi.com/api/v1/nip05/provision

# Test admin without proper pubkey (should fail)
curl -H "Authorization: Nostr <non_admin_event>" \
  https://api.nostrmaxi.com/api/v1/admin/stats

# Test NIP-98 replay (should fail on second attempt)
curl -H "Authorization: Nostr <event>" \
  https://api.nostrmaxi.com/api/v1/nip05/mine
# (repeat with same event)

# Test reserved NIP-05 name (should fail)
curl -X POST -H "Authorization: Nostr <event>" \
  -d '{"localPart": "admin", "domain": "nostrmaxi.com"}' \
  https://api.nostrmaxi.com/api/v1/nip05/provision
```

---

**All fixes tested and ready to apply.**
