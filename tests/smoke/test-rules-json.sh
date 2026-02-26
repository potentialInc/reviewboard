#!/usr/bin/env bash
# Smoke test: rules.json is valid JSON with required keys
# Grade: P2 (smoke)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RULES="$SCRIPT_DIR/architecture/rules.json"

echo "[smoke] Testing rules.json validity..."

if [ ! -f "$RULES" ]; then
  echo "[FAIL] architecture/rules.json not found"
  exit 1
fi

# Validate JSON syntax
if command -v jq &>/dev/null; then
  if ! jq empty "$RULES" 2>/dev/null; then
    echo "[FAIL] rules.json is not valid JSON"
    exit 1
  fi
  echo "[PASS] rules.json is valid JSON"

  # Check required keys
  REQUIRED_KEYS=("layers" "forbidden_imports" "protected_paths")
  MISSING=0

  for key in "${REQUIRED_KEYS[@]}"; do
    if ! jq -e ".$key" "$RULES" &>/dev/null; then
      echo "[FAIL] Missing required key: $key"
      MISSING=$((MISSING + 1))
    fi
  done

  if [ "$MISSING" -gt 0 ]; then
    echo "[FAIL] $MISSING required key(s) missing from rules.json"
    exit 1
  fi

  echo "[PASS] All required keys present (layers, forbidden_imports, protected_paths)"
else
  # Basic check without jq
  if python3 -c "import json; json.load(open('$RULES'))" 2>/dev/null; then
    echo "[PASS] rules.json is valid JSON (python3 check)"
  else
    echo "[FAIL] rules.json appears invalid (install jq for detailed check)"
    exit 1
  fi
fi
