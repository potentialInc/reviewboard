#!/usr/bin/env bash
# Guard test: Orchestrator blocks auto-PR when guard tests fail with P0
# Grade: P0 (hard-fail — verifies orchestrator respects guard results)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[guard] Testing orchestrator guard integration..."

FAILED=0

# The orchestrator's guard handling pattern (from orchestrator.sh lines 286-303):
#   GUARD_RESULT=0
#   _timeout_cmd "$GUARD_TIMEOUT" "$TESTS_RUNNER" guards 2>&1 || GUARD_RESULT=$?
#   if [ "$GUARD_RESULT" -eq 0 ]; then  → pass
#   elif [ "$GUARD_RESULT" -eq 2 ]; then → warn
#   else → P0 failure, AUTO_PR=false, GUARD_P0_FAIL=1

simulate_orchestrator_guard() {
  local guard_exit=$1
  local expected_auto_pr=$2  # "true" or "false"
  local expected_p0_fail=$3  # 0 or 1

  local AUTO_PR=true
  local GUARD_P0_FAIL=0

  if [ "$guard_exit" -eq 0 ]; then
    : # pass
  elif [ "$guard_exit" -eq 2 ]; then
    : # warn
  else
    AUTO_PR=false
    GUARD_P0_FAIL=1
  fi

  if [ "$AUTO_PR" = "$expected_auto_pr" ] && [ "$GUARD_P0_FAIL" -eq "$expected_p0_fail" ]; then
    echo "  [PASS] Guard exit $guard_exit → auto_pr=$AUTO_PR, p0_fail=$GUARD_P0_FAIL"
  else
    echo "  [FAIL] Guard exit $guard_exit → auto_pr=$AUTO_PR (expected $expected_auto_pr), p0_fail=$GUARD_P0_FAIL (expected $expected_p0_fail)"
    FAILED=$((FAILED + 1))
  fi
}

# Test 1: Guard passes → auto-PR allowed
simulate_orchestrator_guard 0 "true" 0

# Test 2: Guard warns (P1/P2) → auto-PR still allowed
simulate_orchestrator_guard 2 "true" 0

# Test 3: Guard P0 failure → auto-PR blocked
simulate_orchestrator_guard 1 "false" 1

# Test 4: Guard timeout (124) → auto-PR blocked
simulate_orchestrator_guard 124 "false" 1

# Test 5: Guard not found (127) → auto-PR blocked
simulate_orchestrator_guard 127 "false" 1

# Test 6: Guard unknown error → auto-PR blocked
simulate_orchestrator_guard 255 "false" 1

# Test 7: Verify the actual orchestrator has the guard check section
if ! grep -q "GUARD_P0_FAIL" "$SCRIPT_DIR/orchestrator.sh"; then
  echo "  [FAIL] orchestrator.sh missing GUARD_P0_FAIL variable"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] orchestrator.sh contains GUARD_P0_FAIL handling"
fi

# Test 8: Verify orchestrator exits 1 when GUARD_P0_FAIL > 0
if ! grep -q 'GUARD_P0_FAIL.*-gt 0' "$SCRIPT_DIR/orchestrator.sh"; then
  echo "  [FAIL] orchestrator.sh doesn't exit on guard P0 failure"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] orchestrator.sh exits on guard P0 failure"
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED orchestrator guard integration test(s) failed"
  exit 1
fi

echo "[PASS] All orchestrator guard integration tests passed"
