# NostrMaxi Data Model

**Last Updated:** 2026-03-01

---

## Entity Relationship Overview

```
User ──────┬──────────────────────────────────────────────────────────
           │
           ├── Subscription (1:1)
           ├── Session (1:N)
           ├── ApiKey (1:N)
           ├── Nip05 (1:N) ─── identities owned
           ├── Domain (1:N)
           │     └── Site (1:1)
           ├── Feed (1:N)
           │     └── FeedSubscription (N:M)
           ├── Endorsement (as endorser, 1:N)
           ├── Endorsement (as endorsee, 1:N)
           ├── MarketplaceTransaction (as buyer, 1:N)
           └── MarketplaceTransaction (as seller, 1:N)

Nip05Auction ── Nip05Bid (1:N)
             └── Nip05Transfer (1:1 on settle)

Nip05Listing ── Nip05Transfer (1:1 on purchase)

MarketplaceTransaction ── links to Transfer, Listing, or Auction
```

---

## Core Models

### User
Primary platform user record.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| pubkey | String | Nostr hex pubkey (unique) |
| tier | Enum | FREE, PRO, BUSINESS, LIFETIME |
| isAdmin | Boolean | Admin access flag |
| lightningAddress | String? | For marketplace payouts |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Subscription
User subscription details.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| userId | UUID | FK → User |
| tier | Enum | Subscription tier |
| expiresAt | DateTime? | Null = lifetime/free |
| isActive | Boolean | Computed: tier != FREE or valid expiry |

### Nip05
Registered NIP-05 identity.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| pubkey | String | Owner's pubkey |
| localPart | String | The "name" in name@domain |
| domain | String | Domain (nostrmaxi.com, etc.) |
| isActive | Boolean | Currently valid |
| expiresAt | DateTime? | |
| createdAt | DateTime | |

**Unique:** (localPart, domain)

---

## Marketplace Models

### Nip05Auction
Auction for premium/reserved names.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| name | String | The NIP-05 local part |
| domain | String | |
| status | Enum | scheduled, live, ended, settled, cancelled |
| startTime | DateTime | |
| endTime | DateTime | |
| reservePriceSats | Int | Minimum to sell |
| minIncrementSats | Int | Min bid increment |
| currentBidSats | Int | Highest bid |
| currentBidderPubkey | String? | |
| winnerPubkey | String? | Set on settle |
| createdBy | String | Admin pubkey |

### Nip05Bid
Bid on an auction.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| auctionId | UUID | FK → Nip05Auction |
| bidderPubkey | String | |
| amountSats | Int | |
| createdAt | DateTime | |

### Nip05Listing
Flat-price or resale listing.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| name | String | |
| domain | String | |
| sellerPubkey | String | |
| priceSats | Int | |
| listingType | Enum | premium, resale |
| saleMode | Enum | lifetime, lease_remainder |
| status | Enum | active, sold, cancelled |
| createdAt | DateTime | |

### Nip05Transfer
Record of ownership transfer.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| sourceType | String | auction, listing |
| sourceId | String | |
| buyerPubkey | String | |
| sellerPubkey | String? | |
| amountSats | Int | Total paid |
| platformFeeSats | Int | 5% |
| sellerPayoutSats | Int | 95% |
| transferStatus | Enum | completed, failed |
| completedAt | DateTime? | |

### MarketplaceTransaction
Full payment audit trail.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| sourceType | String | listing, auction |
| sourceId | String | |
| buyerPubkey | String | |
| sellerPubkey | String | |
| totalSats | Int | |
| feeBps | Int | 500 (5%) |
| platformFeeSats | Int | |
| sellerPayoutSats | Int | |
| status | Enum | pending, paid, settled, failed |
| sellerPayoutStatus | Enum | pending, sent, confirmed, failed |
| paymentId | String? | BTCPay invoice ID |
| paymentHash | String? | Lightning payment hash |
| sellerPayoutId | String? | Outgoing payment ID |
| transferId | String? | FK → Nip05Transfer |

---

## Name Policy Models

### ReservedName
Names requiring auction (famous, high-risk).

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| name | String | (unique) |
| reason | String | Why reserved |
| category | String | prominentNames, highRisk, etc. |

### PremiumName
Names with fixed premium pricing.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| name | String | (unique) |
| priceSats | Int | |
| category | String | |

### BlockedName
Names that cannot be registered.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| name | String | (unique) |
| reason | String | |

---

## Feed Models

### Feed
User-created content feed.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| userId | String | Owner pubkey |
| name | String | |
| description | String? | |
| filterConfig | JSON | { wotThreshold, contentTypes, ... } |
| isPublic | Boolean | Others can subscribe |
| createdAt | DateTime | |

### FeedSubscription
User subscribes to another's feed.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| feedId | UUID | FK → Feed |
| subscriberPubkey | String | |
| createdAt | DateTime | |

---

## Profile Models

### Endorsement
Skill endorsement between users.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| endorserPubkey | String | Who endorsed |
| endorseePubkey | String | Who was endorsed |
| skill | String | e.g., "Bitcoin Development" |
| createdAt | DateTime | |

**Unique:** (endorserPubkey, endorseePubkey, skill)

### ProfileSettings
User profile customization.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| userPubkey | String | (unique) |
| theme | String | dark, light, purple, orange, custom |
| customCss | String? | For custom theme |
| displayName | String? | Override kind:0 name |
| bio | String? | Override kind:0 about |

---

## Domain Models

### Domain
Custom domain registration.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| userId | String | Owner pubkey |
| domain | String | e.g., mydomain.com (unique) |
| verified | Boolean | DNS check passed |
| verifyToken | String | For TXT record |
| lightningName | String? | For pay@domain.com |
| createdAt | DateTime | |

### Site
Website config for domain.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| domainId | UUID | FK → Domain (unique) |
| template | String | personal, portfolio, blog |
| config | JSON | Template-specific settings |
| views | Int | Page view counter |

---

## Indexes

Key indexes for performance:

```sql
-- User lookups
CREATE INDEX idx_user_pubkey ON "User"(pubkey);
CREATE INDEX idx_user_lightning ON "User"("lightningAddress");

-- NIP-05 lookups
CREATE UNIQUE INDEX idx_nip05_identity ON "Nip05"("localPart", domain);
CREATE INDEX idx_nip05_pubkey ON "Nip05"(pubkey);

-- Marketplace
CREATE INDEX idx_auction_status ON "Nip05Auction"(status);
CREATE INDEX idx_listing_status ON "Nip05Listing"(status);
CREATE INDEX idx_transaction_status ON "MarketplaceTransaction"(status);

-- Feeds
CREATE INDEX idx_feed_user ON "Feed"("userId");
CREATE INDEX idx_feed_public ON "Feed"("isPublic");

-- Endorsements
CREATE INDEX idx_endorsement_endorsee ON "Endorsement"("endorseePubkey");
```

---

## Migration Strategy

- Use Prisma migrations for schema changes
- Production: `npx prisma db push` for rapid iteration
- Staging: Full migration files for rollback capability
