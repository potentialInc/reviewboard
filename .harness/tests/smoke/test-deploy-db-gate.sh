#!/usr/bin/env bash
# Smoke test: deploy-manager.sh and db-manager.sh confirmation gates
# Grade: P2 (warn)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY="$SCRIPT_DIR/deploy-manager.sh"
DB_MGR="$SCRIPT_DIR/db-manager.sh"

echo "[smoke] Testing deploy/db confirmation gates..."

FAILED=0

# ── Test 1: deploy preview without --confirm → blocked ──
echo "  Testing: deploy preview without --confirm → blocked..."
if [ -x "$DEPLOY" ]; then
  OUTPUT=$("$DEPLOY" preview 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
  if [ "$EXIT_CODE" -ne 0 ] && echo "$OUTPUT" | grep -qi "confirm"; then
    echo "  [PASS] Deploy preview blocked without --confirm"
  else
    echo "  [FAIL] Deploy preview not blocked (exit=$EXIT_CODE)"
    FAILED=$((FAILED + 1))
  fi
else
  echo "  [SKIP] deploy-manager.sh not executable"
fi

# ── Test 2: deploy promote without --confirm → blocked ──
echo "  Testing: deploy promote without --confirm → blocked..."
if [ -x "$DEPLOY" ]; then
  OUTPUT=$("$DEPLOY" promote 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
  if [ "$EXIT_CODE" -ne 0 ] && echo "$OUTPUT" | grep -qi "confirm"; then
    echo "  [PASS] Deploy promote blocked without --confirm"
  else
    echo "  [FAIL] Deploy promote not blocked (exit=$EXIT_CODE)"
    FAILED=$((FAILED + 1))
  fi
else
  echo "  [SKIP] deploy-manager.sh not executable"
fi

# ── Test 3: db migrate without --confirm → blocked ──
echo "  Testing: db migrate without --confirm → blocked..."
if [ -x "$DB_MGR" ]; then
  OUTPUT=$("$DB_MGR" migrate 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
  if [ "$EXIT_CODE" -ne 0 ] && echo "$OUTPUT" | grep -qi "confirm"; then
    echo "  [PASS] DB migrate blocked without --confirm"
  else
    echo "  [FAIL] DB migrate not blocked (exit=$EXIT_CODE)"
    FAILED=$((FAILED + 1))
  fi
else
  echo "  [SKIP] db-manager.sh not executable"
fi

# ── Test 4: db reset without --confirm → blocked ──
echo "  Testing: db reset without --confirm → blocked..."
if [ -x "$DB_MGR" ]; then
  OUTPUT=$("$DB_MGR" reset 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
  if [ "$EXIT_CODE" -ne 0 ] && echo "$OUTPUT" | grep -qi "confirm"; then
    echo "  [PASS] DB reset blocked without --confirm"
  else
    echo "  [FAIL] DB reset not blocked (exit=$EXIT_CODE)"
    FAILED=$((FAILED + 1))
  fi
else
  echo "  [SKIP] db-manager.sh not executable"
fi

# ── Test 5: deploy help → exit 0 (no confirmation needed) ──
echo "  Testing: deploy help → exit 0..."
if [ -x "$DEPLOY" ]; then
  OUTPUT=$("$DEPLOY" --help 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
  if [ "$EXIT_CODE" -eq 0 ]; then
    echo "  [PASS] Deploy help works"
  else
    echo "  [FAIL] Deploy help failed (exit=$EXIT_CODE)"
    FAILED=$((FAILED + 1))
  fi
else
  echo "  [SKIP] deploy-manager.sh not executable"
fi

# ── Test 6: db help → exit 0 ──
echo "  Testing: db help → exit 0..."
if [ -x "$DB_MGR" ]; then
  OUTPUT=$("$DB_MGR" --help 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
  if [ "$EXIT_CODE" -eq 0 ]; then
    echo "  [PASS] DB help works"
  else
    echo "  [FAIL] DB help failed (exit=$EXIT_CODE)"
    FAILED=$((FAILED + 1))
  fi
else
  echo "  [SKIP] db-manager.sh not executable"
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED deploy/db gate test(s) failed"
  exit 1
fi

echo "[PASS] All deploy/db confirmation gate tests passed"
