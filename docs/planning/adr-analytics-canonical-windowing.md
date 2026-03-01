# ADR: Canonical Analytics Storage with Bucketed Windowing

- **ADR ID:** ADR-analytics-canonical-windowing
- **Date:** 2026-03-01
- **Status:** Accepted (planning)

## Context

Current analytics behavior is fragmented between frontend relay scans and backend ad-hoc computation, with limited persistence and inconsistent performance for large users/windows. Product requirements now demand deterministic rolling + custom window analytics for any target user with near-real-time freshness.

## Decision

Adopt a canonical analytics architecture based on:
1. normalized persisted event facts,
2. bucketed aggregates (minute/hour/day),
3. query-time merge of snapshot aggregates with live delta,
4. versioned API contracts under `/api/v2/analytics`.

This is implemented incrementally behind feature flags while maintaining backward compatibility with existing analytics endpoints.

## Rationale

1. **Performance:** aggregate-first query path reduces repeated expensive relay scans.
2. **Determinism:** one canonical dataset reduces metric drift across clients.
3. **Freshness:** snapshot+delta allows low-latency plus near-real-time updates.
4. **Operability:** explicit watermarks, jobs, and telemetry improve production control.
5. **Practicality:** fits current NestJS + Prisma + Postgres stack.

## Alternatives Considered (Rejected)

## Alternative A: Keep frontend relay-compute as primary
- **Pros:** no backend schema changes.
- **Cons:** poor large-user performance, inconsistent results, hard to enforce SLAs.
- **Decision:** Rejected.

## Alternative B: Full streaming analytics platform (Kafka/Flink/ClickHouse) now
- **Pros:** high scalability and advanced analytics.
- **Cons:** high operational complexity and migration risk for current stage.
- **Decision:** Rejected for phase 1; may revisit after canonical v1 stabilizes.

## Alternative C: Single daily materialized snapshots only
- **Pros:** simplest implementation.
- **Cons:** insufficient freshness and weak support for custom windows.
- **Decision:** Rejected.

## Consequences

## Positive
- Better latency predictability and user experience.
- Stronger confidence in metrics via canonical definitions.
- Clear migration path from legacy endpoints.

## Negative / Tradeoffs
- Additional storage and job orchestration complexity.
- Need careful backfill and compaction tuning.
- Temporary dual-run maintenance cost during migration.

## Implementation Notes

- Introduce canonical schema via Prisma migrations.
- Create ingest + compaction + retention jobs.
- Add `/api/v2/analytics` summary + drilldown + async job endpoints.
- Add frontend feature flag and response adapter.
- Run dual-run drift validation before full cutover.

## Assumptions

1. Existing relay ingest sources remain available.
2. Postgres can be tuned for required write/read profile.
3. Teams can maintain dual-run temporarily.

## Constraints

1. Maintain current endpoint compatibility during rollout.
2. No big-bang infra replacement in phase 1.
3. Must enforce query safety and rate limiting.

## Risks

1. Data skew from incomplete relay ingest.
2. Compaction lag causing stale windows.
3. Heavy custom windows causing compute spikes.

## Acceptance Criteria

- [ ] Canonical schemas/jobs/endpoints delivered.
- [ ] Freshness and latency SLO instrumentation live.
- [ ] Drift threshold met vs legacy outputs.
- [ ] Feature-flagged rollout and rollback validated.

## Fix Gaps Checklist

- [ ] Finalize metric definitions and versioning.
- [ ] Finalize sync-vs-async threshold policy.
- [ ] Finalize retention and partition strategy.
- [ ] Finalize endpoint auth/access matrix.

## Unresolved Questions

1. Should canonical analytics be exposed externally via API keys in phase 1 or phase 2?
2. What default backfill horizon balances launch speed and user trust best?
3. Which metrics, if any, can tolerate sampled computation under extreme load?