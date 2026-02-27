# Marketplace MVP Status — 2026-02-26

## Sprint Scope Delivered

### 1) Research: in-repo + known Nostr listing/order patterns
- **In-repo findings:**
  - No active frontend marketplace/listing route existed before this sprint.
  - Existing Nostr patterns in repo are social-first (kind 1 feed, kind 3 follows, kind 0 profiles) in `frontend/src/lib/social.ts` + `frontend/src/lib/profileCache.ts`.
  - No production listing/order parser existed; only archived commerce tests (`docs/archive-extracted/tests/commerce.test.ts`) for subscription product logic (not Nostr relay listings).
- **MVP standard adopted:**
  - Added a **Nostr listing event adapter** that can parse marketplace-like events from common commerce kinds (`30402`, `30017`, `30403`) with flexible tag/content fallback parsing.
  - Identity rendering follows existing project standard: **NIP-05 first**, then profile display name, then npub truncation fallback.

### 2) MVP marketplace UI route(s)
Implemented authenticated routes:
- `/marketplace` (browse listings)
- `/marketplace/:listingId` (open listing detail)

`/marketplace` includes:
- Listing card grid
- Item media, title, summary
- Price + currency display
- Seller identity display
- Basic filters/search:
  - free-text query
  - max price
  - tag selector

### 3) Data model adapter for Nostr listing events
Implemented in `frontend/src/lib/marketplace.ts`:
- `adaptMarketplaceEvent(event)` converts raw Nostr event → normalized `MarketplaceListing`
- Supports tag/content fallback for:
  - title/name
  - summary/description
  - image/media URLs
  - price/currency
  - location/quantity
  - hashtags (`t` tags)
- `loadMarketplaceListings()`:
  - pulls relay events from marketplace kinds
  - adapts + sorts by recency
  - hydrates seller identity from profile cache
  - falls back to seeded demo listings if no relay listings are available

### 4) Identity display standards (NIP-05-first fallback npub)
Applied in marketplace adapter/listing rendering:
- Seller identity priority:
  1. Valid `nip05`
  2. Profile display name
  3. Truncated `npub`

### 5) “Open listing” detail view
Implemented `MarketplaceListingPage` with:
- Hero media
- Title, price, seller identity, npub
- Description
- Optional location/quantity
- Tag badges
- Back navigation to marketplace

### 6) Tests + build pass
Added tests:
- `src/__tests__/marketplace-adapter.test.ts`
  - validates event adaptation and fallback parsing
  - validates filter behavior (query + max price)

Build/Test execution:
- `npm run build` ✅
- `npm run build:frontend` ✅
- `npm test` ✅
  - Result: **25 passed, 25 total suites**
  - **114 passed, 114 total tests**

---

## Changed Files (this sprint)
- `frontend/src/lib/marketplace.ts` (new)
- `frontend/src/pages/MarketplacePage.tsx` (new)
- `frontend/src/pages/MarketplaceListingPage.tsx` (new)
- `frontend/src/App.tsx` (updated: nav + marketplace routes)
- `frontend/src/pages/index.ts` (updated exports)
- `src/__tests__/marketplace-adapter.test.ts` (new)

---

## Notes / Current MVP Constraints
- Checkout/payments/inventory management are **intentionally out of scope** in this sprint.
- Listing detail is read-only (no cart/purchase action yet).
- Listing retrieval currently uses a broad parser/fallback strategy due ecosystem variability and no strict in-repo listing schema.

---

## Next-Phase Plan (Checkout / Payments / Inventory)

### Phase A — Commerce protocol hardening
1. Finalize canonical listing schema mapping (tags/content + validation).
2. Add order-intent event model + order state machine.
3. Add signed order acknowledgements / status updates.

### Phase B — Checkout + payment rails
1. Add checkout CTA from listing detail.
2. Integrate Lightning invoice flow (BTCPay/LNURL depending on configured provider).
3. Add payment status polling + receipt linkage to listing/order id.

### Phase C — Seller inventory + ops
1. Inventory quantities + reservation on order intent.
2. Seller dashboard for listing lifecycle (draft/live/sold-out/archived).
3. Basic fulfillment metadata (shipping info, tracking notes, dispute notes).

### Phase D — Trust + quality
1. Seller reputation and transaction history badges.
2. Event authenticity indicators and relay consistency checks.
3. E2E tests for browse → open listing → checkout intent → payment success path.
