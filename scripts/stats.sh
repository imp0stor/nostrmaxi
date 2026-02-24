#!/bin/bash
# Quick statistics script

set -e

echo "NostrMaxi Statistics - $(date)"
echo "======================================"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found"
    exit 1
fi

# Total users
echo -n "Total Users: "
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -tAc "SELECT COUNT(*) FROM \"User\";" 2>/dev/null || echo "N/A"

# Active subscriptions
echo -n "Active Subscriptions: "
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -tAc "SELECT COUNT(*) FROM \"Subscription\" WHERE \"expiresAt\" > NOW() AND \"cancelledAt\" IS NULL;" 2>/dev/null || echo "N/A"

# Revenue metrics
echo -n "MRR (USD): $"
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -tAc "SELECT COALESCE(SUM(\"priceUsd\"/100.0), 0) FROM \"Subscription\" WHERE \"expiresAt\" > NOW() AND tier IN ('PRO', 'BUSINESS');" 2>/dev/null || echo "N/A"

echo -n "Total Revenue (USD): $"
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -tAc "SELECT COALESCE(SUM(\"amountUsd\"/100.0), 0) FROM \"Payment\" WHERE status = 'paid';" 2>/dev/null || echo "N/A"

# Tier breakdown
echo ""
echo "Subscriptions by Tier:"
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -tAc "SELECT tier, COUNT(*) FROM \"Subscription\" WHERE \"expiresAt\" > NOW() GROUP BY tier ORDER BY tier;" 2>/dev/null | \
  awk -F'|' '{printf "  %-12s: %s\n", $1, $2}' || echo "  N/A"

# NIP-05 identities
echo ""
echo -n "Total NIP-05 Identities: "
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -tAc "SELECT COUNT(*) FROM \"Nip05\" WHERE \"isActive\" = true;" 2>/dev/null || echo "N/A"

# System resources
echo ""
echo "System Resources:"
echo "  Disk Usage: $(df -h / | tail -1 | awk '{print $5}') of $(df -h / | tail -1 | awk '{print $2}')"
echo "  Memory: $(free -h | grep Mem | awk '{print $3}') / $(free -h | grep Mem | awk '{print $2}')"

# Database size
echo ""
echo -n "Database Size: "
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U nostrmaxi -tAc "SELECT pg_size_pretty(pg_database_size('nostrmaxi'));" 2>/dev/null || echo "N/A"

# Container status
echo ""
echo "Container Status:"
docker-compose -f docker-compose.prod.yml ps 2>/dev/null | tail -n +2 | \
  awk '{printf "  %-15s: %s\n", $1, $4}' || echo "  N/A"

echo ""
echo "======================================"
