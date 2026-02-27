# Relay Sync Activation Status

**Date**: 2026-02-27  
**Status**: ⏳ **Ready, awaiting proper deployment**

---

## What's Done ✅

### 1. Local Relay Running
- **Container**: `strangesignal-relay` (scsibug/nostr-rs-relay)
- **Port**: :7777
- **Uptime**: 3 days
- **Data**: `/home/neo/nostr-relay-data`

### 2. Code Deployed
- RelaySyncService, Controller, Module: ✅ Built in `dist/src/relay-sync/`
- Code copied into container: ✅ `/app/dist/src/relay-sync/`
- app.module.js updated: ✅ RelaySyncModule in imports

### 3. Configuration Added
Environment variables added to `~/nostrmaxi-production/.env`:
```env
RELAY_SYNC_ENABLED=true
LOCAL_RELAY_URL=ws://10.1.10.143:7777
RELAY_SYNC_SOURCES=wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net
RELAY_SYNC_INTERVAL_MS=300000
RELAY_SYNC_STRATEGY=wot
RELAY_SYNC_WOT_PUBKEYS=9fdd0d57238ba01f8c04199ca3c0174fa17c19d28e9de610b9db22729e57310e
RELAY_SYNC_SINCE_DAYS=30
```

---

## What's Blocking 🚧

**Docker environment reload issue**: Running container doesn't have new environment variables. Docker containers only load `.env` at creation time, not on restart.

**Attempted fixes**:
- ✅ Copied relay-sync code into running container
- ✅ Added .env configuration
- ❌ Docker restart → env not reloaded
- ❌ Docker recreate → Redis networking issues

---

## Solution: Proper Redeploy

### Option A: Full Stack Restart (Recommended)
```bash
ssh neo@10.1.10.143
cd ~/nostrmaxi-production

# Stop all services
docker compose down

# Rebuild backend with new code
docker compose build app

# Start everything
docker compose up -d

# Verify
docker compose logs app | grep RelaySyncService
```

### Option B: Manual Environment Injection
```bash
ssh neo@10.1.10.143

# Create new container with environment
docker run -d --name nostrmaxi-backend-relay-enabled \
  --network nostrmaxi-production_default \
  --env-file ~/nostrmaxi-production/.env \
  -e RELAY_SYNC_ENABLED=true \
  -e LOCAL_RELAY_URL=ws://10.1.10.143:7777 \
  -e RELAY_SYNC_SOURCES="wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net" \
  -e RELAY_SYNC_INTERVAL_MS=300000 \
  -e RELAY_SYNC_STRATEGY=wot \
  -e RELAY_SYNC_WOT_PUBKEYS=9fdd0d57238ba01f8c04199ca3c0174fa17c19d28e9de610b9db22729e57310e \
  -e RELAY_SYNC_SINCE_DAYS=30 \
  nostrmaxi-production-app

# Stop old container
docker stop nostrmaxi-production-backend-1

# Verify
docker logs nostrmaxi-backend-relay-enabled | grep RelaySyncService
```

### Option C: Update docker-compose.yml
Add environment vars to `docker-compose.yml` → `app` service:
```yaml
services:
  app:
    environment:
      - RELAY_SYNC_ENABLED=true
      - LOCAL_RELAY_URL=ws://10.1.10.143:7777
      - RELAY_SYNC_SOURCES=wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net
      - RELAY_SYNC_INTERVAL_MS=300000
      - RELAY_SYNC_STRATEGY=wot
      - RELAY_SYNC_WOT_PUBKEYS=9fdd0d57238ba01f8c04199ca3c0174fa17c19d28e9de610b9db22729e57310e
      - RELAY_SYNC_SINCE_DAYS=30
```

Then: `docker compose up -d --force-recreate app`

---

## Expected Behavior When Active

### Startup Logs
```
[RelaySyncService] Relay sync enabled: ws://10.1.10.143:7777 ← 4 sources (wot strategy)
[RelaySyncService] Starting sync (wot strategy)...
[RelaySyncService] Fetched 247 unique events
[RelaySyncService] Sync complete: 247/247 published in 3421ms (total: 247, errors: 0)
```

### API Endpoints Available
- `GET /api/v1/relay-sync/stats` → Returns sync statistics
- `POST /api/v1/relay-sync/trigger` → Manual sync trigger

### Storage Growth
- **Strategy**: WoT (conservative)
- **Expected growth**: ~1-3GB for 30 days of data
- **Available space**: 945GB (46% used)
- **Safe threshold**: < 80% usage (~1.4TB)

---

## Verification Steps

Once deployed:

```bash
# 1. Check service started
docker logs nostrmaxi-production-app-1 | grep RelaySyncService

# 2. Check stats endpoint
curl http://localhost:3000/api/v1/relay-sync/stats

# 3. Check local relay has events
docker exec strangesignal-relay ls -lh /usr/src/app/db/nostr.db

# 4. Monitor disk usage
df -h / | tail -1
```

---

## Disk Space Monitoring

**Current**:
- Used: 793GB (46%)
- Free: 945GB
- Total: 1.8TB

**With WoT sync (30 days)**:
- Expected growth: +2GB
- Projected: 795GB used (46%)
- Safe margin: 150GB remaining before concern

**Safety checks**:
- Automatic sync will stop if errors occur
- RelaySyncService tracks error count
- Can disable via `RELAY_SYNC_ENABLED=false` and restart

---

## Rollback Plan

If issues occur:

```bash
# Disable relay sync
ssh neo@10.1.10.143
cd ~/nostrmaxi-production
echo "RELAY_SYNC_ENABLED=false" >> .env
docker compose restart app

# Or remove entirely
docker exec nostrmaxi-production-app-1 rm -rf /app/dist/src/relay-sync
docker restart nostrmaxi-production-app-1
```

---

## Next Steps

1. ⏳ Schedule proper backend redeployment (Option A above)
2. ⏳ Verify RelaySyncService initializes correctly
3. ⏳ Monitor first sync cycle
4. ⏳ Confirm local relay populating
5. ⏳ Enable frontend local relay integration (already coded, just needs relay available)

---

## Summary

**Everything is ready**. The code is deployed, configuration is written, local relay is running. Just needs:
- Docker container recreation to pick up new environment variables
- OR docker-compose.yml update with env vars + restart

**Estimated activation time**: 5 minutes (for proper docker-compose restart)

**Risk**: Low (can disable/rollback immediately)
