#!/usr/bin/env bash
# Disable NostrMaxi safe-mode and restore nginx config.
# Usage: ./scripts/safe-mode-off.sh

set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
NGINX_CONF="nginx/nginx.conf"
BACKUP_CONF="nginx/nginx.conf.bak"

DOCKER_COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
fi

if [[ ! -f "$BACKUP_CONF" ]]; then
  echo "ERROR: Backup config not found at $BACKUP_CONF"
  exit 1
fi

cp "$BACKUP_CONF" "$NGINX_CONF"

$DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T nginx nginx -s reload || \
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" restart nginx

echo "Safe-mode disabled."
