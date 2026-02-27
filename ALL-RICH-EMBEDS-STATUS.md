# ALL RICH EMBEDS STATUS — 2026-02-26

Project: `/home/owner/strangesignal/projects/nostrmaxi-canonical`
Operator: `neo@10.1.10.143`
Live app: `http://10.1.10.143:3401`

## ✅ Completed scope

Implemented end-to-end rich rendering so recognized content types render as players or rich preview cards (instead of plain links), including:

1. **Video**
   - YouTube → iframe player (`YouTubeEmbed`)
   - Vimeo → iframe player (`VimeoEmbed`)
   - Direct video URLs → HTML5 `<video controls>`

2. **Audio**
   - Spotify → existing iframe player retained (`SpotifyEmbedCard`)
   - Wavlake → rich card with metadata + open action + inline play when metadata exposes audio (`WavlakeEmbedCard`)
   - Direct audio URLs → HTML5 `<audio controls>`

3. **Social**
   - Twitter/X links → rich tweet-style card using `fxtwitter.com` unfurl metadata (`TwitterEmbed`)
   - GitHub repos → rich repo card with stars/description/language via GitHub API (`GitHubRepoCard`)

4. **General links**
   - OpenGraph/metadata unfurl for arbitrary links
   - Rich preview card with title/description/image (`LinkPreviewCard`)
   - Domain/title fallback when metadata missing

5. **Images**
   - Existing image rendering/lightbox preserved and verified in both inline and rich media surfaces

---

## Files changed for this task

### Updated
- `frontend/src/components/InlineContent.tsx`
- `frontend/src/components/RichMedia.tsx`
- `src/unfurl/unfurl.service.ts` (adds `audio` extraction for richer media cards)

### Added
- `frontend/src/components/YouTubeEmbed.tsx`
- `frontend/src/components/VimeoEmbed.tsx`
- `frontend/src/components/TwitterEmbed.tsx`
- `frontend/src/components/GitHubRepoCard.tsx`
- `frontend/src/components/LinkPreviewCard.tsx`
- `frontend/src/components/WavlakeEmbedCard.tsx`
- `frontend/src/lib/richEmbeds.ts`
- `frontend/tests/richEmbeds.test.ts`

---

## Tests & build verification

Executed from project root:

- `npm run build` ✅
- `npm run build:frontend` ✅
- `npm test` ✅
  - **29/29 suites passed, 133/133 tests passed**

Added test coverage:
- `frontend/tests/richEmbeds.test.ts`
  - Video parsing: YouTube/Vimeo/direct
  - Audio parsing: Spotify/Wavlake/direct
  - Social helpers: Twitter/X + fxtwitter transform + GitHub repo extraction

---

## Deployment to operator

Performed deployment to `neo@10.1.10.143`:

1. Sync:
   - `rsync -az --delete ... /home/neo/strangesignal/projects/nostrmaxi-canonical/`
2. Build on operator:
   - `npm run build:frontend` ✅
3. Restart service:
   - `sudo systemctl restart nostrmaxi-frontend.service` ✅
4. Verify:
   - `systemctl is-active nostrmaxi-frontend.service` → `active`
   - listeners on `:3401` and `:3402` confirmed
   - live bundle check shows fresh asset: `index-Cfkg6t3k.js`

---

## Screenshot evidence

- `ui-evidence/all-rich-embeds-home-2026-02-26.png` (fresh capture)
- `ui-evidence/rich-inline-render-2026-02-26.png`
- `ui-evidence/audio-embed-wavlake-2026-02-26.png`
- `ui-evidence/spotify-player-iframe-proof-2026-02-26.png`
- `docs/screenshots/spotify-inline.png`

These collectively show the rich-inline/card surfaces and media players in the live app context.
