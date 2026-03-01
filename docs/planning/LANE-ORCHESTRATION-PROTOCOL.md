# Lane Orchestration Protocol (No-Drop Execution)

## Problem
Spawning lanes is not enough. The failure mode is **not refilling after completion**.

## Hard Rules
1. **Minimum active lanes = 3** during execution windows.
2. Every completion event must trigger:
   - closeout note (commit/tests/result)
   - immediate replacement lane spawn from backlog
3. Never leave active lanes at 0 while backlog has open items.
4. Do not spawn overlapping lanes touching same files unless explicitly coordinated.

## Control Loop
At each checkpoint:
1. Read active lane count.
2. If `< 3`, refill from queue in priority order.
3. Move selected tasks from `READY` -> `RUNNING`.
4. On completion, move `RUNNING` -> `DONE` and spawn next `READY` task.

## Priority Order
1. Release blockers (build/test/deploy regressions)
2. User-visible UX defects
3. Security/auth gating
4. Analytics scalability and correctness
5. Design polish and backlog cleanup

## Queue File of Record
Use: `docs/planning/LANE-QUEUE.md`

Columns:
- ID
- Priority (P0/P1/P2)
- Scope (files/areas)
- Status (READY/RUNNING/BLOCKED/DONE)
- Owner lane (subagent session key)
- Replacement candidate (next task to spawn)

## Completion Hook (Required)
Any completion message must include:
- lane id
- result commit hash
- verification status
- replacement lane id spawned

If replacement is not spawned, it is considered incomplete work.
