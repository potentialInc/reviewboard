#!/usr/bin/env bash
# Smoke test: filter_secrets() in auto-fix-loop.sh masks real credentials
# Grade: P2 (warn)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AUTOFIX="$SCRIPT_DIR/harness/auto-fix-loop.sh"

echo "[smoke] Testing filter_secrets() functional behavior..."

if [ ! -f "$AUTOFIX" ]; then
  echo "[FAIL] auto-fix-loop.sh not found"
  exit 1
fi

FAILED=0

# Extract the filter_secrets function to a temp file and source it.
# Using a temp file avoids eval mangling sed regex on macOS.
TMPFUNC=$(mktemp)
trap "rm -f '$TMPFUNC'" EXIT
sed -n '/^filter_secrets()/,/^}/p' "$AUTOFIX" > "$TMPFUNC"
if [ ! -s "$TMPFUNC" ]; then
  echo "[FAIL] filter_secrets() function not found in auto-fix-loop.sh"
  exit 1
fi
# shellcheck disable=SC1090
source "$TMPFUNC"

# ── Test 1: PostgreSQL connection string ──
INPUT="postgres://admin:s3cret@db.example.com:5432/mydb"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q 's3cret'; then
  echo "  [FAIL] Postgres password not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] Postgres password masked"
fi

# ── Test 2: MySQL connection string ──
INPUT="mysql://root:hunter2@localhost/prod"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q 'hunter2'; then
  echo "  [FAIL] MySQL password not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] MySQL password masked"
fi

# ── Test 3: MongoDB+SRV connection string ──
INPUT="mongodb+srv://user:p4ssw0rd@cluster0.abc.mongodb.net/test"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q 'p4ssw0rd'; then
  echo "  [FAIL] MongoDB password not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] MongoDB password masked"
fi

# ── Test 4: AWS Access Key ──
INPUT="AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q 'AKIAIOSFODNN7EXAMPLE'; then
  echo "  [FAIL] AWS key not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] AWS key masked"
fi

# ── Test 5: OpenAI API key ──
INPUT="OPENAI_API_KEY=sk-abc123def456ghi789jkl012mno345"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q 'sk-abc123def456'; then
  echo "  [FAIL] OpenAI key not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] OpenAI key masked"
fi

# ── Test 6: JWT token ──
INPUT="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q 'eyJhbGci'; then
  echo "  [FAIL] JWT not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] JWT masked"
fi

# ── Test 7: GitHub personal access token ──
INPUT="ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q 'ghp_ABCDEF'; then
  echo "  [FAIL] GitHub token not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] GitHub token masked"
fi

# ── Test 8: Slack token ──
INPUT="xoxb-""123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q 'xoxb-123456'; then
  echo "  [FAIL] Slack token not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] Slack token masked"
fi

# ── Test 9: password=value patterns ──
INPUT="password=SuperSecret123"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q 'SuperSecret123'; then
  echo "  [FAIL] password value not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] password value masked"
fi

# ── Test 10: Normal text passes through unchanged ──
INPUT="This is normal output with no secrets. Exit code 0."
OUTPUT=$(echo "$INPUT" | filter_secrets)
if [ "$OUTPUT" != "$INPUT" ]; then
  echo "  [FAIL] Normal text was modified: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] Normal text unchanged"
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED secret filtering test(s) failed"
  exit 1
fi

echo "[PASS] All secret filtering tests passed (10/10)"
