# Delivery Plan: Canonical Analytics Windowing

- **Date:** 2026-03-01
- **Planning model:** BMAD (Build-Measure-Adjust-Deliver)
- **Scope:** planning + phased execution (no implementation in this package)

## 1) Delivery Strategy

Execute in phased increments with dual-run validation to reduce product risk:
1. Data foundation
2. Query/API layer
3. Frontend integration
4. Performance hardening
5. Controlled rollout and cutover

## 2) Epics and Stories

## Epic A: Canonical Data Foundation

### Story A1: Add analytics schemas and indexes
**Acceptance Criteria**
- Prisma models for fact/aggregate/watermark/job tables created.
- Migration applies cleanly in dev/staging.
- Required indexes present and verified via explain plans.

### Story A2: Build normalization mapper
**Acceptance Criteria**
- Event-to-fact normalization supports kinds used in analytics.
- Dedup via `eventId` uniqueness works idempotently.
- Unit tests cover zap parsing, tag extraction, target resolution.

### Story A3: Build compaction and retention jobs
**Acceptance Criteria**
- Minute/hour/day rollups execute on schedule.
- Retention policy enforced without breaking query correctness.
- Job telemetry emits success/failure/latency metrics.

## Epic B: Query Engine + API Contracts

### Story B1: Implement window query planner
**Acceptance Criteria**
- Supports rolling + custom windows with validation.
- Chooses aggregate tiers + delta scan deterministically.
- Returns consistent results for repeated requests.

### Story B2: Implement `/api/v2/analytics` endpoints
**Acceptance Criteria**
- Summary + drilldown endpoints available.
- Response envelope includes freshness/source/partial metadata.
- OpenAPI docs generated for new endpoints.

### Story B3: Async mode for heavy windows
**Acceptance Criteria**
- Requests exceeding sync threshold return job handle.
- Job status endpoint reports phase and completion.
- Failed jobs return actionable error payload.

## Epic C: Frontend Integration and UX

### Story C1: Canonical API client adapter
**Acceptance Criteria**
- Existing analytics page can consume canonical response envelope.
- Feature flag toggles canonical vs legacy path.
- Backward compatibility preserved during migration.

### Story C2: Freshness and partial-state UX
**Acceptance Criteria**
- UI displays freshness/staleness metadata.
- UI handles partial and stale fallback states gracefully.
- Drilldowns remain window-consistent.

### Story C3: Large-user guardrails UX
**Acceptance Criteria**
- Async-job progress shown for heavy windows.
- Safe messaging for broad custom windows.
- Page remains interactive under delayed responses.

## Epic D: Quality, Performance, and Launch

### Story D1: Drift validation harness
**Acceptance Criteria**
- Dual-run comparison on sample targets/windows.
- Drift report output with metric deltas.
- Alert threshold configured for unacceptable drift.

### Story D2: Load and failure testing
**Acceptance Criteria**
- Load tests simulate large users and concurrent queries.
- Chaos/failure tests validate stale fallback behavior.
- SLA targets measured and documented.

### Story D3: Rollout + migration + rollback
**Acceptance Criteria**
- Gradual feature-flag rollout documented and executed.
- Rollback can disable canonical path without schema rollback.
- Post-launch monitoring + incident runbook exists.

## 3) Parallelizable Lanes

## Lane 1: Data + jobs (Backend)
- A1, A2, A3

## Lane 2: Query/API (Backend)
- B1, B2, B3 (starts once A1 + partial A2 available)

## Lane 3: Frontend migration
- C1, C2, C3 (starts once B2 contracts stabilize)

## Lane 4: Validation and operations
- D1, D2, D3 (parallel once first end-to-end slice exists)

## 4) Dependency Graph (Simplified)

- A1 -> A2 -> A3
- A1 + A2 -> B1
- B1 -> B2
- B2 -> C1
- C1 -> C2 + C3
- B2 + C1 -> D1
- A3 + B2 + C2 -> D2
- D1 + D2 -> D3

## 5) Test Strategy

## Unit tests
- Normalization mapper correctness.
- Window decomposition logic.
- Metric combiners (snapshot + delta merge).
- Input validation and auth policy checks.

## Integration tests
- End-to-end query from facts/aggregates to API response.
- Async job lifecycle and retry behavior.
- Legacy-vs-canonical drift check on fixture datasets.

## Load tests
- High-cardinality custom-window requests.
- Concurrent requests across hot users.
- Cache stampede scenarios.

## Failure tests
- Simulated relay ingest delay/outage.
- Compaction worker crash/retry.
- DB slow query fallback behavior.

## 6) Rollout, Migration, Rollback Plan

## Rollout
1. Deploy schema + jobs dark (feature off).
2. Run backfill for bounded history.
3. Enable canonical for internal/testing cohorts.
4. Enable for % of users via flag.
5. Full cutover once drift + SLO targets met.

## Migration
- Keep legacy endpoints active.
- Add adapter in frontend to support canonical envelope first, then switch default path.
- Maintain side-by-side metrics dashboards during migration.

## Rollback
- Flip feature flag to legacy analytics path.
- Keep canonical ingestion running for data continuity.
- Disable async job endpoint exposure if unstable.
- No destructive schema rollback required for immediate recovery.

## 7) BMAD Risks and Mitigations

1. **Build risk:** underestimating backfill cost.
   - Mitigation: start with limited history; scale in stages.
2. **Measure risk:** false confidence from narrow drift samples.
   - Mitigation: include varied user sizes/windows.
3. **Adjust risk:** too many metric-definition changes late.
   - Mitigation: freeze metric spec after beta gate.
4. **Deliver risk:** cutover before operational visibility is mature.
   - Mitigation: hard launch gates on SLO dashboards + alerts.

## 8) Launch Gates

- [ ] Drift within acceptable threshold.
- [ ] P95 latency and freshness SLOs met.
- [ ] Error rate within target.
- [ ] Rollback tested in staging.
- [ ] Support/runbook docs complete.

## 9) Fix Gaps Checklist

- [ ] Ship data schemas and indexes.
- [ ] Ship ingest + compaction + retention jobs.
- [ ] Ship `/api/v2/analytics` summary/drilldown/jobs endpoints.
- [ ] Ship frontend canonical UX states.
- [ ] Ship validation/load/chaos tests and dashboards.

## 10) Unresolved Questions

1. What is the rollout cohort definition (internal, premium, random sample)?
2. What exact drift threshold blocks launch by metric class?
3. Should async mode persist results for later retrieval/download?
4. Which team owns on-call for analytics compaction failures?