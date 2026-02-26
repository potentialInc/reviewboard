#!/usr/bin/env bash
#
# Quick Install — Streamlined setup for claude-harness
#
# Checks prerequisites, installs missing tools where possible,
# then runs harness-install.sh and doctor.sh.
#
# Usage:
#   ./scripts/quick-install.sh /path/to/your-project
#   OR for new project:
#   ./scripts/quick-install.sh --new --template nextjs --name my-app
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}▸${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; exit 1; }

echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   claude-harness Quick Install           ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"

# ── Parse arguments ──
MODE="existing"
TEMPLATE=""
NAME=""
TARGET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --new)       MODE="new"; shift ;;
    --template)  TEMPLATE="$2"; shift 2 ;;
    --name)      NAME="$2"; shift 2 ;;
    -h|--help)
      echo "Usage:"
      echo "  Existing project: $0 /path/to/project"
      echo "  New project:      $0 --new --template nextjs --name my-app"
      exit 0 ;;
    *)           TARGET="$1"; shift ;;
  esac
done

# ── Step 1: Check prerequisites ──
echo ""
info "Checking prerequisites..."

MISSING=0

check_tool() {
  local tool="$1" install_hint="$2"
  if command -v "$tool" &>/dev/null; then
    ok "$tool found"
  else
    warn "$tool not found"
    echo -e "  Install: $install_hint"
    MISSING=$((MISSING + 1))
  fi
}

check_tool "git"   "brew install git (macOS) or apt install git (Linux)"
check_tool "node"  "https://nodejs.org/ (v18+)"
check_tool "jq"    "brew install jq (macOS) or apt install jq (Linux)"

if ! command -v claude &>/dev/null; then
  warn "Claude Code CLI not found"
  echo -e "  Install: https://claude.ai/download"
  MISSING=$((MISSING + 1))
else
  ok "Claude Code CLI found"
fi

if [ "$MISSING" -gt 0 ]; then
  echo ""
  warn "Install the missing tools above, then re-run this script."
  exit 1
fi

# ── Step 2: Build CLI if needed ──
CLI_BUNDLE="$HARNESS_ROOT/cli/dist/harness-cli.mjs"
if [ ! -f "$CLI_BUNDLE" ]; then
  info "Building CLI bundle..."
  (cd "$HARNESS_ROOT/cli" && npm run build 2>&1) || warn "CLI build failed (non-critical)"
fi

# ── Step 3: Run appropriate installer ──
echo ""
if [ "$MODE" = "new" ]; then
  [ -z "$TEMPLATE" ] && fail "Missing --template (e.g. nextjs, fastapi, generic)"
  [ -z "$NAME" ] && fail "Missing --name (e.g. my-app)"
  info "Creating new project: $NAME (template: $TEMPLATE)..."
  "$HARNESS_ROOT/harness/project-init.sh" --template "$TEMPLATE" --name "$NAME"
  TARGET="$HARNESS_ROOT/../$NAME"
else
  [ -z "$TARGET" ] && fail "Usage: $0 /path/to/project"
  [ ! -d "$TARGET" ] && fail "Directory not found: $TARGET"
  info "Installing harness into: $TARGET"
  "$HARNESS_ROOT/scripts/harness-install.sh" "$TARGET"
fi

# ── Step 4: Run doctor ──
echo ""
info "Running health check..."
"$HARNESS_ROOT/scripts/doctor.sh" "$TARGET" || true

# ── Step 5: Next steps ──
echo ""
echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""

# Offer the welcome wizard for first-time users
WIZARD="$HARNESS_ROOT/scripts/welcome-wizard.sh"
if [ -f "$WIZARD" ] && [ ! -f "$TARGET/.harness-wizard-done" ]; then
  echo -e "New to claude-harness? Run the welcome wizard for a guided experience:"
  echo -e "  ${BOLD}./scripts/welcome-wizard.sh --project-dir $TARGET${NC}"
  echo ""
fi

echo -e "Next steps:"
echo -e "  ${BOLD}cd $(basename "$TARGET") && claude${NC}"
echo ""
echo -e "Try your first command:"
echo -e "  ${CYAN}team: build my project from PRD${NC}"
echo ""
echo -e "Not sure what to do? Run: ${CYAN}./scripts/first-task-guide.sh${NC}"
