# Nostr Primitives Investigation + Implementation Scope (2026-03-01)

## Context
User request: investigate the Nostr primitives built outside current UI pass and scope implementation in NostrMaxi, while mining sspodcast design docs for high-value portal features.

## Sources Reviewed
- `/home/owner/.openclaw/workspace/primitives-typescript/NOSTRMAXI-INTEGRATION.md`
- `/home/owner/.openclaw/workspace/primitives-typescript/IMPLEMENTATION-SUMMARY.md`
- `/home/owner/strangesignal/docs/sspodcast-archive/design-next-steps.md`
- `/home/owner/strangesignal/docs/sspodcast-archive/design-review.md`
- `/home/owner/strangesignal/docs/sspodcast-archive/frontend-architecture.md`
- `/home/owner/strangesignal/docs/sspodcast-archive/mvp-scope.md`
- `/home/owner/strangesignal/docs/sspodcast-archive/user-journeys.md`
- `/home/owner/.openclaw/workspace/knowledge-base/articles/active/2026-02-20--nostrmaxi-sspodcast-merger-decision.md`

---

## External Primitives Inventory (already built)

### 1) `@strangesignal/nostr-profile`
Status: implemented, tested.
- Profile builder/validation
- Kind 0 metadata mapping
- Kind 3 contacts
- Badge kinds support (30008/30009)

### 2) `@strangesignal/nostr-wot-voting`
Status: implemented, tested.
- Vote model/builders
- Reputation calculator
- WoT scoring + bot heuristics + graph discounting
- Voting event kinds (34001/34002)

### 3) `@strangesignal/nostr-kb`
Status: implemented, tested.
- Long-form article model (30023)
- Builder + validation + metadata extraction
- Search filter + indexing helpers

### Quality note
- Reported as 41 tests passing in primitives workspace.
- Integration in NostrMaxi currently appears partial/limited (not yet systematized into product modules and UX flows).

---

## Why these primitives matter for NostrMaxi now

NostrMaxi’s direction is: **Primal feel + deeper feature support + more NIP depth + better interaction flows**.
The external primitives provide exactly the missing domain layer:
- profile/identity consistency
- trust/reputation substrate
- knowledge/content substrate

This avoids rebuilding domain logic in ad-hoc app code.

---

## Implementation Scope (phased)

## Phase A (P0): Wire primitives into backend domain services (1-2 days)

### A1. Add primitives module in Nest app
- `src/primitives/primitives.module.ts`
- `src/primitives/profile.service.ts`
- `src/primitives/wot.service.ts`
- `src/primitives/kb.service.ts`

### A2. Integrate package deps cleanly
- prefer workspace/local package references or private registry flow
- avoid manual copy into node_modules in production workflows

### A3. Add contract tests
- verify primitive outputs match existing API contracts
- verify event-kind conformance (0/3/30023/34001/34002)

Deliverable: backend can call primitives as canonical domain engine.

---

## Phase B (P0): Expose user-facing capability slices (2-4 days)

### B1. Profile primitive usage
- normalize profile hydration path via `NostrProfileService`
- expose profile quality/validation hints in UI (non-blocking)

### B2. WoT primitive usage
- add trust score endpoint(s) + cache
- surface score as drillable metric in profile/feed where relevant
- keep explanatory UX simple (collapsed score + expandable rationale)

### B3. KB primitive usage
- use KB model for long-form/event cards + search filters
- improve 30023 handling in feed/discovery views

Deliverable: primitives become visible product capabilities, not just backend code.

---

## Phase C (P1): UX integration with "feature-rich intuitive simplicity" (3-5 days)

### C1. Drillable contributor system
- contributor sheet primitive for zaps/reactions/reposts
- uniform compact->expanded pattern

### C2. Progressive disclosure
- keep base feed clean
- advanced NIP data in modal/drawer panels

### C3. Interaction grammar standardization
- one metric chip primitive
- one modal shell primitive
- no fake hover states

Deliverable: Apple-like surface clarity + Linux/Windows depth behind one click.

---

## sspodcast docs: highest-value features to port into NostrMaxi portal

## Priority 1 (immediate fit)
1. **Progressive disclosure architecture** (`user-journeys`, `frontend-architecture`)
   - exactly matches current UX direction.
2. **Plugin/adapter mindset** (`design-next-steps`)
   - map to relay adapters, syndication adapters, workflow adapters.
3. **Design principles + extension rules** (`design-next-steps`, `design-review`)
   - document once, enforce across feed/profile/discovery.

## Priority 2 (near-term feature value)
1. **Feed generation and filtering sophistication** (MVP/Phase docs)
2. **Workflow/event system discipline** (event-driven patterns from design docs)
3. **Structured API versioning and endpoint consistency**

## Priority 3 (later)
1. Syndication-heavy creator workflows
2. Marketplace/business surfaces not needed for immediate feed UX pass

---

## Gap Findings

1. **Primitive-code vs product-wire gap**
- primitives exist but are not yet deeply integrated into app modules and UI states.

2. **Design-system vs full-app consistency gap**
- feed has premium pass; rest of portal still mixed styling/interaction primitives.

3. **Documentation cohesion gap**
- some docs still speak as if separate products; merger decision says unified NostrMaxi platform.

---

## Concrete Next Sprint Scope (recommended)

### Sprint 1: Primitives foundation
- Add primitives module + service wiring
- Add tests around primitive outputs
- Add endpoints for WoT score + KB list/search + profile validation status

### Sprint 2: UX + drilldown integration
- Use new endpoints in feed/profile drilldowns
- Ship contributor sheet reusable component
- Standardize metric chip primitive across feed + profile

### Sprint 3: Discovery uplift from sspodcast inspiration
- advanced filter composer
- saved filter sets
- clearer creator/listener journeys in navigation

---

## Acceptance Criteria

1. External primitives are imported and used in production codepaths.
2. At least one UI flow each for profile/WoT/KB is live and drillable.
3. "Contributing data is drillable" rule is enforceable via component usage + review checklist.
4. Build + tests pass after each phase.

---

## Notes
- This plan intentionally avoids overbuilding; it targets visible user value while hardening domain foundations.
- Keep protocol depth and UX simplicity aligned: compact default, rich drilldown.
