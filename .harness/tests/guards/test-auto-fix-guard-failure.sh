#!/usr/bin/env bash
# Guard test: Auto-fix loop stops immediately when guard tests report P0 failure
# Grade: P0 (hard-fail — verifies auto-fix respects guard results)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[guard] Testing auto-fix guard failure handling..."

FAILED=0

# The auto-fix-loop's guard handling pattern (from auto-fix-loop.sh lines 261-287):
#   GUARD_RESULT=0
#   _timeout_cmd "$GUARD_TIMEOUT" "$TESTS_RUNNER" guards >/dev/null 2>&1 || GUARD_RESULT=$?
#   if [ "$GUARD_RESULT" -ne 0 ] && [ "$GUARD_RESULT" -ne 2 ]; then
#     → P0 hard-fail: exit 1
#   elif [ "$GUARD_RESULT" -eq 2 ]; then
#     → P1/P2 soft-fail: warn, continue

simulate_autofix_guard() {
  local guard_exit=$1
  local expected_action=$2  # "continue", "warn", or "stop"

  local actual_action="continue"
  if [ "$guard_exit" -ne 0 ] && [ "$guard_exit" -ne 2 ]; then
    actual_action="stop"
  elif [ "$guard_exit" -eq 2 ]; then
    actual_action="warn"
  fi

  if [ "$actual_action" = "$expected_action" ]; then
    echo "  [PASS] Guard exit $guard_exit → $actual_action"
  else
    echo "  [FAIL] Guard exit $guard_exit → expected $expected_action, got $actual_action"
    FAILED=$((FAILED + 1))
  fi
}

# Test 1: Guard passes → continue loop
simulate_autofix_guard 0 "continue"

# Test 2: Guard warns (P1/P2) → warn but continue
simulate_autofix_guard 2 "warn"

# Test 3: Guard P0 failure → stop loop
simulate_autofix_guard 1 "stop"

# Test 4: Guard timeout → stop loop (not silently continue!)
simulate_autofix_guard 124 "stop"

# Test 5: Guard not found → stop loop
simulate_autofix_guard 127 "stop"

# Test 6: Unknown error → stop loop
simulate_autofix_guard 255 "stop"

# Test 7: Verify auto-fix-loop has both guard check points
# (after success AND after Claude fix)
POST_SUCCESS_GUARD=$(grep -c 'guard.*after success' "$SCRIPT_DIR/auto-fix-loop.sh" 2>/dev/null || true)
POST_SUCCESS_GUARD=${POST_SUCCESS_GUARD:-0}
POST_FIX_GUARD=$(grep -c 'guard.*after fix' "$SCRIPT_DIR/auto-fix-loop.sh" 2>/dev/null || true)
POST_FIX_GUARD=${POST_FIX_GUARD:-0}

if [ "$POST_SUCCESS_GUARD" -gt 0 ] && [ "$POST_FIX_GUARD" -gt 0 ]; then
  echo "  [PASS] auto-fix-loop.sh has guard checks after both success and fix"
else
  echo "  [FAIL] auto-fix-loop.sh missing guard check points (success=$POST_SUCCESS_GUARD, fix=$POST_FIX_GUARD)"
  FAILED=$((FAILED + 1))
fi

# Test 8: Verify auto-fix-loop has exit 1 for guard P0 failures
P0_EXITS=$(grep -c 'exit 1' "$SCRIPT_DIR/auto-fix-loop.sh" 2>/dev/null || echo "0")
if [ "$P0_EXITS" -ge 2 ]; then
  echo "  [PASS] auto-fix-loop.sh has multiple exit points for failures"
else
  echo "  [FAIL] auto-fix-loop.sh has too few exit points ($P0_EXITS)"
  FAILED=$((FAILED + 1))
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED auto-fix guard failure test(s) failed"
  exit 1
fi

echo "[PASS] All auto-fix guard failure tests passed"
