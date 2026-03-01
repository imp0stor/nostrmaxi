#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/owner/strangesignal/projects/nostrmaxi-canonical"
LOGDIR="$ROOT/reports/ops"
mkdir -p "$LOGDIR"
LOG="$LOGDIR/pm-guardrail.log"

now=$(date -Iseconds)
branch=$(git -C "$ROOT" branch --show-current 2>/dev/null || echo "unknown")
status=$(git -C "$ROOT" status --short 2>/dev/null | wc -l | tr -d ' ')

# keep hash manifest current whenever guardrail runs
HASH_SCRIPT="/home/owner/.openclaw/workspace/reports/active/dev-journal/hash-manifest.sh"
if [[ -x "$HASH_SCRIPT" ]]; then
  "$HASH_SCRIPT" >/dev/null 2>&1 || true
fi

{
  echo "[$now] PM Guardrail"
  echo "branch=$branch dirty_files=$status"
  echo "checklist:"
  echo "- review docs/planning/EXECUTION-BACKLOG-2026-03-01.md"
  echo "- review latest dev-journal checkpoint + LATEST.md pointers"
  echo "- verify canonical links in reports/active/dev-journal/PATH-REGISTRY.md"
  echo "- confirm active sprint exit criteria"
  echo "- run gate before ship: npm test -- --runInBand && npm run build && npm run build:frontend"
  echo "- append dev-journal commit-memory block after each ship"
  echo "- before replying status: verify against written docs, do not rely on memory"
  if [[ "$status" -gt 0 ]]; then
    echo "WARN: repo has pending changes. reconcile before deployment."
  fi
  echo
} >> "$LOG"
