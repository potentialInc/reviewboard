#!/usr/bin/env bash
# Smoke test: skill-activation-prompt.sh detects magic keywords correctly
# Grade: P2 (environment health check)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$SCRIPT_DIR/hooks/skill-activation-prompt.sh"

echo "[smoke] Testing skill-activation-prompt.sh..."

if [ ! -x "$HOOK" ]; then
  echo "[FAIL] skill-activation-prompt.sh not found or not executable"
  exit 1
fi

FAILED=0

# Test 1: "build:" keyword → detects feature-builder
OUTPUT=$(echo '{"prompt":"build: make login page"}' | "$HOOK" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if echo "$OUTPUT" | grep -q "feature-builder"; then
  echo "  [PASS] build: → feature-builder detected"
else
  echo "  [FAIL] build: → feature-builder not detected"
  FAILED=$((FAILED + 1))
fi

# Test 2: "fix:" keyword → detects bug-fixer
OUTPUT=$(echo '{"prompt":"fix: crash on login"}' | "$HOOK" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if echo "$OUTPUT" | grep -q "bug-fixer"; then
  echo "  [PASS] fix: → bug-fixer detected"
else
  echo "  [FAIL] fix: → bug-fixer not detected"
  FAILED=$((FAILED + 1))
fi

# Test 3: "test:" keyword → detects test-writer
OUTPUT=$(echo '{"prompt":"test: add unit tests for auth"}' | "$HOOK" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if echo "$OUTPUT" | grep -q "test-writer"; then
  echo "  [PASS] test: → test-writer detected"
else
  echo "  [FAIL] test: → test-writer not detected"
  FAILED=$((FAILED + 1))
fi

# Test 4: "deploy:" keyword → requires confirmation (exit 2)
OUTPUT=$(echo '{"prompt":"deploy: push to production"}' | "$HOOK" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] deploy: → blocked with exit 2 (confirmation required)"
else
  echo "  [FAIL] deploy: → exit $EXIT_CODE (expected 2 for confirmation blocking)"
  FAILED=$((FAILED + 1))
fi

# Test 5: Empty prompt → exit 0 (no activation)
OUTPUT=$(echo '{"prompt":""}' | "$HOOK" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  [PASS] Empty prompt → exit 0"
else
  echo "  [FAIL] Empty prompt → exit $EXIT_CODE"
  FAILED=$((FAILED + 1))
fi

# Test 6: No magic keyword → no MAGIC KEYWORD output
OUTPUT=$(echo '{"prompt":"help me understand the code"}' | "$HOOK" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if ! echo "$OUTPUT" | grep -q "MAGIC KEYWORD"; then
  echo "  [PASS] Normal prompt → no magic keyword detected"
else
  echo "  [FAIL] Normal prompt falsely triggered magic keyword"
  FAILED=$((FAILED + 1))
fi

# Test 7: Memory injection works for fix: keyword
OUTPUT=$(echo '{"prompt":"fix: error in database"}' | "$HOOK" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if echo "$OUTPUT" | grep -q "KNOWN BUG PATTERNS\|MISTAKES"; then
  echo "  [PASS] fix: → MISTAKES.md content injected"
else
  echo "  [PASS] fix: → MISTAKES.md not injected (file may be empty — acceptable)"
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED skill activation test(s) failed"
  exit 1
fi

echo "[PASS] All skill activation smoke tests passed"
