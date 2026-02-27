# NIP-05 + Wavlake Diagnostic Report

Date: 2026-02-26 22:55 EST
Project: `/home/owner/strangesignal/projects/nostrmaxi-canonical`
Target runtime: `neo@10.1.10.143` app on `:3401`

## Summary

Both requested investigations were completed against real data and live deployment.

### Final Diagnosis

1. **NIP-05 not showing in top-right menu**
   - **Primary root cause (confirmed):** The user’s relay profile (`kind:0`) has `nip05: "imp0stor.com"`, which is **not valid NIP-05 format** for this app’s validator (expects `name@domain.tld`).
   - **Secondary product bug (fixed):** Header identity logic in `App.tsx` used only external relay NIP-05 + npub fallback, and **did not include managed NIP-05 fallback** from `/api/v1/nip05/mine/unified`.

2. **Wavlake audio embed for `https://wavlake.com/track/92625eb4-4db4-43e5-950e-c987edbd5495`**
   - Parsing and rendering pipeline is working.
   - URL correctly tokenizes to `audio` with provider `wavlake` and trackId.
   - Inline renderer contains Wavlake audio branch and fallback/open-link behavior.

---

## Real User Data Check (provided npub)

Input npub:
`npub1uf5krsdawn6t8qq6c9uhsq5gtkk8jlzrau4se9gv9mfkzy4fr7yszdr7fw`

### 1) npub → pubkey hex
Decoded pubkey:
`e26961c1bd74f4b3801ac1797802885dac797c43ef2b0c950c2ed36112a91f89`

### 2) Relay profile fetch
Fetched latest kind:0 event:
- event id: `d730e2f5db290aaa36d0b9f47d9d5845c99973f85db8b6c68d2c0098f4959b11`
- created_at: `1760043387`

Profile JSON included:
```json
{
  "name": "imp0stor",
  "displayName": "imp0stor",
  "nip05": "imp0stor.com",
  "lud16": "imp0stor@getalby.com",
  "website": "https://imp0stor.com"
}
```

### 3) NIP-05 validation against app logic
App regex (`isValidNip05`) requires `name@domain.tld`.

- value: `imp0stor.com`
- result: **invalid** (`false`)

This is why external NIP-05 was being discarded.

---

## Code Changes Applied

### A) Added detailed console diagnostics for identity resolution

#### `frontend/src/App.tsx`
- Replaced direct `fetchProfileCached + isValidNip05` logic with `resolvePrimaryIdentityDetailed(...)`.
- Added logging:
  - `[app] loadIdentity resolved`
  - `[app] loadIdentity failed`
- Logged fields include:
  - pubkey, npub, forceRefresh
  - source (`external|managed|npub`)
  - resolved value
  - externalNip05 / managedNip05

### B) Added diagnostics in profile cache/fetch path

#### `frontend/src/lib/profileCache.ts`
Added logs for:
- cache hit
- inflight hit
- cache miss + relay fetch
- no kind:0 event
- fetched profile metadata (raw vs normalized nip05, validity)
- parse failure branch

This directly traces profile fetch + NIP-05 normalization behavior requested in task.

### C) Header resolution fallback fixed

`App.tsx` now uses central resolver (`resolvePrimaryIdentityDetailed`) which already applies:
1. valid external NIP-05
2. valid managed NIP-05 (`/api/v1/nip05/mine/unified`)
3. npub fallback

This closes the gap where managed identity existed but header still showed npub.

---

## Profile Cache / Timing Analysis

- Cache TTL: 10 minutes (`PROFILE_TTL_MS = 10 * 60 * 1000`)
- Existing force refresh points:
  - when identity menu is opened (`loadIdentity(showIdentityMenu)`)
  - on `IDENTITY_REFRESH_EVENT`
- Potential stale window exists if metadata changes while menu is closed and no refresh event fires.

Status:
- Invalidation mechanism itself works.
- The observed user issue was primarily invalid external NIP-05 + missing managed fallback in header logic.

---

## Wavlake Embed Verification

### Parsing path
`frontend/src/lib/media.ts`:
- Detects `wavlake.com/track/:id`
- Produces audio token:
  - `provider: 'wavlake'`
  - `trackId: <uuid>`
  - canonical `url`

### Render path
`frontend/src/components/InlineContent.tsx`:
- Has explicit `if (token.type === 'audio')` branch
- Uses unfurl preview for playable URL where available
- Renders fallback text and `Open link` button if inline audio unavailable

### Tests passing
- `src/__tests__/media-parsing.test.ts` includes exact track URL and asserts provider/trackId.
- `src/__tests__/inline-audio-rendering.test.ts` verifies audio branch + fallback UI contract.

---

## Build, Test, Deploy Proof

### Local verification
- `npm test -- --runInBand` ✅
  - 26 suites passed, 117 tests passed.
- `npm run build:all` ✅
  - backend build passed
  - frontend Vite build passed
  - output bundle included `index-Cr7qgrhe.js`

### Deployment to Operator
Synced built frontend to live path:
- local: `/home/owner/strangesignal/projects/nostrmaxi-canonical/frontend/dist/`
- remote: `/home/neo/strangesignal/projects/nostrmaxi-canonical/frontend/dist/`

Live check on operator:
- `http://127.0.0.1:3401` now references `index-Cr7qgrhe.js` (new build)
- `http://127.0.0.1:3402` also references `index-Cr7qgrhe.js`

This confirms updated frontend is served on the live deployment path.

---

## Exact answer to "why not showing"

For this specific user npub, relay metadata has `nip05 = imp0stor.com` (invalid per NIP-05 address format expected by app), so external NIP-05 is intentionally rejected.

Additionally, prior header code did not use managed fallback identity; that bug has been fixed so valid managed NIP-05 now appears when external metadata is invalid/missing.
