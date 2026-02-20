# NostrMaxi - Product Backlog

**Project:** NostrMaxi (Identity & Subscription Platform)  
**Status:** Not started - New project  
**Last Updated:** 2026-02-11

---

## Overview

NostrMaxi handles identity verification, subscriptions, and Web of Trust features that support NostrCast and future Nostr applications.

---

## MVP (Must Have for Launch) 🚀

### Project Setup
- [ ] NestJS project scaffolding
- [ ] PostgreSQL + Prisma setup
- [ ] Docker Compose configuration
- [ ] Environment configuration (@nestjs/config)
- [ ] Basic health endpoints

### Core Identity (NIP-05)
- [ ] nostrcheck API integration
- [ ] NIP-05 provisioning (create/manage)
- [ ] Custom domain support
- [ ] Domain verification flow
- [ ] NIP-05 lookup API

### Lightning Addresses
- [ ] Custom Lightning address creation
- [ ] Lightning address routing
- [ ] Integration with user domains

### User Management
- [ ] Nostr authentication (NIP-07/NIP-98)
- [ ] User profile storage
- [ ] Account settings
- [ ] Session management

### MVP Effort Estimate
- **Total:** 2-3 weeks
- **Priority:** HIGH (needed for NostrCast integration)

---

## Phase 1: Monetization 💰

### Subscription Tiers
- [ ] Free tier (consumers only)
- [ ] Creator tier ($9/mo or 50k sats)
- [ ] Open Source tier (NIP-39 verified)
- [ ] Tier enforcement logic

### Payment Processing
- [ ] Lightning payment integration
- [ ] Stripe integration (fallback)
- [ ] Invoice generation
- [ ] Payment webhooks
- [ ] Subscription lifecycle management

### Service Provisioning
- [ ] NIP-05 allocation per tier
- [ ] Blossom storage allocation
- [ ] Relay access levels
- [ ] Feature flags per tier

### Phase 1 Effort Estimate
- **Total:** 3-4 weeks
- **Priority:** HIGH

---

## Phase 2: Social Features 👥

### Web of Trust
- [ ] WoT score calculation
- [ ] Trust network visualization
- [ ] Follow chain analysis
- [ ] Mute/block integration

### Account Verification
- [ ] Bot detection logic
- [ ] Genuine account scoring
- [ ] Account age verification
- [ ] Activity-based reputation

### Discount System
- [ ] Social score calculation
- [ ] Content rating aggregation
- [ ] Discount tier assignment
- [ ] Automatic discount application

### Phase 2 Effort Estimate
- **Total:** 4-5 weeks
- **Priority:** MEDIUM

---

## Phase 3: Advanced Identity 🔐

### Skill Endorsements
- [ ] Endorsement creation (kind 31910)
- [ ] Endorsement display
- [ ] 3-tier filtering (WoT/genuine/all)
- [ ] Top endorsers list

### Professional Recommendations
- [ ] Recommendation creation (kind 31911)
- [ ] Approval workflow (kind 31912)
- [ ] Public recommendation display
- [ ] Recommendation requests

### Advanced Tiers
- [ ] Studio tier ($29/mo)
- [ ] Enterprise tier (custom)
- [ ] White-label options
- [ ] Custom SLAs

### Phase 3 Effort Estimate
- **Total:** 4-6 weeks
- **Priority:** LOW (future)

---

## Phase 4: Platform Features 🌐

### Site Proxy
- [ ] Proxy existing sites with Nostr layer
- [ ] SSL/TLS management via nostrcheck
- [ ] Custom domain routing
- [ ] Nostr auth layer injection

### Domain Management
- [ ] DNS management interface
- [ ] Multi-domain support
- [ ] Domain health monitoring
- [ ] SSL certificate status

### Fundraising (Geyser-style)
- [ ] Campaign creation
- [ ] Donation tracking (no custody)
- [ ] Split donation packages
- [ ] "Help a Nostrich Out" randomizer

### Phase 4 Effort Estimate
- **Total:** 6-8 weeks
- **Priority:** LOW (future)

---

## API Endpoints (Planned)

### Identity
```
POST   /api/v1/nip05/provision
GET    /api/v1/nip05/:address
DELETE /api/v1/nip05/:address
GET    /api/v1/nip05/verify/:domain
```

### Subscriptions
```
GET    /api/v1/subscriptions/tiers
POST   /api/v1/subscriptions/create
GET    /api/v1/subscriptions/current
POST   /api/v1/subscriptions/upgrade
POST   /api/v1/subscriptions/cancel
```

### Payments
```
POST   /api/v1/payments/lightning/invoice
POST   /api/v1/payments/stripe/checkout
GET    /api/v1/payments/history
```

### Web of Trust
```
GET    /api/v1/wot/score/:npub
GET    /api/v1/wot/network/:npub
GET    /api/v1/wot/verify/:npub
```

---

## Integration with NostrCast

NostrMaxi exposes APIs for:
1. **Auth verification** - Validate subscriptions
2. **NIP-05 lookup** - Display verified badges
3. **WoT scores** - Filter content by trust
4. **Feature flags** - Enable/disable features by tier

NostrCast calls NostrMaxi to:
- Check if user has valid subscription
- Display NIP-05 verification
- Apply WoT filtering to feeds
- Show tier-specific features

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | NestJS | Structure, TypeScript, extensibility |
| Database | PostgreSQL | ACID, JSON support, proven |
| ORM | Prisma | Type-safe, migrations, DX |
| Auth | Nostr-native | NIP-07, NIP-98 |
| Validation | Zod | Shared schemas, type inference |
| Payments | Lightning + Stripe | Bitcoin-native + fallback |

---

## Definition of Done

An item is "done" when:
1. Code is written with TypeScript
2. Tests pass (80%+ coverage)
3. API documented in OpenAPI
4. PR reviewed and merged
5. Deployed to staging
6. Integration tested with NostrCast

---

*Backlog maintained from FEATURE-CONSOLIDATION.md*
