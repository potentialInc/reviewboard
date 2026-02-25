#!/usr/bin/env bash
# Smoke test: auto-fix-loop.sh validates inputs and handles missing dependencies
# Grade: P2 (environment health check)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$SCRIPT_DIR/auto-fix-loop.sh"

echo "[smoke] Testing auto-fix-loop.sh..."

if [ ! -x "$SCRIPT" ]; then
  echo "[FAIL] auto-fix-loop.sh not found or not executable"
  exit 1
fi

FAILED=0

# Test 1: No arguments → exits with error
"$SCRIPT" 2>/dev/null && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 1 ]; then
  echo "  [PASS] No arguments → exit 1"
else
  echo "  [FAIL] No arguments → exit $EXIT_CODE (expected 1)"
  FAILED=$((FAILED + 1))
fi

# Test 2: Has secret filtering function
if grep -q 'filter_secrets()' "$SCRIPT"; then
  echo "  [PASS] filter_secrets() function exists"
else
  echo "  [FAIL] filter_secrets() function missing"
  FAILED=$((FAILED + 1))
fi

# Test 3: Has timeout wrapper
if grep -q '_timeout_cmd()' "$SCRIPT"; then
  echo "  [PASS] _timeout_cmd() function exists"
else
  echo "  [FAIL] _timeout_cmd() function missing"
  FAILED=$((FAILED + 1))
fi

# Test 4: Has trap handler
if grep -q 'trap.*EXIT' "$SCRIPT"; then
  echo "  [PASS] Trap handler registered"
else
  echo "  [FAIL] No trap handler"
  FAILED=$((FAILED + 1))
fi

# Test 5: Respects safe mode config
if grep -q 'safeMode' "$SCRIPT"; then
  echo "  [PASS] Safe mode check exists"
else
  echo "  [FAIL] No safe mode check"
  FAILED=$((FAILED + 1))
fi

# Test 6: Secret filtering patterns cover key credential types
PATTERNS_FOUND=0
grep -q 'postgres\|mysql\|mongodb' "$SCRIPT" && PATTERNS_FOUND=$((PATTERNS_FOUND + 1))
grep -q 'AKIA\|ASIA' "$SCRIPT" && PATTERNS_FOUND=$((PATTERNS_FOUND + 1))
grep -q 'sk-' "$SCRIPT" && PATTERNS_FOUND=$((PATTERNS_FOUND + 1))
grep -q 'eyJ' "$SCRIPT" && PATTERNS_FOUND=$((PATTERNS_FOUND + 1))
grep -q 'ghp_' "$SCRIPT" && PATTERNS_FOUND=$((PATTERNS_FOUND + 1))
grep -q 'password' "$SCRIPT" && PATTERNS_FOUND=$((PATTERNS_FOUND + 1))

if [ "$PATTERNS_FOUND" -ge 5 ]; then
  echo "  [PASS] Secret filtering covers $PATTERNS_FOUND credential types"
else
  echo "  [FAIL] Secret filtering only covers $PATTERNS_FOUND/6 credential types"
  FAILED=$((FAILED + 1))
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED auto-fix-retry test(s) failed"
  exit 1
fi

echo "[PASS] All auto-fix-retry smoke tests passed"
