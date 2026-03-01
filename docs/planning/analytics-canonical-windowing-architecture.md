# Architecture Spec: Canonical Analytics Storage + Windowing

- **Status:** Proposed
- **Date:** 2026-03-01
- **Primary stack:** NestJS + Prisma + PostgreSQL + cache-manager

## 1) Overview

This design adds a canonical analytics store built from one normalized event fact dataset plus pre-aggregated minute/hour/day buckets. Queries merge compacted snapshots with live deltas to achieve near-real-time freshness while keeping response latency predictable.

## 2) Canonical Event Fact Model

## Core table: `AnalyticsEventFact`

Purpose: normalized immutable analytics facts derived from Nostr events.

Proposed fields (logical):
- `id` (internal uuid)
- `eventId` (nostr id, unique)
- `eventKind` (int)
- `createdAtTs` (unix seconds)
- `authorPubkey`
- `targetPubkey` (nullable; e.g., recipient/owner)
- `rootEventId` (nullable)
- `parentEventId` (nullable)
- `relayUrl` (nullable)
- `zapSats` (nullable numeric)
- `hashtags` (text[] or jsonb)
- `payload` (jsonb minimal normalized tags used for drilldowns)
- `ingestedAt` (timestamp)

Normalization rules:
- Notes: author as `authorPubkey`; target null.
- Reactions/reposts/replies: resolve referenced `e`/`p` tags; set `targetPubkey` when discoverable.
- Zaps: parse sats from receipt, keep sender/recipient signals.
- Keep raw-heavy content out of analytics fact except minimal fields needed for top-post previews references.

Dedup policy:
- Unique on `eventId`.
- Re-ingest is idempotent upsert/no-op.

## 3) Bucketed Aggregate Strategy

## Aggregate tables
- `AnalyticsAggMinute`
- `AnalyticsAggHour`
- `AnalyticsAggDay`

Key dimensions:
- `bucketStartTs`
- `targetPubkey`
- `metricGroup` (e.g., `summary`, `hashtags`, `zaps`, `timing`)
- `metricKey` (e.g., `total_posts`, `hashtag:nostr`, `hour:13`)
- `metricValueNumeric`
- `metricValueJson` (for complex values where needed)
- `computedAt`

Strategy:
- Minute buckets power near-real-time deltas over short ranges.
- Hour/day buckets serve majority query paths.
- Window query decomposes into maximal coarse buckets + minimal fine buckets.

## 4) Delta Merge Model (Snapshot + Live)

## Snapshot layer
- Periodic job compacts event facts into bucket aggregates.
- Snapshot watermark tracked in `AnalyticsWatermark` table:
  - `snapshotAsOfTs`
  - `lastEventIngestedTs`

## Live delta layer
- Query-time delta computes metrics from facts newer than snapshot watermark (typically last few minutes).
- Delta range bounded by freshness SLA (e.g., <= 5 minutes).

## Merge algorithm
1. Resolve requested window.
2. Pull aggregate slices up to `snapshotAsOfTs`.
3. Pull raw facts for `(snapshotAsOfTs, windowEnd]`.
4. Merge deterministically per metric definition.
5. Return response with metadata:
   - `snapshotAsOf`
   - `deltaAsOf`
   - `stalenessMs`
   - `isPartial`

## 5) Query API Contracts

All endpoints versioned under `/api/v2/analytics` to avoid breaking current `/api/analytics`.

## Endpoint: summary
`GET /api/v2/analytics/user/:pubkey/summary?interval=30d`
`GET /api/v2/analytics/user/:pubkey/summary?startTs=...&endTs=...`

Response envelope:
- `data`: summary cards + timeline totals
- `drilldowns`: optional small top-N blocks
- `meta`:
  - `window` (`type`, `startTs`, `endTs`)
  - `freshness`
  - `source` (`canonical`, `canonical+delta`, `fallback`)
  - `partialReason` (nullable)

## Endpoint: drilldown
`GET /api/v2/analytics/user/:pubkey/drilldown/:metric?...`

Supported metrics (phase 1):
- `top-posts`
- `top-hashtags`
- `zappers`
- `best-hours`
- `best-days`
- `timeline`

## Endpoint: progress (for async heavy windows)
`GET /api/v2/analytics/jobs/:jobId`

Returns:
- `status` (`queued|running|complete|failed`)
- `progressPercent`
- `phase`
- `resultRef` (when complete)

## 6) Caching + Materialization

## Query cache
- Redis/cache-manager key: hash(pubkey + window + metric + version + freshnessClass).
- TTL by window type:
  - short windows (<=24h): 15-30s
  - medium windows (<=30d): 60-180s
  - long windows (>30d): 5-15m

## Materialized hot windows
Precompute and cache hot windows for active users:
- 24h, 7d, 30d

Use scheduled jobs + write-through cache update after compaction.

## 7) Retention, Compaction, Storage Sizing

Retention policy proposal:
- Raw `AnalyticsEventFact`: 180 days default (configurable).
- Hour/day aggregates: 2 years+
- Minute aggregates: 7-30 days

Compaction policy:
- Minute -> hour after 48h.
- Hour -> day after 60d.
- Delete superseded fine-grain buckets after successful rollup.

Sizing model (order-of-magnitude):
- If ingest = 5M facts/day, 180d raw ~= 900M rows (requires partitioning).
- Partition facts by day/week on `createdAtTs`.
- BRIN index on time + B-tree on `(targetPubkey, createdAtTs)`.

## 8) Failure Modes + Mitigations

1. **Relay ingestion lag/outage**
   - Mitigation: expose stale metadata, keep last good snapshot, retry ingest.
2. **Compaction job failures**
   - Mitigation: idempotent jobs + retry queue + dead letter alert.
3. **Query explosion from large custom windows**
   - Mitigation: enforce sync limits, async job fallback, per-user rate limiting.
4. **Data skew/inconsistency during migration**
   - Mitigation: dual-run validation (legacy vs canonical) and drift dashboards.
5. **Cache stampede on hot keys**
   - Mitigation: request coalescing/lock key + jittered TTL.

## 9) Security & Privacy Controls

- Public analytics only over already-public Nostr data.
- Guard rails on query complexity to prevent abuse.
- Redact any fields not required for analytics from response payloads.
- Auditable access logs for analytics endpoints.

## 10) Assumptions

1. PostgreSQL can be tuned/partitioned for high-write facts.
2. Existing relay sync pipeline can publish normalized ingest events.
3. Frontend can consume versioned API response envelope.

## 11) Constraints

1. Remain within current app/runtime pattern (NestJS monolith).
2. Use Prisma migrations for schema delivery.
3. Keep legacy endpoints operational until full cutover.

## 12) Acceptance Criteria

- [ ] Canonical fact + aggregate tables exist with indexes and migrations.
- [ ] `/api/v2/analytics` supports rolling + custom windows.
- [ ] Snapshot + delta merge is implemented and unit/integration tested.
- [ ] Freshness metadata emitted in all successful responses.
- [ ] Async fallback exists for heavy custom windows.

## 13) Fix Gaps Checklist

- [ ] Add ingestion transformer from relay events to `AnalyticsEventFact`.
- [ ] Add bucket compaction scheduler(s).
- [ ] Add query planner for bucket decomposition.
- [ ] Add canonical response envelope + DTOs.
- [ ] Add observability metrics (lag, compaction duration, query latency).

## 14) Unresolved Questions

1. Should facts be sharded by pubkey hash if single Postgres node saturates?
2. Are minute buckets needed for all metrics or only zap/timeline metrics?
3. Do we materialize top-post previews server-side or fetch lazily by event id?
4. What exact threshold triggers async mode vs sync mode?