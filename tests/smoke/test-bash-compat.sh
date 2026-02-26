#!/usr/bin/env bash
# Smoke test: Scan all .sh files for Bash 4+ constructs (macOS ships Bash 3.2)
# Grade: P2 (warn — portability is important for non-dev users on stock macOS)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[smoke] Testing Bash 3.2 compatibility..."

FAILED=0

# Patterns to detect (Bash 4.0+ constructs)
PATTERNS=(
  "compgen -G"
  "declare -A"
  "readarray "
  "mapfile "
)

# Extended patterns requiring regex
REGEX_PATTERNS=(
  '\$\{[a-zA-Z_][a-zA-Z0-9_]*,,\}'
  '\$\{[a-zA-Z_][a-zA-Z0-9_]*\^\^\}'
)

SCAN_DIRS=("harness" "hooks" "scripts" "architecture" "ci" "tests")

# Exclude this test file itself (it references patterns in comments/strings)
SELF_FILE="tests/smoke/test-bash-compat.sh"

for dir in "${SCAN_DIRS[@]}"; do
  FULL_DIR="$SCRIPT_DIR/$dir"
  [ ! -d "$FULL_DIR" ] && continue

  while IFS= read -r -d '' sh_file; do
    REL_FILE="${sh_file#"$SCRIPT_DIR/"}"

    # Skip this test file itself (it references patterns in its PATTERNS array)
    [ "$REL_FILE" = "$SELF_FILE" ] && continue

    # Check literal patterns (skip comment lines: lines starting with optional whitespace + #)
    for pattern in "${PATTERNS[@]}"; do
      MATCH=$(grep -n "$pattern" "$sh_file" 2>/dev/null | grep -vE '^[0-9]+:[[:space:]]*#' | head -1 || true)
      if [ -n "$MATCH" ]; then
        LINE=$(echo "$MATCH" | cut -d: -f1)
        echo "  [FAIL] Bash 4+ construct '$pattern' found in $REL_FILE:$LINE"
        FAILED=$((FAILED + 1))
      fi
    done

    # Check regex patterns (skip comment lines)
    for regex in "${REGEX_PATTERNS[@]}"; do
      MATCH=$(grep -nE "$regex" "$sh_file" 2>/dev/null | grep -vE '^[0-9]+:[[:space:]]*#' | head -1 || true)
      if [ -n "$MATCH" ]; then
        LINE=$(echo "$MATCH" | cut -d: -f1)
        echo "  [FAIL] Bash 4+ construct matching '$regex' found in $REL_FILE:$LINE"
        FAILED=$((FAILED + 1))
      fi
    done
  done < <(find "$FULL_DIR" -name "*.sh" -type f -print0 2>/dev/null)
done

if [ "$FAILED" -gt 0 ]; then
  echo "[FAIL] $FAILED Bash 4+ construct(s) found — these will fail on macOS stock Bash 3.2"
  echo "  What to do: Replace with POSIX/Bash 3.2 compatible alternatives"
  exit 1
fi

echo "[PASS] No Bash 4+ constructs found — compatible with macOS Bash 3.2"
