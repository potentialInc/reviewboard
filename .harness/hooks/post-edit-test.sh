#!/usr/bin/env bash
#
# Post-Edit Test Hook
# Runs relevant tests after file edits to catch regressions immediately.
# Finds and runs the closest test file to the edited source.
#
# Usage: ./hooks/post-edit-test.sh "$FILE_PATH"

set -euo pipefail

FILE_PATH="${1:-}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Skip test files themselves, config files, docs
if [[ "$FILE_PATH" =~ \.(test|spec)\. ]] || \
   [[ "$FILE_PATH" =~ test_ ]] || \
   [[ "$FILE_PATH" =~ _test\. ]] || \
   [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx|py|go|rs)$ ]]; then
  exit 0
fi

DIR=$(dirname "$FILE_PATH")
BASENAME=$(basename "$FILE_PATH")
NAME="${BASENAME%.*}"
EXT="${BASENAME##*.}"

# ── Find matching test file ──
TEST_FILE=""

case "$EXT" in
  ts|tsx|js|jsx)
    for pattern in "$DIR/$NAME.test.$EXT" "$DIR/$NAME.spec.$EXT" "$DIR/__tests__/$NAME.test.$EXT" "$DIR/__tests__/$NAME.spec.$EXT"; do
      if [ -f "$pattern" ]; then
        TEST_FILE="$pattern"
        break
      fi
    done
    ;;
  py)
    for pattern in "$DIR/test_$NAME.py" "$DIR/${NAME}_test.py" "$DIR/tests/test_$NAME.py"; do
      if [ -f "$pattern" ]; then
        TEST_FILE="$pattern"
        break
      fi
    done
    ;;
  go)
    TEST_FILE="$DIR/${NAME}_test.go"
    [ ! -f "$TEST_FILE" ] && TEST_FILE=""
    ;;
esac

if [ -z "$TEST_FILE" ]; then
  echo "[test] No matching test file found for $FILE_PATH. Consider writing one."
  exit 0
fi

echo "[test] Running: $TEST_FILE"

# ── Run the test ──
TEST_EXIT=0

case "$EXT" in
  ts|tsx|js|jsx)
    if [ -f "$PROJECT_ROOT/node_modules/.bin/vitest" ]; then
      npx vitest run "$TEST_FILE" --reporter=verbose 2>&1 | tail -20 || TEST_EXIT=$?
    elif [ -f "$PROJECT_ROOT/node_modules/.bin/jest" ]; then
      npx jest "$TEST_FILE" --verbose 2>&1 | tail -20 || TEST_EXIT=$?
    else
      echo "[test] No test runner found (vitest/jest). Install one to enable auto-testing."
    fi
    ;;
  py)
    if command -v pytest &>/dev/null; then
      pytest "$TEST_FILE" -v 2>&1 | tail -20 || TEST_EXIT=$?
    else
      python -m unittest "$TEST_FILE" 2>&1 | tail -20 || TEST_EXIT=$?
    fi
    ;;
  go)
    (cd "$DIR" && go test -v -run "$(basename "$TEST_FILE" .go)" . 2>&1 | tail -20) || TEST_EXIT=$?
    ;;
esac

if [ "$TEST_EXIT" -ne 0 ]; then
  echo "[test] FAILED: $TEST_FILE (exit code: $TEST_EXIT)"
  exit 1
fi
