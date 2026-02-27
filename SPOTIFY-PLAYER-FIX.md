# Spotify Player Fix (Actual iframe players, not fallback cards)

Date: 2026-02-26
Project: `/home/owner/strangesignal/projects/nostrmaxi-canonical`
Operator: `neo@10.1.10.143`

## Issue
Spotify URLs were rendering as generic **"Audio Clip"** cards with **"Open link"** instead of Spotify iframe players.

## Root cause
The Spotify branch existed in `InlineContent`, but quoted/embedded-note rendering path uses `RichMedia`, and `RichMedia` did **not** have Spotify-specific handling. So Spotify audio in that path fell into generic audio card rendering.

## What I changed

### 1) Ensure Spotify component is used in all audio rendering paths
- Updated `frontend/src/components/RichMedia.tsx`
  - Added `SpotifyEmbedCard` import
  - Added `audio.provider === 'spotify'` branch
  - Renders `<SpotifyEmbedCard ... />` instead of generic audio card

### 2) Harden Spotify URL parsing
- Updated `frontend/src/lib/media.ts`
  - Still emits embed URLs in required format:  
    `https://open.spotify.com/embed/{type}/{id}`
  - Added parsing support for Spotify URL variants:
    - `https://open.spotify.com/intl-xx/{type}/{id}`
    - `https://open.spotify.com/embed/{type}/{id}`

### 3) CSP / iframe policy allowance
- Updated `nginx/nginx.conf`
  - Added `frame-src` entries including Spotify:
    - `https://open.spotify.com`
  - Also explicitly kept YouTube/Vimeo iframe sources

### 4) Tests
- Updated `src/__tests__/inline-audio-rendering.test.ts`
  - Added assertion that `RichMedia` routes Spotify to `SpotifyEmbedCard`
- Updated `src/__tests__/media-parsing.test.ts`
  - Added test for locale/embed Spotify URL variants

## Verification

### Local
- `npm test -- --runInBand` ✅ (28/28 suites passed, 130/130 tests)
- `npm run build` ✅

### Deploy to operator
Executed:
1. `rsync -az --delete ... neo@10.1.10.143:/home/neo/strangesignal/projects/nostrmaxi-canonical/`
2. `ssh neo@10.1.10.143 'cd /home/neo/strangesignal/projects/nostrmaxi-canonical && npm run build:frontend'` ✅
3. `ssh neo@10.1.10.143 'sudo systemctl restart nostrmaxi-frontend.service && systemctl is-active nostrmaxi-frontend.service'` → `active`

## Screenshot proof (actual Spotify iframe player)
- `ui-evidence/spotify-player-iframe-proof-2026-02-26.png`

## Files changed
- `frontend/src/components/RichMedia.tsx`
- `frontend/src/lib/media.ts`
- `nginx/nginx.conf`
- `src/__tests__/inline-audio-rendering.test.ts`
- `src/__tests__/media-parsing.test.ts`
- `SPOTIFY-PLAYER-FIX.md`
