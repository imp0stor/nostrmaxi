# NostrMaxi Production Rollback Runbook

**Version:** 1.0  
**Last Updated:** 2026-02-17  
**Estimated Duration:** 10-15 minutes  
**Severity:** CRITICAL - Use only when production is broken

---

## When to Rollback

Rollback **IMMEDIATELY** if any of the following occur within 30 minutes of cutover:

- [ ] Services fail to start or crash repeatedly
- [ ] Database corruption detected
- [ ] Payment webhooks failing (>3 consecutive failures)
- [ ] Critical endpoints returning 500 errors
- [ ] Security breach detected
- [ ] Data loss detected
- [ ] Unable to verify admin access
- [ ] SSL/TLS failures preventing HTTPS access

**Decision Authority:** Any authorized admin can trigger rollback.

---

## Pre-Rollback Checklist (30 seconds)

- [ ] **Confirm rollback necessary** - Don't rollback for minor issues
- [ ] **Notify stakeholders** - "Rolling back production deployment NOW"
- [ ] **Capture evidence:**
  ```bash
  # Save logs before rollback destroys them
  docker-compose -f docker-compose.prod.yml logs --no-log-prefix > /tmp/rollback-logs-$(date +%s).txt
  
  # Capture container status
  docker-compose -f docker-compose.prod.yml ps > /tmp/rollback-status-$(date +%s).txt
  ```

---

## Emergency Rollback Procedure

### Option A: Rollback to Previous Deployment (Fast - 5 min)

**Use if:** You have a previous working deployment on same or different host

```bash
# 1. STOP broken deployment
cd /home/owner/strangesignal/projects/nostrmaxi
docker-compose -f docker-compose.prod.yml down --timeout 10

# 2. Switch to previous working version
git log --oneline -10  # Find last working commit
git checkout <PREVIOUS_WORKING_COMMIT>

# Or if using release tags:
git checkout v1.0.0  # Last stable release

# 3. Restore environment
cp .env.prod.backup .env  # If you backed up .env before cutover
# OR manually restore known-good secrets

# 4. Rebuild (if needed - use cached layers)
docker-compose -f docker-compose.prod.yml build

# 5. Restore database from backup
./scripts/restore-db.sh backups/backup-<TIMESTAMP>.sql.gz

# 6. Start services
docker-compose -f docker-compose.prod.yml up -d

# 7. Verify health
timeout 60 bash -c 'until curl -sf http://localhost:3000/health; do sleep 5; done'
curl http://localhost:3000/health | jq .
```

**Verification:**
```bash
# Check all services running
docker-compose -f docker-compose.prod.yml ps

# Test critical endpoint
curl http://localhost:3000/.well-known/nostr.json?name=test

# Check logs for errors
docker-compose -f docker-compose.prod.yml logs --tail=50 backend
```

---

### Option B: Rollback to Development/Staging (Medium - 10 min)

**Use if:** Previous production deployment doesn't exist, but dev/staging is stable

```bash
# 1. STOP broken deployment
docker-compose -f docker-compose.prod.yml down --timeout 10

# 2. Switch to development compose file
docker-compose down  # Stop any dev services
docker-compose up -d --build

# 3. Update DNS/routing to point to dev/staging temporarily
# (This depends on your infrastructure - update nginx, load balancer, etc.)

# 4. Verify services
curl http://10.1.10.143:8086/health
```

**Temporary Workaround:**
If DNS can't be quickly updated, set up nginx proxy:

```bash
# Edit nginx config to proxy to dev/staging
sudo nano /etc/nginx/sites-available/nostrmaxi-emergency

# Add:
server {
    listen 80;
    server_name nostrmaxi.com;
    location / {
        proxy_pass http://10.1.10.143:8086;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

sudo ln -s /etc/nginx/sites-available/nostrmaxi-emergency /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
```

---

### Option C: Full Database Restore (Slow - 15 min)

**Use if:** Database corruption detected or data loss occurred

```bash
# 1. STOP all services immediately
docker-compose -f docker-compose.prod.yml down

# 2. List available backups
ls -lht backups/*.sql.gz | head -10

# Choose backup from BEFORE cutover
BACKUP_FILE="backups/backup-2026-02-17-T10-00-00.sql.gz"

# 3. Restore database
./scripts/restore-db.sh "$BACKUP_FILE"

# 4. Verify restore
docker exec nostrmaxi-postgres psql $DATABASE_URL -c "SELECT count(*) FROM users;"
docker exec nostrmaxi-postgres psql $DATABASE_URL -c "SELECT count(*) FROM nip05_identities;"

# Compare counts with expected values
# If counts look wrong, try earlier backup

# 5. Restart services
docker-compose -f docker-compose.prod.yml up -d

# 6. Run migrations (if needed)
npx prisma migrate deploy
```

---

### Option D: Safe-Mode Fallback (Fast - 2 min)

**Use if:** You need immediate stabilization without losing state (payments broken, spike errors, or unknown issue).

```bash
# 1. Enable maintenance/safe-mode
./scripts/safe-mode-on.sh

# 2. Confirm maintenance is active
curl -I http://localhost/health
curl -I http://localhost/ | head -5
```

**Notes:** Safe-mode keeps services running but shields users. You can debug while traffic is paused.

**Exit safe-mode (when ready):**
```bash
./scripts/safe-mode-off.sh
```

---

### Option E: Complete Teardown & Rebuild (Nuclear - 20 min)

**Use if:** All else fails, complete reset needed

```bash
# 1. STOP everything
docker-compose -f docker-compose.prod.yml down -v  # -v removes volumes!

# 2. Clean Docker state
docker system prune -af --volumes

# 3. Fresh clone repository
cd /home/owner/strangesignal/projects
mv nostrmaxi nostrmaxi-broken-$(date +%s)
git clone <repository-url> nostrmaxi
cd nostrmaxi

# 4. Checkout last known stable version
git checkout main  # or specific tag

# 5. Restore configuration
cp /path/to/backup/.env.prod.backup .env.prod
cp .env.prod .env

# 6. Restore database to clean state
./scripts/restore-db.sh backups/backup-<LAST_KNOWN_GOOD>.sql.gz

# 7. Fresh build
npm install
npm run build
npm run build:frontend
docker-compose -f docker-compose.prod.yml build --no-cache

# 8. Start services
docker-compose -f docker-compose.prod.yml up -d

# 9. Watch logs closely
docker-compose -f docker-compose.prod.yml logs -f
```

---

## Post-Rollback Verification (5 min)

Run through these checks after ANY rollback:

```bash
# 1. Health check
curl -sf http://localhost:3000/health || echo "HEALTH CHECK FAILED"

# 2. Database connectivity
docker exec nostrmaxi-postgres psql $DATABASE_URL -c "SELECT 1;" || echo "DB CONNECTION FAILED"

# 3. Core endpoints
curl -sf http://localhost:3000/.well-known/nostr.json?name=test || echo "NIP-05 ENDPOINT FAILED"
curl -sf http://localhost:3000/api/v1/subscriptions/tiers || echo "SUBSCRIPTIONS ENDPOINT FAILED"

# 4. Check for errors in logs
docker-compose -f docker-compose.prod.yml logs --tail=100 backend | grep -i error

# 5. Verify container health
docker-compose -f docker-compose.prod.yml ps

# All services should show "Up" or "Up (healthy)"
```

---

## Rollback Success Criteria

All of the following must be TRUE before declaring rollback successful:

- [ ] All containers running and healthy
- [ ] Health endpoint returns 200 OK
- [ ] Database queries successful
- [ ] No ERROR messages in last 5 minutes of logs
- [ ] At least 1 user can login successfully (manual test)
- [ ] NIP-05 lookups working
- [ ] Public access restored (if DNS/proxy updated)

---

## Post-Rollback Actions

### Immediate (Within 1 hour)

- [ ] **Announce service restored** - Notify users, stakeholders
- [ ] **Monitor continuously** - Watch logs for next 2 hours
- [ ] **Document incident:**
  ```bash
  cat > /tmp/incident-report-$(date +%s).md <<EOF
  # Production Rollback Incident Report
  
  Date: $(date)
  Duration: <START> to <END>
  
  ## Trigger
  - What caused the rollback?
  
  ## Timeline
  - HH:MM - Cutover started
  - HH:MM - Issue detected
  - HH:MM - Rollback initiated
  - HH:MM - Service restored
  
  ## Impact
  - Users affected: 
  - Revenue impact: 
  - Data lost: YES/NO
  
  ## Root Cause
  - 
  
  ## Rollback Method Used
  - Option A/B/C/D/E
  
  ## Lessons Learned
  - 
  
  ## Action Items
  - [ ] 
  EOF
  ```

- [ ] **Preserve evidence:**
  ```bash
  # Save all rollback artifacts
  mkdir -p ~/rollback-evidence-$(date +%Y%m%d)
  cp /tmp/rollback-*.txt ~/rollback-evidence-$(date +%Y%m%d)/
  cp docker-compose.prod.yml ~/rollback-evidence-$(date +%Y%m%d)/
  cp .env.prod ~/rollback-evidence-$(date +%Y%m%d)/env-sanitized.txt  # Remove secrets first!
  ```

### Within 24 Hours

- [ ] **Root cause analysis** - Why did cutover fail?
- [ ] **Fix identified issues** - Patch code, update config, etc.
- [ ] **Update runbooks** - Add preventive measures
- [ ] **Test fixes in staging** - Reproduce failure, verify fix
- [ ] **Plan retry cutover** - Schedule when safe

---

## Prevention Checklist

To avoid future rollbacks, verify BEFORE next cutover:

- [ ] All smoke tests pass in staging
- [ ] Database migration tested on staging data
- [ ] Payment webhooks tested end-to-end
- [ ] Load testing completed (if expecting traffic)
- [ ] Rollback procedure tested in staging
- [ ] Backups verified restorable
- [ ] Monitoring and alerting configured
- [ ] Staging environment matches production exactly

---

## Common Rollback Scenarios

### Scenario 1: Container Won't Start

**Symptoms:** `docker-compose up` exits immediately, container in restart loop

**Quick Fix:**
```bash
# Check logs for startup error
docker-compose -f docker-compose.prod.yml logs backend

# Common causes:
# - Missing environment variable → Fix .env
# - Port already in use → Kill conflicting process
# - Database connection failed → Check DATABASE_URL
# - Build artifact missing → Run npm run build

# After fix:
docker-compose -f docker-compose.prod.yml up -d
```

**Rollback if:** Can't identify cause within 5 minutes

---

### Scenario 2: Database Migration Failed

**Symptoms:** Migration errors in logs, schema mismatch

**Quick Fix:**
```bash
# Restore from pre-migration backup
./scripts/restore-db.sh backups/backup-<BEFORE_MIGRATION>.sql.gz

# Rollback code to previous version
git checkout <PREVIOUS_COMMIT>

# Restart services
docker-compose -f docker-compose.prod.yml restart backend
```

**Rollback if:** Data corruption detected or migrations can't be fixed quickly

---

### Scenario 3: Payment Webhooks Not Working

**Symptoms:** Payments succeeding but subscriptions not upgrading

**Quick Fix:**
```bash
# Check webhook URL configured correctly
echo $BTCPAY_WEBHOOK_SECRET
echo $LNBITS_WEBHOOK_SECRET

# Test webhook endpoint manually
curl -X POST https://$DOMAIN/api/v1/payments/webhook?provider=btcpay \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check logs for webhook processing
docker-compose logs backend | grep webhook
```

**Rollback if:** Revenue-blocking and can't fix within 15 minutes

---

### Scenario 4: SSL/TLS Failure

**Symptoms:** HTTPS not working, certificate errors

**Quick Fix:**
```bash
# Check certificate files
ls -la nginx/ssl/
openssl x509 -in nginx/ssl/cert.pem -noout -text

# Regenerate if needed
./scripts/ssl-setup.sh $DOMAIN

# Reload nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

**Rollback if:** Can't restore HTTPS within 10 minutes

---

## Rollback Escalation Path

If rollback fails or you're unsure:

1. **Stop deployment immediately** - Prevent further damage
2. **Contact senior engineer/architect** - Get help
3. **Preserve all evidence** - Logs, configs, database dumps
4. **Document timeline** - What happened, when, what was tried
5. **Consider maintenance mode** - Show users a "down for maintenance" page
6. **Schedule emergency meeting** - Review with team

**Emergency Contacts:**
- Senior Engineer: [contact]
- Database Admin: [contact]
- Infrastructure Lead: [contact]

---

## Testing This Runbook

**IMPORTANT:** Test rollback procedure in staging BEFORE production cutover!

```bash
# Staging rollback drill
cd /path/to/staging
# Simulate cutover
docker-compose -f docker-compose.prod.yml up -d
# Wait 5 minutes
# Simulate failure - stop backend
docker-compose -f docker-compose.prod.yml stop backend
# Run rollback
# ... follow rollback procedure ...
# Verify restoration
# Time the entire process
```

---

**Last Resort:** If all rollback methods fail, contact infrastructure team to restore from off-site backups or consider rebuilding from scratch using Option D.

**Remember:** Document EVERYTHING. Every rollback is a learning opportunity.
