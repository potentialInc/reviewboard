#!/usr/bin/env bash
# Smoke test: All hooks/*.sh have executable permission
# Grade: P2 (smoke)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOKS_DIR="$SCRIPT_DIR/hooks"

echo "[smoke] Testing hooks executable permissions..."

if [ ! -d "$HOOKS_DIR" ]; then
  echo "[SKIP] hooks/ directory not found"
  exit 0
fi

FAILED=0
CHECKED=0

for hook in "$HOOKS_DIR"/*.sh; do
  [ ! -f "$hook" ] && continue
  CHECKED=$((CHECKED + 1))

  if [ ! -x "$hook" ]; then
    echo "[FAIL] Not executable: $hook"
    FAILED=$((FAILED + 1))
  fi
done

if [ "$CHECKED" -eq 0 ]; then
  echo "[SKIP] No .sh files found in hooks/"
  exit 0
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED of $CHECKED hooks missing executable permission"
  exit 1
fi

echo "[PASS] All $CHECKED hooks have executable permission"
