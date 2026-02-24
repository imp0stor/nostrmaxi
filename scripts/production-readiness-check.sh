#!/usr/bin/env bash
# NostrMaxi Production Readiness Checker
# Validates all preconditions for production cutover
# Exit code: 0 = READY, 1 = NOT READY

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        NostrMaxi Production Readiness Checker v1.0             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Helper functions
check_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
    ((WARNINGS++))
}

section() {
    echo ""
    echo -e "${BLUE}━━━ $1 ━━━${NC}"
}

# Load environment file
ENV_FILE="${1:-.env.prod}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}ERROR: Environment file not found: $ENV_FILE${NC}"
    echo "Usage: $0 [path-to-env-file]"
    echo "Example: $0 .env.prod"
    exit 1
fi

echo "Loading environment from: $ENV_FILE"
set -a
source "$ENV_FILE"
set +a
echo ""

# ============================================================================
# 1. CRITICAL ENVIRONMENT VARIABLES
# ============================================================================
section "1. Critical Environment Variables"

# Required secrets
if [[ -z "${JWT_SECRET:-}" ]] || [[ "$JWT_SECRET" == *"change-in-production"* ]] || [[ "$JWT_SECRET" == *"your-"* ]]; then
    check_fail "JWT_SECRET not set or using placeholder value"
else
    if [[ ${#JWT_SECRET} -lt 32 ]]; then
        check_warn "JWT_SECRET is too short (${#JWT_SECRET} chars, recommend 64+)"
    else
        check_pass "JWT_SECRET configured (${#JWT_SECRET} chars)"
    fi
fi

if [[ -z "${WEBHOOK_SECRET:-}" ]] || [[ "$WEBHOOK_SECRET" == *"your-"* ]]; then
    check_fail "WEBHOOK_SECRET not set or using placeholder"
else
    if [[ ${#WEBHOOK_SECRET} -lt 32 ]]; then
        check_warn "WEBHOOK_SECRET is too short (${#WEBHOOK_SECRET} chars, recommend 64+)"
    else
        check_pass "WEBHOOK_SECRET configured (${#WEBHOOK_SECRET} chars)"
    fi
fi

# Database
if [[ -z "${DATABASE_URL:-}" ]]; then
    check_fail "DATABASE_URL not set"
elif [[ "$DATABASE_URL" == *"postgres:postgres"* ]]; then
    check_warn "DATABASE_URL using default postgres:postgres credentials"
else
    check_pass "DATABASE_URL configured"
fi

# Domain configuration
if [[ -z "${DOMAIN:-}" ]] || [[ "$DOMAIN" == "nostrmaxi.com" ]]; then
    check_warn "DOMAIN not set or using example value (nostrmaxi.com)"
else
    check_pass "DOMAIN configured: $DOMAIN"
fi

if [[ -z "${BASE_URL:-}" ]] || [[ "$BASE_URL" == *"localhost"* ]]; then
    check_fail "BASE_URL not set or using localhost"
else
    if [[ "$BASE_URL" != https://* ]]; then
        check_fail "BASE_URL must use https:// in production (got: $BASE_URL)"
    else
        check_pass "BASE_URL configured: $BASE_URL"
    fi
fi

# Admin pubkeys
if [[ -z "${ADMIN_PUBKEYS:-}" ]]; then
    check_fail "ADMIN_PUBKEYS not configured (no admin access!)"
else
    PUBKEY_COUNT=$(echo "$ADMIN_PUBKEYS" | tr ',' '\n' | wc -l)
    # Validate hex format (basic check)
    if echo "$ADMIN_PUBKEYS" | grep -qE '^[0-9a-fA-F,]+$'; then
        check_pass "ADMIN_PUBKEYS configured ($PUBKEY_COUNT pubkey(s))"
    else
        check_fail "ADMIN_PUBKEYS format invalid (must be hex pubkeys)"
    fi
fi

# NIP-05 configuration
if [[ -z "${NIP05_DEFAULT_DOMAIN:-}" ]]; then
    check_fail "NIP05_DEFAULT_DOMAIN not set"
else
    check_pass "NIP05_DEFAULT_DOMAIN: $NIP05_DEFAULT_DOMAIN"
fi

if [[ -z "${NIP05_DEFAULT_RELAYS:-}" ]]; then
    check_warn "NIP05_DEFAULT_RELAYS not set (will use hardcoded defaults)"
else
    RELAY_COUNT=$(echo "$NIP05_DEFAULT_RELAYS" | tr ',' '\n' | wc -l)
    check_pass "NIP05_DEFAULT_RELAYS configured ($RELAY_COUNT relay(s))"
fi

# ============================================================================
# 2. PAYMENT PROVIDER CONFIGURATION
# ============================================================================
section "2. Payment Provider Configuration"

PAYMENTS_PROVIDER="${PAYMENTS_PROVIDER:-btcpay}"

if [[ "$PAYMENTS_PROVIDER" == "btcpay" ]]; then
    echo "Payment provider: BTCPay Server"
    
    if [[ -z "${BTCPAY_URL:-}" ]] || [[ "$BTCPAY_URL" == *"example.com"* ]]; then
        check_fail "BTCPAY_URL not set or using placeholder"
    else
        check_pass "BTCPAY_URL: $BTCPAY_URL"
    fi
    
    if [[ -z "${BTCPAY_API_KEY:-}" ]] || [[ "$BTCPAY_API_KEY" == *"your-"* ]]; then
        check_fail "BTCPAY_API_KEY not set or using placeholder"
    else
        check_pass "BTCPAY_API_KEY configured (${#BTCPAY_API_KEY} chars)"
    fi
    
    if [[ -z "${BTCPAY_STORE_ID:-}" ]] || [[ "$BTCPAY_STORE_ID" == *"your-"* ]]; then
        check_fail "BTCPAY_STORE_ID not set or using placeholder"
    else
        check_pass "BTCPAY_STORE_ID: $BTCPAY_STORE_ID"
    fi
    
    if [[ -z "${BTCPAY_WEBHOOK_SECRET:-}" ]] || [[ "$BTCPAY_WEBHOOK_SECRET" == *"your-"* ]]; then
        check_warn "BTCPAY_WEBHOOK_SECRET not set (will use global WEBHOOK_SECRET)"
    else
        check_pass "BTCPAY_WEBHOOK_SECRET configured (${#BTCPAY_WEBHOOK_SECRET} chars)"
    fi
    
elif [[ "$PAYMENTS_PROVIDER" == "lnbits" ]]; then
    echo "Payment provider: LNbits (legacy fallback)"
    
    if [[ -z "${LNBITS_URL:-}" ]]; then
        check_fail "LNBITS_URL not set"
    else
        check_pass "LNBITS_URL: $LNBITS_URL"
    fi
    
    if [[ -z "${LNBITS_API_KEY:-}" ]] || [[ "$LNBITS_API_KEY" == *"your-"* ]]; then
        check_fail "LNBITS_API_KEY not set or using placeholder"
    else
        check_pass "LNBITS_API_KEY configured (${#LNBITS_API_KEY} chars)"
    fi
    
    if [[ -z "${LNBITS_WEBHOOK_SECRET:-}" ]] || [[ "$LNBITS_WEBHOOK_SECRET" == *"your-"* ]]; then
        check_warn "LNBITS_WEBHOOK_SECRET not set (will use global WEBHOOK_SECRET)"
    else
        check_pass "LNBITS_WEBHOOK_SECRET configured (${#LNBITS_WEBHOOK_SECRET} chars)"
    fi
else
    check_fail "Unknown PAYMENTS_PROVIDER: $PAYMENTS_PROVIDER (expected: btcpay or lnbits)"
fi

# ============================================================================
# 3. CORS CONFIGURATION
# ============================================================================
section "3. CORS Configuration"

if [[ -z "${CORS_ORIGINS:-}" ]]; then
    check_fail "CORS_ORIGINS not configured"
elif [[ "$CORS_ORIGINS" == "*" ]]; then
    check_fail "CORS_ORIGINS set to wildcard (*) - security risk!"
elif echo "$CORS_ORIGINS" | grep -q "localhost"; then
    if [[ "${NODE_ENV:-}" == "production" ]]; then
        check_fail "CORS_ORIGINS contains localhost in production mode"
    else
        check_warn "CORS_ORIGINS contains localhost (OK for dev/staging)"
    fi
else
    ORIGIN_COUNT=$(echo "$CORS_ORIGINS" | tr ',' '\n' | wc -l)
    check_pass "CORS_ORIGINS configured ($ORIGIN_COUNT origin(s))"
fi

# ============================================================================
# 4. DNS CONFIGURATION
# ============================================================================
section "4. DNS Configuration"

if [[ -n "${DOMAIN:-}" ]] && [[ "$DOMAIN" != "nostrmaxi.com" ]]; then
    echo "Checking DNS for: $DOMAIN"
    
    if command -v dig >/dev/null 2>&1; then
        DNS_IP=$(dig +short "$DOMAIN" A | head -1)
        if [[ -n "$DNS_IP" ]]; then
            check_pass "DNS A record resolves to: $DNS_IP"
        else
            check_fail "DNS A record not found for $DOMAIN"
        fi
    else
        check_warn "dig command not found - skipping DNS check"
    fi
    
    # Check if DNS is propagated
    if command -v host >/dev/null 2>&1; then
        if host "$DOMAIN" >/dev/null 2>&1; then
            check_pass "DNS propagation verified"
        else
            check_fail "DNS not yet propagated for $DOMAIN"
        fi
    fi
else
    check_warn "DOMAIN not configured or using example - skipping DNS checks"
fi

# ============================================================================
# 5. TLS/SSL CERTIFICATES
# ============================================================================
section "5. TLS/SSL Certificates"

if [[ -d "nginx/ssl" ]]; then
    if [[ -f "nginx/ssl/cert.pem" ]] && [[ -f "nginx/ssl/key.pem" ]]; then
        check_pass "SSL certificate files found"
        
        # Check certificate expiry if openssl is available
        if command -v openssl >/dev/null 2>&1; then
            EXPIRY=$(openssl x509 -in nginx/ssl/cert.pem -noout -enddate 2>/dev/null | cut -d= -f2)
            if [[ -n "$EXPIRY" ]]; then
                EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null)
                NOW_EPOCH=$(date +%s)
                DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
                
                if [[ $DAYS_UNTIL_EXPIRY -lt 0 ]]; then
                    check_fail "SSL certificate EXPIRED"
                elif [[ $DAYS_UNTIL_EXPIRY -lt 30 ]]; then
                    check_warn "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
                else
                    check_pass "SSL certificate valid for $DAYS_UNTIL_EXPIRY days"
                fi
            fi
        fi
    else
        check_warn "SSL certificate files not found in nginx/ssl/"
    fi
    
    if [[ -f "nginx/dhparam.pem" ]]; then
        check_pass "DH parameters file exists"
    else
        check_warn "DH parameters file not found (nginx/dhparam.pem)"
    fi
else
    check_warn "nginx/ssl directory not found - TLS not configured"
fi

# ============================================================================
# 6. DOCKER & SERVICES
# ============================================================================
section "6. Docker & Services"

if command -v docker >/dev/null 2>&1; then
    check_pass "Docker installed: $(docker --version | head -1)"
    
    if docker ps >/dev/null 2>&1; then
        check_pass "Docker daemon running"
    else
        check_fail "Docker daemon not running or permission denied"
    fi
else
    check_fail "Docker not installed"
fi

if command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1; then
    check_pass "Docker Compose available"
else
    check_fail "Docker Compose not installed"
fi

# Check if containers are running
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q nostrmaxi; then
    RUNNING_CONTAINERS=$(docker ps --filter "name=nostrmaxi" --format '{{.Names}}' | wc -l)
    check_pass "NostrMaxi containers running: $RUNNING_CONTAINERS"
else
    check_warn "No NostrMaxi containers currently running"
fi

# ============================================================================
# 7. DATABASE CONNECTIVITY
# ============================================================================
section "7. Database Connectivity"

if [[ -n "${DATABASE_URL:-}" ]]; then
    # Try to connect using docker if postgres container is running
    if docker ps --format '{{.Names}}' | grep -q postgres; then
        POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format '{{.Names}}' | head -1)
        if docker exec "$POSTGRES_CONTAINER" psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
            check_pass "Database connection successful"
        else
            check_warn "Database connection failed (container may not be ready)"
        fi
    else
        check_warn "PostgreSQL container not running - skipping connectivity test"
    fi
else
    check_fail "DATABASE_URL not configured - cannot test connectivity"
fi

# ============================================================================
# 8. REDIS CONNECTIVITY
# ============================================================================
section "8. Redis Connectivity"

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
        check_pass "Redis connection successful ($REDIS_HOST:$REDIS_PORT)"
    else
        check_warn "Redis connection failed (may not be started yet)"
    fi
elif docker ps --format '{{.Names}}' | grep -q redis; then
    REDIS_CONTAINER=$(docker ps --filter "name=redis" --format '{{.Names}}' | head -1)
    if docker exec "$REDIS_CONTAINER" redis-cli ping >/dev/null 2>&1; then
        check_pass "Redis connection successful (via Docker)"
    else
        check_warn "Redis connection failed"
    fi
else
    check_warn "Redis not accessible - will use in-memory cache fallback"
fi

# ============================================================================
# 9. FILE PERMISSIONS & SECURITY
# ============================================================================
section "9. File Permissions & Security"

if [[ -f "$ENV_FILE" ]]; then
    PERMS=$(stat -c %a "$ENV_FILE" 2>/dev/null || stat -f %A "$ENV_FILE" 2>/dev/null)
    if [[ "$PERMS" == "600" ]] || [[ "$PERMS" == "400" ]]; then
        check_pass "Environment file has secure permissions ($PERMS)"
    else
        check_warn "Environment file should have 600 permissions (current: $PERMS)"
    fi
fi

# Check if .env files are in .gitignore
if [[ -f ".gitignore" ]]; then
    if grep -q "^\.env" .gitignore; then
        check_pass ".env files in .gitignore"
    else
        check_fail ".env files NOT in .gitignore - security risk!"
    fi
else
    check_warn ".gitignore file not found"
fi

# ============================================================================
# 10. BUILD ARTIFACTS
# ============================================================================
section "10. Build Artifacts"

if [[ -d "dist" ]]; then
    if [[ -f "dist/main.js" ]]; then
        check_pass "Backend build artifacts found"
    else
        check_warn "Backend build incomplete (dist/main.js not found)"
    fi
else
    check_warn "dist/ directory not found - run 'npm run build'"
fi

if [[ -d "frontend/dist" ]]; then
    if [[ -f "frontend/dist/index.html" ]]; then
        check_pass "Frontend build artifacts found"
    else
        check_warn "Frontend build incomplete"
    fi
else
    check_warn "frontend/dist/ not found - run 'npm run build:frontend'"
fi

# ============================================================================
# 11. BACKUP CONFIGURATION
# ============================================================================
section "11. Backup Configuration"

if [[ -d "backups" ]]; then
    check_pass "Backup directory exists"
    
    BACKUP_COUNT=$(find backups -name "*.sql.gz" 2>/dev/null | wc -l)
    if [[ $BACKUP_COUNT -gt 0 ]]; then
        check_pass "Database backups found: $BACKUP_COUNT"
        
        LATEST_BACKUP=$(find backups -name "*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2)
        if [[ -n "$LATEST_BACKUP" ]]; then
            BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || stat -f %m "$LATEST_BACKUP" 2>/dev/null)) / 3600 ))
            if [[ $BACKUP_AGE_HOURS -lt 24 ]]; then
                check_pass "Latest backup is ${BACKUP_AGE_HOURS}h old"
            else
                check_warn "Latest backup is ${BACKUP_AGE_HOURS}h old (>24h)"
            fi
        fi
    else
        check_warn "No database backups found - run backup script"
    fi
else
    check_warn "Backup directory not found - create with: mkdir -p backups"
fi

# ============================================================================
# 12. MONITORING & HEALTH ENDPOINTS
# ============================================================================
section "12. Monitoring & Health Endpoints"

if [[ -f "scripts/health-check.sh" ]]; then
    check_pass "Health check script exists"
    
    if [[ -x "scripts/health-check.sh" ]]; then
        check_pass "Health check script is executable"
    else
        check_warn "Health check script not executable - run: chmod +x scripts/health-check.sh"
    fi
else
    check_warn "Health check script not found"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                        SUMMARY                                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ PRODUCTION READY - All critical checks passed              ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    
    if [[ $WARNINGS -gt 0 ]]; then
        echo ""
        echo -e "${YELLOW}Note: $WARNINGS warning(s) detected. Review recommended but not blocking.${NC}"
    fi
    
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ NOT READY FOR PRODUCTION - Fix failures before cutover     ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Fix the $FAILED failed check(s) above before proceeding."
    exit 1
fi
