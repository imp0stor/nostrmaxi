# Primal-like Composer UX Overhaul — 2026-02-28

## What changed

- Moved feed composer to the top of `FeedPage` so posting happens before timeline browsing.
- Added a compact **social controls row** between composer and feed:
  - **Mute (🔧)** opens a mute modal with direct jump to Settings mute manager.
  - **Content Filters (🧰)** opens a modal containing:
    - Existing feed content filter chips (media/text/replies/reposts/links)
    - Feed tag filtering controls (migrated from inline `FilterBar`)
    - AND/OR tag match logic
  - **Relay Status (📡)** opens relay management modal with:
    - Current connected relays
    - Remove relay action
    - Manual relay input (`wss://...`)
    - Suggested relay chips loaded from `/api/relays/suggestions` + defaults
    - Local persistence (`nostrmaxi_connected_relays`) and best-effort kind:10002 publish

## Composer media UX

- Blossom uploads now append to structured `composerMedia` state instead of injecting raw URLs into textarea.
- Added inline attachment previews in composer:
  - image preview cards
  - video inline playback preview
  - audio inline player
  - fallback URL card for unknown media
- Publish pipeline appends attachment URLs to outgoing kind-1 content while keeping the compose surface clean.

## Markdown safety

- Continued using mature markdown stack: `react-markdown` + `remark-gfm` + `rehype-sanitize`.
- Tightened link safety in markdown rendering:
  - `rel="noopener noreferrer nofollow"`
  - URL transform allows only `http:`, `https:`, and `mailto:`.

## UX notes

- Layout now follows a Primal-like flow: compose first, compact controls second, feed third.
- Removed always-visible tag filter bar in favor of a cleaner modal-driven filter workflow.

## Migration/deploy notes

- No DB migration required.
- Relay modal persists to existing browser localStorage key and emits standard kind:10002 relay list events when signing is available.
- Safe to deploy as frontend-only UX behavior change.
