#!/bin/bash
# Set up automated monitoring with cron

set -e

echo "📊 Setting up monitoring for NostrMaxi"
echo "======================================="

DOMAIN="${1}"
if [ -z "$DOMAIN" ]; then
    echo "Usage: ./scripts/setup-monitoring.sh yourdomain.com"
    exit 1
fi

PROJECT_DIR="$(pwd)"
MONITOR_SCRIPT="$PROJECT_DIR/scripts/monitor.sh"

if [ ! -f "$MONITOR_SCRIPT" ]; then
    echo "❌ Monitor script not found: $MONITOR_SCRIPT"
    exit 1
fi

# Make sure script is executable
chmod +x "$MONITOR_SCRIPT"

echo "Setting up monitoring for: $DOMAIN"
echo "Project directory: $PROJECT_DIR"

# Create cron jobs
CRON_FILE="/tmp/nostrmaxi-cron"

cat > "$CRON_FILE" <<EOF
# NostrMaxi Monitoring Jobs

# Health check every 5 minutes
*/5 * * * * cd $PROJECT_DIR && ./scripts/health-check.sh $DOMAIN >> logs/health-check.log 2>&1

# Stats collection every hour
0 * * * * cd $PROJECT_DIR && ./scripts/stats.sh >> logs/stats.log 2>&1

# Database backup every 6 hours (already handled by docker-compose, this is backup)
0 */6 * * * cd $PROJECT_DIR && docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U nostrmaxi nostrmaxi | gzip > backups/cron_\$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz

# Clean old logs weekly (Sundays at 3am)
0 3 * * 0 find $PROJECT_DIR/logs -name "*.log" -mtime +14 -delete

# Clean old backups weekly (Sundays at 4am)
0 4 * * 0 find $PROJECT_DIR/backups -name "*.sql.gz" -mtime +30 -delete

# SSL certificate renewal check monthly (1st of month at 2am)
0 2 1 * * certbot renew --quiet --post-hook "cd $PROJECT_DIR && docker-compose -f docker-compose.prod.yml restart nginx"

# Monthly database vacuum (1st of month at 5am)
0 5 1 * * cd $PROJECT_DIR && docker-compose -f docker-compose.prod.yml exec -T db psql -U nostrmaxi -c "VACUUM ANALYZE;" >> logs/vacuum.log 2>&1
EOF

# Load cron jobs
echo ""
echo "Installing cron jobs..."
(crontab -l 2>/dev/null | grep -v "NostrMaxi"; cat "$CRON_FILE") | crontab -
rm "$CRON_FILE"

echo "✅ Cron jobs installed:"
echo ""
crontab -l | grep -A 20 "NostrMaxi"
echo ""
echo "Logs will be stored in:"
echo "  - $PROJECT_DIR/logs/health-check.log"
echo "  - $PROJECT_DIR/logs/stats.log"
echo "  - $PROJECT_DIR/logs/vacuum.log"
echo ""
echo "To view cron jobs: crontab -l"
echo "To remove cron jobs: crontab -e (then delete the NostrMaxi section)"
