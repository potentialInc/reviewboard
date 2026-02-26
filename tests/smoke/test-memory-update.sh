#!/usr/bin/env bash
# Smoke test: auto-reflect.sh writes to MISTAKES.md from auto-fix failures
# Grade: P2 (warn)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REFLECT_HOOK="$SCRIPT_DIR/hooks/auto-reflect.sh"
MISTAKES_FILE="$SCRIPT_DIR/memory/MISTAKES.md"
METRICS_DIR="$SCRIPT_DIR/.harness-metrics"
METRICS_FILE="$METRICS_DIR/auto-fix.jsonl"
GUARD_FAIL_FILE="$METRICS_DIR/last-guard-failure"

echo "[smoke] Testing MISTAKES.md population via auto-reflect..."

if [ ! -x "$REFLECT_HOOK" ]; then
  echo "[FAIL] auto-reflect.sh not found or not executable"
  exit 1
fi

FAILED=0

# Backup originals if they exist
BACKUP_MISTAKES=""
BACKUP_METRICS=""
BACKUP_GUARD=""
[ -f "$MISTAKES_FILE" ] && BACKUP_MISTAKES=$(cat "$MISTAKES_FILE")
[ -f "$METRICS_FILE" ] && BACKUP_METRICS=$(cat "$METRICS_FILE")
[ -f "$GUARD_FAIL_FILE" ] && BACKUP_GUARD=$(cat "$GUARD_FAIL_FILE")

cleanup_test() {
  # Restore originals
  if [ -n "$BACKUP_MISTAKES" ]; then
    echo "$BACKUP_MISTAKES" > "$MISTAKES_FILE"
  else
    rm -f "$MISTAKES_FILE"
  fi
  if [ -n "$BACKUP_METRICS" ]; then
    echo "$BACKUP_METRICS" > "$METRICS_FILE"
  else
    rm -f "$METRICS_FILE"
  fi
  if [ -n "$BACKUP_GUARD" ]; then
    echo "$BACKUP_GUARD" > "$GUARD_FAIL_FILE"
  else
    rm -f "$GUARD_FAIL_FILE"
  fi
}
trap cleanup_test EXIT

# ── Test 1: Auto-fix failure → MISTAKES.md entry ──
echo "  Testing: auto-fix failure → MISTAKES.md entry..."
rm -f "$MISTAKES_FILE"
mkdir -p "$METRICS_DIR"
cat > "$METRICS_FILE" << 'EOF'
{"command":"npm test","success":true,"duration":5.2,"timestamp":"2026-02-23T10:00:00Z"}
{"command":"npm run lint","success":false,"duration":2.1,"timestamp":"2026-02-23T10:01:00Z"}
EOF

echo "" | "$REFLECT_HOOK" > /dev/null 2>&1 || true

if [ -f "$MISTAKES_FILE" ] && grep -q "Auto-fix failure" "$MISTAKES_FILE"; then
  echo "  [PASS] Auto-fix failure recorded in MISTAKES.md"
else
  echo "  [FAIL] Auto-fix failure NOT found in MISTAKES.md"
  FAILED=$((FAILED + 1))
fi

# ── Test 2: Guard P0 failure → MISTAKES.md entry ──
echo "  Testing: guard P0 failure → MISTAKES.md entry..."
rm -f "$MISTAKES_FILE"
rm -f "$METRICS_FILE"
echo "test-protected-paths: harness/core.sh was modified" > "$GUARD_FAIL_FILE"

echo "" | "$REFLECT_HOOK" > /dev/null 2>&1 || true

if [ -f "$MISTAKES_FILE" ] && grep -q "Guard P0 failure" "$MISTAKES_FILE"; then
  echo "  [PASS] Guard P0 failure recorded in MISTAKES.md"
else
  echo "  [FAIL] Guard P0 failure NOT found in MISTAKES.md"
  FAILED=$((FAILED + 1))
fi

# ── Test 3: Guard failure marker removed after recording ──
echo "  Testing: guard failure marker cleaned up after recording..."
if [ ! -f "$GUARD_FAIL_FILE" ]; then
  echo "  [PASS] Guard failure marker removed after recording"
else
  echo "  [FAIL] Guard failure marker still exists after recording"
  FAILED=$((FAILED + 1))
fi

# ── Test 4: Duplicate prevention ──
echo "  Testing: duplicate entries not written..."
rm -f "$METRICS_FILE"
rm -f "$GUARD_FAIL_FILE"
BEFORE_SIZE=$(wc -c < "$MISTAKES_FILE" 2>/dev/null || echo 0)

# Re-create the same guard failure
echo "test-protected-paths: harness/core.sh was modified" > "$GUARD_FAIL_FILE"
echo "" | "$REFLECT_HOOK" > /dev/null 2>&1 || true

AFTER_SIZE=$(wc -c < "$MISTAKES_FILE" 2>/dev/null || echo 0)
if [ "$AFTER_SIZE" -eq "$BEFORE_SIZE" ]; then
  echo "  [PASS] Duplicate entry prevented"
else
  echo "  [FAIL] Duplicate entry written (before: ${BEFORE_SIZE}B, after: ${AFTER_SIZE}B)"
  FAILED=$((FAILED + 1))
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED memory update test(s) failed"
  exit 1
fi

echo "[PASS] All memory update tests passed (4/4)"
