#!/usr/bin/env bash
# Smoke test: enforce.sh runs without crash
# Grade: P2 (smoke)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENFORCE="$SCRIPT_DIR/architecture/enforce.sh"

echo "[smoke] Testing enforce.sh runs without crash..."

# Test 1: Run on nonexistent path (should not crash)
OUTPUT=$("$ENFORCE" "/nonexistent/path" 2>&1) || EXIT_CODE=$?
EXIT_CODE=${EXIT_CODE:-0}

# enforce.sh should exit 0 (no src dir = skip) or 1 (violations), but never crash (127, 126, etc.)
if [ "$EXIT_CODE" -eq 127 ] || [ "$EXIT_CODE" -eq 126 ]; then
  echo "[FAIL] enforce.sh crashed with exit code $EXIT_CODE"
  exit 1
fi

echo "[PASS] enforce.sh completed with exit code $EXIT_CODE (no crash)"

# Test 2: Run on empty temp directory
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

OUTPUT=$("$ENFORCE" "$TMPDIR" 2>&1) || EXIT_CODE2=$?
EXIT_CODE2=${EXIT_CODE2:-0}

if [ "$EXIT_CODE2" -eq 127 ] || [ "$EXIT_CODE2" -eq 126 ]; then
  echo "[FAIL] enforce.sh crashed on empty directory with exit code $EXIT_CODE2"
  exit 1
fi

echo "[PASS] enforce.sh handles empty directory (exit code $EXIT_CODE2)"
