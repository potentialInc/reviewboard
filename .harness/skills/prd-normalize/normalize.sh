#!/usr/bin/env bash
#
# PRD Normalize — Convert any PRD to the standard harness template
# Triggered by: prd: <file>
#
# Usage:
#   ./skills/prd-normalize/normalize.sh <input-prd-path>
#   ./skills/prd-normalize/normalize.sh <input-prd-path> --output prd/prd-myapp.md
#
# Output:
#   prd/prd-{derived-name}.md with status: draft
#   Gap report printed to stdout

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

INPUT_PRD="${1:-}"
OUTPUT_PRD="${3:-}"  # --output <path>

# Parse args
shift 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) OUTPUT_PRD="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -z "$INPUT_PRD" ]; then
  echo -e "${RED}Usage: $0 <input-prd-path> [--output prd/prd-name.md]${NC}" >&2
  exit 1
fi

# Resolve input path
INPUT_FULL="$INPUT_PRD"
[ ! -f "$INPUT_FULL" ] && INPUT_FULL="$PROJECT_ROOT/$INPUT_PRD"
if [ ! -f "$INPUT_FULL" ]; then
  echo -e "${RED}ERROR: Input file not found: $INPUT_PRD${NC}" >&2
  exit 1
fi

# Derive output path if not specified
if [ -z "$OUTPUT_PRD" ]; then
  basename_no_ext=$(basename "$INPUT_PRD" .md)
  basename_no_ext="${basename_no_ext#prd-}"  # Remove prd- prefix if present
  OUTPUT_PRD="prd/prd-${basename_no_ext}.md"
fi
OUTPUT_FULL="$PROJECT_ROOT/$OUTPUT_PRD"

SKILL_MD="$SCRIPT_DIR/SKILL.md"
TEMPLATE_MD="$PROJECT_ROOT/prd/FEATURE_PRD.template.md"
PRD_GATE="$PROJECT_ROOT/harness/prd-gate.sh"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║         PRD Normalize                    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo -e "  Input:  ${INPUT_PRD}"
echo -e "  Output: ${OUTPUT_PRD}"
echo ""

if ! command -v claude &>/dev/null; then
  echo -e "${RED}ERROR: claude CLI required${NC}" >&2
  exit 1
fi

# ─── Load context ─────────────────────────────────────────────────────────────
SKILL_INSTRUCTIONS=$(cat "$SKILL_MD")
TEMPLATE_CONTENT=$(cat "$TEMPLATE_MD")
INPUT_CONTENT=$(cat "$INPUT_FULL")

# ─── Build normalization prompt ───────────────────────────────────────────────
NORMALIZE_PROMPT="You are executing the PRD Normalize skill. Follow these instructions exactly.

═══════════════════════════════════════════════════════════
SKILL INSTRUCTIONS
═══════════════════════════════════════════════════════════

${SKILL_INSTRUCTIONS}

═══════════════════════════════════════════════════════════
TEMPLATE (standard harness format)
═══════════════════════════════════════════════════════════

${TEMPLATE_CONTENT}

═══════════════════════════════════════════════════════════
INPUT PRD (to be normalized)
═══════════════════════════════════════════════════════════

${INPUT_CONTENT}

═══════════════════════════════════════════════════════════
TASK
═══════════════════════════════════════════════════════════

1. Normalize the INPUT PRD into the standard template format
2. Write the normalized PRD to: ${OUTPUT_PRD}
3. Set status: draft in YAML frontmatter (NOT active — user must review first)
4. Follow the no-hallucination principle: use {MISSING — needs input} for anything not in the source
5. After writing, print the gap report as specified in the SKILL INSTRUCTIONS
6. End with: NORMALIZE_COMPLETE: ${OUTPUT_PRD}"

# ─── Execute ──────────────────────────────────────────────────────────────────
echo -e "${CYAN}→ Running Claude to normalize PRD...${NC}"
echo -e "${CYAN}  (This may take 1-2 minutes for complex PRDs)${NC}"
echo ""

mkdir -p "$PROJECT_ROOT/prd"

normalize_exit=0
claude -p "$NORMALIZE_PROMPT" 2>&1 || normalize_exit=$?

if [ "$normalize_exit" -ne 0 ]; then
  echo -e "${RED}ERROR: Normalization failed (exit code: $normalize_exit)${NC}" >&2
  exit 1
fi

# ─── Check output exists ──────────────────────────────────────────────────────
if [ ! -f "$OUTPUT_FULL" ]; then
  echo -e "${YELLOW}⚠ Output file not found at ${OUTPUT_PRD} — Claude may have used a different path${NC}"
  # Try to find recently created prd-*.md
  recent=$(find "$PROJECT_ROOT/prd" -name "prd-*.md" -newer "$INPUT_FULL" 2>/dev/null | head -1 || echo "")
  if [ -n "$recent" ]; then
    echo -e "${CYAN}  Found: ${recent}${NC}"
    OUTPUT_FULL="$recent"
    OUTPUT_PRD="${recent#$PROJECT_ROOT/}"
  else
    echo -e "${RED}ERROR: No output PRD created${NC}" >&2
    exit 1
  fi
fi

echo ""
echo -e "${GREEN}✓ Normalized PRD written to: ${OUTPUT_PRD}${NC}"
echo ""

# ─── Run PRD gate in report-only mode ────────────────────────────────────────
echo -e "${CYAN}→ Running PRD Gate to identify remaining gaps...${NC}"
if [ -x "$PRD_GATE" ]; then
  gate_exit=0
  "$PRD_GATE" "$OUTPUT_FULL" 2>&1 || gate_exit=$?
  if [ "$gate_exit" -eq 0 ]; then
    echo -e "${GREEN}✓ PRD is complete! Set status: active to start building.${NC}"
  elif [ "$gate_exit" -eq 1 ]; then
    echo -e "${YELLOW}⚠ PRD has blocking issues — fill in the missing sections above, then set status: active${NC}"
  elif [ "$gate_exit" -eq 2 ]; then
    echo -e "${YELLOW}⚠ PRD has warnings — review above, then set status: active when ready${NC}"
  fi
fi

echo ""
echo -e "${BOLD}Next steps:${NC}"
echo -e "  1. Review ${OUTPUT_PRD} and fill in any MISSING sections"
echo -e "  2. Set status: active in the YAML header"
echo -e "  3. Run: pipeline: start  OR  fullstack: <description>"
echo ""
