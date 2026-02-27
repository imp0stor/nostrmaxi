# Rich media parity verification (Sprint 2)

Validated against current `InlineContent` rendering pipeline used by feed cards in `FeedPage.tsx`.

## Works

- **Images (jpg/png/webp)**: inline render with responsive sizing + lightbox expansion.
- **GIFs**: rendered as image tokens with GIF badge and lightbox support.
- **Direct videos** (`.mp4`, etc): native HTML5 video player with controls.
- **YouTube/Vimeo links**: rendered via provider embed components.
- **Twitter/X links**: rendered via Twitter embed component.
- **Generic links**: rendered via `LinkPreviewCard` with `/api/v1/unfurl` preview fallback.
- **GitHub repo links**: rendered via GitHub repo card.

## Known limitations

- Some third-party providers may block embedding via CSP/X-Frame-Options (falls back to open-link behavior where available).
- Link preview quality depends on `/api/v1/unfurl` metadata response quality/reachability.

## Sprint 2 feed UX adjustments

- Added feed-level filters: Media only, Text only, Replies, Reposts, With links.
- Filters are persisted in `localStorage` key: `nostrmaxi.feed.content-filters`.
- Kept content-type badges in post cards for media parity visibility.
