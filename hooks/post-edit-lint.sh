#!/usr/bin/env bash
#
# Post-Edit Lint Hook
# Runs after every Edit/Write to check for lint errors and architecture violations.
# Provides educational feedback so the agent can self-correct.
#
# Usage: Called automatically by Claude Code via .claude/settings.json
#        ./hooks/post-edit-lint.sh "$FILE_PATH"

set -euo pipefail

FILE_PATH="${1:-}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERRORS=0

# Skip non-source files
if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx|py|go|rs)$ ]]; then
  exit 0
fi

# ── Check 1: File size ──
if [ -f "$FILE_PATH" ]; then
  LINES=$(wc -l < "$FILE_PATH")
  if [ "$LINES" -gt 300 ]; then
    echo "[lint] WARNING: $FILE_PATH has $LINES lines (limit: 300)."
    echo "[lint] SUGGESTION: Split this file. Extract helper functions, types, or constants into separate files."
    ERRORS=$((ERRORS + 1))
  fi
fi

# ── Check 2: Language-specific linting ──
EXT="${FILE_PATH##*.}"

case "$EXT" in
  ts|tsx|js|jsx)
    # Try running eslint if available
    if command -v npx &>/dev/null && [ -f "$PROJECT_ROOT/node_modules/.bin/eslint" ]; then
      npx eslint "$FILE_PATH" --no-error-on-unmatched-pattern 2>/dev/null || {
        echo "[lint] ESLint found issues in $FILE_PATH"
        ERRORS=$((ERRORS + 1))
      }
    fi
    # Try running TypeScript check if available
    if command -v npx &>/dev/null && [ -f "$PROJECT_ROOT/tsconfig.json" ]; then
      npx tsc --noEmit --pretty 2>/dev/null | grep -i "$FILE_PATH" || true
    fi
    ;;
  py)
    # Try running ruff if available
    if command -v ruff &>/dev/null; then
      ruff check "$FILE_PATH" 2>/dev/null || {
        echo "[lint] Ruff found issues in $FILE_PATH"
        ERRORS=$((ERRORS + 1))
      }
    fi
    ;;
  go)
    if command -v go &>/dev/null; then
      go vet "$FILE_PATH" 2>/dev/null || {
        echo "[lint] go vet found issues in $FILE_PATH"
        ERRORS=$((ERRORS + 1))
      }
    fi
    ;;
esac

# ── Check 3: Architecture layer check ──
# Removed: full enforce.sh on every edit causes O(n) scan.
# Architecture check runs on Stop event via build-check.sh.
# Layer context is shown proactively by pre-edit-arch-check.sh.

if [ "$ERRORS" -eq 0 ]; then
  echo "[lint] OK — $FILE_PATH passed all checks."
else
  echo "[lint] $ERRORS issue(s) found in $FILE_PATH."
  exit 1
fi
