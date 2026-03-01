# NostrMaxi Execution Backlog (Last 24h Review)

Date: 2026-03-01
Owner: Adam (Chief Architect)
Mode: Aggressive iterative shipping, parallel lanes, conflict-safe

## Source of truth reviewed
- Direct conversation in last 24h (UX + relay sync + admin security + analytics + primitives + deployment)
- Completed lane outputs and commit reports

---

## 1) Canonical Product Requirements (from conversation)

### Feed / UX
1. Composer at top (Primal-like flow)
2. Blossom/media transparent and inline
3. Mute/Filters/Relay controls in compact row under composer
4. Feed tag filters folded into Content Filters
5. Remove duplicate relay status block from feed (single source only)
6. Premium dark UX quality (orange accent + terminal identity) with honest affordances
7. If an element looks interactive, it must be interactive
8. Contributor-backed metrics must be drillable

### Analytics
1. Full drillability for post/contributor data
2. No arbitrary hard truncation of already-available browser data
3. Target analytics for any public user (`npub|hex|nip05`) with default logged-in user
4. Unresolved target -> searchable candidate picker (not dead error)
5. Progress bar + percent + loading phase text
6. Large-user safety (chunking/incremental render)
7. Move toward server-side compute/cache for ALL scope + near-real-time delta model

### Admin/Security
1. Admin must not be exposed to non-admin users
2. Backend admin routes must require admin authorization
3. Frontend admin route/nav gated and redirected
4. Admin needs full redesign and completion after security lock

### Relay / Sync / Ingestion
1. Keep sync flowing without hitting relay limits
2. Adaptive per-relay controls and telemetry
3. Reliable ingestion growth and operational visibility

---

## 2) Done / In-progress / Pending

## DONE (verified by commit reports)
- [x] Connections page with 4 columns (Following/Mutuals/Followers/Muted-Blocked)
  - commit: `612bb9b`
- [x] Admin security lock (guard + hidden nav + /admin/check + redirects)
  - commit: `3a1ebf4`
- [x] Analytics targetable by user + query param + default current user
  - commit: `b352d0a`
- [x] Analytics progress model + progress bar + chunked updates
  - commit: `e0890a2`
- [x] Analytics richer drilldowns + expanded metrics baseline
  - commit: `a7450e8`

## IN PROGRESS
- [ ] Integration merge lane: reconcile all recent commits, resolve compile blockers, include feed relay-duplicate removal
- [ ] Operator deploy lane: deploy latest integrated branch and verify live behavior
- [ ] BMAD package lane: canonical analytics storage/windowing planning artifacts

## PENDING (high priority)
1. Feed duplicate relay status removal shipped to live
2. Full integrated deploy with all new UX/security/analytics changes
3. Verify unresolved analytics target => searchable picker UX (must be explicit)
4. Admin UX redesign (secure + complete + polished)
5. Server-side analytics compute/cache architecture implementation (after BMAD docs)
6. Near-real-time snapshot+delta materialization implementation

---

## 3) Sprint Plan (execution until finished)

## Sprint A — Integration + Release Candidate (NOW)
Goal: ship integrated stable build with no regressions.

Tasks:
- Merge all recent commits into single coherent branch state
- Include feed duplicate relay block removal
- Fix any compile/test failures introduced by concurrent lanes
- Full gate: `npm test -- --runInBand`, `npm run build`, `npm run build:frontend`
- Produce RC note + commit memory block

Exit criteria:
- All tests/build green
- No duplicate relay UI in feed
- Admin locked for non-admins
- Analytics target/progress/drilldown flows function

## Sprint B — Live Deploy + Verification (immediately after Sprint A)
Goal: production matches expected UX/security/search behavior.

Tasks:
- Deploy integrated branch to neo host
- Verify:
  - `/health`
  - `/api/v1/search` not fallback
  - `/api/v1/admin/check` + route gating behavior
  - `/analytics` target + unresolved-target fallback + progress UI
- Capture deploy report + rollback notes

Exit criteria:
- Live checks pass
- User confirms UX state improved and features visible

## Sprint C — Admin Productization (post-security)
Goal: turn admin from minimal to complete, secure console.

Tasks:
- Separate admin IA from main UX surface (gated and purpose-built)
- Add core modules: moderation, relay config, system health, audit logs, user actions
- Enforce drillable data and safe actions with confirmation flows

Exit criteria:
- Admin usability + capability baseline achieved
- No exposed admin controls for non-admins

## Sprint D — Canonical Analytics Engine (BMAD -> implement)
Goal: one canonical dataset supports rolling/custom windows, near-real-time.

Tasks:
- Implement fact-store + time-bucket aggregates
- Snapshot + delta merge read path
- Progress/reporting endpoints for ALL-scope builds
- Cache policy and invalidation strategy

Exit criteria:
- ALL-scope analytics viable for largest users
- Near real-time freshness metadata
- No browser OOM on heavy targets

---

## 4) Risk + guardrail checklist
- [ ] No fake hover affordances
- [ ] Any contributing data is drillable
- [ ] No release without test/build gates
- [ ] No deploy without endpoint verification
- [ ] Keep one canonical DB/data path per service
- [ ] Keep commit-memory block for each major ship

---

## 5) Daily operator cadence
- Start-of-cycle: run full status + open active lane report
- Every 60 min: checkpoint with shipped commits + blockers
- End-of-cycle: append commit-memory journal entry
