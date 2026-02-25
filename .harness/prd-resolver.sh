#!/usr/bin/env bash
#
# PRD Resolver — Finds the active PRD using SoT selection rules
#
# SoT Selection Rules:
#   1. Single prd-*.md file → auto-selected
#   2. Multiple files → use the one with status: active in YAML header
#   3. Explicit override → pass filename as argument
#
# Usage:
#   ./harness/prd-resolver.sh              → prints active PRD path (relative)
#   ./harness/prd-resolver.sh --inject     → prints prompt instruction line
#   ./harness/prd-resolver.sh --status     → prints human-readable status for session-start
#   ./harness/prd-resolver.sh <filename>   → uses specified file

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRD_DIR="$SCRIPT_DIR/prd"
MODE="${1:-}"

# If explicit filename given (not a flag), use it directly
if [ -n "$MODE" ] && [ "$MODE" != "--inject" ] && [ "$MODE" != "--status" ]; then
  if [ -f "$PRD_DIR/$MODE" ]; then
    echo "prd/$MODE"
    exit 0
  elif [ -f "$MODE" ]; then
    echo "$MODE"
    exit 0
  else
    echo "PRD not found: $MODE" >&2
    echo "  What to do:" >&2
    echo "    1. Check prd/ directory for available PRDs: ls prd/prd-*.md" >&2
    echo "    2. Create a new PRD: cp prd/FEATURE_PRD.template.md prd/prd-<name>.md" >&2
    exit 1
  fi
fi

# Find all prd-*.md files (deterministic sort order)
PRD_FILES=()
while IFS= read -r f; do
  [ -n "$f" ] && PRD_FILES+=("$f")
done < <(find "$PRD_DIR" -maxdepth 1 -name "prd-*.md" 2>/dev/null | sort)

PRD_COUNT=${#PRD_FILES[@]}

if [ "$PRD_COUNT" -eq 0 ]; then
  if [ "$MODE" = "--status" ]; then
    echo "No PRD found. Define a feature: cp prd/FEATURE_PRD.template.md prd/prd-<name>.md"
    exit 2
  fi
  exit 0
fi

ACTIVE_PRD=""

if [ "$PRD_COUNT" -eq 1 ]; then
  # Rule 1: Single file → auto-selected
  ACTIVE_PRD="${PRD_FILES[0]}"
else
  # Rule 2: Multiple files → find status: active in YAML frontmatter
  ACTIVE_PRDS=()
  for prd_file in "${PRD_FILES[@]}"; do
    if sed -n '/^---$/,/^---$/p' "$prd_file" | grep -qiE '^[[:space:]]*status:[[:space:]]*active[[:space:]]*$'; then
      ACTIVE_PRDS+=("$prd_file")
    fi
  done

  if [ ${#ACTIVE_PRDS[@]} -gt 1 ]; then
    if [ "$MODE" = "--status" ]; then
      echo "WARNING: ${#ACTIVE_PRDS[@]} PRDs marked active. Set exactly one to status: active."
      exit 2
    fi
    echo "ERROR: ${#ACTIVE_PRDS[@]} PRDs marked active. Set exactly one to status: active:" >&2
    printf '  %s\n' "${ACTIVE_PRDS[@]}" >&2
    echo "  What to do: Edit the YAML headers of extra PRDs and change 'status: active' to 'status: draft'" >&2
    exit 1
  elif [ ${#ACTIVE_PRDS[@]} -eq 1 ]; then
    ACTIVE_PRD="${ACTIVE_PRDS[0]}"
  else
    if [ "$MODE" = "--status" ]; then
      echo "WARNING: $PRD_COUNT PRDs found but none marked active. Add 'status: active' in YAML header."
      exit 2
    fi
    echo "Multiple PRDs found but none marked active." >&2
    echo "  What to do: Add 'status: active' in the YAML header of the PRD you want to use." >&2
    echo "  Example: Edit prd/prd-<name>.md and set 'status: active' between the --- markers." >&2
    exit 1
  fi
fi

# Output based on mode
REL_PATH="prd/$(basename "$ACTIVE_PRD")"

if [ "$MODE" = "--inject" ]; then
  echo "Then read the active PRD: $REL_PATH."
elif [ "$MODE" = "--status" ]; then
  echo "PRD (SoT): $(basename "$ACTIVE_PRD") ($PRD_COUNT total)"
else
  echo "$REL_PATH"
fi
