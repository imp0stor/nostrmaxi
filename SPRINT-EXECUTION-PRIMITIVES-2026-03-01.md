# Sprint Execution Plan — NostrMaxi (2026-03-01)

## Operating Mode
Ship-first, aggressive execution. No partials.

## Sprint 1 (Now): Foundation + Integrity (In Progress)

### Completed
- Primitives integration into backend services (profile, WoT, KB)
- New primitives API endpoints
- Feed/profile drilldown UX primitives (metric chip, contributor sheet, modal shell)
- Dirty/untracked reconciliation + test/build verification

### Exit Criteria
- [x] `npm test` passing
- [x] `npm run build` passing
- [x] frontend build passing
- [x] repo clean

## Sprint 2 (Now): Relay/Tooling Primitive Extraction (In Progress)

### Scope
- Extract relay primitives/tooling into publishable primitives workspace:
  - relay URL normalize/validate
  - relay health scoring and ordering
  - relay selection planning
  - backoff policy helpers
  - relay hint merge strategy
  - event import disposition accounting

### Exit Criteria
- [ ] package created/expanded in primitives-typescript
- [ ] tests added and passing
- [ ] build passing
- [ ] docs and publish checklist updated
- [ ] commit made

## Sprint 3 (Next): NIP Depth + UX Depth

### Scope
- Expand NIP support surfaces in UI with progressive disclosure
- Ensure contributor-backed data drillability across feed/profile/discovery
- Consolidate remaining ad-hoc card/chip usage into reusable primitives

### Exit Criteria
- [ ] 0 fake hover affordances in high-traffic routes
- [ ] all contributor metrics drillable in feed/profile/discovery
- [ ] updated NIP support matrix + implementation docs

## Sprint 4 (Next): Throughput + Quality

### Scope
- Relay sync performance/reliability pass
- Add integration tests for primitives endpoints + UI drilldowns
- Bundle chunking/code-split pass for frontend

### Exit Criteria
- [ ] measurable ingest throughput improvement
- [ ] integration tests green
- [ ] reduced frontend chunk warnings

## Cadence
- Ship commit-sized increments continuously.
- Verify build/tests every change set.
- Document every major decision and primitive extraction.
