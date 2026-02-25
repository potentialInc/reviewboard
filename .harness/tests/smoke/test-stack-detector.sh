#!/usr/bin/env bash
# Smoke test: stack-detector.sh produces valid JSON output
# Grade: P2 (smoke)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DETECTOR="$SCRIPT_DIR/stack-detector.sh"

echo "[smoke] Testing stack-detector.sh JSON output..."

if [ ! -x "$DETECTOR" ]; then
  echo "[SKIP] stack-detector.sh not found or not executable"
  exit 0
fi

# Run in json mode
OUTPUT=$("$DETECTOR" json 2>/dev/null) || EXIT_CODE=$?
EXIT_CODE=${EXIT_CODE:-0}

if [ "$EXIT_CODE" -ne 0 ]; then
  echo "[FAIL] stack-detector.sh exited with code $EXIT_CODE"
  exit 1
fi

# Validate JSON
if command -v jq &>/dev/null; then
  if echo "$OUTPUT" | jq empty 2>/dev/null; then
    echo "[PASS] stack-detector.sh produces valid JSON"
  else
    echo "[FAIL] stack-detector.sh output is not valid JSON"
    echo "Output: $OUTPUT"
    exit 1
  fi
else
  # Basic JSON check without jq
  if [[ "$OUTPUT" == "{"* ]]; then
    echo "[PASS] stack-detector.sh output starts with { (basic JSON check, jq not available)"
  else
    echo "[FAIL] stack-detector.sh output doesn't look like JSON"
    exit 1
  fi
fi
