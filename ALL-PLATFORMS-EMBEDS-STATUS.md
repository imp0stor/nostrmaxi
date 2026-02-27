# ALL-PLATFORMS-EMBEDS-STATUS

Date: 2026-02-26
Project: `/home/owner/strangesignal/projects/nostrmaxi-canonical`
Operator: `neo@10.1.10.143`

## Completed

Implemented broad embed parsing + rendering upgrades across major platforms with dark-theme iframe UX and fallback behavior.

### 1) Media parser upgrades (`frontend/src/lib/media.ts`)

Added/expanded URL parsing for:

- **Audio/music**
  - Wavlake (`wavlake.com/track/...`) → canonical URL + `embed.wavlake.com/track/...`
  - SoundCloud (`soundcloud.com/...`) → `https://w.soundcloud.com/player/...`
  - Apple Music (`music.apple.com/...`) → `https://embed.music.apple.com...`
  - Bandcamp (`*.bandcamp.com/track|album/...`) → `.../EmbeddedPlayer/...`
  - Mixcloud (`mixcloud.com/...`) → `https://www.mixcloud.com/widget/iframe/...`
  - Spotify (existing) preserved

- **Video/social**
  - YouTube + YouTube Music hosts
  - Vimeo
  - Twitch (clips + videos)
  - Rumble
  - Odysee/LBRY
  - Instagram (post/reel embed URL)
  - TikTok (v2 embed URL)
  - Direct video files fallback

### 2) Unified embed component

Added:
- `frontend/src/components/PlatformIframeEmbed.tsx`

Used as shared iframe renderer for non-YouTube/Vimeo providers and non-Spotify audio embeds.

### 3) UI wiring

Updated:
- `frontend/src/components/InlineContent.tsx`
- `frontend/src/components/RichMedia.tsx`
- `frontend/src/components/WavlakeEmbedCard.tsx`
- `frontend/src/lib/quotedMedia.ts`

Behavior:
- Official iframe player used where available.
- Wavlake upgraded to iframe player first, with metadata/audio fallback retained.
- Dark theme + consistent card/iframe frame style maintained.

### 4) CSP allowlist updates

Updated `src/main.ts` `helmet` CSP `frameSrc` to allow required embed domains:
- youtube, vimeo, twitch/clips, rumble, odysee
- instagram, tiktok
- soundcloud, apple music, bandcamp, mixcloud
- wavlake embed, spotify

### 5) Tests

Updated/added assertions:
- `src/__tests__/media-parsing.test.ts`
- `src/__tests__/inline-audio-rendering.test.ts`

Validation run:
- `npm test` ✅ (29 suites, 135 tests passing)
- `npm run build` ✅

## Deployment

Performed deploy to operator:

1. Synced project:
```bash
rsync -az --delete --exclude node_modules --exclude .git /home/owner/strangesignal/projects/nostrmaxi-canonical/ neo@10.1.10.143:/home/neo/strangesignal/projects/nostrmaxi-canonical/
```

2. Built on operator:
```bash
ssh neo@10.1.10.143 'cd /home/neo/strangesignal/projects/nostrmaxi-canonical && npm run build && npm run build:frontend'
```

3. Service restart:
- `nostrmaxi-frontend.service` restarted and active ✅
- `nostrmaxi.service` not present on host (unit not found) — frontend service is active.

## Screenshot evidence

Generated:
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/all-platform-embeds-2026-02-26-showcase.png`
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/all-platform-embeds-2026-02-26-operator-home.png`

Supporting page used for multi-provider iframe evidence:
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/all-platform-embeds-2026-02-26-showcase.html`

## Changed files (this task)

- `frontend/src/lib/media.ts`
- `frontend/src/components/PlatformIframeEmbed.tsx` (new)
- `frontend/src/components/InlineContent.tsx`
- `frontend/src/components/RichMedia.tsx`
- `frontend/src/components/WavlakeEmbedCard.tsx`
- `frontend/src/lib/quotedMedia.ts`
- `src/main.ts`
- `src/__tests__/media-parsing.test.ts`
- `src/__tests__/inline-audio-rendering.test.ts`
- `ALL-PLATFORMS-EMBEDS-STATUS.md` (new)
