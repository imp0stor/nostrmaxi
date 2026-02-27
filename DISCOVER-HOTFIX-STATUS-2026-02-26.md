# Discover + Rendering Hotfix Status — 2026-02-26

## Scope completed in code

### Discover behavior split (For You vs WoT)
- Implemented distinct scoring signals in `frontend/src/lib/social.ts`:
  - **For You** score (`forYouScore`): global relevance (followers), activity, freshness, verified signal.
  - **WoT** score (`wotScore`): social proximity (1-hop/2-hop), interactions by followed accounts, relay affinity, WoT follower strength.
- Added explicit sort policy helpers in `frontend/src/lib/discoverState.ts`:
  - `sortDiscoverUsers(...)`
  - `discoverSortLabel(...)`
- Updated Discover UI in `frontend/src/pages/DiscoverPage.tsx`:
  - deterministic mode sorting per tab,
  - explicit mode/sort label in UI,
  - reason badges aligned to active mode,
  - **Similar tab removed** from primary nav (Users/Relays/Posts only),
  - following-card count hydration sourced from pooled data + fallbacks,
  - optimistic follow/unfollow refresh path retained + cache invalidation.

### Count hydration fixes
- Expanded follower/following field mapping fallback support in `frontend/src/lib/discoverState.ts`:
  - supports `follower_count`, `followers_count`, `followerCount`, `followers`
  - supports `following_count`, `followings_count`, `followingCount`, `followings`, `following`

### Top-right identity/NIP-05 regression
- Added unified identity resolver `frontend/src/lib/identityResolver.ts`.
- Updated header identity rendering in `frontend/src/App.tsx`:
  - policy now: **external valid NIP-05 -> managed NIP-05 -> short npub**
  - revalidation on menu open (cache invalidate + refresh) so updated NIP-05 appears without navigating profile.

### Inline rendering regressions
- Updated token parser in `frontend/src/lib/media.ts`:
  - recognized tokens are consumed (no raw duplication),
  - adds support for `npub`/`nprofile` profile tokens inline,
  - keeps `note`/`nevent` quote token handling,
  - fallback decode path added for reference tokens.
- Updated renderer in `frontend/src/components/InlineContent.tsx`:
  - renders profile tokens as clickable profile chips,
  - image initial render hardened (`src` set immediately, eager + fetchPriority for above-fold),
  - stale/blank tile behavior reduced with explicit error state + fallback message.

### Quoted/nested note media parity
- Added quoted rendering model helper `frontend/src/lib/quotedMedia.ts`.
- Updated quoted card in `frontend/src/components/QuotedEventCard.tsx`:
  - quoted notes now parse/render media using same pipeline,
  - inline image/video/link media rendered in quoted card,
  - raw media URL text suppressed when handler media exists.

## Tests added/updated
- `src/__tests__/discover-state.test.ts` (updated for extended discover shape)
- `src/__tests__/identity-resolver.test.ts`
- `src/__tests__/inline-rendering-regression.test.ts`
- `src/__tests__/quoted-media-rendering.test.ts`

## Verification run

### Build
- `npm run build` ✅
- `npm run build:frontend` ✅

### Tests
- `npm test -- --runInBand --forceExit` ✅
- Result: **20 passed, 20 total**
- Result: **101 passed, 101 total**

## Changed files (this hotfix pass)
- `frontend/src/lib/social.ts`
- `frontend/src/lib/discoverState.ts`
- `frontend/src/pages/DiscoverPage.tsx`
- `frontend/src/lib/identityResolver.ts`
- `frontend/src/App.tsx`
- `frontend/src/lib/media.ts`
- `frontend/src/components/InlineContent.tsx`
- `frontend/src/lib/quotedMedia.ts`
- `frontend/src/components/QuotedEventCard.tsx`
- `src/__tests__/discover-state.test.ts`
- `src/__tests__/identity-resolver.test.ts`
- `src/__tests__/inline-rendering-regression.test.ts`
- `src/__tests__/quoted-media-rendering.test.ts`

## Deploy + live screenshot evidence

I completed all required code and automated verification locally.

**Blocking gap:** this subagent session does not have the operator SSH path/runtime credentials and authenticated browser state needed to perform the requested operator restart flow and capture authenticated live screenshots (For You vs WoT ordering, top-right NIP-05 menu, quoted note inline media on live app).

No fake evidence was produced.

If you provide/operator-inject:
1) SSH target + restart command path, and
2) authenticated browser session (or test account token),

I can immediately execute deploy and append the exact screenshot evidence paths here.
