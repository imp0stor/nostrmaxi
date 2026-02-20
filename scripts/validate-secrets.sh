#!/bin/bash
# Validate required secrets for NostrMaxi production environments.
# Usage: ./scripts/validate-secrets.sh [ENV_FILE]

set -euo pipefail

ENV_FILE="${1:-.env.prod}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

error() { echo -e "${RED}ERROR:${NC} $*"; }
warn() { echo -e "${YELLOW}WARN:${NC} $*"; }
ok() { echo -e "${GREEN}OK:${NC} $*"; }

if [ ! -f "$ENV_FILE" ]; then
  error "Env file not found: $ENV_FILE"
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

missing=0

require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    error "$name is required but missing"
    missing=1
  fi
}

# Required core secrets
require_var "JWT_SECRET"
require_var "ADMIN_PUBKEYS"

# JWT_SECRET validation
if [ -n "${JWT_SECRET:-}" ]; then
  if [ "${#JWT_SECRET}" -lt 32 ]; then
    error "JWT_SECRET must be at least 32 characters"
    missing=1
  fi
  if [[ "$JWT_SECRET" == *"CHANGE_THIS"* ]] || [[ "$JWT_SECRET" == *"your-super-secret"* ]] || [[ "$JWT_SECRET" == *"test-jwt"* ]]; then
    error "JWT_SECRET appears to be a placeholder/test value"
    missing=1
  fi
fi

# ADMIN_PUBKEYS validation (comma separated 64-hex pubkeys)
if [ -n "${ADMIN_PUBKEYS:-}" ]; then
  IFS=',' read -r -a admin_keys <<< "$ADMIN_PUBKEYS"
  if [ "${#admin_keys[@]}" -eq 0 ]; then
    error "ADMIN_PUBKEYS must contain at least one pubkey"
    missing=1
  fi
  for key in "${admin_keys[@]}"; do
    key_trimmed="$(echo "$key" | xargs)"
    if [ -z "$key_trimmed" ]; then
      error "ADMIN_PUBKEYS contains an empty entry"
      missing=1
    elif ! [[ "$key_trimmed" =~ ^[0-9a-fA-F]{64}$ ]]; then
      error "ADMIN_PUBKEYS entry is not a 64-hex pubkey: $key_trimmed"
      missing=1
    fi
  done
fi

# Provider-specific secrets
if [[ "${PAYMENTS_PROVIDER:-}" == "btcpay" ]]; then
  require_var "BTCPAY_URL"
  require_var "BTCPAY_API_KEY"
  require_var "BTCPAY_STORE_ID"
  require_var "BTCPAY_WEBHOOK_SECRET"

  if [[ "${BTCPAY_URL:-}" == *"example.com"* ]]; then
    error "BTCPAY_URL appears to be a placeholder"
    missing=1
  fi
  if [[ "${BTCPAY_API_KEY:-}" == *"CONFIGURE_AFTER_DEPLOYMENT"* ]] || [[ "${BTCPAY_API_KEY:-}" == *"your-btcpay"* ]]; then
    error "BTCPAY_API_KEY appears to be a placeholder"
    missing=1
  fi
  if [[ "${BTCPAY_STORE_ID:-}" == *"CONFIGURE_AFTER_DEPLOYMENT"* ]] || [[ "${BTCPAY_STORE_ID:-}" == *"your-btcpay"* ]]; then
    error "BTCPAY_STORE_ID appears to be a placeholder"
    missing=1
  fi
  if [[ "${BTCPAY_WEBHOOK_SECRET:-}" == *"CONFIGURE_AFTER_DEPLOYMENT"* ]] || [[ "${BTCPAY_WEBHOOK_SECRET:-}" == *"CHANGE_THIS"* ]]; then
    error "BTCPAY_WEBHOOK_SECRET appears to be a placeholder"
    missing=1
  fi
fi

if [ "$missing" -eq 1 ]; then
  error "Secret validation failed. Fix the above issues in $ENV_FILE"
  exit 1
fi

ok "Secret validation passed for $ENV_FILE"
