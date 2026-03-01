# Nostr Primitives Integration Status (2026-03-01)

## Shipped

### Backend
- Added `src/primitives/` module and services:
  - `PrimitiveProfileService` (`@strangesignal/nostr-profile`)
  - `PrimitiveWotService` (`@strangesignal/nostr-wot-voting`)
  - `PrimitiveKbService` (`@strangesignal/nostr-kb`)
- Added API controller: `src/primitives/primitives.controller.ts`
- Wired module into `AppModule`.

### New API Endpoints
- `GET /api/v1/primitives/wot/score/:pubkey?anchor=`
- `GET /api/v1/primitives/kb?limit=`
- `GET /api/v1/primitives/kb/search?q=&limit=`
- `GET /api/v1/primitives/profile/:pubkey/validation-hints`

### Frontend Integration
- Added reusable primitives:
  - `frontend/src/components/primitives/MetricChip.tsx`
  - `frontend/src/components/primitives/ContributorSheet.tsx`
  - `frontend/src/components/primitives/ModalShell.tsx`
- Feed integration:
  - Replaced contributor detail modal with `ContributorSheet`
  - Added reusable metric chips for contributors + WoT display
  - Wired WoT endpoint on feed authors (batched per visible set, memoized in local state)
- Profile integration:
  - Added Profile Validation Hints panel from primitive endpoint
  - Added KB long-form preview panel from primitive endpoint
  - Standardized high-impact metrics with reusable `MetricChip`

### Tests
- Added `src/__tests__/primitives.controller.test.ts` for contract routing coverage.

## Notes
- KB parsing relies on `@strangesignal/nostr-kb` built-in sanitization path (`isomorphic-dompurify` + strict parser guards).
- WoT endpoint includes short-lived in-memory cache to reduce relay fanout pressure.
- Interaction drilldowns remain click-driven (no fake hover-only affordances).
