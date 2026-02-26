#!/usr/bin/env bash
#
# Session Start Hook
# Displays project status summary and available magic keywords when a session begins.
#
# Usage: Called automatically by Claude Code on SessionStart event.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors (ANSI escape codes work in hook output)
C='\033[0;36m'
G='\033[0;32m'
Y='\033[1;33m'
N='\033[0m'

echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "${C}  claude-harness — Agent-First Dev${N}"
echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"

# ── Bootstrap Doctor ──
DOCTOR_ISSUES=0

# Check jq (required for magic keywords, config parsing, agent selection)
if ! command -v jq &>/dev/null; then
  echo -e ""
  echo -e "${Y}WARNING: jq is not installed. Magic keywords and config parsing will not work.${N}"
  echo -e "  Install: brew install jq (macOS) or apt-get install -y jq (Linux)"
  DOCTOR_ISSUES=$((DOCTOR_ISSUES + 1))
fi

# Check git
if ! command -v git &>/dev/null; then
  echo -e "${Y}WARNING: git is not installed. Worktrees, commits, and session tracking will not work.${N}"
  echo -e "  Install: brew install git (macOS) or apt-get install -y git (Linux)"
  DOCTOR_ISSUES=$((DOCTOR_ISSUES + 1))
fi

# Check claude CLI (required by orchestrator, auto-fix-loop, autopilot)
if ! command -v claude &>/dev/null; then
  echo -e "${Y}WARNING: claude CLI is not installed. Orchestrator, auto-fix, and autopilot will not work.${N}"
  echo -e "  Install: https://claude.ai/download"
  DOCTOR_ISSUES=$((DOCTOR_ISSUES + 1))
fi

# Check tmux (required by autopilot)
if ! command -v tmux &>/dev/null; then
  echo -e "${Y}WARNING: tmux is not installed. Autopilot (persistent execution) will not work.${N}"
  echo -e "  Install: brew install tmux (macOS) or apt-get install -y tmux (Linux)"
  DOCTOR_ISSUES=$((DOCTOR_ISSUES + 1))
fi

# Check timeout/gtimeout (required by auto-fix-loop, orchestrator, autopilot)
if ! command -v timeout &>/dev/null && ! command -v gtimeout &>/dev/null; then
  echo -e "${Y}WARNING: timeout/gtimeout (coreutils) not found. Auto-fix, orchestrator, and autopilot will not work.${N}"
  echo -e "  Install: brew install coreutils (macOS) or apt-get install -y coreutils (Linux)"
  DOCTOR_ISSUES=$((DOCTOR_ISSUES + 1))
fi

# Check hook permissions (silent guardrail failure is the most dangerous mode)
HOOKS_NOT_EXEC=0
for hook_file in "$PROJECT_ROOT"/hooks/*.sh; do
  [ ! -f "$hook_file" ] && continue
  if [ ! -x "$hook_file" ]; then
    HOOKS_NOT_EXEC=$((HOOKS_NOT_EXEC + 1))
  fi
done
if [ "$HOOKS_NOT_EXEC" -gt 0 ]; then
  echo -e "${Y}WARNING: $HOOKS_NOT_EXEC hook(s) are not executable. Guardrails (protection, tests, security) are DISABLED.${N}"
  echo -e "  Fix: chmod +x hooks/*.sh harness/*.sh scripts/*.sh tests/**/*.sh architecture/*.sh"
  DOCTOR_ISSUES=$((DOCTOR_ISSUES + 1))
fi

# Check .claude/settings.json hook wiring (silent deactivation is the worst failure mode)
SETTINGS_FILE="$PROJECT_ROOT/.claude/settings.json"
CRITICAL_HOOKS=("hooks/session-start.sh" "hooks/pre-edit-arch-check.sh" "hooks/pre-edit-security-check.sh" "hooks/skill-activation-prompt.sh")
if [ -f "$SETTINGS_FILE" ]; then
  HOOKS_NOT_WIRED=0
  MISSING_HOOKS=""
  for critical_hook in "${CRITICAL_HOOKS[@]}"; do
    if ! grep -q "$critical_hook" "$SETTINGS_FILE" 2>/dev/null; then
      HOOKS_NOT_WIRED=$((HOOKS_NOT_WIRED + 1))
      MISSING_HOOKS="$MISSING_HOOKS $critical_hook"
    fi
  done
  if [ "$HOOKS_NOT_WIRED" -gt 0 ]; then
    echo -e "${Y}WARNING: $HOOKS_NOT_WIRED critical hook(s) not registered in .claude/settings.json:${N}"
    for mh in $MISSING_HOOKS; do
      echo -e "  ${Y}  - $mh${N}"
    done
    echo -e "  Fix: Add these hooks to .claude/settings.json under the appropriate event matchers."
    DOCTOR_ISSUES=$((DOCTOR_ISSUES + HOOKS_NOT_WIRED))
  fi
else
  echo -e "${Y}WARNING: .claude/settings.json not found. Hooks may not be active.${N}"
  echo -e "  Fix: Run project-init or manually create .claude/settings.json with hook registrations."
  DOCTOR_ISSUES=$((DOCTOR_ISSUES + 1))
fi

# Check config validation
CONFIG_VALIDATOR="$PROJECT_ROOT/harness/config-validator.sh"
if [ -x "$CONFIG_VALIDATOR" ] && command -v jq &>/dev/null; then
  CONFIG_OUTPUT=$("$CONFIG_VALIDATOR" 2>&1) && CONFIG_EXIT=0 || CONFIG_EXIT=$?
  if [ "$CONFIG_EXIT" -eq 1 ]; then
    echo -e "${Y}CONFIG ERRORS:${N}"
    echo "$CONFIG_OUTPUT" | grep -E '^\[config\] (ERROR|WARNING)' | sed 's/^/  /'
    DOCTOR_ISSUES=$((DOCTOR_ISSUES + 1))
  elif [ "$CONFIG_EXIT" -eq 2 ]; then
    echo "$CONFIG_OUTPUT" | grep -E '^\[config\] WARNING' | sed 's/^/  /'
  fi
fi

if [ "$DOCTOR_ISSUES" -gt 0 ]; then
  echo -e "${Y}Found $DOCTOR_ISSUES issue(s). Fix them to enable full harness protection.${N}"
  echo -e ""
fi

# Show magic keywords
echo -e ""
echo -e "${Y}Magic Keywords:${N}"
echo -e "  build:     → Feature builder      review:   → Code reviewer"
echo -e "  fix:       → Bug fixer             refactor: → Refactorer"
echo -e "  test:      → Test writer           arch:     → Architecture check"
echo -e "  deploy:    → DevOps agent          db:       → Database agent"
echo -e "  secure:    → Security agent        perf:     → Performance agent"
echo -e "  docs:      → Documentation agent"
echo -e "  parallel:  → N agents at once      pipeline: → Sequential phases"
echo -e "  team:      → PM→Dev→QA loop        fullstack: → Idea to production"

# Show safe mode status (always visible — non-dev must see current state)
CONFIG_FILE="$PROJECT_ROOT/harness.config.json"
if [ -f "$CONFIG_FILE" ]; then
  if command -v jq &>/dev/null; then
    SAFE_MODE=$(jq -r '.safeMode // false' "$CONFIG_FILE" 2>/dev/null)
    echo -e ""
    if [ "$SAFE_MODE" = "true" ]; then
      echo -e "${Y}Safe mode: ON${N} (parallel agents and retries limited)"
    else
      echo -e "Safe mode: OFF"
    fi
  else
    echo -e ""
    echo -e "${Y}Safe mode: UNKNOWN${N} (jq not installed — cannot read config)"
  fi
else
  echo -e ""
  echo -e "${Y}WARNING: harness.config.json not found.${N} Safety gates (deploy/db confirmations) may not work."
  echo -e "  Generate: ./harness/project-init.sh --detect ."
fi

# Show active PRD (Source of Truth) — delegated to prd-resolver.sh (single truth source)
PRD_RESOLVER="$PROJECT_ROOT/harness/prd-resolver.sh"
if [ -x "$PRD_RESOLVER" ]; then
  PRD_STATUS=$("$PRD_RESOLVER" --status 2>/dev/null) && PRD_EXIT=0 || PRD_EXIT=$?
  if [ -n "$PRD_STATUS" ]; then
    if [ "$PRD_EXIT" -eq 2 ]; then
      echo -e "${Y}${PRD_STATUS}${N}"
    else
      echo -e "${G}${PRD_STATUS}${N}"
    fi
  fi
fi

# Show last session summary if available
PROGRESS="$PROJECT_ROOT/memory/PROGRESS.md"
if [ -f "$PROGRESS" ] && [ -s "$PROGRESS" ]; then
  LAST=$(tail -10 "$PROGRESS" 2>/dev/null | head -5)
  if [ -n "$LAST" ]; then
    echo -e ""
    echo -e "${G}Last Session:${N}"
    echo "$LAST"
  fi
fi

# Check for active worktrees
if command -v git &>/dev/null && [ -d "$PROJECT_ROOT/.git" ]; then
  WORKTREE_COUNT=$(cd "$PROJECT_ROOT" && git worktree list 2>/dev/null | wc -l | tr -d ' ')
  if [ "$WORKTREE_COUNT" -gt 1 ]; then
    echo -e ""
    echo -e "${Y}Active worktrees: $((WORKTREE_COUNT - 1))${N}"
    echo -e "  Run: ./harness/worktree-manager.sh list"
  fi
fi

# Check for pending team items
TEAM_STATUS=$(find "$PROJECT_ROOT" -name "TEAM_STATUS.md" -maxdepth 3 2>/dev/null | head -1)
if [ -n "$TEAM_STATUS" ] && [ -f "$TEAM_STATUS" ]; then
  PENDING=$(grep -c "PENDING" "$TEAM_STATUS" 2>/dev/null || echo "0")
  if [ "$PENDING" -gt 0 ]; then
    echo -e ""
    echo -e "${Y}Team backlog: $PENDING pending items${N}"
    echo -e "  Resume: team: continue from backlog"
  fi
fi

echo -e ""
echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
