# Feed UX Declutter — Zap/WoT/Contributors (2026-03-01)

## Before
- Feed cards used a prominent full-width bordered zap strip even when there were no zaps.
- Empty contribution states added visual weight (`No zappers yet`) in a loud orange container.
- Metadata/action hierarchy competed visually with post content due to similar chip prominence.
- Chip sizing and spacing varied between signal chips and action chips.

## After
- Replaced the loud full-width zap strip with a compact inline signal row.
- Empty states now collapse into a subtle icon/text hint (`⚡ No zaps or contributors yet`) with low contrast.
- Hierarchy is clearer: post content remains primary, signal metadata is secondary, action row is tertiary.
- Signal/action chips now use normalized compact sizing and restrained orange accents (lower glow/contrast).
- Drilldowns remain intact:
  - Zap details open from the zap chip when zaps exist.
  - Contributor details remain clickable via `Contributors` chip.
  - Relay hints remain interactive.
- Focus-visible accessibility rings were preserved on all interactive affordances.
