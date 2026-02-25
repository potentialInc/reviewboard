#!/usr/bin/env bash
#
# Welcome Wizard — Interactive first-run guide for non-developers
#
# Walks a new user through setup verification, project selection,
# PRD creation, and shows the exact command to start building.
#
# Usage:
#   ./scripts/welcome-wizard.sh                    # Interactive wizard
#   ./scripts/welcome-wizard.sh --reset            # Re-run even if done before
#   ./scripts/welcome-wizard.sh --project-dir DIR  # Specify project directory
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()    { echo -e "${CYAN}▸${NC} $1"; }
ok()      { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}!${NC} $1"; }
fail()    { echo -e "${RED}✗${NC} $1"; }
step()    { echo -e "\n${CYAN}${BOLD}── Step $1: $2 ──${NC}\n"; }
divider() { echo -e "${DIM}─────────────────────────────────────────${NC}"; }

# ── Parse arguments ──
RESET=false
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset)       RESET=true; shift ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--reset] [--project-dir DIR]"
      echo ""
      echo "Interactive wizard for first-time setup."
      echo "  --reset         Re-run wizard even if completed before"
      echo "  --project-dir   Specify project directory (default: current)"
      exit 0 ;;
    *) PROJECT_DIR="$1"; shift ;;
  esac
done

[ -z "$PROJECT_DIR" ] && PROJECT_DIR="$(pwd)"

# ── Check if already completed ──
MARKER="$PROJECT_DIR/.harness-wizard-done"
if [ "$RESET" = false ] && [ -f "$MARKER" ]; then
  echo ""
  info "Welcome wizard already completed for this project."
  echo "  To re-run: $0 --reset"
  echo "  To see what to do next: ./scripts/first-task-guide.sh"
  exit 0
fi

# ── Banner ──
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   Welcome to claude-harness              ║${NC}"
echo -e "${CYAN}${BOLD}║   Let's get you building in 5 minutes    ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"

step "1" "Checking your setup"

MISSING=0
MISSING_LIST=""

check_tool() {
  local tool="$1" install_hint="$2"
  if command -v "$tool" &>/dev/null; then
    ok "$tool"
  else
    fail "$tool — not found"
    echo -e "  ${DIM}Install: $install_hint${NC}"
    MISSING=$((MISSING + 1))
    MISSING_LIST="${MISSING_LIST}  ${RED}✗${NC} $tool: $install_hint\n"
  fi
}

check_tool "git"   "brew install git (macOS) / apt install git (Linux)"
check_tool "node"  "https://nodejs.org/ (download v18 or newer)"
check_tool "jq"    "brew install jq (macOS) / apt install jq (Linux)"

if command -v claude &>/dev/null; then
  ok "Claude Code CLI"
else
  fail "Claude Code CLI — not found"
  echo -e "  ${DIM}Install: https://claude.ai/download${NC}"
  MISSING=$((MISSING + 1))
  MISSING_LIST="${MISSING_LIST}  ${RED}✗${NC} Claude Code CLI: https://claude.ai/download\n"
fi

if [ "$MISSING" -gt 0 ]; then
  echo ""
  echo -e "${RED}${BOLD}$MISSING tool(s) missing. Please install them first:${NC}"
  echo -e "$MISSING_LIST"
  echo "After installing, run this wizard again:"
  echo "  $0"
  exit 1
fi

echo ""
ok "All tools ready!"

HAS_HARNESS=false
if [ -f "$PROJECT_DIR/CLAUDE.md" ] && [ -d "$PROJECT_DIR/agents" ]; then
  HAS_HARNESS=true
fi

if [ "$HAS_HARNESS" = false ]; then
  step "2" "Setting up your project"

  echo "Your project doesn't have the harness installed yet."
  echo ""
  echo "  What type of project?"
  echo -e "    ${BOLD}1${NC}) Create a new project"
  echo -e "    ${BOLD}2${NC}) Add harness to an existing project"
  echo ""
  echo -n "  Choose (1 or 2): "
  read -r SETUP_CHOICE

  case "$SETUP_CHOICE" in
    1)
      echo ""
      echo -n "  Project name (e.g. my-app): "
      read -r PROJ_NAME
      [ -z "$PROJ_NAME" ] && PROJ_NAME="my-app"

      echo ""
      echo "  Pick a tech stack:"
      echo -e "    ${BOLD}1${NC}) Next.js (React web app)"
      echo -e "    ${BOLD}2${NC}) FastAPI (Python API server)"
      echo -e "    ${BOLD}3${NC}) React + Vite (frontend only)"
      echo -e "    ${BOLD}4${NC}) Generic (I'll decide later)"
      echo ""
      echo -n "  Choose (1-4): "
      read -r STACK_CHOICE

      case "$STACK_CHOICE" in
        1) TEMPLATE="nextjs" ;;
        2) TEMPLATE="fastapi" ;;
        3) TEMPLATE="react-vite" ;;
        *) TEMPLATE="generic" ;;
      esac

      info "Creating project: $PROJ_NAME (template: $TEMPLATE)..."
      "$HARNESS_ROOT/harness/project-init.sh" --template "$TEMPLATE" --name "$PROJ_NAME" 2>&1 | tail -5
      PROJECT_DIR="$HARNESS_ROOT/../$PROJ_NAME"
      MARKER="$PROJECT_DIR/.harness-wizard-done"
      echo ""
      ok "Project created at: $PROJECT_DIR"
      ;;
    *)
      echo ""
      echo -n "  Path to your project: "
      read -r EXISTING_PATH
      [ -z "$EXISTING_PATH" ] && EXISTING_PATH="$(pwd)"

      if [ ! -d "$EXISTING_PATH" ]; then
        fail "Directory not found: $EXISTING_PATH"
        exit 1
      fi

      info "Installing harness..."
      "$HARNESS_ROOT/scripts/harness-install.sh" "$EXISTING_PATH" 2>&1 | tail -5
      PROJECT_DIR="$EXISTING_PATH"
      MARKER="$PROJECT_DIR/.harness-wizard-done"
      echo ""
      ok "Harness installed!"
      ;;
  esac
fi

step "3" "What do you want to build?"

PRD_DIR="$PROJECT_DIR/prd"
EXAMPLES_DIR="$HARNESS_ROOT/prd/examples"

# Check if there's already an active PRD
EXISTING_PRD=""
if [ -d "$PRD_DIR" ]; then
  for f in "$PRD_DIR"/prd-*.md; do
    [ ! -f "$f" ] && continue
    if sed -n '/^---$/,/^---$/p' "$f" 2>/dev/null | grep -qiE '^[[:space:]]*status:[[:space:]]*active'; then
      EXISTING_PRD="$f"
      break
    fi
  done
fi

if [ -n "$EXISTING_PRD" ]; then
  ok "Active PRD found: $(basename "$EXISTING_PRD")"
  echo "  Using this as the plan for what to build."
else
  echo "  A PRD (Product Requirements Document) is your wish list —"
  echo "  what features you want, written in plain language."
  echo ""
  echo "  Pick a starting point:"
  echo -e "    ${BOLD}1${NC}) Todo list app ${DIM}(simple, great for learning)${NC}"
  echo -e "    ${BOLD}2${NC}) Blog API server ${DIM}(backend only, Python)${NC}"
  echo -e "    ${BOLD}3${NC}) Landing page ${DIM}(frontend only, looks nice)${NC}"
  echo -e "    ${BOLD}4${NC}) Something else ${DIM}(I'll describe it)${NC}"
  echo ""
  echo -n "  Choose (1-4): "
  read -r BUILD_CHOICE

  mkdir -p "$PRD_DIR"

  copy_example_prd() {
    local example_name="$1" label="$2"
    local src="$EXAMPLES_DIR/$example_name"
    [ ! -f "$src" ] && src="$PRD_DIR/../prd/examples/$example_name"
    if [ -f "$src" ]; then
      cp "$src" "$PRD_DIR/prd-my-project.md"
      sed -i.bak 's/^status: example/status: active/' "$PRD_DIR/prd-my-project.md" 2>/dev/null
      rm -f "$PRD_DIR/prd-my-project.md.bak"
      ok "$label PRD ready!"
    else
      fail "Example not found: $example_name"
    fi
  }

  case "$BUILD_CHOICE" in
    1) copy_example_prd "prd-todo-app.md" "Todo app" ;;
    2) copy_example_prd "prd-blog-api.md" "Blog API" ;;
    3) copy_example_prd "prd-landing-page.md" "Landing page" ;;
    4|*)
      echo ""
      echo -n "  Describe what you want to build (one line): "
      read -r USER_DESC
      [ -z "$USER_DESC" ] && USER_DESC="My custom project"
      TODAY=$(date '+%Y-%m-%d')
      printf -- '---\nname: my-project\nstatus: active\nversion: "1.0"\nlast_updated: %s\n---\n\n# My Project — Product Requirements Document\n\n## 1. Overview\n\n| Field | Value |\n|-------|-------|\n| Feature Name | My Project |\n| Purpose | %s |\n| Target Users | General users |\n| Target Release | MVP |\n| Owner | Project Owner |\n\n## 2. Requirements\n\n%s\n\n## 3. Success Criteria\n\n- The feature works as described above\n- Tests pass\n- Code follows project architecture rules\n' "$TODAY" "$USER_DESC" "$USER_DESC" > "$PRD_DIR/prd-my-project.md"
      ok "Custom PRD created!"
      ;;
  esac

  echo -e "  ${DIM}Your PRD is at: prd/prd-my-project.md${NC}"
  echo -e "  ${DIM}You can edit it anytime to change what gets built.${NC}"
fi

step "4" "You're ready!"

echo "  Open your project and start Claude:"
echo -e "    ${BOLD}cd $(basename "$PROJECT_DIR") && claude${NC}"
echo ""
echo "  Then type this command:"
echo -e "    ${CYAN}${BOLD}team: build my project from PRD${NC}"
divider
echo ""
echo "  What happens next:"
echo -e "    ${GREEN}1.${NC} PM agent reads your requirements and creates a plan"
echo -e "    ${GREEN}2.${NC} Dev agent writes the code"
echo -e "    ${GREEN}3.${NC} QA agent tests everything → you review the result"
echo ""
echo "  The AI asks you questions if it needs input. Just watch and respond."
divider
echo ""
echo "  Other useful commands:"
echo -e "    ${CYAN}build:${NC} [description]  — Build a feature"
echo -e "    ${CYAN}fix:${NC}   [description]  — Fix a bug"
echo -e "    ${CYAN}test:${NC}  [description]  — Write tests"
echo -e "  ${DIM}Not sure later? Run: ./scripts/first-task-guide.sh${NC}"

# ── Mark wizard as complete ──
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$MARKER"
GITIGNORE="$PROJECT_DIR/.gitignore"
if [ -f "$GITIGNORE" ] && ! grep -q '.harness-wizard-done' "$GITIGNORE" 2>/dev/null; then
  echo '.harness-wizard-done' >> "$GITIGNORE"
fi

echo ""
ok "Wizard complete. Have fun building!"
