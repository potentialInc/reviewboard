#!/usr/bin/env bash
# Smoke test: worktree-manager.sh runs without crash on basic operations
# Grade: P2 (environment health check)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANAGER="$SCRIPT_DIR/harness/worktree-manager.sh"

echo "[smoke] Testing worktree-manager.sh..."

if [ ! -x "$MANAGER" ]; then
  echo "[FAIL] worktree-manager.sh not found or not executable"
  exit 1
fi

FAILED=0

# Test 1: Help command runs without crash
"$MANAGER" help >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  [PASS] help command exits 0"
else
  echo "  [FAIL] help command exits $EXIT_CODE"
  FAILED=$((FAILED + 1))
fi

# Test 2: List command runs without crash (even with no worktrees)
"$MANAGER" list >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  [PASS] list command exits 0"
else
  echo "  [FAIL] list command exits $EXIT_CODE"
  FAILED=$((FAILED + 1))
fi

# Test 3: Create with missing args exits with error (not crash)
"$MANAGER" create 2>/dev/null && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 1 ]; then
  echo "  [PASS] create with no args exits 1"
else
  echo "  [FAIL] create with no args exits $EXIT_CODE (expected 1)"
  FAILED=$((FAILED + 1))
fi

# Test 4: Invalid worktree name rejected
"$MANAGER" create "../escape" "test" 2>/dev/null && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 1 ]; then
  echo "  [PASS] Path traversal name rejected"
else
  echo "  [FAIL] Path traversal name not rejected (exit $EXIT_CODE)"
  FAILED=$((FAILED + 1))
fi

# Test 5: Status of non-existent worktree exits with error
"$MANAGER" status "nonexistent-worktree-12345" 2>/dev/null && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 1 ]; then
  echo "  [PASS] Status of non-existent worktree exits 1"
else
  echo "  [FAIL] Status of non-existent worktree exits $EXIT_CODE (expected 1)"
  FAILED=$((FAILED + 1))
fi

# Test 6: is_interactive function exists
if grep -q 'is_interactive()' "$MANAGER"; then
  echo "  [PASS] is_interactive() helper exists"
else
  echo "  [FAIL] is_interactive() helper missing"
  FAILED=$((FAILED + 1))
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED worktree-manager test(s) failed"
  exit 1
fi

echo "[PASS] All worktree-manager smoke tests passed"
