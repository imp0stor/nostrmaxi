# NostrMaxi Premium UX Runbook (Dark / Orange / Terminal)

_Last updated: 2026-03-01_

## Visual System

- **Core identity:** dark cinematic surfaces + orange signal accent + monospaced telemetry details.
- **Primary accent:** `--sf-accent` (`#f97316`) and `--sf-accent-2` (`#fb923c`).
- **Typography:**
  - UI/body: `IBM Plex Sans`.
  - Technical/identity/chips: `JetBrains Mono` (`.cy-mono`, `.nm-terminal`).
- **Spacing rhythm:** 4/8/12/16/24 scale, with page shells using `.nm-page` and cards in stacked sections.

## Shared Shell Conventions

- Layout shell uses **fixed left sidebar + sticky topbar**.
- Sidebar iconography must be consistent and compact (two-letter mono tags) to avoid emoji style drift.
- Active nav state must use `aria-current="page"` + visual active class.
- Topbar brand keeps terminal style (`>_`) to reinforce product identity.

## Components and Depth

- Surfaces:
  - `cy-card`: primary elevated surface.
  - `cy-panel`: secondary inset surface.
  - `nm-card-interactive`: only for truly clickable cards (honest affordance).
- Hover depth only on actionable elements:
  - Slight lift (`translateY(-1px)`) + border/glow increase.
  - Static chips use `.cy-chip-static` (no hover affordance).

## Interactions + Accessibility

- Global keyboard focus uses high-contrast orange ring (`:focus-visible`), no hidden focus.
- Add `.nm-kbd-focus` to custom clickable wrappers and links when needed.
- Motion safety:
  - `prefers-reduced-motion: reduce` disables non-essential animation/transitions.
- Hover effects must map to click/tap behavior (no decorative pseudo-interaction).

## Targeted Page Guidance

- **Feed:** event cards are interactive depth surfaces; toolbars/chips follow orange active state.
- **Discover:** filters and tabs keep compact control hierarchy; no fake hover on non-actions.
- **Profile:** metrics and social actions grouped in clear action zones.
- **Notifications:** unread/read distinction uses border strength, not only color hue.
- **Bookmarks:** tabbed private/pinned/public sections; consistent chip behavior.
- **Messages:** left thread rail + right conversation panel with clear selected state and focus states.

## Performance Guardrails

- Avoid one-off utility explosions; prefer existing shared classes in `index.css`.
- No heavy animated gradients on large scroll regions.
- Keep transition durations <= 180ms for responsiveness.

## Implementation Checklist

1. Use shared classes before introducing new per-page custom CSS.
2. Verify every hover state corresponds to real action.
3. Verify keyboard navigation (tab order + visible focus rings) on Feed/Discover/Profile/Messages.
4. Validate reduced-motion mode.
5. Run `npm test` and `npm run build` after UI changes.
