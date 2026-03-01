# DESIGN SYSTEM: ORANGE TERMINAL PREMIUM (Feed + Composer)

## Goals
- Dark premium product feel with restrained glow and strong spacing rhythm.
- Orange accent system (not neon overload).
- Monospaced terminal cues for technical identity, while preserving readability.
- Cohesive icon language with custom SVGs for core controls.
- No fake affordances: hover only on truly interactive elements.

## Token System
Defined in `frontend/src/index.css`:
- `--sf-bg`, `--sf-bg-secondary`, `--sf-panel-soft` for layered dark surfaces.
- `--sf-accent`: primary orange.
- `--sf-accent-2`: secondary orange.
- `--sf-accent-strong`: strong action state.
- `--sf-accent-soft`: glow/tint overlays.
- `--sf-accent-border`: borders/focus rings.
- `--sf-text`, `--sf-muted` for high contrast typography hierarchy.

## Typography Rules
- Base body: `IBM Plex Sans`/Inter stack for readability.
- Terminal UI labels, kickers, code/markdown blocks: JetBrains Mono/Fira Code stack.
- Keep paragraph line-height >= 1.5.
- Keep small utility text high-contrast (avoid low alpha on important state labels).

## Icon System
### Base vector style
- Single-stroke outline system.
- Optical size: 20x20.
- Stroke width: ~1.75.
- Rounded joins/caps.

### Custom core icon pack
Located in `frontend/src/assets/icons/`:
- `compose-custom.svg`
- `mute-config-custom.svg`
- `filters-custom.svg`
- `relay-custom.svg`

### Utility base icon
- `refresh-base.svg`

### Usage rules
- Primary controls must use vector icons (SVG), not raster/AI images.
- Keep icon + label pills compact and consistent.

## Component Patterns
- `nm-pill`: compact bordered pill CTA, keyboard-focusable.
- `nm-pill-primary`: stronger primary action style.
- `nm-toolbar`: control row surface rhythm.
- `nm-surface`: premium textured section shell.
- `nm-media-card`: polished media preview shell with interactive target.
- `nm-markdown`: monospaced markdown heading/code treatment with safe sanitizer pipeline.

## Interaction & Accessibility Rules
- Any hover state must map to real interaction target (button/link).
- Non-interactive surfaces should not advertise hover affordance.
- **Contributing Data Rule:** if an element displays contributor-backed data (zaps, reposts, reactions, relay/source indicators, participant avatars), it must be drillable.
- Keep collapsed summaries compact; details live in drilldown modals/panels.
- Use `:focus-visible` rings on all interactive controls.
- Keep semantic elements correct: links for navigation, buttons for actions.
- Provide aria-labels for icon+pill actions and media/relay drilldowns.

## Feed/Composer UX Decisions
- Composer remains at top and now uses premium spacing and section rhythm.
- Social control row remains under composer with compact premium pills.
- Mute/content/relay open modal workflows (hierarchy preserved, visual upgraded).
- Composer media previews are drillable (open in new tab) and removable with explicit action.
- Relay status chips are drillable and open relay management context.
- Contributor summaries should use "feature-rich, intuitively simple" pattern:
  - collapsed = tiny avatars + concise counts
  - expanded = full drilldown (profiles, events, linked entities)
  - no dead-end summary stats.
- Zap module pattern (mandatory on feed cards):
  - collapsed card row shows top zapper avatars (3-6 max) + aggregate zap indicator.
  - entire zap row is one drill target (click/Enter/Space) opening zap details.
  - drilldown includes total sats, total zaps, recent zappers list, and profile links for each zapper.
  - keep module visually lightweight so content body remains dominant.

## Safety & Markdown
- Markdown rendering continues via `react-markdown + remark-gfm + rehype-sanitize`.
- URL protocol allowlist remains (`https`, `http`, `mailto`).

## Future Follow-Ups
1. Centralize mode-chip and state-pill variants into a dedicated component module.
2. Add reduced-motion token variants for motion-sensitive users.
3. Introduce icon linting/checklist to keep stroke/size consistency on additions.
