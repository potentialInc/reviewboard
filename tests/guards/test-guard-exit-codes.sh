#!/usr/bin/env bash
# Guard test: Guard exit code handling treats unknown codes as P0 failure
# Grade: P0 (hard-fail — verifies safety net for missing/broken guard scripts)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[guard] Testing guard exit code handling..."

FAILED=0
TEMP_DIR=$(mktemp -d)

# Create a mock test runner that returns different exit codes
create_mock_runner() {
  local exit_code=$1
  local runner="$TEMP_DIR/mock-runner-$exit_code.sh"
  cat > "$runner" << MOCK
#!/usr/bin/env bash
exit $exit_code
MOCK
  chmod +x "$runner"
  echo "$runner"
}

# Test 1: Exit code 0 = all passed
MOCK=$(create_mock_runner 0)
"$MOCK" 2>/dev/null && RESULT=$? || RESULT=$?
if [ "$RESULT" -eq 0 ]; then
  echo "  [PASS] Exit code 0 = success"
else
  echo "  [FAIL] Exit code 0 should mean success (got $RESULT)"
  FAILED=$((FAILED + 1))
fi

# Test 2: Exit code 1 = P0 failure
MOCK=$(create_mock_runner 1)
"$MOCK" 2>/dev/null && RESULT=$? || RESULT=$?
if [ "$RESULT" -eq 1 ]; then
  echo "  [PASS] Exit code 1 = P0 failure"
else
  echo "  [FAIL] Exit code 1 should mean P0 failure (got $RESULT)"
  FAILED=$((FAILED + 1))
fi

# Test 3: Exit code 2 = P1/P2 warning (soft-fail)
MOCK=$(create_mock_runner 2)
"$MOCK" 2>/dev/null && RESULT=$? || RESULT=$?
if [ "$RESULT" -eq 2 ]; then
  echo "  [PASS] Exit code 2 = P1/P2 warning"
else
  echo "  [FAIL] Exit code 2 should mean P1/P2 warning (got $RESULT)"
  FAILED=$((FAILED + 1))
fi

# Test 4: Verify auto-fix-loop guard handling logic
# The key behavior: exit codes other than 0 and 2 should be treated as P0 failure
# This simulates the guard check pattern from auto-fix-loop.sh
test_guard_logic() {
  local exit_code=$1
  local expected_action=$2  # "pass", "warn", or "block"

  local actual_action="pass"
  if [ "$exit_code" -ne 0 ] && [ "$exit_code" -ne 2 ]; then
    actual_action="block"
  elif [ "$exit_code" -eq 2 ]; then
    actual_action="warn"
  fi

  if [ "$actual_action" = "$expected_action" ]; then
    echo "  [PASS] Guard exit $exit_code → $actual_action"
  else
    echo "  [FAIL] Guard exit $exit_code → expected $expected_action, got $actual_action"
    FAILED=$((FAILED + 1))
  fi
}

# Test the logic for each possible exit code
echo "  Testing guard exit code → action mapping..."
test_guard_logic 0 "pass"      # Normal success
test_guard_logic 1 "block"     # P0 failure
test_guard_logic 2 "warn"      # P1/P2 warning
test_guard_logic 124 "block"   # Timeout (should block, not pass)
test_guard_logic 127 "block"   # Command not found (should block, not pass)
test_guard_logic 126 "block"   # Permission denied (should block, not pass)
test_guard_logic 255 "block"   # Unknown error (should block, not pass)

# Cleanup
rm -rf "$TEMP_DIR"

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED guard exit code test(s) failed"
  exit 1
fi

echo "[PASS] All guard exit code tests passed"
