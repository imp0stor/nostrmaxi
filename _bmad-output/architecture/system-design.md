# NostrMaxi System Design

**Last Updated:** 2026-03-01

## Architecture Overview

NostrMaxi is a NIP-05 identity platform with marketplace, messaging, and creator tools. Built on NestJS (backend) + React/Vite (frontend) with PostgreSQL, Redis, and Nostr relay integration.

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Vite)                    │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐       │
│  │  Feed    │ Profile  │ Messages │ Market   │  Admin   │       │
│  │  Page    │  Page    │   Page   │  place   │  Panel   │       │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (NestJS)                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     API Gateway                          │    │
│  │  Auth Middleware → JWT Validation → Route Guards         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐       │
│  │  NIP-05  │  Market  │ Payments │ Profiles │  Feeds   │       │
│  │  Module  │  Module  │  Module  │  Module  │  Module  │       │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘       │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐       │
│  │  Admin   │ Domains  │ Messages │ Primitives│ Sync    │       │
│  │  Module  │  Module  │  Module  │  Module  │  Module  │       │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │PostgreSQL│   │  Redis   │   │  Nostr   │
        │ Database │   │  Cache   │   │  Relays  │
        └──────────┘   └──────────┘   └──────────┘
```

## Components

### Frontend (React + Vite + TypeScript)

**Stack:**
- React 18 with TypeScript
- Vite for build/dev
- TailwindCSS (TRUE BLACK theme: #000000, orange accents: #f97316)
- nostr-tools for Nostr operations

**Key Pages:**
- `/` - Landing page with value prop
- `/feed` - WoT-filtered content feed
- `/profile/:pubkey` - User profiles with endorsements
- `/messages` - Encrypted DMs (NIP-04/NIP-44)
- `/marketplace` - NIP-05 auctions, listings, resale
- `/settings` - Relay health, mute settings, Blossom config
- `/admin/*` - Admin dashboard, user management, marketplace admin

**Design System:**
- TRUE BLACK background (#000000, #0a0a0a)
- Orange accent (#f97316)
- Drillable UIs (persistent detail pane)
- Minimal, sleek, professional

### Backend (NestJS + TypeScript)

**Stack:**
- NestJS 10
- Prisma ORM
- PostgreSQL 16
- Redis 7 (caching)
- JWT authentication

**Modules:**

| Module | Purpose | Key Endpoints |
|--------|---------|---------------|
| `auth` | JWT auth, Nostr login | `/api/v1/auth/*` |
| `nip05` | Identity registration | `/.well-known/nostr.json`, `/api/v1/nip05/*` |
| `nip05-marketplace` | Auctions, listings, resale | `/api/v1/nip05/marketplace/*` |
| `payments` | BTCPay, Lightning | `/api/v1/payments/*` |
| `split-payment` | Marketplace splits (5%/95%) | Internal service |
| `profiles` | Endorsements, themes | `/api/v1/profiles/*` |
| `feeds` | Feed creation, RSS export | `/api/v1/feeds/*` |
| `domains` | Custom domain management | `/api/v1/domains/*` |
| `admin` | Platform administration | `/api/v1/admin/*` |
| `primitives` | Nostr primitives integration | `/api/v1/primitives/*` |
| `relay-sync` | Event ingestion from relays | Background service |

### Database (PostgreSQL 16)

**Core Tables:**
- `User` - Platform users with pubkey, tier, lightningAddress
- `Nip05` - Registered identities (localPart@domain)
- `Subscription` - User subscription tiers

**Marketplace Tables:**
- `Nip05Auction` - Auction listings with status lifecycle
- `Nip05Bid` - Bids on auctions
- `Nip05Listing` - Flat-price listings
- `Nip05Transfer` - Transfer records
- `MarketplaceTransaction` - Payment audit trail with splits
- `ReservedName`, `PremiumName`, `BlockedName` - Name policies

**Feed Tables:**
- `Feed` - User-created feeds with filter config
- `FeedSubscription` - Feed subscriptions

**Profile Tables:**
- `Endorsement` - Skill endorsements (endorser → endorsee)
- `ProfileSettings` - Theme, display preferences

**Domain Tables:**
- `Domain` - Custom domains with verification
- `Site` - Site configuration per domain

### External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| BTCPay Server | Payment processing | Webhooks, invoice creation |
| Nostr Relays | Event publishing/fetching | WebSocket connections |
| Blossom Servers | Media storage | HTTP upload/download |
| strfry | Local relay for sync | WebSocket on :7777 |

## Data Flow

### NIP-05 Purchase Flow
```
User selects name → Create invoice (BTCPay)
  → User pays Lightning → Webhook received
  → Verify payment → Provision identity
  → Publish to relays → Return success
```

### Marketplace Purchase Flow
```
Buyer clicks Buy → Generate invoice (full price)
  → Buyer pays → Webhook confirms
  → Calculate split (5% platform, 95% seller)
  → Pay seller via Lightning address
  → Execute NIP-05 transfer immediately
  → Record transaction → Return success
```

### DM Flow
```
Receive encrypted event (kind:4 or kind:1059)
  → Detect encryption type (NIP-04/NIP-44/gift-wrap)
  → Decrypt with user's key
  → Display with encryption badge
```

## Security

### Authentication
- **Method:** JWT tokens with Nostr signature verification
- **Flow:** User signs challenge with nsec → Backend verifies → Issues JWT
- **Guard:** `NostrJwtAuthGuard` on protected routes
- **Admin:** `NostrAdminGuard` for admin-only routes

### Authorization
- **Tiers:** FREE, PRO, BUSINESS, LIFETIME
- **Admin:** `isAdmin` flag on User model (database-driven)
- **Entitlements:** Feature access based on tier

### Data Protection
- **nsec:** Never transmitted or stored server-side
- **Encryption:** NIP-44 preferred for DMs
- **Secrets:** Environment variables, not in code

## Deployment

### Production Stack
```
Server: neo@10.1.10.143
├── nostrmaxi-backend (systemd, port 3000)
├── nostrmaxi-frontend (systemd, port 3402)
├── PostgreSQL 16 (Docker, port 5432)
├── Redis 7 (Docker, port 6379)
└── strfry relay (Docker, port 7777)
```

### Caddy Routing
```
nostrmaxi.com {
  /api/* → localhost:3000
  /.well-known/* → localhost:3000
  /* → localhost:3402
}
```

### CI/CD
- Branch: `feat/dm-zap-ux`
- Deploy: `git pull` → `npm install` → `prisma db push` → `npm run build` → `systemctl restart`

## Testing

- **Unit Tests:** Jest, 66 suites, 272 tests
- **Test Command:** `npm test`
- **Coverage Target:** 80%+

## Performance

### Caching
- Redis for session data, WoT scores, feed caching
- TTL-based invalidation

### Bundle Size
- Current: ~1.4MB (needs code splitting)
- Target: <500KB initial load

### Relay Politeness
- Rate limiting on relay queries
- Exponential backoff on failures
- Distributed across multiple relays
