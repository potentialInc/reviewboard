#!/usr/bin/env bash
#
# Doctor — Pre-flight diagnostic for claude-harness
#
# Checks prerequisites, permissions, config, and security readiness.
# Suggests fixes for common issues. No dependencies beyond bash itself.
#
# Usage: ./scripts/doctor.sh [project_root]
#
# Exit codes:
#   0 = all healthy
#   1 = critical issue (cannot operate)
#   2 = warnings only (can operate with degraded features)

set -euo pipefail

PROJECT_ROOT="${1:-$(pwd)}"
[ -d "$PROJECT_ROOT" ] || { echo "Error: directory not found: $PROJECT_ROOT"; exit 1; }
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

CRITICAL=0
WARNINGS=0

section() { echo -e "\n${CYAN}${BOLD}── $1 ──${NC}"; }
ok()      { echo -e "  ${GREEN}✓${NC} $1"; }
warn()    { echo -e "  ${YELLOW}!${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
err()     { echo -e "  ${RED}✗${NC} $1"; CRITICAL=$((CRITICAL + 1)); }
dim()     { echo -e "  ${DIM}$1${NC}"; }

echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   claude-harness Doctor                  ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"

# ── Section 1: Required Tools ──
section "Required Tools"

if command -v claude &>/dev/null; then
  ok "Claude Code CLI installed"
else
  err "Claude Code CLI not found"
  dim "Install: https://claude.ai/download"
fi

if command -v git &>/dev/null; then
  ok "git installed ($(git --version 2>/dev/null | head -c 20))"
else
  err "git not found"
  dim "Install: brew install git (macOS) or apt install git (Linux)"
fi

if command -v node &>/dev/null; then
  NODE_VER=$(node --version 2>/dev/null)
  ok "Node.js installed ($NODE_VER)"
else
  warn "Node.js not found — bash-guard runs in degraded mode (shell fallback)"
  dim "Install: https://nodejs.org/ (v18+)"
  dim "Shell fallback covers: network attacks (curl|bash) and protected path writes."
  dim "Full protection (detailed path extraction, package install warnings) requires Node.js."
fi

if command -v jq &>/dev/null; then
  ok "jq installed"
else
  warn "jq not found — orchestrator and some hooks run in degraded mode"
  dim "Install: brew install jq (macOS) or apt install jq (Linux)"
fi

# ── Section 2: Recommended Tools ──
section "Recommended Tools"

if command -v tmux &>/dev/null; then
  ok "tmux installed (needed for autopilot mode)"
else
  warn "tmux not found — autopilot mode unavailable"
  dim "Install: brew install tmux (macOS) or apt install tmux (Linux)"
fi

# ── Section 3: File Permissions ──
section "File Permissions"

NON_EXEC=0
for dir in hooks harness scripts architecture tests/guards tests/smoke; do
  FULL_DIR="$PROJECT_ROOT/$dir"
  [ ! -d "$FULL_DIR" ] && continue
  while IFS= read -r -d '' f; do
    if [ ! -x "$f" ]; then
      NON_EXEC=$((NON_EXEC + 1))
    fi
  done < <(find "$FULL_DIR" -name "*.sh" -type f -print0 2>/dev/null)
done

if [ "$NON_EXEC" -eq 0 ]; then
  ok "All .sh files are executable"
else
  warn "$NON_EXEC shell script(s) missing execute permission"
  dim "Fix: chmod +x hooks/*.sh harness/*.sh scripts/*.sh tests/**/*.sh"
fi

# ── Section 4: Configuration ──
section "Configuration"

CONFIG="$PROJECT_ROOT/harness.config.json"
if [ -f "$CONFIG" ]; then
  if command -v jq &>/dev/null; then
    if jq empty "$CONFIG" 2>/dev/null; then
      ok "harness.config.json is valid JSON"
      SAFE=$(jq -r '.safeMode // "missing"' "$CONFIG" 2>/dev/null)
      if [ "$SAFE" = "true" ]; then
        ok "safeMode is enabled"
      else
        warn "safeMode is not true (current: $SAFE)"
        dim "Set \"safeMode\": true in harness.config.json for safety"
      fi
    else
      err "harness.config.json is invalid JSON"
    fi
  else
    ok "harness.config.json exists (skipping validation — jq not installed)"
  fi
else
  err "harness.config.json not found"
fi

RULES="$PROJECT_ROOT/architecture/rules.json"
if [ -f "$RULES" ]; then
  if command -v jq &>/dev/null && jq empty "$RULES" 2>/dev/null; then
    ok "architecture/rules.json is valid JSON"
  elif command -v jq &>/dev/null; then
    err "architecture/rules.json is invalid JSON"
  else
    ok "architecture/rules.json exists"
  fi
else
  err "architecture/rules.json not found"
fi

SETTINGS="$PROJECT_ROOT/.claude/settings.json"
if [ -f "$SETTINGS" ]; then
  ok ".claude/settings.json exists (hooks registered)"
else
  warn ".claude/settings.json not found — hooks may not be active"
fi

# ── Section 5: Security Readiness ──
section "Security Readiness"

CLI_BUNDLE="$PROJECT_ROOT/cli/dist/harness-cli.mjs"
if [ -f "$CLI_BUNDLE" ] && command -v node &>/dev/null; then
  ok "CLI bundle built — bash-guard fully operational"
else
  if command -v node &>/dev/null; then
    warn "CLI bundle not built — run: cd cli && npm run build"
    dim "Bash guard will use tsx fallback (slower) or shell fallback"
  else
    warn "CLI bundle AND Node.js missing — bash-guard in shell-only fallback mode"
    dim "Critical patterns (curl|bash, writes to hooks/harness/architecture) are still blocked."
    dim "Install Node.js for full protection."
  fi
fi

if [ -x "$PROJECT_ROOT/hooks/pre-edit-arch-check.sh" ]; then
  ok "Architecture check hook is executable"
else
  warn "pre-edit-arch-check.sh not executable"
fi

if [ -x "$PROJECT_ROOT/hooks/pre-edit-security-check.sh" ]; then
  ok "Security scan hook is executable"
else
  warn "pre-edit-security-check.sh not executable"
fi

# ── Section 6: Project Structure ──
section "Project Structure"

MISSING_DIRS=0
for dir in harness hooks architecture agents skills orchestration memory prd docs templates tests; do
  if [ ! -d "$PROJECT_ROOT/$dir" ]; then
    warn "Missing directory: $dir/"
    MISSING_DIRS=$((MISSING_DIRS + 1))
  fi
done
[ "$MISSING_DIRS" -eq 0 ] && ok "All expected directories present"

# ── Summary ──
echo ""
echo -e "${CYAN}${BOLD}── Summary ──${NC}"
if [ "$CRITICAL" -gt 0 ]; then
  echo -e "  ${RED}${BOLD}$CRITICAL critical issue(s)${NC} — harness may not function correctly"
  echo -e "  ${DIM}Fix the red items above before running Claude.${NC}"
fi
if [ "$WARNINGS" -gt 0 ]; then
  echo -e "  ${YELLOW}$WARNINGS warning(s)${NC} — harness works but with degraded features"
fi
if [ "$CRITICAL" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}All healthy!${NC} Ready to use claude-harness."
  echo -e "  ${DIM}Next: cd your-project && claude${NC}"
fi

# Exit code
if [ "$CRITICAL" -gt 0 ]; then
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  exit 2
else
  exit 0
fi
