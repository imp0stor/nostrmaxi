# Relay Sync - Docker Issues Blocking Activation

**Date**: 2026-02-27 17:25 EST  
**Status**: ⚠️ **Code ready, Docker orchestration needs fixing**

---

## What's Working ✅

1. **Code deployed**: RelaySyncService built + available in `dist/src/relay-sync/`
2. **Local relay running**: `strangesignal-relay` on :7777 (healthy, 3+ days uptime)
3. **Configuration written**: `.env` has all RELAY_SYNC_* variables
4. **Disk space safe**: 945GB free

---

## Docker Issues 🚧

### Issue 1: npm install fails in Docker build
```
npm error Cannot read properties of undefined (reading 'extraneous')
```

Known npm bug in Alpine Linux. Workaround: use pre-built `dist/` folder.

### Issue 2: Port conflicts
```
Bind for 0.0.0.0:5432 failed: port is already allocated
```

NostrCast uses :5432, NostrMaxi postgres on :5433.  
`docker-compose.yml` doesn't account for existing services.

### Issue 3: Redis networking
```
Redis Connection Error: ECONNREFUSED 127.0.0.1:6379
```

App tries `localhost:6379` but Redis is on Docker network at `redis:6379`.  
`docker-compose.yml` missing `REDIS_HOST=redis` environment variable.

### Issue 4: Missing env_file
`docker-compose.yml` hardcodes environment, doesn't load `.env` file.  
RELAY_SYNC_* variables not being picked up.

---

## Root Cause

**docker-compose.yml is incomplete**:
- No `env_file: .env` directive
- Redis host hardcoded to `localhost` instead of service name
- No network configuration for multi-container setup
- Port conflicts with existing services

---

## Solutions

### Option A: Fix docker-compose.yml (Recommended)

Update `~/nostrmaxi-production/docker-compose.yml`:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env  # ADD THIS
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://nostrmaxi:nostrmaxi@nostrmaxi-postgres:5433/nostrmaxi  # Use external DB
      - REDIS_HOST=redis  # ADD THIS
      - REDIS_PORT=6379
      - PORT=3000
    depends_on:
      redis:
        condition: service_started
    networks:
      - nostrmaxi
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    networks:
      - nostrmaxi
    restart: unless-stopped

networks:
  nostrmaxi:
    external: true  # Or create new network
```

Then:
```bash
docker compose down
docker compose up -d
```

### Option B: Use Existing Deployment Method

The backend was previously working as a standalone container (not via docker-compose).  
Use that method + manually inject environment:

```bash
docker run -d --name nostrmaxi-backend \
  --env-file ~/nostrmaxi-production/.env \
  --network host \
  --restart unless-stopped \
  nostrmaxi-production-app

# Verify
docker logs nostrmaxi-backend | grep RelaySyncService
```

### Option C: Systemd Service (Most Reliable)

Create `/etc/systemd/system/nostrmaxi-backend.service`:

```ini
[Unit]
Description=NostrMaxi Backend
After=network.target redis.service postgresql.service

[Service]
Type=simple
User=neo
WorkingDirectory=/home/neo/nostrmaxi-production
EnvironmentFile=/home/neo/nostrmaxi-production/.env
ExecStart=/usr/bin/node dist/src/main.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable nostrmaxi-backend
sudo systemctl start nostrmaxi-backend
systemctl status nostrmaxi-backend
```

---

## What Needs To Happen

1. Choose deployment method (A, B, or C)
2. Fix configuration
3. Start backend
4. Verify relay sync initializes:
   ```bash
   # Look for this line:
   [RelaySyncService] Relay sync enabled: ws://10.1.10.143:7777 ← 4 sources (wot strategy)
   ```

---

## Current State

- ✅ Code: Ready
- ✅ Config: Ready
- ✅ Local relay: Running
- ❌ Backend: Crash-looping (Redis connection issues)
- ⏳ Relay sync: Not initialized (backend not running)

---

## Estimated Time to Fix

- Option A (fix compose): **15 minutes**
- Option B (standalone): **5 minutes**
- Option C (systemd): **10 minutes**

---

## Temporary Workaround

Until deployment is fixed, relay sync won't run. This doesn't block other features:
- ✅ Frontend works (static files)
- ✅ Manual relay queries work
- ✅ Analytics work (query public relays directly)
- ❌ Automated relay population (requires backend)
- ❌ Local relay caching (requires backend sync)

---

## Next Steps

1. Decide on deployment approach
2. Fix docker-compose.yml or use alternative method
3. Start backend with proper environment
4. Verify RelaySyncService logs
5. Monitor disk space (:7777 relay database)

**All code is ready. Just needs proper Docker orchestration.**
