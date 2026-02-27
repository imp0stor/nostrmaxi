# AUDIO EMBED STATUS — 2026-02-26

## Scope completed
Implemented robust audio embed handling for inline note rendering, including Wavlake track URLs, across Feed/Profile pipelines and quoted notes.

## What was changed

### 1) Media parser/tokenizer: Wavlake + direct audio detection
**File:** `frontend/src/lib/media.ts`
- Added `audios` to `ParsedMedia`.
- Extended `AudioRef` with provider metadata (`provider`, `trackId`, `sourceUrl`).
- Added provider-specific `toAudioRef()` logic:
  - Detects direct audio files (`.mp3`, `.wav`, etc.) as `provider: direct`.
  - Detects Wavlake track URLs (`https://wavlake.com/track/<id>`) as `provider: wavlake` with normalized canonical track URL.
- Updated `classifyUrl()` to emit `audio` token when recognized.
- Ensured inline token parsing consumes recognized URLs and does not leave duplicate raw URL text.
- Included audio in parsed aggregates (`parsed.audios`) for downstream renderers.

### 2) Inline renderer: audio card + metadata fallback behavior
**File:** `frontend/src/components/InlineContent.tsx`
- Added audio-aware preview fetching targets (for both `link` and `audio` token source URLs).
- Reworked `audio` token rendering into an inline card:
  - Shows provider/domain/title context.
  - Always includes **Open link** action.
  - Uses `<audio controls>` when playable source is available:
    - direct audio URL => playable immediately.
    - provider URL with metadata audio => playable when available.
  - Fallback message if metadata/playable source unavailable:
    - `Inline playback unavailable; open the source link to play.`

### 3) Quoted/nested note audio rendering
**Files:**
- `frontend/src/lib/quotedMedia.ts`
- `frontend/src/components/QuotedEventCard.tsx`
- `frontend/src/components/RichMedia.tsx`

Changes:
- `quotedRenderModel()` now carries `audios` from parser output.
- `QuotedEventCard` now renders media when audio exists.
- `RichMedia` now supports `audios` rendering with the same playback/fallback card behavior.

This ensures quoted/nested notes render audio embeds (including Wavlake) rather than raw URL-only text.

## Tests added/updated

### Parser test (Wavlake tokenization)
**File:** `src/__tests__/media-parsing.test.ts`
- Added: `detects wavlake track URLs as audio tokens`
- Verifies:
  - token type = `audio`
  - `provider = wavlake`
  - correct `trackId`
  - raw URL removed from output text path

### Renderer test (inline audio component contract)
**File:** `src/__tests__/inline-audio-rendering.test.ts`
- Added source-contract test confirming `InlineContent` includes:
  - `token.type === 'audio'` branch
  - `Open link` action
  - fallback text for non-playable metadata failures

### Quoted note audio render test
**File:** `src/__tests__/quoted-media-rendering.test.ts`
- Added: `renders wavlake audio metadata model for quoted notes`
- Verifies quoted media model includes audio token/provider and no duplicate raw URL text.

## Verification output

### Build
```bash
npm run build
> nostrmaxi@1.0.0 build
> nest build
```
Result: ✅ success

### Tests
```bash
npm test
Test Suites: 22 passed, 22 total
Tests:       108 passed, 108 total
```
Result: ✅ all passing

## Evidence screenshot
- `ui-evidence/audio-embed-wavlake-2026-02-26.png`

## Files changed for this task
- `frontend/src/lib/media.ts`
- `frontend/src/components/InlineContent.tsx`
- `frontend/src/lib/quotedMedia.ts`
- `frontend/src/components/QuotedEventCard.tsx`
- `frontend/src/components/RichMedia.tsx`
- `src/__tests__/media-parsing.test.ts`
- `src/__tests__/inline-audio-rendering.test.ts`
- `src/__tests__/quoted-media-rendering.test.ts`
- `ui-evidence/audio-embed-wavlake-2026-02-26.png`
