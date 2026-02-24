#!/usr/bin/env bash
# Configure local-test env for Operator BTCPay + run smoke test
# Usage: ./scripts/btcpay-localtest-operator.sh [ENV_FILE]
# Safe: uses local-test profile only. No production changes.

set -euo pipefail

ENV_FILE="${1:-.env.localtest.operator}"
BASE_ENV=".env.localtest"
BTCPAY_OPERATOR_URL_DEFAULT="http://10.1.10.143:23000"

red='\033[0;31m'
blue='\033[0;34m'
green='\033[0;32m'
NC='\033[0m'

if [[ ! -f "$BASE_ENV" ]]; then
  echo -e "${red}ERROR${NC}: Missing base env file $BASE_ENV"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$BASE_ENV" "$ENV_FILE"
fi

set_env() {
  local key="$1"
  local value="$2"
  local escaped="$value"
  escaped="${escaped//\\/\\\\}"
  escaped="${escaped//|/\\|}"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${escaped}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

get_env() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2-
}

is_placeholder() {
  local val="$1"
  [[ -z "$val" ]] || [[ "$val" == *"localtest_"* ]] || [[ "$val" == *"your-"* ]] || [[ "$val" == *"CONFIGURE_AFTER_DEPLOYMENT"* ]]
}

set_env "BTCPAY_URL" "${BTCPAY_OPERATOR_URL_DEFAULT}"

current_store_id="$(get_env BTCPAY_STORE_ID)"
current_api_key="$(get_env BTCPAY_API_KEY)"
current_webhook_secret="$(get_env BTCPAY_WEBHOOK_SECRET)"

if is_placeholder "$current_store_id"; then
  echo -e "${blue}INPUT${NC}: Enter BTCPAY_STORE_ID (Operator BTCPay store)"
  read -r store_id
  set_env "BTCPAY_STORE_ID" "$store_id"
fi

if is_placeholder "$current_api_key"; then
  echo -e "${blue}INPUT${NC}: Enter BTCPAY_API_KEY (Greenfield token)"
  read -r -s api_key
  echo
  set_env "BTCPAY_API_KEY" "$api_key"
fi

if is_placeholder "$current_webhook_secret"; then
  echo -e "${blue}INPUT${NC}: Enter BTCPAY_WEBHOOK_SECRET (optional, press Enter to skip)"
  read -r -s webhook_secret
  echo
  if [[ -n "$webhook_secret" ]]; then
    set_env "BTCPAY_WEBHOOK_SECRET" "$webhook_secret"
  fi
fi

chmod 600 "$ENV_FILE"

echo -e "${blue}INFO${NC}: Running local-test preflight"
./scripts/preflight-localtest.sh "$ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo -e "${blue}INFO${NC}: BTCPay API smoke (GET /api/v1/server/info)"
status=$(curl -sS -o /dev/null -w "%{http_code}" \
  -H "Authorization: token ${BTCPAY_API_KEY}" \
  "${BTCPAY_URL}/api/v1/server/info")

report_path="LOCALTEST-BTCPAY-SMOKE-REPORT-LATEST.md"
run_ts="$(date -Iseconds)"

cat > "$report_path" <<EOF
# NostrMaxi BTCPay Local-Test Smoke — Latest

- Run timestamp: ${run_ts}
- Env file: ${ENV_FILE}
- BTCPay URL: ${BTCPAY_URL}
- Preflight: PASS (local-test)
- API smoke: GET /api/v1/server/info → HTTP ${status}

## Result
EOF

echo -e "${blue}INFO${NC}: HTTP ${status}"
if [[ "$status" == "200" ]]; then
  echo -e "${green}PASS${NC}: BTCPay Greenfield auth OK"
  echo "PASS" >> "$report_path"
  echo -e "${blue}INFO${NC}: Report written to ${report_path}"
  exit 0
fi

echo -e "${red}FAIL${NC}: BTCPay Greenfield auth failed (HTTP ${status})"
echo "FAIL (HTTP ${status})" >> "$report_path"
echo -e "${blue}INFO${NC}: Report written to ${report_path}"
exit 1
