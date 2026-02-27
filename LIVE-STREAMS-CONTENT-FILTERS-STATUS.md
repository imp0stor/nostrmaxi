# Live Streams + Content Filters Status

## Scope completed
Implemented **live stream support (NIP-53 kind 30311)** and **content type filtering UX** in the NostrMaxi frontend.

## What was added

### 1) Live stream support (NIP-53)
- Added live stream metadata extraction for kind `30311` events:
  - status (`live` / `ended` / `planned`)
  - title / summary
  - current + total participants (viewer counts)
  - thumbnail image
  - stream URL
  - recording URL
  - chat URL
  - streamer identity
- Added new UI component: `frontend/src/components/LiveStreamCard.tsx`
  - live/ended/planned status pill
  - viewer count display
  - stream info and thumbnail
  - player integration:
    - direct playback for HLS/direct media links where browser can play
    - iframe embed for provider streams (YouTube/Twitch/Owncast/etc. via URL)
  - live chat link integration
- Added “followed streamers went live” notifications in feed:
  - detects followed authors posting live status events
  - deduplicates using localStorage
  - in-app alert card + browser Notification API support

### 2) Content type filtering
- Replaced narrow media-only filters with full content-type model in feed:
  - Text posts
  - Images/photos
  - Videos
  - Audio/music
  - Live streams
  - Long-form articles
  - Events
  - Polls
  - Links/shares
- Filter UX improvements:
  - multi-select chips
  - active filter visual state
  - active filter summary text
  - per-filter counts
  - clear/reset action
- Persisted filter preferences in localStorage (`nostrmaxi.feed.content-filters`).

### 3) Content type detection
- Added `frontend/src/lib/contentTypes.ts` with automatic classification by:
  - event kind (e.g. live, longform, events)
  - media attachments/tokens (image/video/audio/link)
  - content/tag patterns (poll heuristics)
- Added content-type badges on posts in feed cards.

### 4) Discover filtering enhancements
- Added quick content filter toggles to Discover “Posts” tab.
- Added content-type badges for discover network posts.

## Files changed
- `frontend/src/lib/contentTypes.ts` (new)
- `frontend/src/components/LiveStreamCard.tsx` (new)
- `frontend/src/pages/FeedPage.tsx`
- `frontend/src/pages/DiscoverPage.tsx`

## Validation
- ✅ `npm run build` (frontend) passed successfully.
- ⚠️ `npm test` (frontend) is not configured in this package (`Missing script: test`).

## Deploy
- Code-level implementation completed.
- Deployment step was not executed in this run (no deploy command invoked in this task context).
