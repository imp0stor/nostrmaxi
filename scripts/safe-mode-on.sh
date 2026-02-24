#!/usr/bin/env bash
# Enable NostrMaxi safe-mode (maintenance) via nginx config swap.
# Usage: ./scripts/safe-mode-on.sh

set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
NGINX_CONF="nginx/nginx.conf"
MAINT_CONF="nginx/maintenance.conf"
BACKUP_CONF="nginx/nginx.conf.bak"
MAINT_HTML_SRC="nginx/maintenance.html"
MAINT_HTML_DST="frontend/dist/maintenance.html"

DOCKER_COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
fi

if [[ ! -f "$MAINT_CONF" ]]; then
  echo "ERROR: maintenance.conf not found at $MAINT_CONF"
  exit 1
fi

# Backup current config
if [[ ! -f "$BACKUP_CONF" ]]; then
  cp "$NGINX_CONF" "$BACKUP_CONF"
fi

# Ensure maintenance page exists in dist
mkdir -p frontend/dist
cp "$MAINT_HTML_SRC" "$MAINT_HTML_DST"

# Swap config
cp "$MAINT_CONF" "$NGINX_CONF"

# Reload nginx container
$DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T nginx nginx -s reload || \
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" restart nginx

echo "Safe-mode enabled."
