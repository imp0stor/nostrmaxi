# NostrMaxi - Complete Playbook

**Last Updated:** 2026-02-13  
**Version:** 1.0  
**Status:** Production Ready (Deployment Pending)

---

## 🎯 What We're Building

**NostrMaxi** is a NIP-05 identity service and Web of Trust analytics platform for Nostr. It provides:

- **Verified Nostr Identities** (`user@domain.com`) for individuals and businesses
- **Custom Domain Support** - Bring your own domain for white-label identity services
- **Web of Trust Scoring** - Calculate trust scores based on Nostr follow graphs
- **Lightning Payments** - Subscription-based revenue model with instant Bitcoin payments
- **API Access** - Programmatic identity management for developers and services

**Target Customers:**
- Individual Nostr users wanting professional identities
- Businesses offering NIP-05 to customers (white-label)
- Developers building on Nostr needing identity verification
- Communities wanting custom domain identities

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      PRODUCTION STACK                         │
├──────────────────────────────────────────────────────────────┤
│ Frontend (React + Vite)                                       │
│ ├── Landing page (hero, features, pricing)                    │
│ ├── Identity checker (real-time NIP-05 verification)          │
│ ├── User dashboard (manage identities)                        │
│ ├── Payment flow (Lightning invoices)                         │
│ └── Admin dashboard (user management, analytics)              │
├──────────────────────────────────────────────────────────────┤
│ Backend (NestJS + TypeScript)                                 │
│ ├── NIP-05 Identity API (provision, verify, delete)           │
│ ├── Authentication (NIP-42, NIP-98, LNURL-auth)               │
│ ├── Subscription Management (4 tiers)                         │
│ ├── Payment Integration (LNbits webhooks)                     │
│ ├── Web of Trust Scoring                                      │
│ ├── API Key Management                                        │
│ ├── Admin API (stats, audit logs)                             │
│ └── Rate Limiting (DDoS protection)                           │
├──────────────────────────────────────────────────────────────┤
│ Storage Layer                                                 │
│ ├── PostgreSQL 16 (user data, identities, payments)           │
│ ├── Redis (rate limiting, caching)                            │
│ └── Prisma ORM (schema + migrations)                          │
├──────────────────────────────────────────────────────────────┤
│ Infrastructure                                                │
│ ├── nginx (reverse proxy, SSL termination)                    │
│ ├── Let's Encrypt (automated SSL certificates)                │
│ ├── Docker Compose (orchestration)                            │
│ └── Automated backups (every 6 hours)                         │
├──────────────────────────────────────────────────────────────┤
│ External Services                                             │
│ ├── LNbits (Lightning invoices + webhooks)                    │
│ ├── Nostr Relays (WoT data, event publishing)                 │
│ └── DNS Provider (custom domain verification)                 │
└──────────────────────────────────────────────────────────────┘
```

**Deployment Target:** VPS (Ubuntu 22.04+) or cloud provider

---

## 📦 Components

### 1. Backend API (NestJS)
- **Location:** `~/strangesignal/projects/nostrmaxi/backend/`
- **Tech:** NestJS, TypeScript, Prisma, PostgreSQL
- **Port:** 3000 (internal), 443 (via nginx)
- **Key Modules:**
  - `nip05` - Identity provisioning and management
  - `auth` - Authentication (Nostr + LNURL)
  - `subscriptions` - Tier management
  - `payments` - Lightning invoice handling
  - `wot` - Web of Trust scoring
  - `admin` - Admin dashboard API

**API Routes:** 40+ endpoints across 6 modules

### 2. Frontend (React + Vite)
- **Location:** `~/strangesignal/projects/nostrmaxi/frontend/`
- **Tech:** React 18, Vite, TailwindCSS, TypeScript
- **Pages:**
  - Landing (hero, features, pricing)
  - Identity Checker (NIP-05 lookup)
  - Dashboard (user account management)
  - Admin Panel (platform management)
- **Authentication:** Nostr browser extension (NIP-07) + LNURL-auth

### 3. Database (PostgreSQL + Prisma)
- **Schema:**
  - `users` - User accounts
  - `nip05_identities` - Provisioned identities
  - `subscriptions` - Subscription records
  - `payments` - Payment history
  - `api_keys` - API key management
  - `audit_logs` - Audit trail
- **Migrations:** Versioned schema changes in `prisma/migrations/`

### 4. Payment System (LNbits)
- **Integration:** Webhook-based
- **Flow:**
  1. User selects subscription tier
  2. Backend generates Lightning invoice (LNbits API)
  3. User pays invoice
  4. LNbits webhook triggers backend
  5. Backend provisions identity/upgrades subscription
- **Tiers:** FREE, PRO ($9/mo), BUSINESS ($29/mo), LIFETIME ($99)

### 5. Web of Trust (WoT)
- **Purpose:** Calculate trust scores based on Nostr follow graphs
- **Algorithm:** Multi-hop graph traversal
- **Data Source:** Nostr relays (kind 3 contact lists)
- **Status:** Mock implementation (production WoT pending)

---

## 🚀 Implementation Phases

### Phase 1: Backend MVP (COMPLETE)
**Goal:** Core NIP-05 + payment functionality

- [x] NestJS project setup
- [x] PostgreSQL + Prisma schema
- [x] NIP-05 API endpoints
- [x] Authentication (NIP-42, NIP-98, LNURL-auth)
- [x] Subscription management
- [x] LNbits payment integration
- [x] API key generation
- [x] Admin endpoints
- [x] Rate limiting
- [x] Health checks + metrics
- [x] Swagger API documentation

**Deliverable:** Production-ready backend (builds successfully)

### Phase 2: Frontend MVP (COMPLETE)
**Goal:** User-facing interface

- [x] Landing page
- [x] Identity checker widget
- [x] Pricing page
- [x] Login system (Nostr extension)
- [x] User dashboard
- [x] NIP-05 provisioning flow
- [x] Payment flow (Lightning invoices)
- [x] Admin dashboard
- [x] Dark theme + Nostr branding

**Deliverable:** Production-ready frontend (builds successfully)

### Phase 3: Infrastructure (COMPLETE)
**Goal:** Production deployment tooling

- [x] Docker Compose (dev + production)
- [x] nginx reverse proxy config
- [x] SSL/TLS automation (Let's Encrypt)
- [x] Deployment scripts (11 scripts)
- [x] Automated backups (every 6h)
- [x] Health monitoring
- [x] Rollback procedures
- [x] Documentation (README, DEPLOYMENT, ADMIN-GUIDE)

**Deliverable:** Fully automated deployment pipeline

### Phase 4: Testing (PARTIAL)
**Goal:** Comprehensive test coverage

- [x] Payment system tests (13/13 passing)
- [ ] Auth tests (cache manager mocking needed)
- [ ] NIP-05 tests (cache manager mocking needed)
- [ ] Rate limiting tests (async/await refactoring needed)
- [ ] E2E tests (Playwright)

**Status:** Core functionality tested, test infrastructure needs improvement

### Phase 5: Production Deployment (PENDING)
**Goal:** Live production instance

- [ ] VPS provisioning (Ubuntu 22.04)
- [ ] Domain registration
- [ ] DNS configuration
- [ ] Deploy via scripts
- [ ] SSL certificate setup
- [ ] LNbits account (hosted or self-hosted)
- [ ] Nostr relay configuration
- [ ] Backup verification
- [ ] Load testing
- [ ] Soft launch (invite-only)

**Deliverable:** Live production instance at `nostrmaxi.com`

### Phase 6: Web of Trust V2 (FUTURE)
**Goal:** Real WoT scoring

- [ ] Nostr relay integration (fetch kind 3 events)
- [ ] Graph database (Neo4j or PostgreSQL pgRouting)
- [ ] Multi-hop traversal algorithm
- [ ] Caching layer (Redis)
- [ ] WoT API endpoints
- [ ] WoT analytics dashboard

**Deliverable:** Production Web of Trust scoring

---

## 🔧 Technical Decisions

### Framework: NestJS (not Express/Fastify)
**Decision:** NestJS  
**Rationale:** Enterprise-grade structure, built-in dependency injection, TypeScript-first, modular architecture  
**Trade-offs:** Slightly more boilerplate than Express, but better long-term maintainability  
**Date:** 2026-02-09

### ORM: Prisma (not TypeORM/Sequelize)
**Decision:** Prisma  
**Rationale:** Type safety, great DX, automatic migrations, schema-first design  
**Trade-offs:** Less mature than TypeORM, but superior type safety  
**Date:** 2026-02-09

### Frontend: React + Vite (not Next.js)
**Decision:** React + Vite  
**Rationale:** Simpler than Next.js for SPA, faster dev builds, no SSR complexity  
**Trade-offs:** No SSR/SSG (not needed for this use case)  
**Date:** 2026-02-10

### Auth: Nostr-native (not email/password)
**Decision:** Nostr extension + LNURL-auth only  
**Rationale:** Aligns with target audience, no password database, user owns identity  
**Trade-offs:** Requires Nostr browser extension (barrier for new users)  
**Date:** 2026-02-10

### Payments: LNbits (not BTCPay/LND)
**Decision:** LNbits API  
**Rationale:** Clean API, hosted option available, webhook support  
**Trade-offs:** External dependency (can self-host if needed)  
**Date:** 2026-02-10

### Deployment: Docker Compose (not Kubernetes)
**Decision:** Docker Compose on VPS  
**Rationale:** Simpler ops, lower cost, sufficient for MVP scale  
**Trade-offs:** Manual scaling vs K8s auto-scaling  
**Date:** 2026-02-11

---

## 📁 Project Structure

```
~/strangesignal/projects/nostrmaxi/
├── PLAYBOOK.md                    # This file
├── README.md                      # Project overview
├── STATUS.md                      # Current status
├── DEPLOYMENT.md                  # Deployment guide (17KB)
├── ADMIN-GUIDE.md                 # Operations manual (13KB)
├── PRODUCTION-CHECKLIST.md        # Pre-launch checklist
├── BACKLOG.md                     # Product backlog
├── backend/
│   ├── src/
│   │   ├── main.ts                # NestJS entry point
│   │   ├── nip05/                 # NIP-05 module
│   │   ├── auth/                  # Authentication module
│   │   ├── subscriptions/         # Subscription management
│   │   ├── payments/              # Payment integration
│   │   ├── wot/                   # Web of Trust module
│   │   ├── admin/                 # Admin API module
│   │   └── common/                # Shared utilities
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── migrations/            # Migration history
│   ├── test/                      # Unit/integration tests
│   ├── package.json
│   ├── Dockerfile
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/                 # React pages
│   │   ├── components/            # Reusable components
│   │   ├── hooks/                 # Custom hooks
│   │   └── utils/                 # Utilities
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.ts
├── scripts/
│   ├── deploy.sh                  # Main deployment
│   ├── ssl-setup.sh               # SSL certificate setup
│   ├── backup.sh                  # Database backup
│   ├── restore.sh                 # Restore from backup
│   ├── health-check.sh            # Health monitoring
│   ├── logs.sh                    # View logs
│   ├── rollback.sh                # Rollback deployment
│   └── ... (11 total scripts)
├── docker-compose.yml             # Development setup
├── docker-compose.prod.yml        # Production setup
├── nginx.conf                     # nginx reverse proxy
└── .env.production                # Production environment vars
```

---

## 🔄 Pivot Log

### 2026-02-11: Deferred WoT V2
**Change:** Launched with mock WoT, real implementation deferred to Phase 6  
**Rationale:** Core NIP-05 + payments sufficient for MVP, WoT complex  
**Impact:** WoT endpoints return mock scores, real implementation post-launch  
**Documentation Updated:** STATUS.md, BACKLOG.md

### 2026-02-12: Simplified Auth Flow
**Change:** Removed email/password, Nostr-only authentication  
**Rationale:** Target audience already has Nostr keys, simplifies security  
**Impact:** Removed email verification, password reset flows  
**Documentation Updated:** README.md, frontend auth components

---

## 🧪 Testing Checklist

### Backend API
- [x] NIP-05 provisioning works
- [x] /.well-known/nostr.json returns correct format
- [x] Lightning invoice generation (LNbits)
- [x] Payment webhook handling
- [x] Subscription tier upgrades
- [x] API key generation
- [x] Rate limiting enforced
- [ ] Auth token validation (needs fix)
- [ ] Cache manager mocking (test infrastructure)

### Frontend
- [x] Landing page loads
- [x] Identity checker works
- [x] Pricing page displays tiers
- [x] Login via Nostr extension
- [x] Dashboard displays user data
- [x] Payment flow (invoice generation)
- [ ] E2E user journey (Playwright)

### Infrastructure
- [x] Docker Compose builds successfully
- [x] nginx serves frontend + proxies API
- [x] SSL certificate automation
- [x] Backup script works
- [x] Health check endpoint responds
- [ ] Production deployment on VPS

---

## 🚨 Critical Dependencies

### Infrastructure
- VPS with public IP (Ubuntu 22.04+)
- Domain name with DNS control
- SSL certificate (automated via Let's Encrypt)

### External Services
- **LNbits:** Lightning payments (legend.lnbits.com or self-hosted)
- **Nostr Relays:** WoT data, event publishing
- **DNS Provider:** Custom domain verification

### Software
- Docker 24+
- Docker Compose 2.20+
- PostgreSQL 16
- Redis 7+
- nginx (reverse proxy)
- Node.js 20+

---

## 📊 Success Metrics

### MVP Launch
- 100+ NIP-05 identities provisioned
- 20+ PRO subscriptions
- 5+ BUSINESS subscriptions
- $500+ MRR (Monthly Recurring Revenue)

### Production (3 months)
- 1,000+ identities
- 100+ PRO subscriptions
- 10+ BUSINESS subscriptions
- $1,500+ MRR
- 99.5% uptime
- <500ms API response time (p95)

### Year 1
- 10,000+ identities
- 500+ paying subscriptions
- $5,000+ MRR
- 99.9% uptime
- White-label customers (custom domains)

---

## 🔗 Related Projects

### NostrCast
- **Purpose:** Podcast hosting platform
- **Integration:** NostrMaxi provides NIP-05 for NostrCast creators
- **Location:** `~/strangesignal/projects/nostrcast/`

### Immortals
- **Purpose:** AI personality debates
- **Integration:** Immortals personalities have NIP-05 identities via NostrMaxi
- **Location:** `~/strangesignal/projects/immortals/`

### Fragstr Network
- **Purpose:** Gaming platform
- **Integration:** Fragstr players get NIP-05 identities (white-label)
- **Location:** `~/strangesignal/projects/fragstr/`

---

## 📞 Key Contacts

- **Project Owner:** imp0stor
- **VPS Access:** TBD (10.1.10.154 credentials pending)
- **LNbits Account:** TBD (setup pending)
- **Domain Registrar:** TBD

---

## 📚 References

### Internal Docs
- `README.md` - Project overview + features
- `DEPLOYMENT.md` - Complete deployment guide (17KB)
- `ADMIN-GUIDE.md` - Operations manual (13KB)
- `PRODUCTION-CHECKLIST.md` - Pre-launch checklist
- `STATUS.md` - Current project status
- `BACKLOG.md` - Product backlog + roadmap

### External Resources
- [NIP-05 Spec](https://github.com/nostr-protocol/nips/blob/master/05.md)
- [NIP-42 Auth Spec](https://github.com/nostr-protocol/nips/blob/master/42.md)
- [NIP-98 HTTP Auth](https://github.com/nostr-protocol/nips/blob/master/98.md)
- [LNbits API Docs](https://lnbits.com/api)
- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs)

---

## 🛠️ Maintenance

### Update Triggers
- **Deployment blockers:** Update STATUS.md immediately
- **API changes:** Update Swagger docs + README
- **Architecture shifts:** Update PLAYBOOK.md
- **New features:** Update phase completion status
- **Pivots:** Add to pivot log within 24h

### Review Cadence
- **Daily:** Sprint status check (STATUS.md)
- **Weekly:** Playbook review (this file)
- **Pre-deployment:** Full documentation audit
- **Post-incident:** Update troubleshooting section

---

## 💡 Open Questions

1. **VPS Provider:** Use existing 10.1.10.154 or deploy to cloud (Hetzner, DigitalOcean)?
2. **Domain:** nostrmaxi.com available? Alternative: nostrmaxi.io, nostrmaxi.net?
3. **LNbits:** Hosted (legend.lnbits.com) or self-hosted instance?
4. **WoT Data:** Which Nostr relays for WoT graph data?
5. **Pricing:** Are tier prices ($9/29/99) competitive?
6. **White-Label:** What's minimum BUSINESS tier feature set?
7. **Monitoring:** Self-hosted (Prometheus/Grafana) or SaaS (BetterStack)?

**Action:** Resolve before Phase 5 (Deployment) begins.

---

## 🎯 Next Immediate Steps

1. Resolve VPS SSH access (10.1.10.154)
2. Register domain (nostrmaxi.com or alternative)
3. Setup LNbits account (or deploy self-hosted)
4. Configure DNS records
5. Run deployment via `./scripts/deploy.sh`
6. Setup SSL certificates
7. Test full payment flow end-to-end
8. Invite beta testers
9. Public launch announcement on Nostr
