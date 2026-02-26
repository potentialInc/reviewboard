#!/usr/bin/env bash
# Guard test: Protected paths still enforced when rules.json is corrupt
# Grade: P0 (hard-fail — ensures fallback protection when config is broken)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK="$SCRIPT_DIR/hooks/pre-edit-arch-check.sh"
RULES_FILE="$SCRIPT_DIR/architecture/rules.json"

echo "[guard] Testing rules.json fallback protection..."

if [ ! -x "$HOOK" ]; then
  echo "[FAIL] pre-edit-arch-check.sh not found or not executable"
  exit 1
fi

FAILED=0

# Backup rules.json
BACKUP_FILE=$(mktemp)
cp "$RULES_FILE" "$BACKUP_FILE"

restore_rules() {
  if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$RULES_FILE"
    rm -f "$BACKUP_FILE"
  fi
}
trap restore_rules EXIT

# Test 1: With corrupt rules.json, protected paths should STILL be blocked
echo "  Testing: corrupt rules.json → harness/ should still be blocked..."
echo '{ "version": "broken"' > "$RULES_FILE"  # invalid JSON with missing protected_paths

"$HOOK" "$SCRIPT_DIR/auto-fix-loop.sh" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] harness/ blocked with corrupt rules.json (exit 2)"
else
  echo "  [FAIL] harness/ NOT blocked with corrupt rules.json (exit $EXIT_CODE, expected 2)"
  FAILED=$((FAILED + 1))
fi

# Test 2: With empty protected_paths, fallback should kick in
echo "  Testing: empty protected_paths → harness/ should still be blocked..."
echo '{"protected_paths":{"paths":[]},"exceptions":{"allowed_core_edits":[]}}' > "$RULES_FILE"

"$HOOK" "$SCRIPT_DIR/auto-fix-loop.sh" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] harness/ blocked with empty protected_paths (exit 2)"
else
  echo "  [FAIL] harness/ NOT blocked with empty protected_paths (exit $EXIT_CODE, expected 2)"
  FAILED=$((FAILED + 1))
fi

# Test 3: Non-protected file should still be allowed even with corrupt rules
echo "  Testing: corrupt rules.json → README.md should still be allowed..."
echo '{ "version": "broken"' > "$RULES_FILE"

"$HOOK" "$REPO_ROOT/README.md" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  [PASS] README.md allowed with corrupt rules.json (exit 0)"
else
  echo "  [FAIL] README.md should be allowed even with corrupt rules.json (exit $EXIT_CODE, expected 0)"
  FAILED=$((FAILED + 1))
fi

# Restore rules.json (also done by trap)
restore_rules

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED rules.json fallback test(s) failed"
  exit 1
fi

echo "[PASS] All rules.json fallback tests passed"
