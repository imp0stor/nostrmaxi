#!/usr/bin/env bash
# NostrMaxi GO blockers preflight
# Checks: BTCPAY_* creds, ADMIN_PUBKEYS, DNS, TLS
# Usage: ./scripts/go-blockers-preflight.sh [ENV_FILE]

set -euo pipefail

ENV_FILE="${1:-.env.prod}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass_count=0
fail_count=0
warn_count=0

pass() { echo -e "${GREEN}✓ PASS${NC}: $*"; pass_count=$((pass_count+1)); }
fail() { echo -e "${RED}✗ FAIL${NC}: $*"; fail_count=$((fail_count+1)); }
warn() { echo -e "${YELLOW}⚠ WARN${NC}: $*"; warn_count=$((warn_count+1)); }

if [[ ! -f "$ENV_FILE" ]]; then
  echo -e "${RED}ERROR${NC}: Env file not found: $ENV_FILE"
  exit 1
fi

# Load env
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Helpers
is_placeholder() {
  local val="$1"
  [[ -z "$val" ]] && return 0
  [[ "$val" == *"CONFIGURE_AFTER_DEPLOYMENT"* ]] && return 0
  [[ "$val" == *"your-"* ]] && return 0
  [[ "$val" == *"example.com"* ]] && return 0
  return 1
}

extract_domain() {
  local url="$1"
  url="${url#http://}"
  url="${url#https://}"
  echo "${url%%/*}"
}

section() {
  echo ""
  echo -e "${BLUE}━━━ $1 ━━━${NC}"
}

section "Secrets: ADMIN_PUBKEYS"
if [[ -z "${ADMIN_PUBKEYS:-}" ]]; then
  fail "ADMIN_PUBKEYS not configured"
else
  if echo "$ADMIN_PUBKEYS" | grep -qE '^[0-9a-fA-F]{64}(,[0-9a-fA-F]{64})*$'; then
    count=$(echo "$ADMIN_PUBKEYS" | tr ',' '\n' | wc -l | tr -d ' ')
    pass "ADMIN_PUBKEYS configured (${count} pubkey(s))"
  else
    fail "ADMIN_PUBKEYS format invalid (must be 64-hex pubkeys, comma-separated)"
  fi
fi

section "Secrets: BTCPAY_*"
PAYMENTS_PROVIDER="${PAYMENTS_PROVIDER:-btcpay}"
if [[ "$PAYMENTS_PROVIDER" != "btcpay" ]]; then
  warn "PAYMENTS_PROVIDER=$PAYMENTS_PROVIDER (BTCPay checks skipped)"
else
  if is_placeholder "${BTCPAY_URL:-}"; then
    fail "BTCPAY_URL not configured"
  else
    pass "BTCPAY_URL configured"
  fi
  if is_placeholder "${BTCPAY_API_KEY:-}"; then
    fail "BTCPAY_API_KEY not configured"
  else
    pass "BTCPAY_API_KEY configured"
  fi
  if is_placeholder "${BTCPAY_STORE_ID:-}"; then
    fail "BTCPAY_STORE_ID not configured"
  else
    pass "BTCPAY_STORE_ID configured"
  fi
  if is_placeholder "${BTCPAY_WEBHOOK_SECRET:-}"; then
    fail "BTCPAY_WEBHOOK_SECRET not configured"
  else
    pass "BTCPAY_WEBHOOK_SECRET configured"
  fi
fi

section "DNS"
DOMAIN_VALUE="${DOMAIN:-}"
if [[ -z "$DOMAIN_VALUE" ]] && [[ -n "${BASE_URL:-}" ]]; then
  DOMAIN_VALUE="$(extract_domain "$BASE_URL")"
fi

if [[ -z "$DOMAIN_VALUE" ]]; then
  warn "DOMAIN/BASE_URL not set - DNS check skipped"
else
  if command -v dig >/dev/null 2>&1; then
    dns_ip=$(dig +short "$DOMAIN_VALUE" A | head -1)
  elif command -v host >/dev/null 2>&1; then
    dns_ip=$(host "$DOMAIN_VALUE" | awk '/has address/ {print $4; exit}')
  else
    dns_ip=""
  fi

  if [[ -n "$dns_ip" ]]; then
    pass "DNS A record resolves ($DOMAIN_VALUE -> $dns_ip)"
  else
    fail "DNS A record missing for $DOMAIN_VALUE"
  fi
fi

section "TLS"
if [[ -z "$DOMAIN_VALUE" ]]; then
  warn "DOMAIN/BASE_URL not set - TLS check skipped"
else
  if command -v openssl >/dev/null 2>&1; then
    cert_end=$(echo | openssl s_client -connect "$DOMAIN_VALUE:443" -servername "$DOMAIN_VALUE" 2>/dev/null \
      | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true)
    if [[ -z "$cert_end" ]]; then
      fail "TLS certificate not found for $DOMAIN_VALUE (port 443)"
    else
      # best-effort expiry check
      if exp_epoch=$(date -d "$cert_end" +%s 2>/dev/null); then
        now_epoch=$(date +%s)
        days_left=$(( (exp_epoch - now_epoch) / 86400 ))
        if [[ $days_left -lt 0 ]]; then
          fail "TLS certificate expired ($cert_end)"
        elif [[ $days_left -lt 30 ]]; then
          warn "TLS certificate expiring soon ($days_left days)"
        else
          pass "TLS certificate valid ($days_left days)"
        fi
      else
        pass "TLS certificate present (expiry parse failed: $cert_end)"
      fi
    fi
  elif command -v curl >/dev/null 2>&1; then
    if curl -fsS "https://$DOMAIN_VALUE" >/dev/null 2>&1; then
      pass "TLS handshake ok via curl"
    else
      fail "TLS handshake failed via curl"
    fi
  else
    warn "openssl/curl not available - TLS check skipped"
  fi
fi

section "Summary"
echo -e "Passed:  ${GREEN}${pass_count}${NC}"
echo -e "Warnings:${YELLOW} ${warn_count}${NC}"
echo -e "Failed:  ${RED}${fail_count}${NC}"

if [[ $fail_count -gt 0 ]]; then
  exit 1
fi
