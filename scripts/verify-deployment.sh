#!/bin/bash
# Deployment artifact verification script

echo "NostrMaxi Production Readiness Verification"
echo "==========================================="
echo ""

FAILED=0

# Check required files exist
echo "File Existence Checks:"
echo "---------------------"
FILES=(
  "docker-compose.prod.yml"
  "Dockerfile.prod"
  "nginx/nginx.conf"
  ".env.production"
  "scripts/deploy.sh"
  "scripts/setup-ssl.sh"
  "scripts/rollback.sh"
  "scripts/health-check.sh"
  "scripts/monitor.sh"
  "scripts/backup-db.sh"
  "DEPLOYMENT.md"
  "ADMIN-GUIDE.md"
  "PRODUCTION-CHECKLIST.md"
  "README-DEPLOY.md"
  "src/common/guards/rate-limit.guard.ts"
  "src/common/middleware/security.middleware.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo "✗ $file MISSING"
    FAILED=$((FAILED+1))
  fi
done

# Check scripts are executable
echo ""
echo "Script Permissions:"
echo "-------------------"
for script in scripts/*.sh; do
  if [ -x "$script" ]; then
    echo "✓ $(basename $script) is executable"
  else
    echo "✗ $(basename $script) NOT EXECUTABLE"
    FAILED=$((FAILED+1))
  fi
done

# Check docker-compose validates
echo ""
echo "Docker Compose Validation:"
echo "-------------------------"
if command -v docker-compose &> /dev/null; then
  if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    echo "✓ docker-compose.prod.yml is valid"
  else
    echo "✗ docker-compose.prod.yml has errors"
    FAILED=$((FAILED+1))
  fi
else
  echo "⚠ docker-compose not installed, skipping validation"
  echo "  (Will be validated during deployment)"
fi

# Check for critical configurations
echo ""
echo "Configuration Checks:"
echo "--------------------"

# Rate limiting in nginx
RATE_LIMITS=$(grep -c "limit_req_zone" nginx/nginx.conf 2>/dev/null || echo 0)
if [ "$RATE_LIMITS" -ge 4 ]; then
  echo "✓ Rate limiting configured ($RATE_LIMITS zones)"
else
  echo "✗ Rate limiting incomplete (found $RATE_LIMITS, need 4)"
  FAILED=$((FAILED+1))
fi

# Security headers in nginx
SEC_HEADERS=$(grep -c "add_header" nginx/nginx.conf 2>/dev/null || echo 0)
if [ "$SEC_HEADERS" -ge 7 ]; then
  echo "✓ Security headers configured ($SEC_HEADERS headers)"
else
  echo "✗ Security headers incomplete (found $SEC_HEADERS, need 7+)"
  FAILED=$((FAILED+1))
fi

# SSL config in nginx
SSL_DIRECTIVES=$(grep -c "ssl_" nginx/nginx.conf 2>/dev/null || echo 0)
if [ "$SSL_DIRECTIVES" -ge 10 ]; then
  echo "✓ SSL/TLS configured ($SSL_DIRECTIVES directives)"
else
  echo "✗ SSL/TLS incomplete (found $SSL_DIRECTIVES, need 10+)"
  FAILED=$((FAILED+1))
fi

# Health checks in docker-compose
HEALTHCHECKS=$(grep -c "healthcheck:" docker-compose.prod.yml 2>/dev/null || echo 0)
if [ "$HEALTHCHECKS" -ge 3 ]; then
  echo "✓ Health checks configured ($HEALTHCHECKS services)"
else
  echo "✗ Health checks incomplete (found $HEALTHCHECKS, need 3)"
  FAILED=$((FAILED+1))
fi

# Directory structure
echo ""
echo "Directory Structure:"
echo "-------------------"
DIRS=("nginx" "scripts" "backups" "logs")
for dir in "${DIRS[@]}"; do
  if [ "$dir" = "backups" ] || [ "$dir" = "logs" ]; then
    if [ -d "$dir" ]; then
      echo "✓ $dir/ exists"
    else
      echo "⚠ $dir/ will be created during deployment"
    fi
  else
    if [ -d "$dir" ]; then
      echo "✓ $dir/ exists"
    else
      echo "✗ $dir/ MISSING"
      FAILED=$((FAILED+1))
    fi
  fi
done

# Documentation completeness
echo ""
echo "Documentation:"
echo "-------------"
DOCS=(
  "DEPLOYMENT.md"
  "ADMIN-GUIDE.md"
  "PRODUCTION-CHECKLIST.md"
  "README-DEPLOY.md"
  "DEPLOYMENT-COMPLETE.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$doc" ]; then
    SIZE=$(wc -c < "$doc")
    if [ "$SIZE" -gt 1000 ]; then
      echo "✓ $doc ($(numfmt --to=iec-i --suffix=B $SIZE))"
    else
      echo "⚠ $doc is very small ($SIZE bytes)"
    fi
  else
    echo "✗ $doc MISSING"
    FAILED=$((FAILED+1))
  fi
done

# Summary
echo ""
echo "==========================================="
if [ $FAILED -eq 0 ]; then
  echo "✅ All checks passed! Ready for deployment."
  echo ""
  echo "Next steps:"
  echo "  1. Copy .env.production to .env.prod"
  echo "  2. Configure .env.prod with your settings"
  echo "  3. Run ./scripts/setup-ssl.sh"
  echo "  4. Run ./scripts/deploy.sh"
  echo "  5. Run ./scripts/health-check.sh yourdomain.com"
  exit 0
else
  echo "❌ $FAILED check(s) failed. Fix before deploying."
  echo ""
  echo "Review the errors above and fix missing files or configurations."
  exit 1
fi
