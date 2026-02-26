#!/usr/bin/env bash
# Guard test: PRD resolver correctly selects single or active PRD
# Grade: P1 (warn — PRD SoT selection must be deterministic)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESOLVER="$SCRIPT_DIR/prd-resolver.sh"
PRD_DIR="$SCRIPT_DIR/prd"

echo "[guard] Testing PRD resolver..."

if [ ! -x "$RESOLVER" ]; then
  echo "[FAIL] prd-resolver.sh not found or not executable"
  exit 1
fi

FAILED=0

# Stash existing PRD files so tests run in a clean directory
STASH_DIR=$(mktemp -d)
stash_existing_prds() {
  for f in "$PRD_DIR"/prd-*.md; do
    [ -f "$f" ] && mv "$f" "$STASH_DIR/"
  done
}
restore_existing_prds() {
  rm -f "$PRD_DIR/prd-test-alpha.md" "$PRD_DIR/prd-test-beta.md" 2>/dev/null || true
  for f in "$STASH_DIR"/prd-*.md; do
    [ -f "$f" ] && mv "$f" "$PRD_DIR/"
  done
  rm -rf "$STASH_DIR"
}
trap restore_existing_prds EXIT

stash_existing_prds

# Test 1: No prd-*.md files → exit 0 (graceful empty state)
# (The project has template files but no prd-*.md files)
echo "  Testing: no prd-*.md files → exit 0..."
OUTPUT=$("$RESOLVER" 2>/dev/null) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "  [PASS] No PRD files → exit 0"
else
  echo "  [FAIL] No PRD files → exit $EXIT_CODE (expected 0)"
  FAILED=$((FAILED + 1))
fi

# Test 2: Single PRD file → auto-selected
cat > "$PRD_DIR/prd-test-alpha.md" << 'EOF'
---
name: test-alpha
status: active
version: "1.0"
last_updated: 2026-02-01
---
# Test Alpha PRD
EOF
echo "  Testing: single PRD file → auto-select..."
OUTPUT=$("$RESOLVER" 2>/dev/null) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ] && echo "$OUTPUT" | grep -q "prd-test-alpha.md"; then
  echo "  [PASS] Single PRD auto-selected"
else
  echo "  [FAIL] Single PRD not selected (exit=$EXIT_CODE, output=$OUTPUT)"
  FAILED=$((FAILED + 1))
fi

# Test 3: Multiple PRDs, one active → correct selection
cat > "$PRD_DIR/prd-test-beta.md" << 'EOF'
---
name: test-beta
status: draft
version: "1.0"
last_updated: 2026-02-01
---
# Test Beta PRD
EOF
echo "  Testing: multiple PRDs, one active → select active..."
OUTPUT=$("$RESOLVER" 2>/dev/null) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ] && echo "$OUTPUT" | grep -q "prd-test-alpha.md"; then
  echo "  [PASS] Active PRD correctly selected over draft"
else
  echo "  [FAIL] Active PRD not selected (exit=$EXIT_CODE, output=$OUTPUT)"
  FAILED=$((FAILED + 1))
fi

# Test 4: Multiple active PRDs → hard fail (exit 1)
cat > "$PRD_DIR/prd-test-beta.md" << 'EOF'
---
name: test-beta
status: active
version: "1.0"
last_updated: 2026-02-01
---
# Test Beta PRD
EOF
echo "  Testing: multiple active PRDs → hard fail..."
OUTPUT=$("$RESOLVER" 2>&1) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 1 ]; then
  echo "  [PASS] Multiple active PRDs → exit 1"
else
  echo "  [FAIL] Multiple active PRDs → exit $EXIT_CODE (expected 1)"
  FAILED=$((FAILED + 1))
fi

# Test 5: --inject mode outputs prompt line
rm -f "$PRD_DIR/prd-test-alpha.md" "$PRD_DIR/prd-test-beta.md" 2>/dev/null || true
cat > "$PRD_DIR/prd-test-alpha.md" << 'EOF'
---
name: test-alpha
status: active
version: "1.0"
last_updated: 2026-02-01
---
# Test Alpha PRD
EOF
echo "  Testing: --inject mode outputs prompt instruction..."
OUTPUT=$("$RESOLVER" --inject 2>/dev/null) && EXIT_CODE=$? || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ] && echo "$OUTPUT" | grep -q "read.*PRD"; then
  echo "  [PASS] --inject mode outputs PRD instruction"
else
  echo "  [FAIL] --inject mode failed (exit=$EXIT_CODE, output=$OUTPUT)"
  FAILED=$((FAILED + 1))
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED PRD resolver test(s) failed"
  exit 1
fi

echo "[PASS] All PRD resolver tests passed"
