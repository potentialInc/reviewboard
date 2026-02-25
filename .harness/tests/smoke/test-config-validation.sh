#!/usr/bin/env bash
# Smoke test: config-validator.sh validates harness.config.json correctly
# Grade: P2 (warn — config validation is important but not a core protection)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VALIDATOR="$SCRIPT_DIR/config-validator.sh"

echo "[smoke] Testing config validator..."

if [ ! -x "$VALIDATOR" ]; then
  echo "[FAIL] config-validator.sh not found or not executable"
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "[SKIP] jq not installed — cannot test config-validator"
  exit 0
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

FAILED=0

# Test 1: Valid config → exit 0
cat > "$TMPDIR/valid.json" << 'EOF'
{
  "version": "1.0",
  "safeMode": true,
  "restrictions": {
    "maxParallelAgents": 5,
    "autoFixRetries": 3,
    "requireConfirmation": ["deploy", "db", "secure"]
  }
}
EOF
echo "  Testing: valid config → exit 0..."
OUTPUT=$("$VALIDATOR" "$TMPDIR/valid.json" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  [PASS] Valid config accepted"
else
  echo "  [FAIL] Valid config rejected (exit=$EXIT_CODE)"
  FAILED=$((FAILED + 1))
fi

# Test 2: Missing required key → exit 1
cat > "$TMPDIR/missing-key.json" << 'EOF'
{
  "version": "1.0",
  "restrictions": {
    "maxParallelAgents": 5,
    "autoFixRetries": 3,
    "requireConfirmation": ["deploy"]
  }
}
EOF
echo "  Testing: missing required key → exit 1..."
OUTPUT=$("$VALIDATOR" "$TMPDIR/missing-key.json" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 1 ]; then
  echo "  [PASS] Missing 'safeMode' detected"
else
  echo "  [FAIL] Missing key not caught (exit=$EXIT_CODE)"
  FAILED=$((FAILED + 1))
fi

# Test 3: Unknown top-level key (typo) → exit 2 (warning)
cat > "$TMPDIR/typo.json" << 'EOF'
{
  "version": "1.0",
  "safeMode": true,
  "safmode": true,
  "restrictions": {
    "maxParallelAgents": 5,
    "autoFixRetries": 3,
    "requireConfirmation": ["deploy"]
  }
}
EOF
echo "  Testing: unknown key (typo) → exit 2 (warning)..."
OUTPUT=$("$VALIDATOR" "$TMPDIR/typo.json" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "  [PASS] Typo 'safmode' detected as warning"
else
  echo "  [FAIL] Typo not caught (exit=$EXIT_CODE)"
  FAILED=$((FAILED + 1))
fi

# Test 4: Bad type (safeMode as string) → exit 1
cat > "$TMPDIR/bad-type.json" << 'EOF'
{
  "version": "1.0",
  "safeMode": "yes",
  "restrictions": {
    "maxParallelAgents": 5,
    "autoFixRetries": 3,
    "requireConfirmation": ["deploy"]
  }
}
EOF
echo "  Testing: bad type → exit 1..."
OUTPUT=$("$VALIDATOR" "$TMPDIR/bad-type.json" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 1 ]; then
  echo "  [PASS] Bad type for 'safeMode' detected"
else
  echo "  [FAIL] Bad type not caught (exit=$EXIT_CODE)"
  FAILED=$((FAILED + 1))
fi

# Test 5: Invalid JSON → exit 1
echo "{bad json" > "$TMPDIR/invalid.json"
echo "  Testing: invalid JSON → exit 1..."
OUTPUT=$("$VALIDATOR" "$TMPDIR/invalid.json" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 1 ]; then
  echo "  [PASS] Invalid JSON rejected"
else
  echo "  [FAIL] Invalid JSON not caught (exit=$EXIT_CODE)"
  FAILED=$((FAILED + 1))
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED config validation test(s) failed"
  exit 1
fi

echo "[PASS] All config validation tests passed"
