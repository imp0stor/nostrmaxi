# PRD: Canonical Analytics Storage with Rolling + Custom Windows

- **Status:** Draft for implementation
- **Owner:** Analytics platform
- **Date:** 2026-03-01
- **Related docs:**
  - [Architecture Spec](./analytics-canonical-windowing-architecture.md)
  - [Gap Analysis](./analytics-canonical-windowing-gap-analysis.md)
  - [Delivery Plan](./analytics-canonical-windowing-delivery-plan.md)
  - [ADR](./adr-analytics-canonical-windowing.md)

## 1) Problem Statement

Current analytics in this codebase are computed mostly on-demand from relay queries and short-lived in-memory/localStorage caches. This creates four issues:

1. Slow/variable response times for large users.
2. Inconsistent results across identical window requests.
3. Limited near-real-time freshness guarantees.
4. Missing backend primitive for arbitrary custom windows across one canonical dataset.

We need a canonical analytics storage layer that supports:
- analytics for **any target user**,
- **rolling windows** (24h/7d/30d/90d/1y/all),
- **custom windows** (`startTs`, `endTs`),
- near real-time freshness with bounded latency,
- safe handling for large users and high-event-volume ranges.

## 2) Goals

1. Provide deterministic analytics from a canonical backend dataset (not only client-side relay scans).
2. Support windowed analytics queries for any public user target.
3. Support both predefined rolling windows and arbitrary custom windows.
4. Reach near-real-time freshness for hot metrics through snapshot+delta.
5. Keep UX responsive with progress states and safe degradation for large workloads.

## 3) Non-Goals

1. Building full multi-tenant billing metering in this phase.
2. Replacing all existing analytics screens at once (incremental migration only).
3. Historical backfill for all of Nostr from genesis (bounded initial backfill).
4. Building cross-user cohort analytics UI in phase 1.

## 4) User Personas & Use Cases

## Persona A: Creator / Power User
- Wants accurate personal performance over last 7d/30d and custom campaign windows.
- Needs drilldowns into top posts, hashtags, zaps, and posting-time performance.

## Persona B: Analyst / Growth Operator
- Needs to compare windows (before/after launch).
- Needs confidence that repeated queries return consistent numbers.

## Persona C: Casual User
- Opens analytics occasionally.
- Needs fast load and understandable progress without technical details.

## Persona D: Platform Operator
- Needs predictable compute/storage costs and operational SLO visibility.
- Needs graceful failure behavior when relays are degraded.

## 5) Functional Requirements

## FR-1 Targeting and scope
- System shall return analytics for any provided target pubkey (public data).
- System shall preserve auth/plan gating already implemented (e.g., premium guard rules), while allowing public-target queries where policy permits.

## FR-2 Windowing
- Support rolling windows: `24h`, `7d`, `30d`, `90d`, `1y`, `all`.
- Support custom windows with explicit `startTs` and `endTs`.
- Validate max window span limits (e.g., protect from pathological unbounded scans where needed).

## FR-3 Canonical metrics dataset
- Canonical fact model must include at least notes, reactions, replies, reposts, zaps, hashtags, and relay attribution signals available in existing code.
- Metrics derived from one normalized event dataset with reproducible aggregation rules.

## FR-4 Near real-time freshness
- Aggregates updated by scheduled compaction + frequent delta ingestion.
- Query responses include freshness metadata (`snapshotAsOf`, `deltaAsOf`, `stalenessMs`).

## FR-5 Drilldowns
- API supports drilldown payloads for:
  - top posts,
  - top hashtags,
  - best posting hours/days,
  - zap contributors and amounts,
  - event timelines.

## FR-6 Large-user safety
- For large users, service must avoid single huge relay scans in request path.
- Query should degrade gracefully (partial/sampled flags where necessary) with explicit metadata.

## FR-7 Caching and idempotency
- Deterministic cache keys based on target + window + metric version.
- Repeated request in same freshness envelope should return stable values.

## FR-8 Migration compatibility
- Existing frontend analytics flows continue to work during migration.
- Feature flag controls cutover to canonical backend responses.

## 6) UX Requirements

## UX-1 Progress
- Surface phased progress states already familiar in UI (`resolving`, `fetching`, `aggregating`, `enriching`, `complete`) mapped to backend job/query states.
- For async recompute paths, return immediately with progress token and poll endpoint when required.

## UX-2 Drilldowns
- Drilldown tables/charts must support consistent sorting and pagination.
- Drilldown data must reflect same window and freshness metadata as summary cards.

## UX-3 Large-user safety UX
- If workload is large:
  - show safe timeout/partial-results notice,
  - show recommended narrower window,
  - keep page interactive (no hard lock).

## UX-4 Error semantics
- Distinguish: invalid input, no data, stale data fallback, and backend unavailable.
- Include machine-readable error codes for frontend mapping.

## 7) Success Metrics + SLAs

## Product success metrics
- >= 90% of analytics page loads use canonical backend path by end of rollout.
- >= 95% of identical-window repeat queries differ by <= 1% (excluding live delta window).
- >= 80% reduction in frontend direct relay analytics scans for migrated views.

## Performance SLAs (phase targets)
- P50 response <= 700ms (cached canonical window).
- P95 response <= 2.5s (uncached but pre-aggregated windows).
- P99 response <= 6s with graceful partial fallback.

## Freshness SLAs
- Delta ingest lag <= 60s (P95).
- Snapshot lag <= 5 minutes (P95) for active users.
- Freshness metadata present in 100% of responses.

## Reliability SLAs
- Analytics endpoint availability >= 99.5% monthly.
- Failed aggregation jobs auto-retried with exponential backoff.

## 8) Assumptions

1. Existing relay sync/local relay pipeline remains available as ingestion source.
2. PostgreSQL + Prisma is primary persisted analytics store.
3. Redis/cache-manager is available for short-lived query cache.
4. Existing frontend can accept new response envelope with metadata.

## 9) Constraints

1. Must be practical in current NestJS + Prisma architecture.
2. No large-scale infra replacement in this phase.
3. Keep backward compatibility for existing `/api/analytics` consumers during migration.
4. Respect premium/public access rules already present.

## 10) Risks

1. Relay data incompleteness can skew results.
2. Backfill and compaction may create temporary load spikes.
3. Query-cardinality explosion from arbitrary custom windows.
4. Divergence between legacy and canonical metric definitions during migration.

## 11) Acceptance Criteria (PRD-level)

1. All required APIs for canonical window queries are implemented and documented.
2. Canonical fact + aggregate tables are deployed with required indexes.
3. Frontend analytics page can request rolling + custom windows from backend.
4. Freshness metadata + progress handling is visible in UI.
5. Load tests demonstrate large-user safe behavior and SLA compliance targets.
6. Rollout can be toggled/rolled back without data loss.

## 12) Fix Gaps Checklist

- [ ] Add canonical event fact and bucket aggregate schemas.
- [ ] Add window query API supporting rolling and custom ranges.
- [ ] Add snapshot + live delta merge logic.
- [ ] Add compaction/retention jobs and observability metrics.
- [ ] Add frontend handling for canonical freshness metadata and partial flags.
- [ ] Add migration feature flag and fallback path.

## 13) Unresolved Questions

1. Should very large custom windows require async job mode by default?
2. What strict max range should anonymous/public analytics queries allow?
3. Do we need per-metric freshness targets or a single global freshness envelope?
4. What level of sampling is acceptable (if any) for extreme edge cases?
5. Should legacy client-side localStorage cache be retained post-cutover?