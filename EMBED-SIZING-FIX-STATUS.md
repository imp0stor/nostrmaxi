# EMBED SIZING FIX STATUS

Date: 2026-02-27
Project: `/home/owner/strangesignal/projects/nostrmaxi-canonical`
Operator: `neo@10.1.10.143`

## ✅ Completed

Implemented responsive/constrained embed sizing across all embed components and nested quoted-note rendering.

### 1) Standard embed dimensions
- **Audio embeds (Spotify/Wavlake/SoundCloud/etc.)**
  - Compact: **152px**
  - Expanded: **232px max**
- **Video embeds (YouTube/Vimeo/platform video)**
  - **16:9 aspect ratio** via `aspect-video`
  - Width constrained with `max-w-4xl`
- **Social embeds (Twitter/X)**
  - Card bounded with max-height behavior (`image max-h`, content max-h, total card constrained)
- **Generic iframe embeds**
  - Provider-aware defaults in `PlatformIframeEmbed`

### 2) Responsive behavior
- Embeds now use full container width with max-width constraints:
  - Audio: `max-w-3xl`
  - Video: `max-w-4xl`
- Mobile-friendly width behavior retained (`w-full` everywhere)
- Audio uses fixed height caps; video uses aspect-ratio

### 3) Consistent styling / dark integration / loading states
- Unified rounded corners to `rounded-lg`
- Consistent dark backgrounds and borders
- Added subtle loading pulse layers (`animate-pulse`) to iframe containers
- Standardized spacing and header/action patterns for platform cards

### 4) Components fixed
- `frontend/src/components/SpotifyEmbedCard.tsx`
- `frontend/src/components/WavlakeEmbedCard.tsx`
- `frontend/src/components/YouTubeEmbed.tsx`
- `frontend/src/components/VimeoEmbed.tsx`
- `frontend/src/components/TwitterEmbed.tsx`
- `frontend/src/components/PlatformIframeEmbed.tsx`
- `frontend/src/components/RichMedia.tsx` (compact propagation + platform iframe compact sizing)
- `frontend/src/components/QuotedEventCard.tsx` (passes compact mode into nested rich media)

### 5) Quoted note embeds / nested sizing
- `RichMedia` now accepts `compact?: boolean`
- `QuotedEventCard` passes `compact={compact}` into nested `RichMedia`
- Nested Spotify/Wavlake/platform iframe embeds now render in compact-constrained mode for quoted notes

## Tests

### Ran
- `npm test -- --runInBand` ✅
  - Result: **37 passed, 0 failed**
  - Includes new regression coverage:
    - `src/__tests__/embed-sizing.test.ts`

### Notes
- Root backend build (`npm run build`) has an existing unrelated TypeScript error in `src/ecosystem-catalog/ecosystem-catalog.seed.ts` (unterminated string / missing properties) that predates this embed patch.
- Operator frontend build is green and deployed (see below).

## Deploy to operator

Executed:
1. `rsync -az --delete --exclude node_modules --exclude .git ... neo@10.1.10.143:/home/neo/strangesignal/projects/nostrmaxi-canonical/`
2. `ssh neo@10.1.10.143 'cd /home/neo/strangesignal/projects/nostrmaxi-canonical && npm run build:frontend'` ✅
3. `ssh neo@10.1.10.143 'sudo systemctl restart nostrmaxi-frontend.service && systemctl is-active nostrmaxi-frontend.service'` → `active`

## Screenshot evidence

- Operator live page capture:
  - `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/embed-sizing-operator-home-2026-02-27.png`
- Sizing constraint proof sheet:
  - `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/embed-sizing-fix-showcase-2026-02-27.png`
  - Source HTML:
    - `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/embed-sizing-fix-showcase-2026-02-27.html`

## Outcome

✅ Embed rendering is now constrained, responsive, and consistent across audio/video/social/generic platform embeds, including nested quoted-note embeds.
