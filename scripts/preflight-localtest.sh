#!/usr/bin/env bash
# Local-test preflight for NostrMaxi (BTCPay synthetic profile)
# Usage: ./scripts/preflight-localtest.sh [ENV_FILE]

set -euo pipefail

ENV_FILE="${1:-.env.localtest}"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

if [[ ! -f "$ENV_FILE" ]]; then
  echo -e "${BLUE}INFO${NC}: Expected local-test env file at $ENV_FILE"
  exit 1
fi

echo -e "${BLUE}━━━ NostrMaxi Local-Test Preflight (BTCPay synthetic) ━━━${NC}"
export ENV_PROFILE=local-test
export LOCAL_TEST=1

./scripts/validate-secrets.sh "$ENV_FILE"
./scripts/validate-secrets-full.sh "$ENV_FILE"

echo -e "${GREEN}Local-test preflight complete${NC}"
