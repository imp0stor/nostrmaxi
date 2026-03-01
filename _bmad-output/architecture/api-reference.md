# NostrMaxi API Reference

**Base URL:** `https://nostrmaxi.com/api/v1`  
**Last Updated:** 2026-03-01

---

## Authentication

All protected endpoints require JWT Bearer token.

```
Authorization: Bearer <jwt_token>
```

### Login Flow
1. `POST /auth/challenge` - Get challenge to sign
2. Sign challenge with nsec (client-side)
3. `POST /auth/verify` - Submit signature, receive JWT

---

## NIP-05 Identity

### Lookup (Public)
```
GET /.well-known/nostr.json?name=<localPart>
```
Returns NIP-05 JSON for identity verification.

### Register Identity
```
POST /nip05/register
Auth: Required
Body: { name: string, domain: string }
```

### My Identities
```
GET /nip05/mine
Auth: Required
```

### Verify External
```
GET /nip05/verify-address/:address
Auth: Required
```

---

## NIP-05 Marketplace

### Browse Marketplace
```
GET /nip05/marketplace
Query: ?q=search&type=auction|listing|resale
```

### Check Availability
```
GET /nip05/marketplace/availability/:name
Query: ?domain=nostrmaxi.com
```
Returns availability status, pricing policy, restrictions.

### Reserved Names
```
GET /nip05/marketplace/reserved
```

### Seller: Set Lightning Address
```
PATCH /nip05/marketplace/seller/lightning-address
Auth: Required
Body: { lightningAddress: string }
```

### Create Listing (Resale)
```
POST /nip05/marketplace/listings
Auth: Required
Body: { name: string, priceSats: number, saleMode: "lifetime"|"lease" }
```

### Buy Listing
```
POST /nip05/marketplace/listings/:listingId/buy
Auth: Required
```
Returns payment invoice. On payment: split executed, transfer completed.

### Place Bid
```
POST /nip05/marketplace/auctions/:auctionId/bid
Auth: Required
Body: { amountSats: number }
```

---

## Admin: Marketplace

All require `isAdmin: true`.

### Name Management
```
GET/POST/PATCH/DELETE /admin/marketplace/reserved-names
GET/POST/PATCH/DELETE /admin/marketplace/premium-names
GET/POST/PATCH/DELETE /admin/marketplace/blocked-names
POST /admin/marketplace/names/bulk-import
```

### Auction Management
```
GET/POST/PATCH /admin/marketplace/auctions
POST /admin/marketplace/auctions/:id/cancel
POST /admin/marketplace/auctions/:id/settle
```

### Transaction Management
```
GET /admin/marketplace/transactions
POST /admin/marketplace/transactions/:id/retry-payout
```

---

## Feeds

### My Feeds
```
GET /feeds
Auth: Required
```

### Create Feed
```
POST /feeds
Auth: Required
Body: { name: string, filterConfig: { wotThreshold?: number, contentTypes?: string[], ... } }
```

### Update Feed
```
PATCH /feeds/:feedId
Auth: Required
```

### Delete Feed
```
DELETE /feeds/:feedId
Auth: Required
```

### Get Feed Posts
```
GET /feeds/:feedId/posts
Query: ?limit=50&before=<timestamp>
```

### Trending
```
GET /feeds/trending
Query: ?limit=50
```

### RSS Export
```
GET /feeds/:feedId/rss
```
Returns RSS 2.0 XML.

### Subscribe to Feed
```
POST /feeds/:feedId/subscribe
Auth: Required
```

### Unsubscribe
```
DELETE /feeds/:feedId/subscribe
Auth: Required
```

---

## Profiles

### Get Profile
```
GET /profiles/:pubkey
```

### Update Theme
```
PATCH /profiles/:pubkey/theme
Auth: Required (owner only)
Body: { theme: "dark"|"light"|"purple"|"orange"|"custom", customCss?: string }
```

### Endorse Skill
```
POST /profiles/:pubkey/endorse
Auth: Required
Body: { skill: string }
```

### Get Endorsements
```
GET /profiles/:pubkey/endorsements
```

### Remove Endorsement
```
DELETE /profiles/:pubkey/endorsements/:skill
Auth: Required
```

---

## Domains

### My Domains
```
GET /domains
Auth: Required
```

### Add Domain
```
POST /domains
Auth: Required
Body: { domain: string }
```
Returns verification token for DNS TXT record.

### Verify Domain
```
POST /domains/:domainId/verify
Auth: Required
```
Checks DNS TXT record `nostrmaxi-verify=<token>`.

### Delete Domain
```
DELETE /domains/:domainId
Auth: Required
```

### Set Lightning Name
```
PATCH /domains/:domainId/lightning
Auth: Required
Body: { lightningName: string }
```
Enables `<name>@<domain>` Lightning address.

### Domain Analytics
```
GET /domains/:domainId/analytics
Auth: Required
```

---

## Primitives

### WoT Score
```
GET /primitives/wot/score/:pubkey
```

### Engagement Metrics
```
GET /primitives/engagement/profile/:pubkey
Query: ?limit=80
```

### Profile Validation Hints
```
GET /primitives/profile/:pubkey/validation-hints
```

### Knowledge Base Search
```
GET /primitives/kb/search
Query: ?q=query
```

---

## Payments

### Create Invoice
```
POST /payments/invoice
Auth: Required
Body: { amountSats: number, memo: string }
```

### Webhook (BTCPay)
```
POST /payments/webhook
```
Handles payment confirmations, triggers splits for marketplace.

---

## Admin: Users

### List Users
```
GET /admin/users
Auth: Admin
Query: ?tier=LIFETIME&limit=50
```

### Update User Role
```
PATCH /admin/users/:pubkey/role
Auth: Admin
Body: { isAdmin: boolean }
```

### Update User Tier
```
PATCH /admin/users/:pubkey/tier
Auth: Admin
Body: { tier: "FREE"|"PRO"|"BUSINESS"|"LIFETIME" }
```

---

## Health & Meta

### Health Check
```
GET /health
```
Returns: `{ status: "healthy", timestamp, version, services: { database: "up" } }`

### Relay Sync Status
```
GET /relay-sync/status
```

### Relay Sync Debug
```
GET /relay-sync/debug
```

---

## Error Responses

All errors follow format:
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

Common status codes:
- `400` - Bad request (validation)
- `401` - Unauthorized (no/invalid JWT)
- `403` - Forbidden (wrong tier/role)
- `404` - Not found
- `409` - Conflict (duplicate)
- `500` - Server error
