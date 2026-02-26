#!/usr/bin/env bash
# Guard test: Path traversal and symlink bypass prevention
# Grade: P0 (hard-fail — core security of protected path system)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK="$SCRIPT_DIR/hooks/pre-edit-arch-check.sh"

echo "[guard] Testing path traversal and symlink protection..."

if [ ! -x "$HOOK" ]; then
  echo "[FAIL] pre-edit-arch-check.sh not found or not executable"
  exit 1
fi

FAILED=0

# Test 1: Path traversal with ../ should be BLOCKED
echo "  Testing: app/../.harness/auto-fix-loop.sh should be blocked (path traversal)..."
"$HOOK" "$REPO_ROOT/app/../.harness/auto-fix-loop.sh" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] Path traversal to .harness/ blocked (exit 2)"
else
  echo "  [FAIL] Path traversal NOT blocked (exit $EXIT_CODE, expected 2)"
  FAILED=$((FAILED + 1))
fi

# Test 2: Deep path traversal should be BLOCKED
echo "  Testing: app/src/../../.harness/hooks/hook.sh should be blocked (deep traversal)..."
"$HOOK" "$REPO_ROOT/app/src/../../.harness/hooks/hook.sh" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] Deep path traversal to .harness/hooks/ blocked (exit 2)"
else
  echo "  [FAIL] Deep path traversal NOT blocked (exit $EXIT_CODE, expected 2)"
  FAILED=$((FAILED + 1))
fi

# Test 3: Path traversal to .claude/ should be BLOCKED
echo "  Testing: app/../.claude/settings.json should be blocked..."
"$HOOK" "$REPO_ROOT/app/../.claude/settings.json" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] Path traversal to .claude/ blocked (exit 2)"
else
  echo "  [FAIL] Path traversal to .claude/ NOT blocked (exit $EXIT_CODE, expected 2)"
  FAILED=$((FAILED + 1))
fi

# Test 4: Symlink to protected file should be BLOCKED (if symlinks can be created)
SYMLINK_TEST_DIR=$(mktemp -d)
SYMLINK_PATH="$SYMLINK_TEST_DIR/harmless-link.sh"
if ln -s "$SCRIPT_DIR/auto-fix-loop.sh" "$SYMLINK_PATH" 2>/dev/null; then
  echo "  Testing: symlink to harness/ should be blocked..."
  "$HOOK" "$SYMLINK_PATH" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
  if [ "$EXIT_CODE" -eq 2 ]; then
    echo "  [PASS] Symlink to harness/ blocked (exit 2)"
  else
    echo "  [FAIL] Symlink to harness/ NOT blocked (exit $EXIT_CODE, expected 2)"
    FAILED=$((FAILED + 1))
  fi
  rm -f "$SYMLINK_PATH"
else
  echo "  [SKIP] Could not create symlink for testing"
fi
rm -rf "$SYMLINK_TEST_DIR"

# Test 5: Normal file should still be ALLOWED
echo "  Testing: README.md should still be allowed..."
"$HOOK" "$REPO_ROOT/README.md" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  [PASS] README.md allowed (exit 0)"
else
  echo "  [FAIL] README.md should be allowed (exit $EXIT_CODE, expected 0)"
  FAILED=$((FAILED + 1))
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED path traversal/symlink test(s) failed"
  exit 1
fi

echo "[PASS] All path traversal/symlink tests passed"
