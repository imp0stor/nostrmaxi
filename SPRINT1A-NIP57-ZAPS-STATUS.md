# SPRINT 1A — NIP-57 Lightning Zaps Status

Date: 2026-02-26
Project: `/home/owner/strangesignal/projects/nostrmaxi-canonical`
Operator: `neo@10.1.10.143`

## ✅ What was implemented

### 1) Zap request parsing + validation (kind:9734)
Implemented in `frontend/src/lib/zaps.ts`:
- `parseZapRequest(event)`
- `validateZapRequest(event)`
- Required field extraction/validation:
  - `amount` (msats + sats)
  - recipient `p`
  - optional target event `e`
  - content
- Signature verification via `verifyEvent`.

### 2) Zap receipt ingestion (kind:9735)
Implemented in `frontend/src/lib/zaps.ts`:
- `parseZapReceipt(event)`
  - Reads + parses `description` tag (embedded zap request)
  - Validates embedded zap request
  - Extracts recipient + event linkage + amount
- `loadZapReceipts(eventIds, profilePubkeys)`
  - Pulls receipts by `#e` and `#p`
  - Deduplicates by receipt id
- `aggregateZaps(receipts)`
  - Aggregates by post/event id
  - Aggregates by profile pubkey

### 3) Zap totals display (posts + profiles)
Implemented UI integration:
- Feed post-level zap totals with visual indicator:
  - `frontend/src/pages/FeedPage.tsx`
  - shows `⚡ <sats> sats · <count>`
- Profile-level zap total + post-level zap totals:
  - `frontend/src/pages/ProfilePage.tsx`
  - profile summary card includes total sats zapped

### 4) Zap send UX
Implemented in `frontend/src/lib/zaps.ts` and connected in feed/profile:
- Zap action button on posts + profile
- Amount selector prompt with defaults: `[21, 100, 500, 1000]`
- Wallet integration:
  - resolves LNURL pay endpoint from `lud16`
  - fetches LNURL metadata
  - builds/signed zap request (9734)
  - calls LNURL callback with `amount`, `nostr`, `lnurl`
  - handles returned invoice (`pr`)
  - pays via WebLN if available, otherwise `lightning:` deep link fallback

### 5) Tests
Added tests:
- `frontend/tests/zaps.test.ts`
  - zap request parsing/validation
  - zap receipt parsing
  - amount aggregation correctness
  - indicator formatting
- `frontend/tests/zap-ui.test.ts`
  - amount selector defaults
  - zap button busy/idle labels
  - indicator rendering helper

Test/build verification (local):
- `npm run build` ✅
- `npm test -- --runInBand` ✅ (149/149)
- `npm --prefix frontend run build` ✅

## Changed files
- `frontend/src/lib/zaps.ts` (new)
- `frontend/src/pages/FeedPage.tsx`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/tests/zaps.test.ts` (new)
- `frontend/tests/zap-ui.test.ts` (new)

## Screenshots
- `ui-evidence/zaps-feed-2026-02-26.png`
- `ui-evidence/zaps-profile-2026-02-26.png`

## Deploy to operator
- Operator reachable and updated via `scp` to:
  - `/home/neo/strangesignal/projects/nostrmaxi-canonical/frontend/src/lib/zaps.ts`
  - `/home/neo/strangesignal/projects/nostrmaxi-canonical/frontend/src/pages/FeedPage.tsx`
  - `/home/neo/strangesignal/projects/nostrmaxi-canonical/frontend/src/pages/ProfilePage.tsx`
  - `/home/neo/strangesignal/projects/nostrmaxi-canonical/frontend/tests/zaps.test.ts`
  - `/home/neo/strangesignal/projects/nostrmaxi-canonical/frontend/tests/zap-ui.test.ts`
- Remote `npm test` passed.
- Remote frontend build currently has unrelated pre-existing type errors in that environment (outside this zap change scope).
