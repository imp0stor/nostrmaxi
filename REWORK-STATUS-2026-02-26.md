# NostrMaxi Rework Status — 2026-02-26

## Outcome
Rework closure completed for the requested product direction, with build/test verification and Operator deployment of frontend changes.

## Scope Completion

### 1) Feed-first UX default for authenticated users ✅
Implemented and verified in app routing logic:
- Authenticated users hitting `/` or `/home` are redirected to `/feed`.
- Feed remains protected for authenticated sessions.

Evidence:
- `frontend/src/App.tsx` (redirect effect: authenticated + landing route -> `/feed`)
- `frontend/src/pages/HomePage.tsx` (copy explicitly states feed-first/default experience)

---

### 2) Optional NIP-05/Lightning upgrade path (not forced), with external NIP-05 aware messaging ✅
Implemented as optional monetization path (social/feed remains free):
- Pricing explicitly frames upgrade as optional.
- NIP-05 page detects and messages external profile NIP-05 as valid/recognized.
- Managed NIP-05 + Lightning path is presented as optional upgrade CTA.

Evidence:
- `frontend/src/components/pricing/PricingPage.tsx`
- `frontend/src/pages/Nip05Page.tsx`
- `frontend/src/pages/HomePage.tsx`

---

### 3) Multi-signer login correctness ✅
Confirmed in login/runtime code:
- Per-signer trigger calls selected provider only.
- No silent fallback to default provider.
- Unavailable signer buttons disabled with explicit reason text.
- Debug marker retained and rendered during sign flow.

Evidence:
- `frontend/src/lib/nostr.ts`
  - explicit provider mapping/selection, `missingProviderMessage`, `getPublicKey(provider)`, `signEvent(event, provider)`, no fallback chaining
  - runtime marker: `markProviderUsage`, `getSignerRuntimeDebugMarker`
- `frontend/src/hooks/useAuth.ts`
  - explicit `loginWithExtension(provider)` path, unavailable-provider gate, debug marker state propagation
- `frontend/src/components/auth/LoginModal.tsx`
  - signer option rendering, disabled unavailable providers + reason, debug marker display in loading panel

---

### 4) Blossom storage UX/policy hooks aligned to external-default and paid-managed tiers ✅
Integrated safely in canonical frontend where scaffold existed:
- Added explicit blossom policy hook fields to frontend tier typing.
- Added blossom policy + storage allowance metadata to pricing fallback tiers.
- Added UI policy indicator in pricing cards: external/default (free) vs managed/paid tiers.

Evidence:
- `frontend/src/types/index.ts`
- `frontend/src/components/pricing/PricingPage.tsx`

---

### 5) Build + tests pass ✅
Executed after changes:
- `npm test` -> PASS (12 suites, 81 tests)
- `npm run build` -> PASS
- `npm run build:frontend` -> PASS

Evidence:
- `ui-evidence/rework-2026-02-26/verification.log`

---

### 6) Deploy frontend/backend as needed to Operator + verify live behavior ✅
Deployment actions:
- Synced repo to Operator path: `/home/neo/strangesignal/projects/nostrmaxi-canonical`
- Rebuilt frontend on Operator.
- Restarted frontend serve process on port `3402`.
- Verified live route through Operator gateway at `http://10.1.10.143:3401`.

Live verification evidence:
- Frontend process listener check: `ui-evidence/rework-2026-02-26/verification.log`
- Live bundle hash from deployed page: `index-BhedOppX.js` in `ui-evidence/rework-2026-02-26/verification.log`
- API response capture: `ui-evidence/rework-2026-02-26/verification.log`
- UI screenshots:
  - `ui-evidence/rework-2026-02-26/operator-home-3401.png`
  - `ui-evidence/rework-2026-02-26/operator-pricing-optional-upgrade.png`

Note: Backend redeploy was not required for this final delta set; frontend deployment covered shipped changes for this closure pass.

---

## Concise file list (this closure delta)
- `frontend/src/App.tsx`
- `frontend/src/components/auth/LoginModal.tsx`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/lib/nostr.ts`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/Nip05Page.tsx`
- `frontend/src/components/pricing/PricingPage.tsx`
- `frontend/src/types/index.ts`
- `ui-evidence/rework-2026-02-26/operator-home-3401.png`
- `ui-evidence/rework-2026-02-26/operator-pricing-optional-upgrade.png`
- `ui-evidence/rework-2026-02-26/verification.log`

## Verification evidence paths
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/rework-2026-02-26/verification.log`
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/rework-2026-02-26/operator-home-3401.png`
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/rework-2026-02-26/operator-pricing-optional-upgrade.png`
