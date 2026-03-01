# Release Candidate Notes — 2026-03-01

## Scope
Integration consolidation for completed lanes on `feat/dm-zap-ux`:
- adaptive relay limiter
- frontend interaction integrity
- relay debug panel
- docs/runbook reconciliation

## Branch/Commit Hygiene Check
- Current branch: `feat/dm-zap-ux`
- Baseline against `master`: `5312318`
- All lane commits are present locally and in coherent order.
- Related tip from sibling lane is already included in history: `972f45f` (`feat/notifications-mvp`).

### Consolidated commit sequence (oldest → newest)
1. `210e707` — chore: reconcile pending docs and relay sync tooling state
2. `2b3c32c` — fix(frontend): harden interaction affordances and metric drilldowns
3. `9c1187c` — feat(relay-sync): add adaptive per-relay rate control with persisted tuning
4. `22b4a30` — feat(frontend): add relay sync adaptive limiter debug panel

## Stray/Unmerged Findings
- Untracked (pre-consolidation): `SPRINT-EXECUTION-PRIMITIVES-2026-03-01.md`
- No merge conflicts or detached commits detected.
- `master..HEAD` is linear and includes expected lane commits.

## Verification Gate
Commands executed on `feat/dm-zap-ux`:

### 1) `npm test`
- Result: ✅ PASS
- Suites: 58 passed / 58 total
- Tests: 246 passed / 246 total
- Note: Jest emitted open-handle warning after completion (`Jest did not exit one second after the test run has completed`).

### 2) `npm run build`
- Result: ✅ PASS
- Backend build completed via `nest build`.

### 3) `npm run build:frontend`
- Result: ✅ PASS
- Frontend build completed via `tsc && vite build`.
- Warning: bundle chunk size warning (largest JS chunk ~1.38 MB, gzip ~405.87 KB).

## Risks
1. **Runtime/test hygiene risk**: open-handle warning in Jest may hide async cleanup issues in tests.
2. **Frontend payload risk**: large bundle chunk warning may affect load performance on slower clients.
3. **Relay behavior tuning risk**: adaptive limiter defaults may need production telemetry calibration across relays.

## Rollback Plan
If issues are found after promotion:
1. Identify bad commit in this sequence (`22b4a30`, `9c1187c`, `2b3c32c`, `210e707`).
2. Fast rollback (shared branch):
   - `git revert <bad_commit>` (or revert a range in reverse order)
   - Re-run gates: `npm test && npm run build && npm run build:frontend`
3. Local/hot rollback:
   - `git reset --hard 5312318` (or another known-good SHA)
4. If relay limiter is culprit, first revert `9c1187c`, then (if needed) `22b4a30`.

## Consolidation delta in this RC prep
- Added: `RELEASE_CANDIDATE_NOTES-2026-03-01.md`
- Included stray planning doc for hygiene: `SPRINT-EXECUTION-PRIMITIVES-2026-03-01.md`
