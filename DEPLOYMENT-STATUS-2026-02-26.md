# DEPLOYMENT STATUS — 2026-02-26

Project: `/home/owner/strangesignal/projects/nostrmaxi-canonical`
Operator: `neo@10.1.10.143`
Live app: `http://10.1.10.143:3401`

## Scope deployed
Included all requested pending frontend features plus pre-deploy quoted-note OP metadata fix:
1. Feed modes (Firehose / Following / WoT / High Signal) + infinite scroll
2. Profile followers/following expandable panels
3. Discover fixes (For You/WoT distinct ranking + follower counts)
4. Rich inline rendering (quotes/images/links/audio)
5. Spotify embeds
6. NIP-05 root domain fix (verified still present)
7. Wavlake audio embeds
8. **Quoted note card OP metadata fix (added now)**
   - profile picture
   - display name / NIP-05 identity
   - timestamp

## Pre-deploy quoted note fix added
Updated file:
- `frontend/src/components/QuotedEventCard.tsx`

What changed:
- Added profile resolution using `fetchProfileCached(event.pubkey)` when profile prop is absent.
- Added OP avatar rendering via `Avatar` component.
- Added identity metadata rendering (display name / NIP-05 fallback handling) plus timestamp in quote header.

## Verification before deploy
Executed locally from repo root:
- `npm test -- --runInBand` ✅
  - **28/28 suites passed, 128/128 tests passed**
- `npm run build` ✅
- `npm run build:frontend` ✅

## Deployment actions performed
1. Synced repo to Operator:
   - local: `/home/owner/strangesignal/projects/nostrmaxi-canonical/`
   - remote: `/home/neo/strangesignal/projects/nostrmaxi-canonical/`
   - command: `rsync -az --delete ...`
2. Built frontend on Operator:
   - `cd /home/neo/strangesignal/projects/nostrmaxi-canonical && npm run build:frontend` ✅
3. Restarted frontend service:
   - `sudo systemctl restart nostrmaxi-frontend.service` ✅
4. Verified service + listener:
   - `systemctl is-active nostrmaxi-frontend.service` → `active`
   - `ss -ltnp | grep :3402` → node listener present
5. Verified live gateway serves fresh bundle:
   - `curl -s http://127.0.0.1:3401 | grep -o 'index-*.js'` → `index-5DkMXird.js`

## Screenshot evidence paths
### Live/operator evidence
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/rework-2026-02-26/operator-home-3401.png`
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/feed-modes-infinite-scroll.png`
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/profile-followers-panel-2026-02-26.png`
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/rich-inline-render-2026-02-26.png`
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/audio-embed-wavlake-2026-02-26.png`

### Spotify embed evidence
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/docs/screenshots/spotify-inline.png`

## Notes
- NIP-05 root-domain normalization fix remains included in deployed frontend profile resolution path.
- Quoted/embedded note OP metadata patch is now part of deployed bundle (`index-5DkMXird.js`).
