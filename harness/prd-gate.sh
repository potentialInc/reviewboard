#!/bin/bash
# prd-gate.sh — PRD completeness validator
# Called before ANY pipeline starts (fullstack:, pipeline:, design:)
#
# Usage:
#   ./harness/prd-gate.sh <prd-path>
#   ./harness/prd-gate.sh <prd-path> --mode design   # design-pipeline strict mode
#   ./harness/prd-gate.sh <prd-path> --mode fullstack # fullstack strict mode
#
# Exit codes:
#   0 = PRD is ready (all checks pass)
#   1 = BLOCKING issues found (pipeline must NOT start)
#   2 = WARNINGS only (user should confirm but can proceed)

set -euo pipefail

PRD_FILE="${1:-}"
MODE="${2:-}"
MODE_VALUE="${3:-all}"

# ─── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Helpers ───────────────────────────────────────────────────────────────────
blocking=()
warnings=()

add_blocking() { blocking+=("$1"); }
add_warning()  { warnings+=("$1"); }

check_pattern() {
  local label="$1"
  local pattern="$2"
  local severity="$3"  # blocking | warning
  local matches
  matches=$(grep -n "$pattern" "$PRD_FILE" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    local lines
    lines=$(echo "$matches" | head -3 | awk -F: '{print "    line "$1": "$2}')
    if [ "$severity" = "blocking" ]; then
      add_blocking "$label\n$lines"
    else
      add_warning "$label\n$lines"
    fi
  fi
}

# ─── Validate file ─────────────────────────────────────────────────────────────
if [ -z "$PRD_FILE" ]; then
  echo -e "${RED}ERROR: No PRD file specified.${NC}"
  echo "Usage: ./harness/prd-gate.sh <prd-path>"
  exit 1
fi

if [ ! -f "$PRD_FILE" ]; then
  echo -e "${RED}ERROR: PRD file not found: $PRD_FILE${NC}"
  exit 1
fi

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║          PRD GATE — Validation           ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo -e "  File: $PRD_FILE"
echo -e "  Mode: ${MODE_VALUE:-all}"
echo ""

# ─── Check 1: PRD status must be 'active' ─────────────────────────────────────
status_value=$(grep -m1 "^status:" "$PRD_FILE" 2>/dev/null | awk '{print $2}' | tr -d '"' || true)
if [ "$status_value" = "draft" ] || [ -z "$status_value" ]; then
  add_blocking "[status] PRD status is '${status_value:-missing}' — set status: active to proceed"
fi

# ─── Check 2: Unfilled template placeholders ───────────────────────────────────
check_pattern "[placeholder] Generic {name} placeholder found" "{name}" "blocking"
check_pattern "[placeholder] Generic {description} placeholder found" "{description}" "blocking"
check_pattern "[placeholder] {one-line purpose} not filled" "{one-line purpose}" "blocking"
check_pattern "[placeholder] {hex} color not set" "{#hex}" "blocking"
check_pattern "[placeholder] {font name} not set" "{font name}" "blocking"
check_pattern "[placeholder] {N}px not set" "{N}px" "blocking"
check_pattern "[placeholder] Table column placeholders found" "{column}" "blocking"
check_pattern "[placeholder] API path placeholders found" "/api/{resource}" "blocking"
check_pattern "[placeholder] Screen name placeholder found" "{screen name}" "blocking"

# ─── Check 3: MISSING markers (from prd-normalize) ────────────────────────────
check_pattern "[missing] MISSING — needs input markers found" "MISSING — needs input" "blocking"
check_pattern "[missing] Unclear section markers found" "unclear — see Q" "warning"
check_pattern "[missing] TBD values found" "{TBD}" "blocking"

# ─── Check 4: Design tokens — required for design: pipeline ───────────────────
if [ "$MODE_VALUE" = "design" ] || [ "$MODE_VALUE" = "fullstack" ] || [ "$MODE_VALUE" = "all" ]; then
  # App Type
  app_type=$(grep -A1 "App Type" "$PRD_FILE" 2>/dev/null | grep -v "App Type" | head -1 || true)
  if echo "$app_type" | grep -qE "\{|\?|TBD|MISSING|Pick one|Web App / Mobile"; then
    add_blocking "[Section 9 — App Type] Not specified — required for design pipeline (Web App / Mobile App / Dashboard / Landing Page)"
  fi

  # Design Style
  design_style=$(grep -A1 "Design Style" "$PRD_FILE" 2>/dev/null | grep -v "Design Style" | head -1 || true)
  if echo "$design_style" | grep -qE "\{|\?|TBD|MISSING|Modern SaaS / Minimal"; then
    add_blocking "[Section 9 — Design Style] Not specified — required for Aura prompts (Modern SaaS / Minimal / Corporate / Playful / Dark)"
  fi

  # Icon Library
  icon_lib=$(grep -A1 "Icon Library" "$PRD_FILE" 2>/dev/null | grep -v "Icon Library" | head -1 || true)
  if echo "$icon_lib" | grep -qE "\{|\?|TBD|MISSING|Pick one|Lucide Icons / Heroicons"; then
    add_blocking "[Section 9 — Icon Library] Not specified — required for design pipeline (Lucide Icons / Heroicons / Phosphor Icons)"
  fi
fi

# ─── Check 5: Critical sections must exist ────────────────────────────────────
for section in "## 7. DB Schema" "## 8. API Endpoints" "## 9. UI Specifications" "## 10. Acceptance Criteria"; do
  if ! grep -q "$section" "$PRD_FILE" 2>/dev/null; then
    add_blocking "[missing section] '$section' not found — add this section before proceeding"
  fi
done

# ─── Check 6: Acceptance criteria — must not all be unchecked templates ────────
ac_count=$(grep -c "AC-[0-9]\{3\}" "$PRD_FILE" 2>/dev/null || true)
if [ "$ac_count" -eq 0 ]; then
  add_warning "[Section 10 — Acceptance Criteria] No AC-NNN items found — tests cannot be auto-generated"
fi

# ─── Check 7: Open questions left unresolved ──────────────────────────────────
open_q=$(grep -c "| Open |" "$PRD_FILE" 2>/dev/null || true)
if [ "$open_q" -gt 0 ]; then
  add_warning "[Section 12 — Open Questions] $open_q unresolved question(s) — review before building"
fi

# ─── Report ────────────────────────────────────────────────────────────────────
if [ ${#blocking[@]} -eq 0 ] && [ ${#warnings[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ PRD GATE PASSED — PRD is ready to proceed.${NC}"
  echo ""
  exit 0
fi

EXIT_CODE=0

if [ ${#blocking[@]} -gt 0 ]; then
  EXIT_CODE=1
  echo -e "${RED}${BOLD}✗ BLOCKING — Pipeline cannot start (${#blocking[@]} issue(s))${NC}"
  echo -e "${RED}  These must be resolved before any pipeline runs:${NC}"
  echo ""
  for issue in "${blocking[@]}"; do
    echo -e "${RED}  ✗ $(echo -e "$issue")${NC}"
    echo ""
  done
fi

if [ ${#warnings[@]} -gt 0 ]; then
  [ $EXIT_CODE -eq 0 ] && EXIT_CODE=2
  echo -e "${YELLOW}${BOLD}⚠ WARNINGS — Review before proceeding (${#warnings[@]} item(s))${NC}"
  echo ""
  for issue in "${warnings[@]}"; do
    echo -e "${YELLOW}  ⚠ $(echo -e "$issue")${NC}"
    echo ""
  done
fi

echo "─────────────────────────────────────────────────"

if [ $EXIT_CODE -eq 1 ]; then
  echo -e "${RED}${BOLD}Pipeline BLOCKED.${NC} Fix the issues above, then re-run."
  echo -e "Tip: run  ${BOLD}prd: $PRD_FILE${NC}  to complete missing sections."
elif [ $EXIT_CODE -eq 2 ]; then
  echo -e "${YELLOW}${BOLD}Warnings found.${NC} Confirm with user before proceeding."
  echo -e "To proceed anyway: acknowledge each warning explicitly."
fi

echo ""
exit $EXIT_CODE
