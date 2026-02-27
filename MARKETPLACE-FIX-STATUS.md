# MARKETPLACE FIX STATUS

Date: 2026-02-26
Project: `/home/owner/strangesignal/projects/nostrmaxi-canonical`
Operator: `neo@10.1.10.143`

## What I completed

Implemented a Nostr-native marketplace fix using NIP-15 patterns and reference implementations from Shopstr/Plebeian Market.

### Research + references used
- NIP-15 spec: https://nips.nostr.com/15
- Shopstr repo: https://github.com/shopstr-eng/shopstr
  - Pattern used: parse product metadata from tags + JSON; use replaceable address (`d` tag) semantics for listing identity.
- Plebeian Market repos:
  - https://github.com/PlebeianApp/plebeian-market-old
  - Pattern used: consume kind `30018` product events, hydrate product object from content JSON + `t` tags/categories.

## Marketplace fixes implemented

### 1) Broken route/data model fixed
- Updated marketplace ingestion from legacy kinds to NIP-15 aligned kinds:
  - Added support for kinds `30017` (stall) and `30018` (product)
  - Kept compatibility kinds for existing data (`30402`, `30023`, `30403`)
- Added stall parsing (`30017`) and currency fallback from stall to product.
- Added deterministic listing identity key based on `author:d` for replaceable events.
- Added deduping logic for replaceable listings (keep newest by `created_at`).
- Added 5s timeout fallback so UI doesn’t hang indefinitely; uses seed listings fallback if relays are unavailable.

### 2) Marketplace UI behavior fixed
- Listing links now use stable replaceable key routing (`/marketplace/:listingKey`) instead of raw event id.
- Detail page lookup now resolves listing by:
  - listingKey (`pubkey:d`), OR
  - event id, OR
  - d-tag
- Keeps seller identity rendering via NIP-05/display-name/npub fallback.
- Existing categories/search/filters and listing cards remain active.

### 3) Tests added/updated
- Expanded marketplace adapter tests for NIP-15 data model:
  - `30018` event adaptation with `d` tag + `stall_id`
  - filter behavior
  - detail lookup by listing key/event id/d-tag

## Files changed

- `frontend/src/lib/marketplace.ts`
- `frontend/src/pages/MarketplacePage.tsx`
- `frontend/src/pages/MarketplaceListingPage.tsx`
- `src/__tests__/marketplace-adapter.test.ts`

## Validation run

From project root:
- `npm run build` ✅
- `npm test` ✅ (29/29 suites, 136/136 tests)
- `npm test -- --runInBand marketplace-adapter` ✅
- `npm run build:frontend` ✅

## Deployment to operator

Deployed changed marketplace files to:
- `neo@10.1.10.143:/home/neo/strangesignal/projects/nostrmaxi-canonical`

Actions run:
- rsync of changed files
- remote `npm run build:frontend`
- `sudo systemctl restart nostrmaxi-frontend.service`
- service check `systemctl is-active nostrmaxi-frontend.service` => `active`

## Screenshot evidence

Saved screenshots:
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/marketplace-live-2026-02-26.png`
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/marketplace-list-live-2026-02-26.png`

Note: Marketplace detail screenshot path was requested/generated in automation, but final file did not persist:
- expected: `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/marketplace-detail-live-2026-02-26.png` (missing)

## Summary
Marketplace route and data handling are now aligned with NIP-15 marketplace patterns (30017/30018 + d-tag replaceable semantics), filters/cards/detail lookup are corrected, tests pass, and deployment to operator is complete.
