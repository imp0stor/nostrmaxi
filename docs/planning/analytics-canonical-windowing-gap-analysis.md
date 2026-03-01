# Gap Analysis: Canonical Analytics Windowing

- **Date:** 2026-03-01
- **Scope:** Current repository state vs target canonical analytics architecture

## 1) Executive Summary

The codebase has meaningful analytics functionality, but it is split between:
- frontend relay-query analytics (`frontend/src/lib/analytics.ts`),
- backend ad-hoc analytics services (`src/analytics/*`),
- one persisted network snapshot table (`NetworkAnalytics`).

There is no canonical persisted user analytics fact/aggregate model that supports deterministic rolling/custom window queries for any target user with snapshot+delta freshness guarantees.

## 2) Current State vs Target

| Area | Current State | Target State | Gap |
|---|---|---|---|
| Data model | Mostly transient relay query results; only `NetworkAnalytics` persisted snapshot | Canonical event fact + minute/hour/day aggregates | **High** |
| Query model | On-demand scans from relay(s), client-heavy computation | Server canonical query planner over aggregates + delta | **High** |
| Window support | Rolling intervals + custom in frontend; backend mostly interval enums | Unified backend rolling + custom window contracts | **High** |
| Freshness | Implicit via query timing; limited metadata | Explicit snapshot/delta freshness metadata | **High** |
| Large-user safety | Some limits/chunks; still expensive request path | Safe bounded request path + async fallback | **High** |
| API consistency | Mixed endpoints (`/api/analytics`, `/api/v1/analytics/network`) | Versioned canonical API (`/api/v2/analytics`) | **Medium** |
| Observability | Basic logs + generic metrics endpoint | Analytics-specific lag/compaction/drift metrics | **Medium** |

## 3) Missing Backend Endpoints

Required additions:

1. `GET /api/v2/analytics/user/:pubkey/summary`
   - supports `interval` OR `startTs/endTs`.
2. `GET /api/v2/analytics/user/:pubkey/drilldown/:metric`
   - paginated drilldowns (top posts, hashtags, zappers, timing, timeline).
3. `POST /api/v2/analytics/user/:pubkey/query` (optional for complex payload)
4. `GET /api/v2/analytics/jobs/:jobId`
   - async execution status for heavy windows.
5. `POST /api/v2/analytics/admin/rebuild`
   - controlled backfill/rebuild endpoint (admin-only).

Current endpoints to preserve/migrate:
- `/api/analytics/user/:pubkey`
- `/api/analytics/user/:pubkey/insights`
- `/api/analytics/network`

## 4) Missing Jobs / Pipelines

1. **Canonical ingest job**: normalize incoming relay events into analytics facts.
2. **Compaction jobs**:
   - minute rollup,
   - hour rollup,
   - day rollup,
   - retention cleanup.
3. **Delta watermark job**: maintain snapshot and ingest watermarks.
4. **Drift validation job**: compare canonical vs legacy outputs on sample targets/windows.
5. **Hot-window materialization job**: precompute 24h/7d/30d for active users.

## 5) Missing Schemas and Indexes

## Missing schemas
- `AnalyticsEventFact`
- `AnalyticsAggMinute`
- `AnalyticsAggHour`
- `AnalyticsAggDay`
- `AnalyticsWatermark`
- `AnalyticsQueryJob` (if async mode implemented)

## Missing indexes
- Fact table:
  - unique `eventId`
  - btree `(targetPubkey, createdAtTs)`
  - btree `(authorPubkey, createdAtTs)`
  - brin `(createdAtTs)`
- Aggregate tables:
  - unique `(bucketStartTs, targetPubkey, metricGroup, metricKey)`
  - btree `(targetPubkey, bucketStartTs)`
  - partial indexes for hot metric groups

## 6) Missing UI States

Current frontend already has analytics progress and skeleton states, but missing canonical-specific UX states:

1. Freshness badge (`Live`, `Delayed`, `Stale`).
2. Partial-result warning with reason and retry action.
3. Async-job progress state for heavy custom windows.
4. “Window too broad” guardrail messaging with suggested ranges.
5. Explicit source metadata (“canonical”, “fallback”).

## 7) Security / Privacy Concerns

1. **Query abuse risk**: custom windows could be abused for expensive scans.
   - Mitigate with input constraints + rate limits + async fallback.
2. **Data minimization**: returning raw content/tags unnecessarily.
   - Mitigate with strict DTO shaping.
3. **Endpoint exposure**: public analytics for any target must avoid leaking non-public operational metadata.
   - Mitigate by separating user-facing vs internal diagnostics fields.
4. **Auth policy drift**: mixed premium/public behavior in current endpoints.
   - Mitigate by codifying access matrix per endpoint in policy tests.

## 8) Assumptions

1. Existing local relay (`ws://10.1.10.143:7777`) remains part of ingest path.
2. Existing Postgres deployment can be tuned for added write load.
3. Feature-flag based rollout is accepted.

## 9) Constraints

1. No breaking removal of existing analytics routes during migration.
2. Must stay within NestJS/Prisma conventions used in repo.
3. Must avoid introducing heavy external infra in phase 1.

## 10) Risks

1. Large backfill can impact DB and API latency.
2. Metric definition mismatches can erode trust.
3. Relay incompleteness can produce perceived inaccuracies.

## 11) Acceptance Criteria for Gap Closure

- [ ] Canonical schemas and indexes merged and migrated.
- [ ] New `/api/v2/analytics` endpoints available with contract tests.
- [ ] Scheduled ingest/compaction/retention jobs running and observable.
- [ ] Frontend supports freshness + partial + async states.
- [ ] Security controls validated (rate limit, auth matrix, DTO redaction).

## 12) Fix Gaps Checklist

- [ ] Implement missing schema + migration package.
- [ ] Implement canonical ingest and compaction workers.
- [ ] Implement canonical query service and API controllers.
- [ ] Implement frontend canonical envelope adapter.
- [ ] Add drift-test harness comparing legacy vs canonical outputs.
- [ ] Add analytics-specific dashboards and alerts.

## 13) Unresolved Questions

1. Which existing endpoint should become the canonical default first?
2. How much historical backfill is required for launch (30d, 90d, 1y)?
3. Should network analytics snapshots share the same fact model tables now or later?
4. What is acceptable max latency before forcing async mode?