# NostrMaxi - Production Deployment Quick Guide

**🚀 Get NostrMaxi production-ready in under 30 minutes.**

## Prerequisites

- Ubuntu 22.04 server with 2GB+ RAM
- Domain name with DNS configured
- Docker & Docker Compose installed
- Ports 80 and 443 open

## Quick Deploy

### 1. Clone and Configure

```bash
# Clone repository
git clone https://github.com/yourusername/nostrmaxi.git
cd nostrmaxi

# Create production environment file
cp .env.production .env.prod

# Generate secrets
echo "DB_PASSWORD=$(openssl rand -hex 32)" >> .env.prod
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env.prod
echo "WEBHOOK_SECRET=$(openssl rand -hex 32)" >> .env.prod

# Edit remaining configuration
nano .env.prod
```

**Required in `.env.prod`:**
- `DOMAIN` - Your domain
- `PAYMENTS_PROVIDER` - `btcpay` or `lnbits`
- `BTCPAY_URL` - Your BTCPay Server URL (if using BTCPay)
- `BTCPAY_API_KEY` - BTCPay API key (if using BTCPay)
- `BTCPAY_STORE_ID` - BTCPay store id (if using BTCPay)
- `LNBITS_URL` - Your LNbits instance (legacy fallback)
- `LNBITS_API_KEY` - Your LNbits API key (legacy fallback)
- `ADMIN_PUBKEYS` - Your nostr pubkey(s)

### 2. Set Up SSL

```bash
# Obtain SSL certificates
./scripts/setup-ssl.sh

# Enter your email and domain when prompted
```

### 3. Deploy Application

```bash
# Deploy everything
./scripts/deploy.sh
```

This will:
- Build frontend and backend
- Run database migrations  
- Start all services
- Run health checks

### 4. Verify Deployment

```bash
# Run comprehensive health check
./scripts/health-check.sh yourdomain.com
```

**That's it!** Your NostrMaxi instance is live at `https://yourdomain.com`

---

## Post-Deploy Setup

### Configure LNbits Webhook

1. Go to your LNbits instance
2. Navigate to Extensions → LNURLp
3. Set webhook URL: `https://yourdomain.com/api/v1/payments/webhook`
4. Set webhook secret to match `WEBHOOK_SECRET` in `.env.prod`

### Set Up Monitoring

```bash
# Set up automated monitoring via cron
./scripts/setup-monitoring.sh yourdomain.com
```

### Test Payment Flow

1. Visit `https://yourdomain.com`
2. Login with NIP-07 extension
3. Go to Pricing page
4. Select a tier and test payment
5. Verify subscription upgrade

---

## File Structure

```
nostrmaxi/
├── docker-compose.prod.yml      # Production compose file
├── Dockerfile.prod              # Production backend Dockerfile
├── nginx/
│   ├── nginx.conf              # Nginx configuration with rate limiting
│   └── ssl/                    # SSL certificates
├── scripts/
│   ├── deploy.sh              # Main deployment script
│   ├── setup-ssl.sh           # SSL certificate setup
│   ├── health-check.sh        # Health monitoring
│   ├── backup-db.sh           # Database backup
│   ├── rollback.sh            # Rollback to previous version
│   ├── monitor.sh             # Continuous monitoring
│   ├── setup-monitoring.sh    # Set up cron jobs
│   └── stats.sh               # Quick statistics
├── .env.prod                   # Production environment (DO NOT COMMIT)
├── DEPLOYMENT.md              # Complete deployment guide
├── ADMIN-GUIDE.md             # Admin operations guide
└── PRODUCTION-CHECKLIST.md    # Pre-launch checklist
```

---

## Common Commands

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop all services
docker-compose -f docker-compose.prod.yml down

# View service status
docker-compose -f docker-compose.prod.yml ps

# Access backend shell
docker-compose -f docker-compose.prod.yml exec backend sh

# Access database
docker-compose -f docker-compose.prod.yml exec db psql -U nostrmaxi

# Run health check
./scripts/health-check.sh yourdomain.com

# View statistics
./scripts/stats.sh

# Create manual backup
docker-compose -f docker-compose.prod.yml exec db \
  pg_dump -U nostrmaxi nostrmaxi | gzip > backups/manual_$(date +%Y%m%d).sql.gz
```

---

## Updating

```bash
# Pull latest code
git pull origin main

# Redeploy
./scripts/deploy.sh
```

---

## Rollback

```bash
# Rollback to previous database backup
./scripts/rollback.sh

# Follow prompts to select backup
```

---

## Monitoring

### Automated Monitoring (via cron)

After running `./scripts/setup-monitoring.sh`, these jobs run automatically:

- Health check every 5 minutes
- Statistics collection every hour  
- Database backup every 6 hours
- Log cleanup weekly
- SSL renewal check monthly
- Database vacuum monthly

### Manual Monitoring

```bash
# Quick health check
./scripts/health-check.sh yourdomain.com

# View statistics
./scripts/stats.sh

# Watch logs in real-time
docker-compose -f docker-compose.prod.yml logs -f
```

### External Monitoring

Set up external monitoring with:
- **UptimeRobot**: Monitor `https://yourdomain.com/health`
- **Healthchecks.io**: Ping on successful health checks
- **SSL Monitor**: Track certificate expiry

---

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check disk space
df -h

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

### Database connection failed

```bash
# Check database health
docker-compose -f docker-compose.prod.yml exec db pg_isready -U nostrmaxi

# View database logs
docker-compose -f docker-compose.prod.yml logs db

# Restart database
docker-compose -f docker-compose.prod.yml restart db
```

### SSL certificate issues

```bash
# Check certificate
openssl x509 -in nginx/ssl/fullchain.pem -noout -dates

# Renew certificate
sudo certbot renew --force-renewal
sudo cp /etc/letsencrypt/live/yourdomain.com/*.pem nginx/ssl/
docker-compose -f docker-compose.prod.yml restart nginx
```

### Payment webhooks not working

```bash
# Check backend logs
docker-compose -f docker-compose.prod.yml logs backend | grep webhook

# Verify webhook secret matches
grep WEBHOOK_SECRET .env.prod

# Test webhook manually
curl -X POST https://yourdomain.com/api/v1/payments/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{"payment_hash":"test","paid":true}'
```

---

## Security Checklist

- [ ] Strong random secrets for DB_PASSWORD, JWT_SECRET, WEBHOOK_SECRET
- [ ] SSL/TLS enabled with A+ rating
- [ ] Firewall configured (UFW/iptables)
- [ ] SSH key authentication only
- [ ] Admin pubkeys verified
- [ ] CORS origins restricted
- [ ] Rate limiting enabled
- [ ] Backups tested and working
- [ ] Monitoring configured

---

## Support

- **Documentation**: See `DEPLOYMENT.md` and `ADMIN-GUIDE.md`
- **Issues**: Create GitHub issue
- **Security**: DM admin via nostr

---

## License

MIT License - See LICENSE file

---

**Last Updated**: 2026-02-11  
**Version**: 1.0.0
