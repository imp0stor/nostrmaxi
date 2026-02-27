#!/usr/bin/env bash
# NostrMaxi production cutover automation (safe, gated).
# Usage: ./scripts/prod-cutover.sh [ENV_FILE] [--dry-run] [--skip-build]

set -euo pipefail

ENV_FILE="${1:-.env.prod}"
DRY_RUN=false
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --skip-build) SKIP_BUILD=true ;;
  esac
  shift || true
  set -- "$@"
done

if [[ "${CUTOVER_CONFIRM:-}" != "YES" ]]; then
  echo "ERROR: Set CUTOVER_CONFIRM=YES to proceed. (Example: CUTOVER_CONFIRM=YES ./scripts/prod-cutover.sh .env.prod)"
  exit 1
fi

run() {
  echo "+ $*"
  if [[ "$DRY_RUN" == "false" ]]; then
    eval "$@"
  fi
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Env file not found: $ENV_FILE"
  exit 1
fi

# Load env
set -a
source "$ENV_FILE"
set +a

COMPOSE_FILE="docker-compose.prod.yml"

# Use docker compose if available
DOCKER_COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
fi

echo "=== NostrMaxi Production Cutover ==="
echo "Env file: $ENV_FILE"
echo "Compose:  $COMPOSE_FILE"
echo "Dry-run:  $DRY_RUN"

# 1) Validate secrets + readiness
run "./scripts/validate-secrets-full.sh $ENV_FILE"
run "./scripts/production-readiness-check.sh $ENV_FILE"

# 2) Build artifacts (optional)
if [[ "$SKIP_BUILD" == "false" ]]; then
  run "npm run build"
  run "npm run build:frontend"
  run "$DOCKER_COMPOSE -f $COMPOSE_FILE build --no-cache"
else
  echo "Skipping build steps (--skip-build)"
fi

# 3) DB migrate
run "npx prisma generate"
run "npx prisma migrate deploy"

# 4) Start services
run "$DOCKER_COMPOSE -f $COMPOSE_FILE up -d"

# 5) Health checks
TARGET_URL="${BASE_URL:-}"
if [[ -z "$TARGET_URL" ]]; then
  TARGET_URL="http://localhost:3000"
fi
run "./scripts/health-check.sh $TARGET_URL"

echo "=== Cutover complete ==="
if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry-run only. No changes were applied."
fi
