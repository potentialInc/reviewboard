#!/usr/bin/env bash
# Smoke test: on-stop-summary.sh writes to PROGRESS.md without crash
# Grade: P2 (environment health check)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$SCRIPT_DIR/hooks/on-stop-summary.sh"

echo "[smoke] Testing on-stop-summary.sh..."

if [ ! -x "$HOOK" ]; then
  echo "[FAIL] on-stop-summary.sh not found or not executable"
  exit 1
fi

FAILED=0

# Save original PROGRESS.md content
PROGRESS_FILE="$SCRIPT_DIR/memory/PROGRESS.md"
BACKUP=""
if [ -f "$PROGRESS_FILE" ]; then
  BACKUP=$(cat "$PROGRESS_FILE")
fi

# Get size before
SIZE_BEFORE=0
[ -f "$PROGRESS_FILE" ] && SIZE_BEFORE=$(wc -c < "$PROGRESS_FILE" | tr -d ' ')

# Test 1: Hook runs without crash
"$HOOK" >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  [PASS] Hook exits 0"
else
  echo "  [FAIL] Hook exits $EXIT_CODE"
  FAILED=$((FAILED + 1))
fi

# Test 2: PROGRESS.md was modified (content added)
SIZE_AFTER=0
[ -f "$PROGRESS_FILE" ] && SIZE_AFTER=$(wc -c < "$PROGRESS_FILE" | tr -d ' ')

if [ "$SIZE_AFTER" -gt "$SIZE_BEFORE" ]; then
  echo "  [PASS] PROGRESS.md grew ($SIZE_BEFORE → $SIZE_AFTER bytes)"
else
  echo "  [FAIL] PROGRESS.md not modified ($SIZE_BEFORE → $SIZE_AFTER bytes)"
  FAILED=$((FAILED + 1))
fi

# Test 3: Session marker format is correct
if grep -q "## Session:" "$PROGRESS_FILE" 2>/dev/null; then
  echo "  [PASS] Session marker format correct"
else
  echo "  [FAIL] Session marker not found in PROGRESS.md"
  FAILED=$((FAILED + 1))
fi

# Test 4: Required fields present in last session entry
LAST_SESSION=$(tail -20 "$PROGRESS_FILE" 2>/dev/null || echo "")
MISSING_FIELDS=0
for field in "Intent" "Agent" "Branch" "Outcome" "Changes"; do
  if ! echo "$LAST_SESSION" | grep -q "$field"; then
    MISSING_FIELDS=$((MISSING_FIELDS + 1))
  fi
done

if [ "$MISSING_FIELDS" -eq 0 ]; then
  echo "  [PASS] All required fields present in session entry"
else
  echo "  [FAIL] $MISSING_FIELDS required fields missing from session entry"
  FAILED=$((FAILED + 1))
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED on-stop-summary test(s) failed"
  exit 1
fi

echo "[PASS] All on-stop-summary smoke tests passed"
