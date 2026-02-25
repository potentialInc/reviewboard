#!/usr/bin/env bash
#
# Review Fixer — Structured review → auto-fix pipeline
# Reads review results (JSON array of issues), prioritizes, and auto-fixes via Claude.
# Issues that can't be auto-fixed are written to issues/ folder.
#
# Usage:
#   ./harness/review-fixer.sh <review.json>                  # Fix all P0, log P1+
#   ./harness/review-fixer.sh <review.json> --priority P1    # Fix P0+P1, log P2+
#   ./harness/review-fixer.sh <review.json> --dry-run        # Only categorize, no fixes
#
# Review JSON format (array of issues):
#   [
#     {
#       "id": "ISSUE-001",
#       "file": "src/app/api/projects/route.ts",
#       "line": 30,
#       "severity": "P0",       // P0=critical, P1=high, P2=medium, P3=low
#       "category": "security", // security, bug, performance, ux, missing-feature
#       "title": "Ambiguous FK in nested select",
#       "description": "PostgREST ambiguous relationship causes null data",
#       "suggested_fix": "Separate the client_accounts query from the projects query"
#     }
#   ]
#
# Exit codes:
#   0 = All fixable issues resolved
#   1 = Some P0 issues could not be fixed
#   2 = Review JSON parse error

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AUTO_FIX="$SCRIPT_DIR/auto-fix-loop.sh"
ISSUES_DIR="$PROJECT_ROOT/issues"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

REVIEW_FILE="${1:-}"
FIX_PRIORITY="P0"
DRY_RUN=false

shift 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --priority)  FIX_PRIORITY="$2"; shift 2 ;;
    --dry-run)   DRY_RUN=true; shift ;;
    *) shift ;;
  esac
done

if [ -z "$REVIEW_FILE" ] || [ ! -f "$REVIEW_FILE" ]; then
  echo -e "${RED}Usage: $0 <review.json> [--priority P0|P1|P2] [--dry-run]${NC}"
  exit 2
fi

if ! command -v jq &>/dev/null; then
  echo -e "${RED}Error: jq is required for parsing review JSON${NC}"
  exit 2
fi

# Validate JSON
if ! jq empty "$REVIEW_FILE" 2>/dev/null; then
  echo -e "${RED}Error: Invalid JSON in $REVIEW_FILE${NC}"
  exit 2
fi

TOTAL=$(jq 'length' "$REVIEW_FILE")
echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  Review Fixer${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
echo -e "  Review file: ${REVIEW_FILE}"
echo -e "  Total issues: ${TOTAL}"
echo -e "  Fix priority: ${FIX_PRIORITY} and above"
echo -e "  Dry run: ${DRY_RUN}"
echo ""

# Priority ordering
priority_num() {
  case "$1" in
    P0) echo 0 ;; P1) echo 1 ;; P2) echo 2 ;; P3) echo 3 ;; *) echo 9 ;;
  esac
}

FIX_THRESHOLD=$(priority_num "$FIX_PRIORITY")

# Count by severity
for sev in P0 P1 P2 P3; do
  count=$(jq "[.[] | select(.severity==\"$sev\")] | length" "$REVIEW_FILE")
  echo -e "  ${sev}: ${count} issues"
done
echo ""

# Prepare issues directory
mkdir -p "$ISSUES_DIR"

# Process issues by priority
FIXED=0
LOGGED=0
FAILED=0

for sev in P0 P1 P2 P3; do
  sev_num=$(priority_num "$sev")
  issues=$(jq -c "[.[] | select(.severity==\"$sev\")] | .[]" "$REVIEW_FILE" 2>/dev/null)

  [ -z "$issues" ] && continue

  echo -e "${BOLD}── ${sev} Issues ──${NC}"

  while IFS= read -r issue; do
    id=$(echo "$issue" | jq -r '.id')
    title=$(echo "$issue" | jq -r '.title')
    file=$(echo "$issue" | jq -r '.file // "unknown"')
    category=$(echo "$issue" | jq -r '.category // "general"')
    description=$(echo "$issue" | jq -r '.description // ""')
    suggested_fix=$(echo "$issue" | jq -r '.suggested_fix // ""')

    if [ "$sev_num" -le "$FIX_THRESHOLD" ]; then
      # Auto-fix this issue
      if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}  [dry-run] Would fix: ${id} — ${title}${NC}"
        FIXED=$((FIXED+1))
        continue
      fi

      echo -e "${CYAN}  → Fixing ${id}: ${title} (${file})${NC}"

      FIX_PROMPT="Fix this issue in the codebase:

ID: ${id}
File: ${file}
Severity: ${sev}
Category: ${category}
Title: ${title}
Description: ${description}
Suggested fix: ${suggested_fix}

Read CLAUDE.md first. Only modify the minimum necessary files. Run the build after fixing to verify."

      fix_exit=0
      claude -p "$FIX_PROMPT" 2>&1 | tail -5 || fix_exit=$?

      if [ "$fix_exit" -eq 0 ]; then
        echo -e "${GREEN}  ✓ Fixed: ${id}${NC}"
        FIXED=$((FIXED+1))
      else
        echo -e "${RED}  ✗ Failed to fix: ${id}${NC}"
        FAILED=$((FAILED+1))
        # Log to issues file
        echo "- [ ] **${id}** [${sev}/${category}] ${title} — ${file}" >> "$ISSUES_DIR/AUTO_FIX_FAILED.md"
        echo "  ${description}" >> "$ISSUES_DIR/AUTO_FIX_FAILED.md"
        echo "" >> "$ISSUES_DIR/AUTO_FIX_FAILED.md"
      fi
    else
      # Log for later
      echo -e "${YELLOW}  [log] ${id}: ${title}${NC}"
      LOGGED=$((LOGGED+1))
    fi
  done <<< "$issues"
done

# Write remaining issues to ISSUES.md
if [ "$LOGGED" -gt 0 ] || [ "$FAILED" -gt 0 ]; then
  ISSUES_FILE="$ISSUES_DIR/REVIEW_ISSUES.md"
  echo "# Review Issues (auto-generated)" > "$ISSUES_FILE"
  echo "" >> "$ISSUES_FILE"
  echo "> Generated: $(date '+%Y-%m-%d %H:%M')" >> "$ISSUES_FILE"
  echo "> Source: ${REVIEW_FILE}" >> "$ISSUES_FILE"
  echo "" >> "$ISSUES_FILE"

  for sev in P0 P1 P2 P3; do
    sev_num=$(priority_num "$sev")
    [ "$sev_num" -le "$FIX_THRESHOLD" ] && continue

    count=$(jq "[.[] | select(.severity==\"$sev\")] | length" "$REVIEW_FILE")
    [ "$count" -eq 0 ] && continue

    echo "## ${sev}" >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"

    jq -r ".[] | select(.severity==\"$sev\") | \"- [ ] **\\(.id)** [\\(.category)] \\(.title) — \\(.file // \"global\")\\n  \\(.description)\\n\"" "$REVIEW_FILE" >> "$ISSUES_FILE"
  done

  echo -e "${CYAN}  Logged issues: ${ISSUES_FILE}${NC}"
fi

# Summary
echo ""
echo -e "${BOLD}── Summary ──${NC}"
echo -e "  Fixed: ${GREEN}${FIXED}${NC}"
echo -e "  Logged: ${YELLOW}${LOGGED}${NC}"
echo -e "  Failed: ${RED}${FAILED}${NC}"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}Some P0 issues could not be auto-fixed. Manual intervention needed.${NC}"
  exit 1
fi

exit 0
