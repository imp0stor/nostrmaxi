# NostrMaxi - Admin Operations Guide

Complete guide for administering NostrMaxi in production.

## Table of Contents

1. [Admin Access](#admin-access)
2. [User Management](#user-management)
3. [Subscription Management](#subscription-management)
4. [Payment Reconciliation](#payment-reconciliation)
5. [Database Operations](#database-operations)
6. [System Monitoring](#system-monitoring)
7. [Emergency Procedures](#emergency-procedures)
8. [Common Tasks](#common-tasks)

---

## Admin Access

### Setting Admin Pubkeys

Add your nostr hex pubkey to `.env.prod`:

```env
ADMIN_PUBKEYS=abc123...,def456...,789xyz...
```

Multiple admins can be comma-separated.

### Admin Endpoints

All admin endpoints require authentication with an admin pubkey:

```
GET    /api/v1/admin/stats          # System statistics
GET    /api/v1/admin/users          # List all users
GET    /api/v1/admin/subscriptions  # List all subscriptions
GET    /api/v1/admin/payments       # List all payments
POST   /api/v1/admin/user/:id/suspend
POST   /api/v1/admin/user/:id/restore
POST   /api/v1/admin/refund/:paymentId
```

### Admin Dashboard

Access admin features at: `https://nostrmaxi.com/admin`

Login with NIP-07 extension using an admin pubkey.

---

## User Management

### View All Users

```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec db psql -U nostrmaxi

# List recent users
SELECT id, npub, "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 20;

# Count total users
SELECT COUNT(*) FROM "User";

# Active users (with subscriptions)
SELECT COUNT(*) FROM "User" u
INNER JOIN "Subscription" s ON u.id = s."userId"
WHERE s."expiresAt" > NOW();
```

### Search User by NIP-05

```sql
SELECT u.npub, n."localPart", n.domain, s.tier
FROM "User" u
INNER JOIN "Nip05" n ON u.id = n."userId"
LEFT JOIN "Subscription" s ON u.id = s."userId"
WHERE n."localPart" = 'username' AND n.domain = 'nostrmaxi.com';
```

### Suspend User Account

```sql
-- Deactivate all NIP-05 identities
UPDATE "Nip05" SET "isActive" = false
WHERE "userId" = 'user-id-here';

-- Cancel subscription
UPDATE "Subscription" 
SET "cancelledAt" = NOW(), "expiresAt" = NOW()
WHERE "userId" = 'user-id-here';
```

### Restore User Account

```sql
-- Reactivate NIP-05
UPDATE "Nip05" SET "isActive" = true
WHERE "userId" = 'user-id-here';

-- Note: Subscription must be manually extended or renewed
```

### Delete User (GDPR)

```sql
-- This will cascade delete all related data
DELETE FROM "User" WHERE id = 'user-id-here';

-- Verify deletion
SELECT COUNT(*) FROM "Nip05" WHERE "userId" = 'user-id-here'; -- Should be 0
```

---

## Subscription Management

### View Active Subscriptions

```sql
SELECT 
  u.npub,
  s.tier,
  s."priceUsd",
  s."startsAt",
  s."expiresAt",
  (s."expiresAt" - NOW()) as "timeRemaining"
FROM "Subscription" s
INNER JOIN "User" u ON s."userId" = u.id
WHERE s."expiresAt" > NOW()
  AND s."cancelledAt" IS NULL
ORDER BY s."expiresAt" ASC;
```

### Revenue Statistics

```sql
-- Monthly recurring revenue
SELECT 
  SUM(s."priceUsd" / 100.0) as mrr_usd,
  COUNT(*) as active_subs
FROM "Subscription" s
WHERE s."expiresAt" > NOW()
  AND s."cancelledAt" IS NULL
  AND s.tier IN ('PRO', 'BUSINESS');

-- Lifetime revenue
SELECT 
  SUM(p."amountUsd" / 100.0) as total_usd,
  SUM(p."amountSats") as total_sats
FROM "Payment" p
WHERE p.status = 'paid';

-- Revenue by tier
SELECT 
  s.tier,
  COUNT(*) as subscriptions,
  SUM(s."priceUsd" / 100.0) as monthly_revenue
FROM "Subscription" s
WHERE s."expiresAt" > NOW()
GROUP BY s.tier;
```

### Manually Upgrade User

```sql
-- Upgrade to PRO tier
UPDATE "Subscription"
SET 
  tier = 'PRO',
  "priceUsd" = 900,
  "expiresAt" = NOW() + INTERVAL '30 days'
WHERE "userId" = 'user-id-here';
```

### Grant Lifetime Subscription

```sql
-- Set tier to LIFETIME with no expiry
UPDATE "Subscription"
SET 
  tier = 'LIFETIME',
  "priceUsd" = 9900,
  "expiresAt" = NULL
WHERE "userId" = 'user-id-here';
```

---

## Payment Reconciliation

### Check Unpaid Invoices

```sql
SELECT 
  p.id,
  p."invoice",
  p."amountSats",
  p.status,
  p."createdAt",
  (NOW() - p."createdAt") as age
FROM "Payment" p
WHERE p.status = 'pending'
ORDER BY p."createdAt" DESC;
```

### Mark Payment as Paid (Manual)

```sql
UPDATE "Payment"
SET 
  status = 'paid',
  "paidAt" = NOW()
WHERE id = 'payment-id-here';

-- Also update subscription
UPDATE "Subscription"
SET "expiresAt" = NOW() + INTERVAL '30 days'
WHERE id = (
  SELECT "subscriptionId" FROM "Payment" WHERE id = 'payment-id-here'
);
```

### Issue Refund

```sql
-- Mark payment as refunded
UPDATE "Payment"
SET status = 'refunded'
WHERE id = 'payment-id-here';

-- Cancel subscription
UPDATE "Subscription"
SET 
  "cancelledAt" = NOW(),
  "expiresAt" = NOW()
WHERE id = (
  SELECT "subscriptionId" FROM "Payment" WHERE id = 'payment-id-here'
);

-- Note: Actual lightning refund must be done in LNbits
```

### Failed Payment Cleanup

```sql
-- Mark old pending payments as expired
UPDATE "Payment"
SET status = 'expired'
WHERE status = 'pending'
  AND "createdAt" < NOW() - INTERVAL '24 hours';
```

---

## Database Operations

### Full Backup

```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec db \
  pg_dump -U nostrmaxi nostrmaxi | gzip > backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz

# List backups
ls -lh backups/
```

### Restore Backup

```bash
# Use rollback script
./scripts/rollback.sh

# Or manually:
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d db
sleep 10

gunzip -c backups/nostrmaxi_20260211_120000.sql.gz | \
  docker-compose -f docker-compose.prod.yml exec -T db psql -U nostrmaxi -d nostrmaxi

docker-compose -f docker-compose.prod.yml up -d
```

### Database Maintenance

```sql
-- Vacuum and analyze (run weekly)
VACUUM ANALYZE;

-- Check database size
SELECT pg_size_pretty(pg_database_size('nostrmaxi'));

-- Check table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### Run Migrations

```bash
# Apply pending migrations
docker-compose -f docker-compose.prod.yml run --rm backend \
  sh -c "npx prisma migrate deploy"

# View migration status
docker-compose -f docker-compose.prod.yml run --rm backend \
  sh -c "npx prisma migrate status"
```

---

## System Monitoring

### Service Health

```bash
# Quick health check
./scripts/health-check.sh nostrmaxi.com

# View container status
docker-compose -f docker-compose.prod.yml ps

# View resource usage
docker stats --no-stream

# Check disk usage
df -h
```

### Application Logs

```bash
# Backend logs (real-time)
docker-compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 backend

# Search for errors
docker-compose -f docker-compose.prod.yml logs backend | grep -i error

# Nginx access logs
tail -f logs/nginx/access.log

# Nginx error logs
tail -f logs/nginx/error.log | grep -v "client closed connection"
```

### Performance Metrics

```sql
-- Average response time (from audit logs)
SELECT 
  entity,
  COUNT(*) as requests,
  AVG(EXTRACT(EPOCH FROM ("createdAt" - LAG("createdAt") OVER (ORDER BY "createdAt")))) as avg_time
FROM "AuditLog"
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY entity;

-- Popular API endpoints
SELECT 
  action,
  COUNT(*) as hits
FROM "AuditLog"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY action
ORDER BY hits DESC
LIMIT 10;
```

### Rate Limiting Stats

```bash
# Check nginx rate limit logs
docker-compose -f docker-compose.prod.yml logs nginx | grep "limiting requests"

# Count rate limited IPs
docker-compose -f docker-compose.prod.yml logs nginx | \
  grep "limiting requests" | \
  awk '{print $8}' | sort | uniq -c | sort -rn
```

---

## Emergency Procedures

### Service Down

```bash
# 1. Check service status
docker-compose -f docker-compose.prod.yml ps

# 2. Check logs for errors
docker-compose -f docker-compose.prod.yml logs --tail=100

# 3. Restart specific service
docker-compose -f docker-compose.prod.yml restart backend

# 4. Full restart if needed
docker-compose -f docker-compose.prod.yml restart
```

### Database Crash

```bash
# 1. Check database logs
docker-compose -f docker-compose.prod.yml logs db

# 2. Try restart
docker-compose -f docker-compose.prod.yml restart db

# 3. If corrupted, restore from backup
./scripts/rollback.sh

# 4. Verify database integrity
docker-compose -f docker-compose.prod.yml exec db \
  psql -U nostrmaxi -c "SELECT COUNT(*) FROM \"User\";"
```

### SSL Certificate Expired

```bash
# 1. Check expiry
openssl x509 -in nginx/ssl/fullchain.pem -noout -dates

# 2. Renew certificate
sudo certbot renew --force-renewal

# 3. Copy new certificates
sudo cp /etc/letsencrypt/live/nostrmaxi.com/*.pem nginx/ssl/
sudo chown $(whoami):$(whoami) nginx/ssl/*.pem

# 4. Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

### Disk Space Full

```bash
# 1. Check disk usage
df -h

# 2. Find large files
du -sh /* | sort -h

# 3. Clean Docker
docker system prune -a --volumes

# 4. Clean old backups
find backups/ -mtime +30 -delete

# 5. Clean logs
find logs/ -name "*.log" -mtime +14 -delete

# 6. Vacuum database
docker-compose -f docker-compose.prod.yml exec db \
  psql -U nostrmaxi -c "VACUUM FULL;"
```

### DDoS Attack

```bash
# 1. Check access logs for patterns
tail -f logs/nginx/access.log

# 2. Block specific IP
docker-compose -f docker-compose.prod.yml exec nginx \
  sh -c "echo 'deny 1.2.3.4;' >> /etc/nginx/blocked-ips.conf"

# 3. Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx

# 4. Use fail2ban (if installed)
sudo fail2ban-client set nginx-limit-req banip 1.2.3.4

# 5. Enable Cloudflare if available
```

---

## Common Tasks

### Add New Admin

```bash
# 1. Get their hex pubkey
# 2. Edit .env.prod
nano .env.prod

# Add to ADMIN_PUBKEYS (comma-separated)
ADMIN_PUBKEYS=existing...,new-pubkey-here

# 3. Restart backend
docker-compose -f docker-compose.prod.yml restart backend
```

### Update Domain/SSL

```bash
# 1. Update .env.prod
nano .env.prod
# Change DOMAIN and BASE_URL

# 2. Run SSL setup
./scripts/setup-ssl.sh

# 3. Update DNS records

# 4. Restart all services
docker-compose -f docker-compose.prod.yml restart
```

### Scale for High Traffic

```bash
# 1. Edit docker-compose.prod.yml
# Add multiple backend instances:
backend:
  deploy:
    replicas: 3

# 2. Update nginx upstream
nano nginx/nginx.conf
# Add:
upstream backend {
  server backend:3000;
  server backend:3000;
  server backend:3000;
  least_conn;
}

# 3. Redeploy
./scripts/deploy.sh
```

### Export User Data (GDPR)

```sql
-- Export all user data
COPY (
  SELECT 
    u.npub,
    u."createdAt",
    json_agg(n.*) as nip05_identities,
    s.tier as subscription_tier,
    s."expiresAt" as subscription_expires
  FROM "User" u
  LEFT JOIN "Nip05" n ON u.id = n."userId"
  LEFT JOIN "Subscription" s ON u.id = s."userId"
  WHERE u.npub = 'npub1...'
  GROUP BY u.id, s.id
) TO '/tmp/user-export.json';

-- Copy from container
docker cp nostrmaxi-db-1:/tmp/user-export.json ./
```

### Audit Security

```bash
# Check for suspicious activity
docker-compose -f docker-compose.prod.yml logs backend | \
  grep -E "(failed|unauthorized|forbidden)"

# Review recent admin actions
docker-compose -f docker-compose.prod.yml exec db psql -U nostrmaxi -c \
  "SELECT * FROM \"AuditLog\" WHERE \"actorPubkey\" IN (SELECT unnest(string_to_array('${ADMIN_PUBKEYS}', ','))) ORDER BY \"createdAt\" DESC LIMIT 20;"

# Check for brute force attempts
tail -1000 logs/nginx/access.log | \
  awk '{print $1}' | sort | uniq -c | sort -rn | head -20
```

---

## Metrics Dashboard

### Key Metrics to Monitor

1. **Uptime**: Service availability %
2. **Response Time**: API endpoint latency
3. **Error Rate**: 4xx/5xx response ratio
4. **Active Users**: Users with valid subscriptions
5. **MRR**: Monthly recurring revenue
6. **Disk Usage**: Remaining storage
7. **Memory Usage**: Container memory consumption
8. **Database Size**: PostgreSQL database growth

### Quick Stats Script

Save as `scripts/stats.sh`:

```bash
#!/bin/bash
echo "NostrMaxi Statistics"
echo "===================="

# Total users
echo -n "Total Users: "
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -tAc "SELECT COUNT(*) FROM \"User\";"

# Active subscriptions
echo -n "Active Subs: "
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -tAc "SELECT COUNT(*) FROM \"Subscription\" WHERE \"expiresAt\" > NOW();"

# MRR
echo -n "MRR (USD): \$"
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -tAc "SELECT SUM(\"priceUsd\"/100.0) FROM \"Subscription\" WHERE \"expiresAt\" > NOW();"

# Disk usage
echo "Disk Usage:"
df -h | grep -E '(Filesystem|/$)'

# Service uptime
docker-compose -f docker-compose.prod.yml ps
```

---

## Support Contacts

- **Emergency Contact**: [Your phone/email]
- **LNbits Support**: support@lnbits.com
- **Server Provider**: [Your hosting provider]

---

## Change Log

- **2026-02-11**: Initial admin guide created
- 
**Maintained by**: NostrMaxi Admin Team
