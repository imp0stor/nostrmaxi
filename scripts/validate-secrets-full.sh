#!/usr/bin/env bash
# Comprehensive secrets validation for NostrMaxi production cutover.
# Usage: ./scripts/validate-secrets-full.sh [ENV_FILE]

set -euo pipefail

ENV_FILE="${1:-.env.prod}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; ((PASSED+=1)) || true; }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; ((FAILED+=1)) || true; }
warn() { echo -e "${YELLOW}⚠ WARN${NC}: $1"; ((WARNINGS+=1)) || true; }
section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

if [[ ! -f "$ENV_FILE" ]]; then
  fail "Env file not found: $ENV_FILE"
  exit 1
fi

# shellcheck source=/dev/null
set -a
source "$ENV_FILE"
set +a

IS_LOCAL_TEST=false
if [[ "${LOCAL_TEST:-}" == "1" || "${ENV_PROFILE:-}" == "local-test" || "$ENV_FILE" == *".env.localtest" ]]; then
  IS_LOCAL_TEST=true
fi

section "1) File Safety"
PERMS=$(stat -c %a "$ENV_FILE" 2>/dev/null || stat -f %A "$ENV_FILE" 2>/dev/null || echo "")
if [[ "$PERMS" == "600" || "$PERMS" == "400" ]]; then
  pass "Env permissions secure ($PERMS)"
else
  warn "Env permissions should be 600 (current: ${PERMS:-unknown})"
fi

section "2) Core Secrets"
check_required() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    fail "$name is missing"
  else
    pass "$name present"
  fi
}

check_not_placeholder() {
  local name="$1"
  local val="${!name:-}"
  local pattern="$2"
  if [[ -n "$val" && "$val" =~ $pattern ]]; then
    fail "$name appears to be a placeholder"
  fi
}

check_length() {
  local name="$1"
  local min="$2"
  local val="${!name:-}"
  if [[ -n "$val" && ${#val} -lt $min ]]; then
    fail "$name too short (${#val} < $min)"
  else
    [[ -n "$val" ]] && pass "$name length OK (${#val})"
  fi
}

check_required JWT_SECRET
check_required WEBHOOK_SECRET
check_required ADMIN_PUBKEYS
check_required DB_PASSWORD
check_required BASE_URL
check_required DOMAIN
check_required NIP05_DEFAULT_DOMAIN

check_not_placeholder JWT_SECRET "CHANGE_THIS|change-in-production|your-super-secret|test-jwt"
check_not_placeholder WEBHOOK_SECRET "CHANGE_THIS|change-in-production|your-webhook"
check_not_placeholder DB_PASSWORD "CHANGE_THIS|postgres|password"
if ! $IS_LOCAL_TEST; then
  check_not_placeholder BASE_URL "localhost|127\.0\.0\.1"
  check_not_placeholder DOMAIN "example\.com|nostrmaxi\.com"
fi

check_length JWT_SECRET 32
check_length WEBHOOK_SECRET 32
check_length DB_PASSWORD 16

# Admin pubkeys validation
if [[ -n "${ADMIN_PUBKEYS:-}" ]]; then
  IFS=',' read -r -a admin_keys <<< "$ADMIN_PUBKEYS"
  if [[ ${#admin_keys[@]} -lt 1 ]]; then
    fail "ADMIN_PUBKEYS empty"
  else
    for key in "${admin_keys[@]}"; do
      key_trimmed="$(echo "$key" | xargs)"
      if ! [[ "$key_trimmed" =~ ^[0-9a-fA-F]{64}$ ]]; then
        fail "ADMIN_PUBKEYS invalid entry: $key_trimmed"
      fi
    done
    pass "ADMIN_PUBKEYS format OK (${#admin_keys[@]} key(s))"
  fi
fi

section "3) Payments Provider"
PAYMENTS_PROVIDER="${PAYMENTS_PROVIDER:-btcpay}"
case "$PAYMENTS_PROVIDER" in
  btcpay)
    check_required BTCPAY_URL
    check_required BTCPAY_API_KEY
    check_required BTCPAY_STORE_ID
    check_required BTCPAY_WEBHOOK_SECRET
    check_not_placeholder BTCPAY_URL "example\.com"
    check_not_placeholder BTCPAY_API_KEY "CONFIGURE_AFTER_DEPLOYMENT|your-btcpay"
    check_not_placeholder BTCPAY_STORE_ID "CONFIGURE_AFTER_DEPLOYMENT|your-btcpay"
    check_not_placeholder BTCPAY_WEBHOOK_SECRET "CONFIGURE_AFTER_DEPLOYMENT|CHANGE_THIS"
    ;;
  lnbits)
    check_required LNBITS_URL
    check_required LNBITS_API_KEY
    check_required LNBITS_WEBHOOK_SECRET
    check_not_placeholder LNBITS_API_KEY "CONFIGURE_AFTER_DEPLOYMENT|your-lnbits"
    check_not_placeholder LNBITS_WEBHOOK_SECRET "CONFIGURE_AFTER_DEPLOYMENT|CHANGE_THIS"
    ;;
  *)
    fail "Unknown PAYMENTS_PROVIDER: $PAYMENTS_PROVIDER"
    ;;
esac

section "4) Network/Origin Safety"
if $IS_LOCAL_TEST; then
  pass "Local test mode - skipping prod origin checks"
else
  if [[ -n "${CORS_ORIGINS:-}" ]]; then
    if [[ "$CORS_ORIGINS" == "*" ]]; then
      fail "CORS_ORIGINS wildcard is not allowed in prod"
    elif echo "$CORS_ORIGINS" | grep -q "localhost"; then
      fail "CORS_ORIGINS contains localhost in prod"
    else
      pass "CORS_ORIGINS set"
    fi
  else
    warn "CORS_ORIGINS not set (defaults may apply)"
  fi

  if [[ -n "${BASE_URL:-}" && "$BASE_URL" != https://* ]]; then
    fail "BASE_URL must be https:// in prod"
  fi
fi

section "5) Optional but Recommended"
[[ -n "${NIP05_DEFAULT_RELAYS:-}" ]] && pass "NIP05_DEFAULT_RELAYS set" || warn "NIP05_DEFAULT_RELAYS not set"
[[ -n "${REDIS_HOST:-}" ]] && pass "REDIS_HOST set" || warn "REDIS_HOST not set"
[[ -n "${REDIS_PORT:-}" ]] && pass "REDIS_PORT set" || warn "REDIS_PORT not set"

section "Summary"
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC} $FAILED"

if [[ $FAILED -gt 0 ]]; then
  echo -e "${RED}NOT READY${NC}: Fix failures in $ENV_FILE"
  exit 1
fi

echo -e "${GREEN}READY${NC}: Secrets validation passed for $ENV_FILE"
exit 0
