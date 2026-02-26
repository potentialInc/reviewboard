#!/usr/bin/env bash
# Smoke test: auto-reflect.sh runs without crash and deduplicates patterns
# Grade: P2 (environment health check)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$SCRIPT_DIR/hooks/auto-reflect.sh"

echo "[smoke] Testing auto-reflect.sh..."

if [ ! -x "$HOOK" ]; then
  echo "[FAIL] auto-reflect.sh not found or not executable"
  exit 1
fi

FAILED=0

# Test 1: Hook runs without crash (pipe /dev/null to avoid stdin hang)
"$HOOK" </dev/null >/dev/null 2>&1 && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  [PASS] Hook exits 0"
else
  echo "  [FAIL] Hook exits $EXIT_CODE"
  FAILED=$((FAILED + 1))
fi

# Test 2: Uses correct format (### Pattern: ...)
if grep -q '### Pattern:' "$HOOK"; then
  echo "  [PASS] Uses ### Pattern: format"
else
  echo "  [FAIL] Does not use ### Pattern: format"
  FAILED=$((FAILED + 1))
fi

# Test 3: Has duplicate detection (grep -qF)
if grep -q 'grep.*qF.*Pattern' "$HOOK"; then
  echo "  [PASS] Has duplicate detection"
else
  echo "  [FAIL] Missing duplicate detection"
  FAILED=$((FAILED + 1))
fi

# Test 4: Has safe git diff handling (|| true)
if grep -q 'git diff.*|| true' "$HOOK" || grep -q '|| true.*git diff' "$HOOK" || grep -q '{ git diff.*|| true; }' "$HOOK"; then
  echo "  [PASS] Has safe git diff handling"
else
  echo "  [FAIL] Unsafe git diff (no fallback for repos without commits)"
  FAILED=$((FAILED + 1))
fi

# Test 5: Run twice — verify no duplicate entries
SIZE_BEFORE=0
PATTERNS_FILE="$SCRIPT_DIR/memory/PATTERNS.md"
[ -f "$PATTERNS_FILE" ] && SIZE_BEFORE=$(wc -c < "$PATTERNS_FILE" | tr -d ' ')

"$HOOK" </dev/null >/dev/null 2>&1 || true
SIZE_AFTER_1=$(wc -c < "$PATTERNS_FILE" | tr -d ' ')

"$HOOK" </dev/null >/dev/null 2>&1 || true
SIZE_AFTER_2=$(wc -c < "$PATTERNS_FILE" | tr -d ' ')

if [ "$SIZE_AFTER_1" -eq "$SIZE_AFTER_2" ]; then
  echo "  [PASS] Deduplication works (second run didn't add duplicates)"
else
  echo "  [FAIL] Deduplication broken ($SIZE_AFTER_1 → $SIZE_AFTER_2 bytes)"
  FAILED=$((FAILED + 1))
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED auto-reflect test(s) failed"
  exit 1
fi

echo "[PASS] All auto-reflect smoke tests passed"
