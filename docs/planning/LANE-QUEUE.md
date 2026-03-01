# Lane Queue (Source of Truth)

Updated: 2026-03-01

| ID | Priority | Task | Scope | Status | Owner Lane | Replacement Candidate |
|---|---|---|---|---|---|---|
| L-001 | P0 | Integrate latest commits + full gate + RC note v2 | repo-wide integration only | RUNNING | agent:main:subagent:9148df19-984b-4de5-acd0-85a13af1d47c | L-006 |
| L-002 | P0 | Deploy + live verification report v2 | operator server only | RUNNING | agent:main:subagent:e4ea2acf-8c90-41a6-96a6-9603656c3e91 | L-007 |
| L-003 | P1 | Journal memory blocks + latest pointers | docs/journal only | DONE | agent:main:subagent:2b24bc11-4f70-4ca8-8284-293c424fdf1f | L-008 |
| L-004 | P1 | Unresolved analytics target picker polish/verify | analytics page | DONE | agent:main:subagent:7199be84-2df1-4a3a-919a-fa402923086a | L-009 |
| L-005 | P1 | Admin UX phase-1 | admin UI only | DONE | agent:main:subagent:623f3899-7280-40f3-aa11-c40ea1a84e1c | L-010 |
| L-006 | P1 | Registration + entitlement integration verification pass | auth/subscription + app route gating | READY | - | L-011 |
| L-007 | P1 | Feed signal subtlety QA pass live (zap/WoT/contributors) | feed ui only | READY | - | L-012 |
| L-008 | P2 | Ecosystem filter UX fine-tune from user feedback | ecosystem only | READY | - | L-013 |
| L-009 | P2 | Performance pass: bundle chunk splitting | frontend build config/pages | READY | - | L-014 |
| L-010 | P2 | Admin phase-2 capability backlog scaffold | admin only | READY | - | L-015 |
| L-011 | P1 | Paid entitlement UX copy and upgrade flow polish | subscription UI only | READY | - | L-016 |
| L-012 | P1 | WoT semantic badge UX tuning (unknown vs score) | feed/profile badges only | READY | - | L-017 |

## Rule
Keep at least 3 RUNNING lanes while READY items exist.
