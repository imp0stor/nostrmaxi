#!/bin/bash
# Comprehensive health check script

set -e

DOMAIN="${1:-localhost}"
PROTOCOL="https"

if [ "$DOMAIN" = "localhost" ]; then
    PROTOCOL="http"
fi

echo "🏥 NostrMaxi Health Check"
echo "========================="
echo "Target: $PROTOCOL://$DOMAIN"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    printf "Testing %-30s ... " "$name"
    
    status=$(curl -s -o /dev/null -w "%{http_code}" -k "$url" || echo "000")
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ OK${NC} ($status)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (got $status, expected $expected_status)"
        return 1
    fi
}

FAILED=0

# Basic health checks
test_endpoint "Health endpoint" "$PROTOCOL://$DOMAIN/health" || FAILED=$((FAILED+1))
test_endpoint "NIP-05 well-known" "$PROTOCOL://$DOMAIN/.well-known/nostr.json" || FAILED=$((FAILED+1))
test_endpoint "API docs" "$PROTOCOL://$DOMAIN/api/docs" 301 || FAILED=$((FAILED+1))
test_endpoint "Frontend" "$PROTOCOL://$DOMAIN/" || FAILED=$((FAILED+1))

# API endpoint checks
test_endpoint "Subscription tiers" "$PROTOCOL://$DOMAIN/api/v1/payments/tiers" || FAILED=$((FAILED+1))

# Docker service checks
echo ""
echo "Docker Services Status:"
echo "======================="

if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.prod.yml ps
    
    # Check container health
    echo ""
    echo "Container Health:"
    for service in backend db nginx; do
        health=$(docker inspect --format='{{.State.Health.Status}}' "nostrmaxi-${service}-1" 2>/dev/null || echo "unknown")
        printf "%-15s: " "$service"
        
        if [ "$health" = "healthy" ]; then
            echo -e "${GREEN}healthy${NC}"
        elif [ "$health" = "unknown" ]; then
            echo -e "${YELLOW}no healthcheck${NC}"
        else
            echo -e "${RED}$health${NC}"
            FAILED=$((FAILED+1))
        fi
    done
fi

# Database connection test
echo ""
echo "Database Connection:"
echo "===================="
if docker-compose -f docker-compose.prod.yml exec -T db pg_isready -U nostrmaxi > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is accepting connections${NC}"
else
    echo -e "${RED}✗ Database is not responding${NC}"
    FAILED=$((FAILED+1))
fi

# SSL certificate check
if [ "$PROTOCOL" = "https" ]; then
    echo ""
    echo "SSL Certificate:"
    echo "================"
    
    cert_expiry=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | \
                  openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    
    if [ -n "$cert_expiry" ]; then
        echo -e "${GREEN}✓ Certificate valid until: $cert_expiry${NC}"
    else
        echo -e "${RED}✗ Could not verify SSL certificate${NC}"
        FAILED=$((FAILED+1))
    fi
fi

# Summary
echo ""
echo "Summary:"
echo "========"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILED check(s) failed${NC}"
    exit 1
fi
