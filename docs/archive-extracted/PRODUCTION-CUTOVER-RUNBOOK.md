# NostrMaxi Production Cutover Runbook

**Version:** 1.0  
**Last Updated:** 2026-02-17  
**Estimated Duration:** 2-4 hours  
**Rollback Time:** 15 minutes

---

## Pre-Cutover Checklist

### T-24 Hours: Preparation

- [ ] **Run readiness checker:**
  ```bash
  ./scripts/production-readiness-check.sh .env.prod
  ```
  **Required:** All critical checks must PASS (0 failures)

- [ ] **Verify secrets provisioned (automated):**
  ```bash
  ./scripts/validate-secrets-full.sh .env.prod
  ```
  **Required:** 0 failures

  Manual checklist:
  - `BTCPAY_URL`, `BTCPAY_API_KEY`, `BTCPAY_STORE_ID` (or LNbits equivalents)
  - `ADMIN_PUBKEYS` (at least one valid hex pubkey)
  - `JWT_SECRET` (64+ chars, cryptographically random)
  - `WEBHOOK_SECRET` (32+ chars, cryptographically random)

- [ ] **DNS verification:**
  ```bash
  dig +short $DOMAIN A
  host $DOMAIN
  ```
  **Required:** DNS must resolve to production server IP

- [ ] **TLS certificates:**
  ```bash
  ls -la nginx/ssl/
  openssl x509 -in nginx/ssl/cert.pem -noout -enddate
  ```
  **Required:** Valid certificates with >30 days until expiry

- [ ] **Database backup:**
  ```bash
  ./scripts/backup-db.sh
  ls -lh backups/
  ```
  **Required:** Fresh backup <1 hour old

- [ ] **Smoke test current dev/staging:**
  ```bash
  ./scripts/health-check.sh http://10.1.10.143:8086
  ```
  **Required:** All endpoints returning 200 OK

### T-1 Hour: Final Verification

- [ ] **Notify stakeholders:** "Production cutover starting in 1 hour"
- [ ] **Stop incoming traffic** (if applicable - set maintenance page)
- [ ] **Verify no users logged in** (check active sessions)
- [ ] **Final database backup:**
  ```bash
  ./scripts/backup-db.sh
  ```

---

## Automation (Optional)

Use the gated automation script to run validation + build + migrations + health checks:

```bash
CUTOVER_CONFIRM=YES ./scripts/prod-cutover.sh .env.prod
# Or dry-run:
CUTOVER_CONFIRM=YES ./scripts/prod-cutover.sh .env.prod --dry-run
```

---

## Cutover Procedure

### Phase 1: Stop Old Services (5 min)

**Location:** Current deployment (if applicable)

```bash
# If running on different host/port, stop gracefully
cd /path/to/old/deployment
docker-compose down --timeout 30

# Verify stopped
docker ps | grep nostrmaxi
# Should return nothing
```

**Checkpoint:** Old services stopped cleanly

---

### Phase 2: Deploy Production Configuration (10 min)

**Location:** `/home/owner/strangesignal/projects/nostrmaxi` (or production path)

```bash
# 1. Ensure on correct branch/commit
git fetch origin
git checkout main  # or production branch
git pull origin main

# 2. Copy production environment
cp .env.prod .env
chmod 600 .env

# 3. Verify environment loaded correctly
source .env
echo "Domain: $DOMAIN"
echo "Payment provider: $PAYMENTS_PROVIDER"
# Do NOT echo secrets

# 4. Run readiness check one final time
./scripts/production-readiness-check.sh .env
```

**Checkpoint:** Readiness check passes with 0 failures

**Decision Point:** PASS → Continue | FAIL → ABORT and run rollback

---

### Phase 3: Build Production Images (10-15 min)

```bash
# 1. Build backend
npm run build

# Verify dist/ created
ls -la dist/
test -f dist/main.js || { echo "Build failed!"; exit 1; }

# 2. Build frontend
npm run build:frontend

# Verify frontend/dist created
ls -la frontend/dist/
test -f frontend/dist/index.html || { echo "Frontend build failed!"; exit 1; }

# 3. Build Docker images
docker-compose -f docker-compose.prod.yml build --no-cache

# Verify images built
docker images | grep nostrmaxi
```

**Checkpoint:** All builds successful, images created

**Decision Point:** PASS → Continue | FAIL → ABORT and run rollback

---

### Phase 4: Database Migration (5 min)

```bash
# 1. Generate Prisma client
npx prisma generate

# 2. Run migrations (production mode - no prompts)
npx prisma migrate deploy

# 3. Verify schema
npx prisma db pull
git diff prisma/schema.prisma
# Should show no changes

# 4. Seed admin data (if needed)
# npx prisma db seed  # Only if you have seed script
```

**Checkpoint:** Migrations applied successfully

**Decision Point:** PASS → Continue | FAIL → ABORT and restore from backup

---

### Phase 5: Start Production Services (10 min)

```bash
# 1. Start services
docker-compose -f docker-compose.prod.yml up -d

# 2. Watch logs for startup errors
docker-compose -f docker-compose.prod.yml logs -f --tail=100

# Watch for:
# - "🚀 NostrMaxi running on http://localhost:3000"
# - No ERROR or CRITICAL log messages
# - All modules loaded successfully

# 3. Wait for services to be healthy (max 60s)
timeout=60
while [ $timeout -gt 0 ]; do
    if docker-compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
        echo "Services healthy!"
        break
    fi
    echo "Waiting for services... ${timeout}s"
    sleep 5
    timeout=$((timeout - 5))
done

# 4. Verify all containers running
docker-compose -f docker-compose.prod.yml ps
```

**Expected Output:**
```
NAME                COMMAND             SERVICE    STATUS         PORTS
nostrmaxi-backend   "node dist/main"    backend    Up (healthy)   0.0.0.0:3000->3000/tcp
nostrmaxi-postgres  "postgres"          db         Up (healthy)   5432/tcp
nostrmaxi-redis     "redis-server"      redis      Up (healthy)   6379/tcp
nostrmaxi-nginx     "nginx"             nginx      Up (healthy)   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

**Checkpoint:** All containers running and healthy

**Decision Point:** PASS → Continue | FAIL → ABORT and run rollback

---

### Phase 6: Smoke Test Production (10 min)

```bash
# Run comprehensive health check
./scripts/health-check.sh https://$DOMAIN

# If domain not yet resolving, test via IP:
./scripts/health-check.sh http://$(hostname -I | awk '{print $1}'):3000
```

**Required Tests:**
- [ ] `/health` returns 200 OK
- [ ] `/.well-known/nostr.json` returns 200 OK
- [ ] `/api/docs` loads Swagger UI
- [ ] `/api/v1/auth/challenge` returns valid challenge
- [ ] `/api/v1/subscriptions/tiers` returns pricing data

**Manual Verification:**
```bash
# 1. Health check
curl -s https://$DOMAIN/health | jq .

# Expected:
# {
#   "status": "ok",
#   "timestamp": "2026-02-17T16:00:00.000Z",
#   "uptime": 123.45
# }

# 2. NIP-05 endpoint
curl -s "https://$DOMAIN/.well-known/nostr.json?name=test" | jq .

# Expected: Valid JSON (may be empty if no test user)

# 3. Subscription tiers
curl -s https://$DOMAIN/api/v1/subscriptions/tiers | jq .

# Expected: Array of tier objects (FREE, PRO, BUSINESS, LIFETIME)

# 4. Auth challenge
curl -X POST https://$DOMAIN/api/v1/auth/challenge -H "Content-Type: application/json" -d '{}' | jq .

# Expected: { "challenge": "..." }
```

**Checkpoint:** All smoke tests passing

**Decision Point:** PASS → Continue | FAIL → ABORT and run rollback

---

### Phase 7: End-to-End Critical Path Test (15-20 min)

**Test 1: User Registration + Login**
1. Open browser to `https://$DOMAIN`
2. Click "Sign Up"
3. Connect with Nostr extension (Alby/nos2x)
4. Verify login successful
5. Check dashboard loads

**Test 2: NIP-05 Provisioning**
1. Navigate to "Claim NIP-05"
2. Choose username (e.g., `cutover-test`)
3. Submit claim
4. Verify NIP-05 address displayed: `cutover-test@$DOMAIN`
5. Test lookup:
   ```bash
   curl "https://$DOMAIN/.well-known/nostr.json?name=cutover-test" | jq .
   ```
6. Verify pubkey returned

**Test 3: Payment Flow** (CRITICAL - Revenue Blocking)
1. Navigate to "Upgrade Subscription"
2. Select PRO tier ($7/mo or configured price)
3. Click "Pay with Lightning"
4. Verify invoice generated (Lightning QR code displays)
5. **Do NOT pay yet** - save invoice for webhook test
6. Pay invoice using test wallet
7. Wait for webhook (max 30s)
8. Verify subscription upgraded to PRO
9. Check logs for webhook confirmation:
   ```bash
   docker-compose -f docker-compose.prod.yml logs backend | grep webhook
   ```

**Test 4: Admin Access**
1. Login with admin pubkey (from `ADMIN_PUBKEYS`)
2. Navigate to `/admin` or admin dashboard
3. Verify access granted
4. Check user count, payment stats display correctly

**Checkpoint:** All critical paths working

**Decision Point:** PASS → Continue | FAIL → ABORT and run rollback

---

### Phase 8: Enable Public Access (5 min)

```bash
# 1. If maintenance page was enabled, disable it
# (nginx config or load balancer setting)

# 2. Verify DNS propagation complete
for ns in 8.8.8.8 1.1.1.1 9.9.9.9; do
    echo "Checking $ns:"
    dig @$ns +short $DOMAIN A
done

# 3. Test from external network (not localhost)
curl -I https://$DOMAIN

# 4. Update status page / monitoring
# (if applicable - mark service as OPERATIONAL)
```

---

### Phase 9: Post-Cutover Monitoring (30 min)

**Immediate (First 5 minutes):**
```bash
# Watch logs continuously
docker-compose -f docker-compose.prod.yml logs -f backend | grep -E "ERROR|WARN|webhook|payment"

# Monitor resource usage
docker stats
```

**Watch for:**
- No ERROR messages in logs
- Response times <500ms
- Memory usage stable (<80% container limit)
- CPU usage reasonable (<70% sustained)
- Webhook deliveries successful

**Active Monitoring (Next 30 minutes):**
- [ ] Check application logs every 5 minutes
- [ ] Verify at least 1 successful user action (NIP-05 claim or login)
- [ ] Test payment webhook manually if no organic payments yet
- [ ] Monitor disk space: `df -h`
- [ ] Monitor database connections: 
  ```bash
  docker exec nostrmaxi-postgres psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
  ```

---

## Success Criteria

All of the following must be TRUE:

- [ ] All services running and healthy for 30+ minutes
- [ ] Health check passing continuously
- [ ] At least 1 successful user registration
- [ ] At least 1 successful NIP-05 claim
- [ ] Payment webhook tested and confirmed working
- [ ] No ERROR logs in last 30 minutes
- [ ] Response times <500ms average
- [ ] DNS resolving globally
- [ ] HTTPS working without warnings
- [ ] Admin access verified

---

## Post-Cutover Tasks (Within 24h)

- [ ] **Send launch announcement** (social media, Nostr, email if applicable)
- [ ] **Monitor continuously** (first 24h is critical)
- [ ] **Test all subscription tiers** with real payments
- [ ] **Verify automated backups running** (check cron / backup container)
- [ ] **Document any issues encountered** in incident log
- [ ] **Update documentation** with actual production URLs
- [ ] **Enable uptime monitoring** (UptimeRobot, Pingdom, etc.)
- [ ] **Configure alerting** (PagerDuty, email, Slack, etc.)

---

## Decision Points Summary

| Phase | Checkpoint | PASS → | FAIL → |
|-------|------------|--------|--------|
| 2 | Readiness check | Continue | ROLLBACK |
| 3 | Build artifacts | Continue | ROLLBACK |
| 4 | Database migration | Continue | RESTORE & ROLLBACK |
| 5 | Services healthy | Continue | ROLLBACK |
| 6 | Smoke tests | Continue | ROLLBACK |
| 7 | Critical paths | Continue | ROLLBACK |

**Golden Rule:** When in doubt, ROLLBACK. Better to delay than to ship broken.

---

## Emergency Contacts

- **On-Call Admin:** [Your contact]
- **Database Admin:** [DBA contact]
- **Infrastructure:** [DevOps contact]
- **Payment Provider Support:** 
  - BTCPay: [support contact]
  - LNbits: support@lnbits.com

---

## Notes Section

Use this space to document actual cutover execution:

```
Date: _______________________
Start Time: _______________________
End Time: _______________________
Total Duration: _______________________

Issues Encountered:
- 
- 

Deviations from Runbook:
- 
- 

Rollback Triggered: YES / NO
Reason (if YES): 

Production URL: _______________________
Admin Login Verified: YES / NO
Payment Test Completed: YES / NO

Sign-Off: _______________________
```

---

**Next Steps:** If cutover successful, see `PRODUCTION-ROLLBACK-RUNBOOK.md` for emergency rollback procedures.
