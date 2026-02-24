# NostrMaxi - Production Launch Checklist

**Last Updated:** 2026-02-13  
**Review Status:** Updated with production readiness gaps

Complete this checklist before going live.

---

## ⚠️ CRITICAL GAPS IDENTIFIED (2026-02-13)

### Testing (BLOCKER)
- [ ] **Add smoke tests** (minimum 4 hours)
  - Payment webhook handling
  - Subscription tier logic
  - NIP-05 provisioning
  - Authentication flows
- [ ] Run tests: `npm test`
- [ ] Verify critical paths work

### Docker Verification (BLOCKER)
- [ ] Test Docker production build: `docker build -f Dockerfile.prod -t nostrmaxi .`
- [ ] Verify multi-stage build completes
- [ ] Test container startup: `docker run --rm nostrmaxi`
- [ ] Check image size (should be <500MB)

### Environment Configuration (BLOCKER)
- [ ] Copy `.env.production` to `.env.prod`
- [ ] Generate all secrets (see Configuration section below)
- [ ] Configure BTCPay API key/store/webhook (or LNbits fallback)
- [ ] Set admin pubkeys
- [ ] Verify no default/example values remain

**Estimated Time for Critical Gaps:** 8-10 hours

---

## Pre-Deployment

### Infrastructure
- [ ] Server provisioned (minimum 2GB RAM, 2 CPU, 20GB disk)
- [ ] Domain purchased and DNS configured
- [ ] DNS A record pointing to server IP
- [ ] Firewall configured (ports 80, 443 open)
- [ ] SSH key authentication configured
- [ ] Non-root user created with sudo access

### Software Installation
- [ ] Docker installed and running
- [ ] Docker Compose installed
- [ ] Git installed
- [ ] Certbot installed (for Let's Encrypt)
- [ ] UFW firewall configured
- [ ] Fail2ban installed (optional but recommended)

### Repository
- [ ] Repository cloned to `/home/user/nostrmaxi`
- [ ] All scripts executable (`chmod +x scripts/*.sh`)
- [ ] `.env.prod` created from `.env.production` template
- [ ] `.env.prod` **NOT** committed to git

---

## Configuration

### Environment Variables (.env.prod)

#### Required
- [ ] `DOMAIN` - Your domain (e.g., nostrmaxi.com)
- [ ] `BASE_URL` - Full URL with https://
- [ ] `DB_PASSWORD` - Strong password (min 32 chars, generated with `openssl rand -hex 32`)
- [ ] `JWT_SECRET` - Random secret (min 64 chars, generated with `openssl rand -hex 64`)
- [ ] `WEBHOOK_SECRET` - Random secret (min 32 chars, generated with `openssl rand -hex 32`)
- [ ] `PAYMENTS_PROVIDER` - `btcpay` or `lnbits`
- [ ] `BTCPAY_URL` - BTCPay Server URL (if using BTCPay)
- [ ] `BTCPAY_API_KEY` - BTCPay API key (if using BTCPay)
- [ ] `BTCPAY_STORE_ID` - BTCPay store id (if using BTCPay)
- [ ] `LNBITS_URL` - Your LNbits instance URL (legacy fallback)
- [ ] `LNBITS_API_KEY` - LNbits invoice/admin API key (legacy fallback)
- [ ] `ADMIN_PUBKEYS` - Your nostr hex pubkey(s), comma-separated
- [ ] `NIP05_RELAYS` - List of default relays

#### Verified
- [ ] No default/example values left
- [ ] No spaces in comma-separated values
- [ ] All secrets are truly random
- [ ] Domain matches DNS configuration

---

## Security

### Secrets
- [ ] All passwords and secrets are unique and strong
- [ ] `.env.prod` has permissions 600 (`chmod 600 .env.prod`)
- [ ] `.env.prod` is in `.gitignore`
- [ ] No secrets in git history

### Firewall
- [ ] UFW enabled with default deny incoming
- [ ] Only ports 22, 80, 443 allowed
- [ ] SSH port changed from 22 (optional)
- [ ] Fail2ban configured for SSH and nginx

### SSH
- [ ] Password authentication disabled
- [ ] Root login disabled
- [ ] Only key-based authentication enabled
- [ ] Backup SSH keys stored securely

### Application
- [ ] CORS origins restricted (not `*`)
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] Admin pubkeys verified

---

## SSL/TLS

### DNS Readiness
- [ ] A/AAAA records point to production IP
- [ ] CAA record allows Let's Encrypt (optional but recommended)
- [ ] DNS propagation verified (`dig +short yourdomain.com`)
- [ ] HTTP challenge path reachable (`http://yourdomain.com/.well-known/acme-challenge/test`)

### Certificate Setup
- [ ] SSL certificates obtained (Let's Encrypt or custom)
- [ ] Certificates copied to `nginx/ssl/`
- [ ] DH parameters generated (`nginx/dhparam.pem`)
- [ ] Certificate auto-renewal configured (cron)
- [ ] Certificate expiry >30 days

### SSL Verification
- [ ] HTTPS accessible without warnings
- [ ] HTTP redirects to HTTPS
- [ ] SSL Labs test result: A or higher
- [ ] HSTS header present
- [ ] Mixed content warnings checked

---

## Database

### Setup
- [ ] Database starts successfully
- [ ] Health check passes
- [ ] Migrations applied (`npx prisma migrate deploy`)
- [ ] Database accessible from backend
- [ ] Connection pooling configured

### Backup
- [ ] Backup directory created (`./backups/`)
- [ ] Automatic backup container running
- [ ] Manual backup tested and verified
- [ ] Backup retention policy set (default: 7 days)
- [ ] Restore procedure tested

---

## Payment Integration

### BTCPay Configuration (Primary)
- [ ] BTCPay Server reachable
- [ ] Store created and Lightning enabled
- [ ] API key generated (store scope)
- [ ] Store ID set in `.env.prod`
- [ ] Webhook URL configured: `https://yourdomain.com/api/v1/payments/webhook?provider=btcpay`
- [ ] Webhook secret matches `BTCPAY_WEBHOOK_SECRET` (or `WEBHOOK_SECRET` fallback)

### LNbits Configuration (Legacy Fallback)
- [ ] LNbits account created
- [ ] Wallet funded (for testing)
- [ ] API key generated
- [ ] Webhook URL configured: `https://yourdomain.com/api/v1/payments/webhook?provider=lnbits`
- [ ] Webhook secret matches `LNBITS_WEBHOOK_SECRET` (or `WEBHOOK_SECRET`)

### Testing
- [ ] Test invoice created successfully (BTCPay)
- [ ] Test payment completes
- [ ] Webhook receives confirmation
- [ ] Subscription upgraded after payment
- [ ] Receipt generated correctly

### All Tiers
- [ ] FREE tier works (no payment)
- [ ] PRO tier payment flow tested
- [ ] BUSINESS tier payment flow tested
- [ ] LIFETIME tier payment flow tested
- [ ] Tier limits enforced correctly

---

## Application Testing

### Backend
- [ ] `/health` endpoint returns 200
- [ ] `/api/docs` accessible (Swagger)
- [ ] Database connectivity verified
- [ ] All modules load without errors
- [ ] Logs show no errors on startup

### Frontend
- [ ] Homepage loads correctly
- [ ] Login with NIP-07 extension works
- [ ] LNURL-auth QR code displays
- [ ] Pricing page shows all tiers
- [ ] Dashboard accessible after login
- [ ] NIP-05 claiming works
- [ ] Payment modal displays invoice

### NIP-05
- [ ] `/.well-known/nostr.json?name=test` returns valid JSON
- [ ] NIP-05 identities resolve correctly
- [ ] Custom domains can be verified
- [ ] Tier limits enforced (FREE=1, BUSINESS=10)

### Authentication
- [ ] NIP-07 browser extension login works
- [ ] LNURL-auth QR code scannable
- [ ] JWT tokens issued correctly
- [ ] Session persistence works
- [ ] Logout clears session

---

## Monitoring

### Health Checks
- [ ] Health check script runs: `./scripts/health-check.sh yourdomain.com`
- [ ] All endpoints return expected status
- [ ] Docker containers healthy
- [ ] Database connection verified
- [ ] SSL certificate valid

### Monitoring Setup
- [ ] External uptime monitor configured (UptimeRobot, etc.)
- [ ] `/health` endpoint monitored (every 5 min)
- [ ] SSL expiry monitored
- [ ] Disk space alerts configured
- [ ] Log monitoring set up

### Logs
- [ ] Log rotation configured
- [ ] Nginx logs readable: `tail -f logs/nginx/access.log`
- [ ] Backend logs readable: `docker-compose logs -f backend`
- [ ] No sensitive data in logs
- [ ] Error tracking configured

---

## Performance

### Optimization
- [ ] Frontend built for production (`npm run build:frontend`)
- [ ] Backend built for production (`npm run build`)
- [ ] Static assets served with caching headers
- [ ] Gzip compression enabled
- [ ] Database indexes created

### Load Testing
- [ ] API can handle expected traffic
- [ ] Rate limiting tested and working
- [ ] Response times < 500ms for most endpoints
- [ ] Database queries optimized
- [ ] No memory leaks detected

---

## Documentation

### Completeness
- [ ] README.md updated with production instructions
- [ ] DEPLOYMENT.md reviewed
- [ ] ADMIN-GUIDE.md available for operators
- [ ] API documentation accessible at `/api/docs`
- [ ] Environment variables documented

### Runbooks
- [ ] Deployment procedure documented
- [ ] Rollback procedure tested
- [ ] Backup/restore procedure tested
- [ ] Common troubleshooting steps documented
- [ ] Emergency contacts listed

---

## Deployment

### Pre-Deploy
- [ ] All tests passing
- [ ] All checklist items above completed
- [ ] Deployment plan reviewed
- [ ] Rollback plan ready
- [ ] Stakeholders notified

### Deploy
- [ ] Run deployment script: `./scripts/deploy.sh`
- [ ] All containers start successfully
- [ ] Health checks pass
- [ ] No errors in logs
- [ ] DNS propagation complete

### Post-Deploy
- [ ] Verify HTTPS access
- [ ] Test user registration flow
- [ ] Test payment flow end-to-end
- [ ] Verify NIP-05 lookups
- [ ] Check all monitoring dashboards

---

## Post-Launch

### First 24 Hours
- [ ] Monitor error logs closely
- [ ] Watch for unusual traffic patterns
- [ ] Verify payment webhooks working
- [ ] Check database performance
- [ ] Respond to any user issues

### First Week
- [ ] Review payment reconciliation
- [ ] Check backup success rate
- [ ] Analyze performance metrics
- [ ] Gather user feedback
- [ ] Plan improvements

### Ongoing
- [ ] Weekly database backups verified
- [ ] Monthly security updates
- [ ] Quarterly disaster recovery test
- [ ] Regular performance reviews
- [ ] Continuous monitoring

---

## Emergency Contacts

- **Server Provider**: [Provider name + support contact]
- **Domain Registrar**: [Registrar + login/support]
- **LNbits Support**: support@lnbits.com
- **On-Call Admin**: [Your contact info]
- **Backup Admin**: [Backup contact]

---

## Sign-Off

I confirm that:
- [ ] All items in this checklist are completed
- [ ] Production environment has been thoroughly tested
- [ ] Monitoring and alerting are configured
- [ ] Backup and disaster recovery procedures are in place
- [ ] I understand how to rollback if needed

**Deployed by**: ___________________________  
**Date**: ___________________________  
**Signature**: ___________________________

---

## Notes

Use this section for deployment-specific notes, issues encountered, or deviations from the checklist:

```
[Add your notes here]
```

---

**Last Updated**: 2026-02-11  
**Version**: 1.0.0
