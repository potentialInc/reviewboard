#!/usr/bin/env bash
#
# First Task Guide — Context-aware "what to type next" suggestions
#
# Analyzes the current project state (PRDs, source code, tests)
# and recommends the most relevant magic keyword command.
#
# Usage:
#   ./scripts/first-task-guide.sh              # Analyze current directory
#   ./scripts/first-task-guide.sh /path/to/dir # Analyze specific directory
#

set -euo pipefail

PROJECT_DIR="${1:-$(pwd)}"

# ── Colors ──
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

divider() { echo -e "${DIM}─────────────────────────────────────────${NC}"; }

echo ""
echo -e "${CYAN}${BOLD}What should you do next?${NC}"
echo ""

# ── Detect project state ──
HAS_PRD=false
ACTIVE_PRD=""
HAS_SOURCE=false
HAS_TESTS=false
HAS_TEAM_STATUS=false
HAS_PIPELINE_STATUS=false

# Check for active PRD
PRD_DIR="$PROJECT_DIR/prd"
if [ -d "$PRD_DIR" ]; then
  for f in "$PRD_DIR"/prd-*.md; do
    [ ! -f "$f" ] && continue
    if sed -n '/^---$/,/^---$/p' "$f" 2>/dev/null | grep -qiE '^[[:space:]]*status:[[:space:]]*active'; then
      HAS_PRD=true
      ACTIVE_PRD="$(basename "$f")"
      break
    fi
  done
  # If only one PRD, treat it as active
  if [ "$HAS_PRD" = false ]; then
    PRD_COUNT=$(find "$PRD_DIR" -maxdepth 1 -name "prd-*.md" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$PRD_COUNT" -eq 1 ]; then
      HAS_PRD=true
      ACTIVE_PRD="$(basename "$(find "$PRD_DIR" -maxdepth 1 -name "prd-*.md" 2>/dev/null)")"
    fi
  fi
fi

# Check for source code
if [ -d "$PROJECT_DIR/src" ] || [ -d "$PROJECT_DIR/app" ] || [ -d "$PROJECT_DIR/pages" ] || \
   [ -d "$PROJECT_DIR/lib" ] || [ -d "$PROJECT_DIR/api" ]; then
  HAS_SOURCE=true
fi

# Check for tests
if find "$PROJECT_DIR" -maxdepth 3 \( -name "*.test.*" -o -name "*.spec.*" -o -name "test_*" -o -name "*_test.*" \) 2>/dev/null | grep -q .; then
  HAS_TESTS=true
fi

# Check for active team/pipeline status
[ -f "$PROJECT_DIR/TEAM_STATUS.md" ] && HAS_TEAM_STATUS=true
[ -f "$PROJECT_DIR/PIPELINE_STATUS.md" ] && HAS_PIPELINE_STATUS=true

# ── Recommend based on state ──

# Case 1: Active team session — resume it
if [ "$HAS_TEAM_STATUS" = true ]; then
  echo -e "  ${GREEN}You have an active team session.${NC}"
  echo ""
  echo "  Continue where you left off:"
  echo -e "    ${CYAN}${BOLD}team: continue from backlog${NC}"
  echo ""
  divider

# Case 2: Active pipeline — resume it
elif [ "$HAS_PIPELINE_STATUS" = true ]; then
  echo -e "  ${GREEN}You have an active pipeline.${NC}"
  echo ""
  echo "  Continue the build:"
  echo -e "    ${CYAN}${BOLD}pipeline: continue${NC}"
  echo ""
  divider

# Case 3: Has PRD but no source code — start building
elif [ "$HAS_PRD" = true ] && [ "$HAS_SOURCE" = false ]; then
  echo -e "  ${GREEN}You have a PRD ($ACTIVE_PRD) but no code yet.${NC}"
  echo ""
  echo "  Start building your project:"
  echo -e "    ${CYAN}${BOLD}team: build my project from PRD${NC}"
  echo ""
  echo "  Or build just one feature:"
  echo -e "    ${CYAN}build:${NC} [pick a feature from your PRD]"
  echo ""
  divider

# Case 4: Has code but no tests — write tests
elif [ "$HAS_SOURCE" = true ] && [ "$HAS_TESTS" = false ]; then
  echo -e "  ${YELLOW}You have code but no tests yet.${NC}"
  echo ""
  echo "  Add tests for your code:"
  echo -e "    ${CYAN}${BOLD}test: write tests for existing code${NC}"
  echo ""
  echo "  Or keep building:"
  echo -e "    ${CYAN}build:${NC} [describe the next feature]"
  echo ""
  divider

# Case 5: Has code and tests — build more or review
elif [ "$HAS_SOURCE" = true ] && [ "$HAS_TESTS" = true ]; then
  echo -e "  ${GREEN}Your project has code and tests.${NC}"
  echo ""
  echo "  What next?"
  echo -e "    ${CYAN}build:${NC}    [description]  — Add a new feature"
  echo -e "    ${CYAN}fix:${NC}      [description]  — Fix a bug"
  echo -e "    ${CYAN}review:${NC}   check code     — Get a code review"
  echo -e "    ${CYAN}refactor:${NC} [description]  — Clean up code"
  echo ""
  divider

# Case 6: No PRD, no code — start from scratch
else
  echo -e "  ${YELLOW}No PRD or code found. Let's get started!${NC}"
  echo ""
  echo "  Option 1: Run the welcome wizard:"
  echo -e "    ${BOLD}./scripts/welcome-wizard.sh${NC}"
  echo ""
  echo "  Option 2: Create a PRD (describe what to build):"
  echo -e "    ${BOLD}cp prd/FEATURE_PRD.template.md prd/prd-my-project.md${NC}"
  echo "    Edit prd-my-project.md with your requirements,"
  echo "    then set status: active in the header."
  echo ""
  echo "  Option 3: Just start building:"
  echo -e "    ${CYAN}${BOLD}build: create the initial project scaffold${NC}"
  echo ""
  divider
fi

# ── Always show quick reference ──
echo ""
echo -e "${DIM}Quick reference — all magic keywords:${NC}"
echo -e "${DIM}  build: fix: test: refactor: review: arch:${NC}"
echo -e "${DIM}  deploy: db: secure: perf: docs: design:${NC}"
echo -e "${DIM}  parallel: pipeline: team: fullstack:${NC}"
echo ""
