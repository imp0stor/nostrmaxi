# PRICING-SIMPLIFICATION-STATUS

Date: 2026-02-26 (EST)
Project: `/home/owner/strangesignal/projects/nostrmaxi-canonical`

## Objective
Simplify NostrMaxi to focus on **single-user NIP-05 sales** with clear monthly/annual/lifetime options, remove enterprise/team positioning, and streamline onboarding/messaging.

## What was implemented

### 1) Pricing page simplified for individuals
**File:** `frontend/src/components/pricing/PricingPage.tsx`

- Removed Business/enterprise visibility from checkout UI.
- Repositioned page around value prop: **"Your Nostr Identity"**.
- Focused paid offering on individual identity product:
  - `NIP-05 Pro` (monthly/annual)
  - `NIP-05 Lifetime` (one-time)
- Kept FREE + individual paid paths; blocked BUSINESS from selection.
- Updated pricing copy to emphasize registration length choices (monthly, annual, lifetime).
- Reworked CTA/process copy to individual setup flow.
- Added competitive benchmark section with market context and cited providers.
- Updated FAQ to remove enterprise/team references.

### 2) Homepage messaging simplified
**File:** `frontend/src/pages/HomePage.tsx`

- Changed hero from broad social control-plane framing to individual NIP-05-first positioning.
- Updated CTAs:
  - `Manage my NIP-05`
  - `Quick setup`
  - `View NIP-05 plans`
- Replaced feature cards with simple identity purchase/activation journey.

### 3) Team/multi-identity behavior hidden in UI
**File:** `frontend/src/pages/Nip05Page.tsx`

- Reframed page copy from plural/team tone to single-user identity tone.
- Enforced single-user limit in frontend UX (`singleUserLimit = 1`) for claiming flow.
- Updated usage meter and create button behavior to reflect one managed identity focus.
- Removed copy encouraging upgrades for more identities/business tiers.

### 4) Onboarding flow messaging streamlined for individuals
**File:** `frontend/src/pages/OnboardingPage.tsx`

- Updated intro to quick individual NIP-05 setup positioning.
- Updated bullets to include registration length options and fast setup.
- Reworked NIP-05 step copy to:
  - emphasize one-identity individual flow
  - remove enterprise/team implications
  - direct user to simple plan choice

### 5) Navigation copy aligned
**File:** `frontend/src/App.tsx`

- Updated pricing nav label from `Get NIP-05 + Lightning Address` to `Get Your NIP-05`.

## Competitive analysis used for pricing direction
Reviewed public references and extracted market anchors:

- **nip-05.com**: one-time, length-based pricing (e.g., 5+ chars around 6,875 sats).
- **nostrplebs.com**: length-based pricing (e.g., standard names around 12,500 sats).
- **nostrich.house**: approximately 9,000 sats/year style annual pricing.

These anchors were used to keep NostrMaxi positioned competitively while highlighting managed Lightning + instant activation.

## Validation
Executed required verification after code changes:

- `npm run build` ✅
- `npm test` ✅ (34 suites, 151 tests passed)

## Notes
- Backend/business tier structures were not deleted in this pass to avoid broad subscription API breakage, but business/enterprise positioning is removed from user-facing pricing and identity purchase UX.
- The core UX is now explicitly tuned for **single-user NIP-05 sales** with simple term selection.
