#!/usr/bin/env bash
# Guard test: Protected path blocking works correctly
# Grade: P0 (hard-fail — stops auto-fix immediately if this fails)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK="$SCRIPT_DIR/hooks/pre-edit-arch-check.sh"

echo "[guard] Testing protected path blocking..."

if [ ! -x "$HOOK" ]; then
  echo "[FAIL] pre-edit-arch-check.sh not found or not executable"
  exit 1
fi

FAILED=0

# Test 1: Editing a protected path should be BLOCKED (exit 2)
echo "  Testing: hooks/session-start.sh should be blocked..."
"$HOOK" "$SCRIPT_DIR/hooks/session-start.sh" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] hooks/session-start.sh blocked (exit 2)"
else
  echo "  [FAIL] hooks/session-start.sh NOT blocked (exit $EXIT_CODE, expected 2)"
  FAILED=$((FAILED + 1))
fi

# Test 2: Editing architecture/rules.json should be BLOCKED (exit 2)
echo "  Testing: architecture/rules.json should be blocked..."
"$HOOK" "$SCRIPT_DIR/architecture/rules.json" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] architecture/rules.json blocked (exit 2)"
else
  echo "  [FAIL] architecture/rules.json NOT blocked (exit $EXIT_CODE, expected 2)"
  FAILED=$((FAILED + 1))
fi

# Test 3: Editing harness/ should be BLOCKED (exit 2)
echo "  Testing: harness/auto-fix-loop.sh should be blocked..."
"$HOOK" "$SCRIPT_DIR/auto-fix-loop.sh" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] harness/auto-fix-loop.sh blocked (exit 2)"
else
  echo "  [FAIL] harness/auto-fix-loop.sh NOT blocked (exit $EXIT_CODE, expected 2)"
  FAILED=$((FAILED + 1))
fi

# Test 4: Editing .claude/ should be BLOCKED (exit 2)
echo "  Testing: .claude/settings.json should be blocked..."
"$HOOK" "$REPO_ROOT/.claude/settings.json" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] .claude/settings.json blocked (exit 2)"
else
  echo "  [FAIL] .claude/settings.json NOT blocked (exit $EXIT_CODE, expected 2)"
  FAILED=$((FAILED + 1))
fi

# Test 5: Editing CLAUDE.md should be BLOCKED (exit 2)
echo "  Testing: CLAUDE.md should be blocked..."
"$HOOK" "$REPO_ROOT/CLAUDE.md" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] CLAUDE.md blocked (exit 2)"
else
  echo "  [FAIL] CLAUDE.md NOT blocked (exit $EXIT_CODE, expected 2)"
  FAILED=$((FAILED + 1))
fi

# Test 6: Editing src/ should be ALLOWED (exit 0)
echo "  Testing: src/service/foo.ts should be allowed (non-protected)..."
"$HOOK" "$REPO_ROOT/app/src/service/foo.ts" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  [PASS] src/service/foo.ts allowed (exit 0)"
else
  echo "  [FAIL] src/service/foo.ts NOT allowed (exit $EXIT_CODE, expected 0)"
  FAILED=$((FAILED + 1))
fi

# Test 7: Editing a non-protected path should be ALLOWED (exit 0)
echo "  Testing: prd/prd-auth.md should be allowed (non-protected)..."
"$HOOK" "$REPO_ROOT/prd/prd-auth.md" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  [PASS] prd/prd-auth.md allowed (exit 0)"
else
  echo "  [FAIL] prd/prd-auth.md NOT allowed (exit $EXIT_CODE, expected 0)"
  FAILED=$((FAILED + 1))
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED protected path test(s) failed"
  exit 1
fi

echo "[PASS] All protected path tests passed"
