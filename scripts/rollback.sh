#!/bin/bash
# Rollback to previous deployment

set -e

echo "⏮️  NostrMaxi Rollback Script"
echo "============================"

# List available backups
echo "Available database backups:"
ls -lh backups/ | grep "nostrmaxi_"

echo ""
read -p "Enter backup filename to restore (or 'cancel'): " BACKUP_FILE

if [ "$BACKUP_FILE" = "cancel" ] || [ -z "$BACKUP_FILE" ]; then
    echo "Rollback cancelled"
    exit 0
fi

if [ ! -f "backups/$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: backups/$BACKUP_FILE"
    exit 1
fi

echo ""
echo "⚠️  WARNING: This will:"
echo "   1. Stop all services"
echo "   2. Restore database from backup"
echo "   3. Restart services"
echo ""
read -p "Are you sure? (type 'yes' to continue): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Rollback cancelled"
    exit 0
fi

# Stop services
echo "🛑 Stopping services..."
docker-compose -f docker-compose.prod.yml down

# Start database
echo "🗄️  Starting database..."
docker-compose -f docker-compose.prod.yml up -d db
sleep 10

# Restore backup
echo "📥 Restoring database from $BACKUP_FILE..."
gunzip -c "backups/$BACKUP_FILE" | docker-compose -f docker-compose.prod.yml exec -T db psql -U nostrmaxi -d nostrmaxi

# Start all services
echo "🚀 Starting all services..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "✅ Rollback completed!"
echo ""
echo "Please verify the application is working correctly:"
echo "  ./scripts/health-check.sh"
