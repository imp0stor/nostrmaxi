# Design Gap Review + Next Inspiration Pass (2026-03-01)

## North Star
**Primal feel, deeper core feature support, stronger NIP coverage, and richer interaction flows with intuitive simplicity.**

## What is strong now
- Compose-first feed layout is correct.
- Compact controls row keeps power features close without clutter.
- Orange terminal design direction is distinctive and premium.
- Markdown safety approach uses proven libraries (good call).

## Gaps to close next

### 1) Drillability consistency (P0)
**Rule:** if it has contributing data, it must be drillable.

Current gap patterns to audit:
- Stats shown as plain text without click path.
- Hover affordance on non-clickable wrappers.
- Contributor context hidden with no lightweight entry point.

Next actions:
- Add interaction audit checklist per feed card section.
- Add tiny drilldown affordance standards (avatar strip, count chip, chevron).
- Add keyboard parity for every drilldown target.

### 2) Zaps UX depth (P0)
Wanted pattern:
- Collapsed: zap count + tiny zapper avatars (top N).
- Expanded: modal/panel with total zaps, recent zappers, and drillable profiles/events.

Why:
- Zaps are social proof and contributor-backed data.
- This is core to "feature-rich, intuitively simple".

### 3) Information hierarchy polish (P1)
- Keep collapsed surface calm.
- Move advanced controls/details into contextual panels.
- Ensure every panel has one obvious primary action.

### 4) Visual language consistency (P1)
- Keep one icon grammar (stroke weight/size/radius) across all control contexts.
- Keep one elevation/glow system; avoid per-component custom shadows.
- Define a spacing rhythm scale and enforce it.

### 5) Interaction honesty + accessibility (P0)
- No decorative hover-only states.
- Every interactive affordance needs semantic role, focus ring, and aria label.
- Minimum contrast targets for all status/UI text.

### 6) NIP-facing UX readiness (P1)
- As NIP support expands, keep advanced protocol controls in layered UI (drawer/modal) not base feed clutter.
- Add progressive disclosure patterns for relay, identity proofs, and zap details.

## Inspiration constraints for next pass
- Premium dark SaaS quality: restrained effects, strong spacing, clear type hierarchy.
- Orange accent as signature (not over-saturated).
- Terminal cues for identity, sans-serif for readability.
- Replit-level polish, but product depth of Linux/Windows controls.

## Concrete backlog (design + implementation)
1. **Interaction Map v1**: document every card element and its drilldown target.
2. **Zap Card Module**: avatar strip + count + drilldown modal.
3. **Contributor Sheet Component**: reusable panel for zaps/reposts/reactions.
4. **Clickable Metrics Standard**: common metric chip component with keyboard support.
5. **Hover Lint Rule**: no hover styles on non-interactive class names.
6. **Design QA Pass**: before/after screenshots + accessibility spot check.

## Acceptance criteria for next update
- 0 fake hovers on non-interactive elements.
- 100% contributor-backed UI elements drillable.
- Zap module shipped in compact + expanded forms.
- Accessibility checks pass for new interactive controls.
- Design consistency check passes against orange-terminal tokens and icon rules.
