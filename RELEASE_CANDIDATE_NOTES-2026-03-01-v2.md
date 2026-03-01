# RELEASE CANDIDATE NOTES — 2026-03-01 v2

## Scope
Integration and RC consolidation for the following commit set:

1. `75f9453` — feat(feed): declutter zap/wot/contributor signals in feed cards
2. `cc66d00` — fix(wot): treat unknown feed scores distinctly and expand graph sampling
3. `85e4e29` — feat(ecosystem): visible grouped catalog with filterable drilldown UI
4. `007ad63` — feat(frontend): premium dark-orange UX pass for core social surfaces
5. `97f89fa` — feat: add registration bootstrap and paid entitlement gating
6. `7a88b84` — feat(admin): ship phase-1 admin UX IA, confirmations, and audit trail
7. `85fb41e` — feat(analytics): show candidate profiles when target resolution fails

## Branch/Integration Status
- Current branch: `feat/dm-zap-ux`
- All required commits are present in branch history.
- Compile/build gates pass for backend and frontend.
- Unit/integration tests pass.

## Verification (exact command outputs)

### 1) Tests
Command:
```bash
npm test -- --runInBand
```
Output:
```text
> nostrmaxi@1.0.0 test
> jest --runInBand

PASS src/__tests__/primitive-wot.service.test.ts
PASS src/__tests__/api-contract.test.ts
PASS src/__tests__/nip05.test.ts
PASS src/__tests__/auth.test.ts
PASS src/__tests__/payments.test.ts
PASS src/__tests__/registration-verification.e2e.test.ts
PASS src/__tests__/analytics-route-guard.test.ts
PASS src/__tests__/identity.service.test.ts
PASS src/__tests__/auction.service.test.ts
[Nest] 538431  - 11/14/2023, 5:13:30 PM    WARN [AuctionService] Rejected unpaid bid for auction e6da05dc-1ee3-4b64-a880-43ed903f11f4 (zap=zap-invalid-preimage, method=failed, reason=Invalid zap preimage for invoice payment hash)
[Nest] 538431  - 11/14/2023, 5:13:30 PM    WARN [AuctionService] Rejected unpaid bid for auction 83f9057e-753a-403e-ade2-1166f5b0067a (zap=zap-pending-invoice, method=failed, reason=Invoice exists but is not yet marked paid)
[Nest] 538431  - 03/01/2026, 12:46:50 AM     LOG [SearchService] Beacon search request q="nostr"
[Nest] 538431  - 03/01/2026, 12:46:50 AM     LOG [SearchService] Beacon search request q="nostr"
[Nest] 538431  - 03/01/2026, 12:46:50 AM     LOG [SearchService] Beacon search request q="nostr"
[Nest] 538431  - 03/01/2026, 12:46:50 AM     LOG [SearchService] Beacon search/filtered request q="nostr"
[Nest] 538431  - 03/01/2026, 12:46:50 AM    WARN [SearchService] Beacon search/filtered failed after 0ms: beacon unavailable
PASS src/__tests__/search.service.test.ts
PASS src/__tests__/relay-sync-controller.test.ts
PASS frontend/tests/muteWords.test.ts
PASS src/__tests__/relay-sync-selection.test.ts
PASS src/__tests__/admin.guard.test.ts
PASS src/__tests__/nostr-auth-integration.test.ts
PASS src/__tests__/notifications.service.test.ts
PASS src/__tests__/settings.service.test.ts
PASS src/__tests__/premium.guard.test.ts
PASS src/__tests__/relay-sync-rate-limiter.test.ts
PASS src/__tests__/entitlement.guard.test.ts
[Nest] 538431  - 03/01/2026, 12:46:51 AM    WARN [RateLimiterService] Relay wss://nos.lol returned 429, backing off for 2000ms (target 21 rpm)
[Nest] 538431  - 03/01/2026, 12:46:51 AM    WARN [RateLimiterService] Relay wss://nos.lol returned 429, backing off for 4000ms (target 14 rpm)
[Nest] 538431  - 03/01/2026, 12:46:51 AM    WARN [RateLimiterService] Relay wss://relay.damus.io returned 429, backing off for 2000ms (target 35 rpm)
[Nest] 538431  - 03/01/2026, 12:46:51 AM    WARN [RateLimiterService] Relay wss://relay.damus.io returned 429, backing off for 4000ms (target 24 rpm)
[Nest] 538431  - 03/01/2026, 12:46:51 AM    WARN [RateLimiterService] Relay wss://relay.damus.io quarantined for 300000ms after repeated 429s
[Nest] 538431  - 03/01/2026, 12:46:51 AM    WARN [RateLimiterService] Relay wss://relay.damus.io returned 429, backing off for 8000ms (target 16 rpm)
[Nest] 538431  - 03/01/2026, 12:46:51 AM    WARN [RateLimiterService] Relay wss://relay.damus.io returned 429, backing off for 2000ms (target 35 rpm)
[Nest] 538431  - 03/01/2026, 12:46:51 AM    WARN [RateLimiterService] Relay wss://relay.damus.io returned 429, backing off for 4000ms (target 24 rpm)
[Nest] 538431  - 03/01/2026, 12:46:51 AM    WARN [RateLimiterService] Relay wss://relay.damus.io quarantined for 300000ms after repeated 429s
[Nest] 538431  - 03/01/2026, 12:46:51 AM    WARN [RateLimiterService] Relay wss://relay.damus.io returned 429, backing off for 8000ms (target 16 rpm)
PASS src/__tests__/marketplace-adapter.test.ts
PASS src/__tests__/auction-settlement.test.ts
PASS frontend/tests/interaction-primitives.test.tsx
PASS src/__tests__/ecosystem-catalog.service.test.ts
PASS src/__tests__/user-sync-login-policy.test.ts
PASS src/__tests__/relay-sync-priority.test.ts
PASS frontend/tests/editor/primitives.test.tsx
PASS src/__tests__/media-parsing.test.ts
PASS frontend/tests/nip51Lists.test.ts
PASS src/__tests__/identity-resolver-refresh.test.ts
PASS frontend/tests/externalIdentityPanel.test.tsx
PASS frontend/tests/editor/state.test.ts
PASS src/__tests__/relay-discovery.test.ts
PASS src/__tests__/markdown-rendering.test.ts
PASS src/__tests__/config.validation.test.ts
PASS frontend/tests/zaps.test.ts
PASS frontend/tests/analytics-target.test.ts
PASS src/__tests__/media-detection.test.ts
PASS frontend/tests/quotes.test.ts
PASS frontend/tests/analytics.test.ts
PASS src/__tests__/nostrmaxi-cli.test.ts
PASS src/__tests__/name-ownership.test.ts
PASS src/__tests__/media-rendering-placement.test.ts
PASS src/__tests__/inline-rendering-regression.test.ts
PASS frontend/tests/relaySyncDebugPanel.test.ts
PASS frontend/tests/direct-messages.test.ts
PASS frontend/tests/zap-ui.test.ts
PASS src/__tests__/onboarding-state.test.ts
PASS frontend/tests/profileCache.test.ts
PASS frontend/tests/externalIdentities.test.ts
PASS src/__tests__/quoted-media-rendering.test.ts
PASS src/__tests__/name-pricing.test.ts
PASS src/__tests__/feed-modes.test.ts
PASS frontend/tests/editor/adapters.test.ts
PASS src/__tests__/identity-resolver.test.ts
PASS frontend/tests/richEmbeds.test.ts
PASS src/__tests__/top-right-menu-identity.test.ts
PASS src/__tests__/inline-audio-rendering.test.ts
PASS src/__tests__/discover-state.test.ts
PASS frontend/tests/ecosystemCatalogPage.test.ts
PASS src/__tests__/profile-followers-panel-and-feed-parity.test.ts
PASS frontend/tests/wotScore.test.ts
PASS src/__tests__/embed-sizing.test.ts
PASS src/__tests__/discover-ranking.test.ts
PASS src/__tests__/nip05-display.test.ts

Test Suites: 65 passed, 65 total
Tests:       266 passed, 266 total
Snapshots:   0 total
Time:        9.737 s
Ran all test suites.
Jest did not exit one second after the test run has completed.

'This usually means that there are asynchronous operations that weren't stopped in your tests. Consider running Jest with `--detectOpenHandles` to troubleshoot this issue.
```

### 2) Backend build
Command:
```bash
npm run build
```
Output:
```text
> nostrmaxi@1.0.0 build
> nest build
```

### 3) Frontend build
Command:
```bash
npm run build:frontend
```
Output:
```text
> nostrmaxi@1.0.0 build:frontend
> cd frontend && npm run build


> nostrmaxi-frontend@0.1.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 1301 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                        0.62 kB │ gzip:   0.38 kB
dist/assets/index-BXtWNT0s.css        62.14 kB │ gzip:  11.89 kB
dist/assets/secp256k1-ihR1ze_U.js     44.78 kB │ gzip:  17.50 kB
dist/assets/index-DM34IrcX.js      1,412.23 kB │ gzip: 415.30 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 8.17s
```

## Known Risks / Follow-ups
1. **Jest open handles warning** appears post-test despite full pass; potential async cleanup gap in one or more tests.
2. **Frontend bundle size warning** (`index-DM34IrcX.js` ~1.4 MB minified) indicates potential performance impact on slower networks/devices.
3. **Rate limiter / relay 429 warnings** seen in test logs are expected in coverage paths but reflect sensitivity to upstream relay throttling behavior.

## Rollback Plan
If RC regression is detected:

1. Identify bad commit(s) in this RC slice:
   ```bash
   git log --oneline 7a88b84^..75f9453
   ```
2. Revert individual offending commit(s) without rewriting shared history:
   ```bash
   git revert <sha>
   ```
3. If full RC rollback is required on branch before merge/deploy:
   ```bash
   git reset --hard <known-good-sha>
   ```
   (Use only when history rewrite is acceptable in the target workflow.)
4. Re-run gates after rollback:
   ```bash
   npm test -- --runInBand
   npm run build
   npm run build:frontend
   ```
5. Redeploy only after green gate and smoke verification.

## Consolidation Changes in This Pass
- Added this RC notes document for v2 consolidation.
