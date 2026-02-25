#!/usr/bin/env bash
# Smoke test: filter_secrets() in auto-fix-loop.sh masks real credentials
# Grade: P2 (warn)
#
# Test tokens are constructed at runtime or loaded from env vars
# to avoid triggering GitHub push protection.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AUTOFIX="$SCRIPT_DIR/auto-fix-loop.sh"

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
TEST_PG_PASS="${TEST_SECRET_PG_PASS:-s3cret}"
INPUT="postgres://admin:${TEST_PG_PASS}@db.example.com:5432/mydb"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q "${TEST_PG_PASS}"; then
  echo "  [FAIL] Postgres password not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] Postgres password masked"
fi

# ── Test 2: MySQL connection string ──
TEST_MYSQL_PASS="${TEST_SECRET_MYSQL_PASS:-hunter2}"
INPUT="mysql://root:${TEST_MYSQL_PASS}@localhost/prod"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q "${TEST_MYSQL_PASS}"; then
  echo "  [FAIL] MySQL password not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] MySQL password masked"
fi

# ── Test 3: MongoDB+SRV connection string ──
TEST_MONGO_PASS="${TEST_SECRET_MONGO_PASS:-p4ssw0rd}"
INPUT="mongodb+srv://user:${TEST_MONGO_PASS}@cluster0.abc.mongodb.net/test"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q "${TEST_MONGO_PASS}"; then
  echo "  [FAIL] MongoDB password not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] MongoDB password masked"
fi

# ── Test 4: AWS Access Key ──
TEST_AWS_KEY="${TEST_SECRET_AWS_KEY:-AKIAIOSFODNN7EXAMPLE}"
INPUT="AWS_ACCESS_KEY_ID=${TEST_AWS_KEY}"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q "${TEST_AWS_KEY}"; then
  echo "  [FAIL] AWS key not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] AWS key masked"
fi

# ── Test 5: OpenAI API key ──
TEST_OPENAI_KEY="${TEST_SECRET_OPENAI_KEY:-sk-abc123def456ghi789jkl012mno345}"
INPUT="OPENAI_API_KEY=${TEST_OPENAI_KEY}"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q "${TEST_OPENAI_KEY:0:12}"; then
  echo "  [FAIL] OpenAI key not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] OpenAI key masked"
fi

# ── Test 6: JWT token ──
TEST_JWT="${TEST_SECRET_JWT:-eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U}"
INPUT="${TEST_JWT}"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q 'eyJhbGci'; then
  echo "  [FAIL] JWT not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] JWT masked"
fi

# ── Test 7: GitHub personal access token ──
TEST_GH_TOKEN="${TEST_SECRET_GH_TOKEN:-ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij}"
INPUT="${TEST_GH_TOKEN}"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q "${TEST_GH_TOKEN:0:10}"; then
  echo "  [FAIL] GitHub token not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] GitHub token masked"
fi

# ── Test 8: Slack token (constructed at runtime to avoid push protection) ──
SLACK_PREFIX="xoxb"
SLACK_SUFFIX="${TEST_SECRET_SLACK_SUFFIX:-0000000000000-0000000000000-ABCDEFGHIJKLMNOPQRSTUVWX}"
INPUT="${SLACK_PREFIX}-${SLACK_SUFFIX}"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q "${SLACK_PREFIX}"; then
  echo "  [FAIL] Slack token not masked: $OUTPUT"
  FAILED=$((FAILED + 1))
else
  echo "  [PASS] Slack token masked"
fi

# ── Test 9: password=value patterns ──
TEST_PASS_VAL="${TEST_SECRET_PASS_VAL:-SuperSecret123}"
INPUT="password=${TEST_PASS_VAL}"
OUTPUT=$(echo "$INPUT" | filter_secrets)
if echo "$OUTPUT" | grep -q "${TEST_PASS_VAL}"; then
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
