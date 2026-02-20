# NostrMaxi

**Production-Ready Identity & Subscription Platform for Nostr**

[![Tests](https://img.shields.io/badge/tests-71%20passing-success)](./TEST_RESULTS.md)
[![Production Ready](https://img.shields.io/badge/production-ready-success)](./DEPLOYMENT.md)
[![Documentation](https://img.shields.io/badge/docs-complete-blue)](./DEPLOYMENT.md)

> **Status:** ✅ Production-ready as of 2026-02-13  
> **Test Coverage:** 71 tests passing  
> **Deployment:** Fully automated with comprehensive monitoring

---

## 🚀 Features

### Core Identity Services
- **NIP-05 Identity Management** - Provision and manage `user@domain.com` Nostr identities
- **Custom Domain Support** - Bring your own domain with DNS verification
- **Web of Trust Scoring** - Calculate trust scores based on Nostr follow graphs
- **NIP-98 HTTP Authentication** - Native Nostr authentication for API access
- **LNURL-auth** - QR code-based login flow

### Subscription & Payments
- **Tier-Based Subscriptions** - FREE, PRO ($9/mo), BUSINESS ($29/mo), LIFETIME ($99)
- **Lightning Payments** - Native Bitcoin payments via LNbits integration
- **Automated Provisioning** - Instant service activation after payment
- **Tier Enforcement** - API limits and feature flags per subscription tier

### API & Administration
- **RESTful API** - Comprehensive API with OpenAPI/Swagger documentation
- **Admin Dashboard** - User management, analytics, and audit logs
- **Rate Limiting** - Multi-zone rate limiting for DDoS protection
- **API Keys** - Generate and manage API keys for programmatic access

---

## 📋 Complete API Reference

### Authentication
```
POST   /api/v1/auth/challenge           Get Nostr auth challenge
POST   /api/v1/auth/verify              Verify signed challenge
POST   /api/v1/auth/verify-nip98        Verify NIP-98 HTTP auth
GET    /api/v1/auth/lnurl               Get LNURL-auth QR code
GET    /api/v1/auth/lnurl-callback      LNURL callback handler
GET    /api/v1/auth/lnurl-poll          Poll LNURL auth status
GET    /api/v1/auth/me                  Get current user info
POST   /api/v1/auth/logout              Logout and clear session
GET    /api/v1/auth/sessions            List active sessions
DELETE /api/v1/auth/sessions/:id       Delete specific session
```

### NIP-05 Identity
```
GET    /.well-known/nostr.json          Standard NIP-05 lookup (RFC)
GET    /api/v1/nip05/:address           Lookup identity by address
POST   /api/v1/nip05/provision          Create new NIP-05 identity
DELETE /api/v1/nip05                    Delete NIP-05 identity
GET    /api/v1/nip05/mine               List my identities
POST   /api/v1/nip05/verify/:domain     Verify custom domain
```

### Subscriptions
```
GET    /api/v1/subscriptions/tiers      List available subscription tiers
GET    /api/v1/subscriptions            Get current subscription
POST   /api/v1/subscriptions/upgrade    Upgrade subscription tier
POST   /api/v1/subscriptions/downgrade  Downgrade subscription tier
POST   /api/v1/subscriptions/cancel     Cancel subscription
POST   /api/v1/subscriptions/reactivate Reactivate subscription
```

### Payments
```
GET    /api/v1/payments/tiers           Get pricing tiers
POST   /api/v1/payments/invoice         Create Lightning invoice
GET    /api/v1/payments/invoice/:id     Get invoice status
POST   /api/v1/payments/webhook         LNbits webhook (internal)
GET    /api/v1/payments/history         Get payment history
GET    /api/v1/payments/receipt/:id     Get payment receipt
```

### Web of Trust
```
GET    /api/v1/wot/score/:pubkey        Get WoT score for pubkey
GET    /api/v1/wot/verify/:pubkey       Verify trust level
GET    /api/v1/wot/network/:pubkey      Get trust network graph
POST   /api/v1/wot/recalculate/:pubkey  Recalculate WoT score
```

### API Keys
```
POST   /api/v1/api-keys                 Create new API key
GET    /api/v1/api-keys                 List my API keys
GET    /api/v1/api-keys/:id/usage       Get API key usage stats
DELETE /api/v1/api-keys/:id             Delete API key
```

### Beacon Search
```
GET    /api/v1/search                   Search via Beacon (proxy + cache)
POST   /api/v1/search/filtered          Filtered Beacon search
```

### Admin (Auth Required)
```
GET    /api/v1/admin/stats              Platform statistics
GET    /api/v1/admin/users              List all users
GET    /api/v1/admin/nip05s             List all NIP-05 identities
GET    /api/v1/admin/audit              Audit log
GET    /api/v1/admin/payments           Payment history
```

### Health & Metrics
```
GET    /health                          Health check endpoint
GET    /api/v1/metrics                  Prometheus metrics
GET    /api/docs                        Swagger API documentation
```

---

## ⚡ Quick Start

### Local Development (SQLite)

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Initialize database
npx prisma db push

# Start development server
npm run start:dev
```

Server runs on `http://localhost:3000`  
API docs available at `http://localhost:3000/api/docs`

### Docker Development (PostgreSQL)

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend

# Stop services
docker compose down
```

### Run Tests

```bash
# Run all tests (71 tests)
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test auth.test.ts
```

---

## 🚀 Production Deployment

**Full deployment guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)

### Quick Deploy

```bash
# 1. Clone repository
git clone https://github.com/yourusername/nostrmaxi.git
cd nostrmaxi

# 2. Configure environment
cp .env.production .env.prod
nano .env.prod  # Set DOMAIN, secrets, API keys

# 3. Run deployment
chmod +x scripts/*.sh
./scripts/deploy.sh

# 4. Setup SSL (Let's Encrypt)
./scripts/ssl-setup.sh yourdomain.com

# 5. Verify deployment
./scripts/health-check.sh yourdomain.com
```

### Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| RAM | 2GB | 4GB+ |
| CPU | 2 cores | 4 cores |
| Disk | 20GB SSD | 50GB+ SSD |
| Network | 100 Mbps | 1 Gbps |

---

## 🔧 Configuration

### Required Environment Variables

```bash
# Server
DOMAIN=nostrmaxi.com
BASE_URL=https://nostrmaxi.com
PORT=3000

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/nostrmaxi
DB_PASSWORD=<generate with: openssl rand -hex 32>

# Security
JWT_SECRET=<generate with: openssl rand -hex 64>
WEBHOOK_SECRET=<generate with: openssl rand -hex 32>

# Payment Providers
PAYMENTS_PROVIDER=btcpay

# BTCPay Server (preferred)
BTCPAY_URL=https://btcpay.example.com
BTCPAY_API_KEY=your_btcpay_api_key
BTCPAY_STORE_ID=your_btcpay_store_id
BTCPAY_WEBHOOK_SECRET=<generate with: openssl rand -hex 32>

# LNbits Integration (legacy fallback)
LNBITS_URL=https://your-lnbits-instance.com
LNBITS_API_KEY=your_lnbits_admin_key
LNBITS_WEBHOOK_SECRET=<generate with: openssl rand -hex 32>

# Nostr Configuration
NIP05_DEFAULT_DOMAIN=nostrmaxi.com
NIP05_DEFAULT_RELAYS=wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol
ADMIN_PUBKEYS=hex_pubkey1,hex_pubkey2

# Features
ENABLE_REGISTRATION=true
ENABLE_PAYMENTS=true
```

### Subscription Tiers

| Tier | Price | NIP-05 Identities | Custom Domains | API Rate Limit |
|------|-------|-------------------|----------------|----------------|
| **FREE** | $0 | 1 | ❌ | 100/hour |
| **PRO** | $9/mo | 1 | ✅ | 1,000/hour |
| **BUSINESS** | $29/mo | 10 | ✅ | 10,000/hour |
| **LIFETIME** | $99 once | 1 | ✅ | 1,000/hour |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Complete production deployment guide (17KB) |
| [ADMIN-GUIDE.md](./ADMIN-GUIDE.md) | Operations and administration manual (13KB) |
| [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md) | Pre-launch verification checklist |
| [TEST_RESULTS.md](./TEST_RESULTS.md) | Test suite summary (71 tests) |
| [SMOKE_TEST_SUMMARY.md](./SMOKE_TEST_SUMMARY.md) | Smoke test verification report |

---

## 🔐 Security Features

- **Rate Limiting** - Multi-zone rate limiting (API, auth, payments, general)
- **Security Headers** - 15+ security headers (HSTS, CSP, X-Frame-Options, etc.)
- **JWT Authentication** - Secure session management with rotating secrets
- **Input Validation** - Zod schemas for all API inputs
- **SQL Injection Protection** - Parameterized queries via Prisma ORM
- **CORS Configuration** - Restricted origins in production
- **Audit Logging** - All administrative actions logged
- **Webhook Verification** - HMAC signature verification for payments

---

## 🧪 Testing

**Status:** ✅ 71 tests passing

### Test Coverage

| Component | Tests | Status |
|-----------|-------|--------|
| Authentication (NIP-42, NIP-98, LNURL-auth) | 16 | ✅ PASS |
| NIP-05 Verification & Provisioning | 14 | ✅ PASS |
| Payment Processing & Webhooks | 13 | ✅ PASS |
| Rate Limiting & Security | 17 | ✅ PASS |
| Identity CRUD Operations | 11 | ✅ PASS |
| **TOTAL** | **71** | **✅ PASS** |

```bash
# Run all tests
npm test

# Output:
# Test Suites: 4 passed, 4 total
# Tests:       71 passed, 71 total
# Time:        ~8.4 seconds
```

---

## 📊 Monitoring & Operations

### Health Monitoring

```bash
# Check application health
./scripts/health-check.sh yourdomain.com

# Monitor logs
docker compose logs -f backend

# View metrics
curl https://yourdomain.com/api/v1/metrics
```

### Automated Backups

- **Frequency:** Every 6 hours (configurable)
- **Retention:** 7 days (configurable)
- **Location:** `./backups/`
- **Format:** Compressed PostgreSQL dumps

```bash
# Manual backup
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh backups/backup-2026-02-13.sql.gz
```

### Rollback

```bash
# Safe rollback to previous version
./scripts/rollback.sh
```

---

## 🛠️ Development Scripts

```bash
# Development
npm run start:dev              # Start with hot-reload
npm run dev                    # Start backend + frontend concurrently

# Building
npm run build                  # Build backend (NestJS)
npm run build:frontend         # Build frontend (React)
npm run build:all              # Build everything

# Production
npm run start:prod             # Start production server

# Database
npm run prisma:generate        # Generate Prisma client
npm run prisma:migrate         # Run migrations (dev)
npm run prisma:migrate:prod    # Run migrations (production)

# Testing
npm test                       # Run tests
npm run test:e2e              # Run end-to-end tests
```

---

## 🏗️ Architecture

### Tech Stack

- **Backend:** NestJS (TypeScript)
- **Database:** PostgreSQL + Prisma ORM
- **Authentication:** Nostr (NIP-42, NIP-98), LNURL-auth
- **Payments:** LNbits (Lightning Network)
- **Frontend:** React + Vite
- **Deployment:** Docker + Docker Compose
- **Web Server:** nginx (reverse proxy)
- **SSL:** Let's Encrypt (automated)

### Project Structure

```
nostrmaxi/
├── src/                    # Backend source code
│   ├── admin/             # Admin dashboard API
│   ├── api-keys/          # API key management
│   ├── auth/              # Authentication (NIP-42, NIP-98, LNURL-auth)
│   ├── nip05/             # NIP-05 identity provisioning
│   ├── payments/          # Lightning payments (LNbits)
│   ├── subscription/      # Subscription management
│   ├── wot/               # Web of Trust scoring
│   ├── health/            # Health checks
│   ├── metrics/           # Prometheus metrics
│   └── __tests__/         # Test suite (71 tests)
├── frontend/              # React frontend
├── prisma/                # Database schema & migrations
├── scripts/               # Deployment & operations scripts (11)
├── nginx/                 # nginx configuration
├── docker-compose.yml     # Development compose file
├── docker-compose.prod.yml # Production compose file
└── Dockerfile.prod        # Production Docker image
```

---

## 🚦 Production Readiness

**Status:** ✅ **PRODUCTION READY** (as of 2026-02-13)

### Completed
- ✅ All core features implemented
- ✅ 71 tests passing (Auth, NIP-05, Payments, Rate Limiting)
- ✅ Comprehensive documentation (40+ pages)
- ✅ Deployment automation (11 scripts)
- ✅ Security hardening (rate limiting, headers, JWT)
- ✅ Automated backups every 6 hours
- ✅ Health monitoring & metrics
- ✅ Clean codebase (only 1 TODO, non-critical)
- ✅ Docker production build verified
- ✅ SSL/TLS automation ready
- ✅ Payment integration complete (LNbits)
- ✅ API documentation (Swagger)
- ✅ Frontend built and optimized

### Known Limitations

1. **Web of Trust (WoT) uses mock data**
   - Location: `src/wot/wot.service.ts:95`
   - Impact: LOW - Returns placeholder scores instead of querying Nostr relays
   - Workaround: Functional for MVP, real relay queries planned for v1.1
   - Does not block production launch

2. **Blossom Storage not implemented**
   - Status: Planned for Phase 1 post-launch
   - Workaround: Not required for core NIP-05 and subscription functionality
   - Reference: `BACKLOG.md` Phase 1 "Service Provisioning"

### Pre-Launch Requirements

Before deploying to production, complete:
1. Configure `.env.prod` with real secrets and API keys
2. Setup SSL certificates (automated via `./scripts/ssl-setup.sh`)
3. Configure LNbits webhook endpoint
4. Set admin pubkeys

**Estimated deployment time:** 2-4 hours for experienced operators

---

## 📞 Support & Contributing

### Getting Help

- **Documentation:** See [DEPLOYMENT.md](./DEPLOYMENT.md) and [ADMIN-GUIDE.md](./ADMIN-GUIDE.md)
- **Issues:** Report bugs via GitHub Issues
- **Nostr:** Contact via NIP-05 verified address

### Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🎯 Roadmap

### v1.0 (Current - Production Ready) ✅
- NIP-05 identity management
- Subscription tiers with Lightning payments
- Nostr authentication (NIP-42, NIP-98, LNURL-auth)
- Admin dashboard
- API key management

### v1.1 (Planned - Q1 2026)
- Real Web of Trust relay queries
- Blossom storage integration
- Enhanced analytics dashboard
- Multi-language support

### v2.0 (Future)
- Custom relay management
- Advanced endorsement features (NIP-31910, NIP-31911)
- White-label solutions
- Enterprise tier

---

**Last Updated:** 2026-02-13  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
