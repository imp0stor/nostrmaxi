# Staging Deployment Checklist (NostrMaxi)

## Pre-deploy
- [ ] Pull latest code
- [ ] Install dependencies (`npm install`, `frontend npm install`)
- [ ] `npm run build`
- [ ] `npm test -- --runInBand`
- [ ] `npm run build:frontend`

## Database
- [ ] Apply schema updates (`npx prisma db push` or migration deploy)
- [ ] Confirm new columns exist (`User.email`, `User.emailVerifiedAt`)

## Deploy
- [ ] Bring stack up with explicit env file:
  - `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`
- [ ] Verify backend container healthy
- [ ] Verify nginx healthy/restarted

## Post-deploy validation
- [ ] `GET /health` returns OK
- [ ] `GET /api/v1/nip05/domains` returns catalog
- [ ] Authenticated `GET /api/v1/auth/email/status` returns fields
- [ ] Authenticated `POST /api/v1/auth/email/request` returns sent=true
- [ ] Authenticated `POST /api/v1/auth/email/verify` verifies code
- [ ] `POST /api/v1/payments/invoice` blocks until email verified
- [ ] Domain TXT verification succeeds for valid record

## Known environment caveat
- Port `10.1.10.143:3001` is currently occupied by `beacon-search-backend`.
- NostrMaxi production stack is deployed via `docker-compose.prod.yml` with internal backend + nginx router.
