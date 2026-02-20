# NostrMaxi - Production Deployment Guide

Complete guide for deploying NostrMaxi to production with SSL, monitoring, backups, and operational runbooks.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Server Setup](#server-setup)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Payment Integration](#payment-integration)
8. [Backups](#backups)
9. [Monitoring](#monitoring)
10. [Operations](#operations)
11. [Security Hardening](#security-hardening)
12. [Troubleshooting](#troubleshooting)
13. [Disaster Recovery](#disaster-recovery)

---

## Quick Start

For experienced operators, here's the TL;DR:

```bash
# 1. Clone and configure
git clone https://github.com/yourusername/nostrmaxi.git && cd nostrmaxi
cp .env.production .env.prod
nano .env.prod  # Fill in DOMAIN, DB_PASSWORD, JWT_SECRET, etc.

# 2. Deploy
chmod +x scripts/*.sh
./scripts/deploy.sh

# 3. Setup SSL
./scripts/ssl-setup.sh

# 4. Verify
./scripts/health-check.sh $DOMAIN
```

---

## Prerequisites

### Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| RAM | 2GB | 4GB+ |
| CPU | 2 cores | 4 cores |
| Disk | 20GB SSD | 50GB+ SSD |
| Network | 100 Mbps | 1 Gbps |

### Required Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH (restrict to your IP) |
| 80 | TCP | HTTP (redirects to HTTPS) |
| 443 | TCP | HTTPS |

### Software Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Install utilities
sudo apt install -y git curl wget openssl certbot jq

# Verify installations
docker --version
docker compose version
```

### Domain Setup

1. Purchase/configure your domain (e.g., `nostrmaxi.com`)
2. Create DNS A record pointing to your server's IP
3. Wait for DNS propagation (verify with `dig nostrmaxi.com +short`)
4. Optionally create a CAA record: `0 issue "letsencrypt.org"`

---

## Server Setup

### 1. Create Application User (Optional)

```bash
# Create dedicated user
sudo adduser nostrmaxi
sudo usermod -aG docker nostrmaxi
sudo su - nostrmaxi
```

### 2. Clone Repository

```bash
cd ~
git clone https://github.com/yourusername/nostrmaxi.git
cd nostrmaxi
```

### 3. Directory Structure

The project creates these directories:

```
nostrmaxi/
├── backups/           # Database backups
├── frontend/dist/     # Built frontend
├── logs/
│   └── nginx/         # Nginx logs
├── nginx/
│   ├── ssl/           # SSL certificates
│   ├── nginx.conf     # Nginx configuration
│   └── dhparam.pem    # DH parameters
└── scripts/           # Deployment scripts
```

---

## Configuration

### 1. Create Production Environment File

```bash
cp .env.production .env.prod
chmod 600 .env.prod
nano .env.prod
```

### 2. Required Configuration

```env
# Domain
DOMAIN=nostrmaxi.com
BASE_URL=https://nostrmaxi.com

# Database - Generate a strong password!
DB_PASSWORD=$(openssl rand -hex 32)

# JWT Secret - Must be unique and secure!
JWT_SECRET=$(openssl rand -hex 64)

# Webhook Secret - For payment verification
WEBHOOK_SECRET=$(openssl rand -hex 32)

# Payment Provider (btcpay or lnbits)
PAYMENTS_PROVIDER=btcpay

# BTCPay Server (preferred)
BTCPAY_URL=https://btcpay.example.com
BTCPAY_API_KEY=your-btcpay-api-key
BTCPAY_STORE_ID=your-btcpay-store-id
BTCPAY_WEBHOOK_SECRET=$(openssl rand -hex 32)

# LNbits (legacy fallback)
LNBITS_URL=https://legend.lnbits.com
LNBITS_API_KEY=your-lnbits-invoice-read-key
LNBITS_WEBHOOK_SECRET=$(openssl rand -hex 32)

# NIP-05 Relays
NIP05_RELAYS=wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol

# Admin pubkeys (hex format, comma-separated)
ADMIN_PUBKEYS=abc123def456...
```

### 3. Generate Secrets Helper

```bash
# Generate all secrets at once
echo "DB_PASSWORD=$(openssl rand -hex 32)"
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "WEBHOOK_SECRET=$(openssl rand -hex 32)"
```

---

## Deployment

### Full Deployment

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run full deployment
./scripts/deploy.sh
```

**What this does:**
1. ✅ Validates environment configuration
2. ✅ Creates necessary directories
3. ✅ Builds frontend and backend
4. ✅ Pulls latest Docker images
5. ✅ Builds application containers
6. ✅ Runs database migrations
7. ✅ Starts all services
8. ✅ Waits for health checks
9. ✅ Verifies deployment

### Deployment Options

```bash
# Rolling update (default, minimal downtime)
./scripts/deploy.sh

# Full recreate (stops all services first)
./scripts/deploy.sh --recreate

# Skip build (use existing images)
./scripts/deploy.sh --skip-build

# Skip image pull
./scripts/deploy.sh --skip-pull

# Help
./scripts/deploy.sh --help
```

### Verify Deployment

```bash
# Check all services are running
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Test health endpoint
curl http://localhost/health

# Run comprehensive health check
./scripts/health-check.sh localhost
```

---

## SSL/TLS Setup

### Automated Setup (Recommended)

```bash
./scripts/ssl-setup.sh
```

**Process:**
1. Installs certbot if needed
2. Generates DH parameters (2048-bit)
3. Obtains Let's Encrypt certificate
4. Configures auto-renewal
5. Restarts nginx with HTTPS

### Options

```bash
# Use staging environment (for testing)
./scripts/ssl-setup.sh --staging

# Force renewal
./scripts/ssl-setup.sh --renew

# Verify existing certificate
./scripts/ssl-setup.sh --verify
```

### Manual Certificate Setup

If using custom certificates:

```bash
# Copy your certificates
cp /path/to/fullchain.pem nginx/ssl/
cp /path/to/privkey.pem nginx/ssl/

# Generate DH parameters
openssl dhparam -out nginx/dhparam.pem 2048

# Restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### Verify SSL

```bash
# Check certificate details
openssl x509 -in nginx/ssl/fullchain.pem -noout -subject -dates

# Test HTTPS
curl -v https://nostrmaxi.com/health

# Check SSL Labs rating
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=nostrmaxi.com
```

---

## Payment Integration

### LNbits Setup

1. **Create LNbits Wallet**
   - Go to https://legend.lnbits.com (or self-hosted)
   - Create a new wallet
   - Navigate to API Info → Copy Invoice/Read key

2. **Configure in .env.prod**
   ```env
   LNBITS_URL=https://legend.lnbits.com
   LNBITS_API_KEY=your-invoice-read-key
   ```

3. **Set Up Webhook**
   - In LNbits wallet settings, add webhook URL:
     ```
     https://nostrmaxi.com/api/v1/payments/webhook
     ```
   - Set webhook secret (same as `WEBHOOK_SECRET`)

### Test Payments

```bash
# Create test invoice
curl -X POST https://nostrmaxi.com/api/v1/payments/invoice \
  -H "Content-Type: application/json" \
  -d '{"tier":"PRO","userId":"testuser"}'
```

### Payment Tiers

| Tier | Price | Features |
|------|-------|----------|
| FREE | $0 | 1 NIP-05 identifier |
| PRO | $9/mo | Custom domain, analytics |
| BUSINESS | $29/mo | 10 identities, API access |
| LIFETIME | $99 | Pro features forever |

---

## Backups

### Automatic Backups

The `db-backup` container runs automatic backups every 6 hours.

**Retention Policy:**
- Daily backups: 7 days
- Weekly backups (Sundays): 4 weeks
- Monthly backups (1st of month): 6 months

### Manual Backup

```bash
# Create manual backup
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U nostrmaxi nostrmaxi | gzip > backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Backup Commands

```bash
# Run backup script directly
docker compose -f docker-compose.prod.yml exec db-backup /backup-db.sh backup

# List all backups
docker compose -f docker-compose.prod.yml exec db-backup /backup-db.sh list

# Verify latest backup
docker compose -f docker-compose.prod.yml exec db-backup /backup-db.sh verify

# Check backup health
docker compose -f docker-compose.prod.yml exec db-backup /backup-db.sh health
```

### Restore from Backup

```bash
# Stop backend to prevent writes
docker compose -f docker-compose.prod.yml stop backend

# Restore backup
gunzip -c backups/nostrmaxi_daily_20260212_030000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -d nostrmaxi

# Restart backend
docker compose -f docker-compose.prod.yml start backend
```

### Remote Backups (Optional)

Set environment variables for remote backup:

```bash
# AWS S3
export S3_BUCKET=your-bucket-name
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

# Restic
export RESTIC_REPOSITORY=s3:s3.amazonaws.com/your-bucket
export RESTIC_PASSWORD=your-restic-password
```

---

## Monitoring

### Built-in Health Checks

```bash
# Check all service health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Comprehensive health check
./scripts/health-check.sh nostrmaxi.com
```

### Key Endpoints to Monitor

| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `/health` | API health | Every 1 min |
| `/.well-known/nostr.json?name=test` | NIP-05 service | Every 5 min |
| `/api/v1/payments/status` | Payment system | Every 5 min |

### External Monitoring Services

**Recommended free services:**
- [UptimeRobot](https://uptimerobot.com) - Uptime monitoring
- [Healthchecks.io](https://healthchecks.io) - Cron/backup monitoring
- [BetterStack](https://betterstack.com) - Logs and status pages

### Log Management

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service
docker compose -f docker-compose.prod.yml logs -f backend

# Tail nginx access logs
tail -f logs/nginx/access.log

# Tail nginx error logs  
tail -f logs/nginx/error.log
```

### Setup Logrotate

```bash
sudo tee /etc/logrotate.d/nostrmaxi << 'EOF'
/home/nostrmaxi/nostrmaxi/logs/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        docker compose -f /home/nostrmaxi/nostrmaxi/docker-compose.prod.yml exec -T nginx nginx -s reopen 2>/dev/null || true
    endscript
}
EOF
```

---

## Operations

### Common Tasks

#### Restart All Services
```bash
docker compose -f docker-compose.prod.yml restart
```

#### Restart Single Service
```bash
docker compose -f docker-compose.prod.yml restart backend
```

#### View Container Resource Usage
```bash
docker stats
```

#### Access Database Shell
```bash
docker compose -f docker-compose.prod.yml exec db psql -U nostrmaxi
```

#### Access Backend Shell
```bash
docker compose -f docker-compose.prod.yml exec backend sh
```

#### Update Application
```bash
git pull origin main
./scripts/deploy.sh
```

#### Rollback Deployment
```bash
./scripts/rollback.sh
```

### Database Operations

```bash
# Connect to database
docker compose -f docker-compose.prod.yml exec db psql -U nostrmaxi

# Run SQL query
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -c "SELECT count(*) FROM \"User\";"

# Check active connections
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -c "SELECT * FROM pg_stat_activity WHERE datname='nostrmaxi';"

# Vacuum database
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -c "VACUUM ANALYZE;"
```

### SSL Operations

```bash
# Check certificate expiry
./scripts/ssl-setup.sh --verify

# Force certificate renewal
sudo certbot renew --force-renewal

# Copy renewed certificates
sudo cp /etc/letsencrypt/live/$DOMAIN/*.pem nginx/ssl/
sudo chown $USER:$USER nginx/ssl/*.pem
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Security Hardening

### Pre-Launch Checklist

- [ ] Strong, unique passwords for DB_PASSWORD, JWT_SECRET, WEBHOOK_SECRET
- [ ] SSL/TLS configured with A+ rating
- [ ] Firewall enabled (UFW)
- [ ] SSH key authentication only
- [ ] Fail2ban configured
- [ ] .env.prod not in version control
- [ ] Admin pubkeys configured
- [ ] Database not exposed to internet
- [ ] Rate limiting enabled
- [ ] CORS properly configured

### Firewall Setup (UFW)

```bash
# Install and enable UFW
sudo apt install ufw -y
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
sudo ufw status
```

### SSH Hardening

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Set these values:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
X11Forwarding no
AllowUsers nostrmaxi

# Restart SSH
sudo systemctl restart ssh
```

### Fail2ban Setup

```bash
# Install
sudo apt install fail2ban -y

# Configure
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
logpath = /home/nostrmaxi/nostrmaxi/logs/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /home/nostrmaxi/nostrmaxi/logs/nginx/error.log
maxretry = 10
EOF

# Start
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo fail2ban-client status
```

### Security Headers Test

Verify security headers at: https://securityheaders.com/?q=nostrmaxi.com

Expected headers:
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options
- Content-Security-Policy
- Referrer-Policy
- Permissions-Policy

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs for errors
docker compose -f docker-compose.prod.yml logs

# Check disk space
df -h

# Check memory
free -m

# Check Docker daemon
sudo systemctl status docker

# Restart Docker daemon
sudo systemctl restart docker
```

### Database Connection Issues

```bash
# Check database is running
docker compose -f docker-compose.prod.yml ps db

# Check database logs
docker compose -f docker-compose.prod.yml logs db

# Test database connection
docker compose -f docker-compose.prod.yml exec db pg_isready -U nostrmaxi

# Check connection string
docker compose -f docker-compose.prod.yml exec backend printenv DATABASE_URL
```

### Backend Startup Failures

```bash
# Check backend logs
docker compose -f docker-compose.prod.yml logs backend

# Check Prisma migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate status

# Regenerate Prisma client
docker compose -f docker-compose.prod.yml exec backend npx prisma generate
```

### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in nginx/ssl/fullchain.pem -noout -dates

# Test certificate chain
openssl s_client -connect nostrmaxi.com:443 -servername nostrmaxi.com

# Check nginx SSL config
docker compose -f docker-compose.prod.yml exec nginx nginx -t

# Check certbot renewal
sudo certbot certificates
```

### Payment Webhook Issues

```bash
# Check webhook logs
docker compose -f docker-compose.prod.yml logs backend | grep -i webhook

# Verify webhook secret matches
grep WEBHOOK_SECRET .env.prod

# Test webhook manually
curl -X POST https://nostrmaxi.com/api/v1/payments/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{"payment_hash":"test","paid":true}'
```

### High Resource Usage

```bash
# Check container stats
docker stats --no-stream

# Check for memory leaks
docker compose -f docker-compose.prod.yml restart backend

# Prune unused Docker resources
docker system prune -a
```

---

## Disaster Recovery

### Scenario: Complete Server Loss

1. **Provision new server** with same specs
2. **Restore from backup**
   ```bash
   # Clone repo
   git clone https://github.com/yourusername/nostrmaxi.git
   cd nostrmaxi
   
   # Restore .env.prod from secure backup
   # Restore database backup
   cp /path/to/backup/nostrmaxi_*.sql.gz backups/
   
   # Deploy
   ./scripts/deploy.sh
   
   # Restore database
   gunzip -c backups/nostrmaxi_daily_latest.sql.gz | \
     docker compose -f docker-compose.prod.yml exec -T db psql -U nostrmaxi
   ```
3. **Update DNS** to point to new server IP
4. **Obtain new SSL certificate**
   ```bash
   ./scripts/ssl-setup.sh
   ```

### Scenario: Database Corruption

1. **Stop backend** to prevent further corruption
   ```bash
   docker compose -f docker-compose.prod.yml stop backend
   ```
2. **Identify latest good backup**
   ```bash
   ls -la backups/
   ```
3. **Restore from backup**
   ```bash
   # Drop and recreate database
   docker compose -f docker-compose.prod.yml exec db \
     psql -U nostrmaxi -c "DROP DATABASE nostrmaxi; CREATE DATABASE nostrmaxi;"
   
   # Restore
   gunzip -c backups/nostrmaxi_daily_20260211.sql.gz | \
     docker compose -f docker-compose.prod.yml exec -T db psql -U nostrmaxi
   ```
4. **Run migrations** (if schema changed)
   ```bash
   docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
   ```
5. **Restart services**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

### Scenario: Compromised Secrets

1. **Immediately rotate all secrets**
   ```bash
   # Generate new secrets
   openssl rand -hex 32  # DB_PASSWORD
   openssl rand -hex 64  # JWT_SECRET
   openssl rand -hex 32  # WEBHOOK_SECRET
   ```
2. **Update .env.prod** with new secrets
3. **Restart all services**
   ```bash
   docker compose -f docker-compose.prod.yml down
   docker compose -f docker-compose.prod.yml up -d
   ```
4. **Invalidate all sessions** (users will need to re-authenticate)
5. **Review access logs** for suspicious activity
6. **Update LNbits webhook** with new secret

---

## Support & Resources

- **GitHub Issues**: Report bugs and request features
- **Documentation**: See `COMPLETION.md` for API details
- **Admin Guide**: See `ADMIN-GUIDE.md` for administration
- **Nostr**: DM admin pubkeys for urgent issues

---

**Version**: 2.0.0  
**Last Updated**: 2026-02-12  
**Maintainer**: NostrMaxi Team
