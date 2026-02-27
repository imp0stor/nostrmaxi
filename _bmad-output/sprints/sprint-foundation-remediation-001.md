# Sprint Foundation Remediation 001 — nostrmaxi-canonical

**Date:** 2026-02-25
**Project Type:** SaaS/Portal
**Profile:** A
**Objective:** Close profile-gate gaps and harden foundation baseline.

## Identified Gaps
- [ ] Connector/plugin framework
- [ ] Execution engine (manual/scheduled + history/alerts)

## Sprint Tasks
- [ ] Align admin UI ↔ admin API contracts and remove duplicate/parallel implementation drift.
- [ ] Ensure all config entities are DB-backed and editable from admin surfaces.
- [ ] Verify connector factory + at least one production connector path per critical source.
- [ ] Verify scheduler/manual triggers with execution history and alerting wired to dashboard.
- [ ] Run build/test/e2e and publish remediation closeout notes.

## Definition of Done
- [ ] Profile gates satisfied per `standards/FOUNDATION-PROFILES.md`
- [ ] Build + tests pass
- [ ] Any new config is admin-editable (or profile-appropriate config-managed)
- [ ] Runbook/docs updated

## Dependencies / Notes
- Profile plan: `_bmad-output/architecture/project-profile-plan.md`
- Portfolio matrix: `docs/PROFILE-GAP-MATRIX-2026-02-25.md`
