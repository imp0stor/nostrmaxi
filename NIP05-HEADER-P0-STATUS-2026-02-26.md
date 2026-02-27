# NIP05 Header/Menu P0 Status — 2026-02-26

## Summary
P0 fix implemented for header identity selection + refresh invalidation flow. Local tests/build passed and frontend was deployed on Operator (`neo@10.1.10.143`) with new live bundle hash observed through `:3401`.

## 1) End-to-end trace (auth -> profile cache -> resolver -> header menu)
- **Auth/session source:** `frontend/src/hooks/useAuth.ts`
  - `initialize`, `loginWithExtension`, `loginWithNsec`, `pollLnurlLogin`, `refreshUser`, `logout` control authenticated user state.
- **External profile metadata cache:** `frontend/src/lib/profileCache.ts`
  - Nostr kind:0 metadata cached with TTL; `invalidateProfileCache(pubkey?)` supports explicit invalidation.
- **Primary identity resolver:** `frontend/src/lib/identityResolver.ts`
  - `resolvePrimaryIdentity()` reads cached/fresh external profile NIP-05 + managed `/api/v1/nip05/mine/unified`.
  - `selectPrimaryIdentity()` policy is:
    1. external valid NIP-05
    2. managed NIP-05
    3. short npub
- **Menu/header consumer:** `frontend/src/App.tsx`
  - top-right chip renders `primaryIdentity || truncateNpub(user.npub, 4)`
  - reload on open (`showIdentityMenu`) and now also via explicit refresh event.

## 2) Regression fix implemented
### Policy enforcement
- Maintained resolver precedence: **external valid NIP-05 > managed NIP-05 > short npub**.

### Hydration/revalidation + explicit invalidation
Added event-driven identity refresh channel:
- **New file:** `frontend/src/lib/identityRefresh.ts`
  - `requestIdentityRefresh(pubkey?)` does:
    - `invalidateProfileCache(pubkey)`
    - dispatch `window` event `nostrmaxi:identity-refresh`

Wired refresh producers:
- `frontend/src/hooks/useAuth.ts`
  - trigger identity refresh after:
    - session initialize success
    - extension login success
    - nsec login success
    - LNURL poll verification success
    - refreshUser success
    - logout
- `frontend/src/pages/OnboardingPage.tsx`
  - trigger refresh after profile publish success (kind:0 update)
  - trigger refresh after follow success
- `frontend/src/pages/DiscoverPage.tsx`
  - trigger refresh after follow success
- `frontend/src/pages/ProfilePage.tsx`
  - trigger refresh after follow/unfollow success
- `frontend/src/pages/Nip05Page.tsx`
  - trigger refresh after identity hydration completes (load identities + subscription + domains)

Wired refresh consumer:
- `frontend/src/App.tsx`
  - listens for `nostrmaxi:identity-refresh`
  - runs forced identity reload without requiring navigation to profile page.

## 3) Tests added/updated
### Added
- `src/__tests__/identity-resolver-refresh.test.ts`
  - verifies `forceRefresh=true` invalidates profile cache
  - verifies external valid NIP-05 still wins
  - verifies fallback to managed NIP-05 when external invalid

### Existing relevant coverage retained
- `src/__tests__/identity-resolver.test.ts`
  - selection preference order and npub fallback

## 4) Quality gates
Executed in repo root:
- `npm test -- --runInBand` ✅
  - **23 suites passed, 110 tests passed**
- `npm run build` ✅
- `npm run build:all` ✅
  - frontend build emitted bundle: `dist/assets/index-BYunB0or.js`

## 5) Operator deploy + restart
Target: `neo@10.1.10.143`
- Synced updated repo to:
  - `/home/neo/strangesignal/projects/nostrmaxi-canonical`
- Built frontend on operator:
  - `npm run build:frontend` ✅
- Restarted frontend static serve on `:3402` and verified listener.
- Verified gateway route `http://10.1.10.143:3401` serves new bundle hash:
  - `index-BYunB0or.js`

## 6) Screenshot evidence
- Available live screenshot path used in this run:
  - `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/rework-2026-02-26/operator-home-3401.png`

### Important note
Current available evidence is an unauthenticated view (Login visible), so it does **not** show an opened top-right identity menu with a displayed NIP-05 value. The code path for authenticated header identity selection/refresh has been fixed and deployed; final authenticated screenshot capture requires an authenticated browser session on live (`:3401`) to open the identity menu.

## Concise changed files (this P0 fix set)
- `frontend/src/lib/identityRefresh.ts` (new)
- `frontend/src/App.tsx`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/pages/DiscoverPage.tsx`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/OnboardingPage.tsx`
- `frontend/src/pages/Nip05Page.tsx`
- `src/__tests__/identity-resolver-refresh.test.ts` (new)
