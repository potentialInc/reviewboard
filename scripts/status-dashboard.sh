#!/usr/bin/env bash
#
# Status Dashboard — Project health at a glance
#
# Shows active worktrees, team/pipeline status, recent memory entries,
# and build/test health with color-coded output.
#
# Usage:
#   ./scripts/status-dashboard.sh [project_root]
#

set -euo pipefail

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
PROJECT_ROOT="${1:-$(pwd)}"

if [ ! -d "$PROJECT_ROOT" ]; then
  echo "Error: directory does not exist: $PROJECT_ROOT"
  exit 1
fi

# Resolve to absolute path
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
section() {
  echo ""
  echo -e "${BOLD}${CYAN}--- $1 ---${NC}"
}

ok()   { echo -e "  ${GREEN}$1${NC}"; }
warn() { echo -e "  ${YELLOW}$1${NC}"; }
err()  { echo -e "  ${RED}$1${NC}"; }
dim()  { echo -e "  ${DIM}$1${NC}"; }

# ─────────────────────────────────────────────
# Header
# ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}================================================${NC}"
echo -e "${BOLD}${CYAN}  Project Status Dashboard${NC}"
echo -e "${BOLD}${CYAN}================================================${NC}"
echo -e "  ${DIM}Project: $PROJECT_ROOT${NC}"
echo -e "  ${DIM}Time:    $(date '+%Y-%m-%d %H:%M:%S')${NC}"

# ─────────────────────────────────────────────
# Git Worktrees
# ─────────────────────────────────────────────
section "Git Worktrees"

if [ -d "$PROJECT_ROOT/.git" ] || [ -f "$PROJECT_ROOT/.git" ]; then
  WORKTREE_LIST="$(git -C "$PROJECT_ROOT" worktree list 2>/dev/null || echo "")"
  if [ -n "$WORKTREE_LIST" ]; then
    WORKTREE_COUNT="$(echo "$WORKTREE_LIST" | wc -l | tr -d ' ')"
    # Subtract 1 for the main worktree
    ACTIVE_COUNT=$((WORKTREE_COUNT - 1))
    if [ "$ACTIVE_COUNT" -gt 0 ]; then
      ok "Active worktrees: $ACTIVE_COUNT (plus main)"
      echo "$WORKTREE_LIST" | while IFS= read -r line; do
        dim "  $line"
      done
    else
      dim "No additional worktrees (main only)"
    fi
  else
    dim "No worktree information available"
  fi
else
  warn "Not a git repository"
fi

# ─────────────────────────────────────────────
# TEAM_STATUS.md
# ─────────────────────────────────────────────
section "Team Status"

TEAM_STATUS_FILE="$PROJECT_ROOT/TEAM_STATUS.md"

if [ -f "$TEAM_STATUS_FILE" ]; then
  PENDING_COUNT=$(grep -c 'PENDING' "$TEAM_STATUS_FILE" 2>/dev/null || echo "0")
  COMPLETED_COUNT=$(grep -cE 'COMPLETED|DONE' "$TEAM_STATUS_FILE" 2>/dev/null || echo "0")
  BLOCKED_COUNT=$(grep -cE 'BLOCKED|FAILED' "$TEAM_STATUS_FILE" 2>/dev/null || echo "0")

  if [ "$BLOCKED_COUNT" -gt 0 ]; then
    err "Blocked/Failed: $BLOCKED_COUNT"
  fi
  if [ "$PENDING_COUNT" -gt 0 ]; then
    warn "Pending: $PENDING_COUNT"
  fi
  if [ "$COMPLETED_COUNT" -gt 0 ]; then
    ok "Completed: $COMPLETED_COUNT"
  fi
  if [ "$PENDING_COUNT" -eq 0 ] && [ "$COMPLETED_COUNT" -eq 0 ] && [ "$BLOCKED_COUNT" -eq 0 ]; then
    dim "No status items found in TEAM_STATUS.md"
  fi
else
  dim "No TEAM_STATUS.md found"
fi

# ─────────────────────────────────────────────
# PIPELINE_STATUS.md
# ─────────────────────────────────────────────
section "Pipeline Status"

PIPELINE_STATUS_FILE="$PROJECT_ROOT/PIPELINE_STATUS.md"

if [ -f "$PIPELINE_STATUS_FILE" ]; then
  # Look for the current phase marker
  CURRENT_PHASE="$(grep -iE '(current|active|phase|stage).*:' "$PIPELINE_STATUS_FILE" 2>/dev/null | head -1 || echo "")"
  if [ -n "$CURRENT_PHASE" ]; then
    ok "Current: $CURRENT_PHASE"
  fi

  # Show phases with their status
  PHASE_LINES="$(grep -E '^\s*[-*]\s+' "$PIPELINE_STATUS_FILE" 2>/dev/null | head -5 || echo "")"
  if [ -n "$PHASE_LINES" ]; then
    echo "$PHASE_LINES" | while IFS= read -r line; do
      if echo "$line" | grep -qi 'DONE\|COMPLETED\|PASS'; then
        ok "$line"
      elif echo "$line" | grep -qi 'FAILED\|BLOCKED\|ERROR'; then
        err "$line"
      elif echo "$line" | grep -qi 'RUNNING\|IN.PROGRESS\|ACTIVE'; then
        warn "$line"
      else
        dim "$line"
      fi
    done
  fi

  if [ -z "$CURRENT_PHASE" ] && [ -z "$PHASE_LINES" ]; then
    dim "No phase information found in PIPELINE_STATUS.md"
  fi
else
  dim "No PIPELINE_STATUS.md found"
fi

# ─────────────────────────────────────────────
# Recent Memory (PROGRESS.md)
# ─────────────────────────────────────────────
section "Recent Progress"

PROGRESS_FILE="$PROJECT_ROOT/memory/PROGRESS.md"

if [ -f "$PROGRESS_FILE" ]; then
  LAST_LINES="$(tail -5 "$PROGRESS_FILE" 2>/dev/null || echo "")"
  if [ -n "$LAST_LINES" ]; then
    echo "$LAST_LINES" | while IFS= read -r line; do
      if [ -n "$line" ]; then
        dim "$line"
      fi
    done
  else
    dim "PROGRESS.md is empty"
  fi
else
  dim "No memory/PROGRESS.md found"
fi

# ─────────────────────────────────────────────
# Build / Test Health
# ─────────────────────────────────────────────
section "Build & Test Health"

HEALTH_DETECTED=false

# Check package.json
if [ -f "$PROJECT_ROOT/package.json" ]; then
  HEALTH_DETECTED=true
  ok "package.json found"

  # Check for common scripts
  HAS_TEST=$(grep -c '"test"' "$PROJECT_ROOT/package.json" 2>/dev/null || echo "0")
  HAS_BUILD=$(grep -c '"build"' "$PROJECT_ROOT/package.json" 2>/dev/null || echo "0")
  HAS_LINT=$(grep -c '"lint"' "$PROJECT_ROOT/package.json" 2>/dev/null || echo "0")

  if [ "$HAS_TEST" -gt 0 ]; then
    ok "  test script: defined"
  else
    warn "  test script: not defined"
  fi
  if [ "$HAS_BUILD" -gt 0 ]; then
    ok "  build script: defined"
  else
    warn "  build script: not defined"
  fi
  if [ "$HAS_LINT" -gt 0 ]; then
    ok "  lint script: defined"
  else
    warn "  lint script: not defined"
  fi

  # Check for lock file
  if [ -f "$PROJECT_ROOT/package-lock.json" ] || [ -f "$PROJECT_ROOT/yarn.lock" ] || [ -f "$PROJECT_ROOT/pnpm-lock.yaml" ]; then
    ok "  lock file: present"
  else
    warn "  lock file: missing"
  fi

  # Check node_modules
  if [ -d "$PROJECT_ROOT/node_modules" ]; then
    ok "  node_modules: installed"
  else
    warn "  node_modules: not installed (run npm install)"
  fi
fi

# Check pyproject.toml
if [ -f "$PROJECT_ROOT/pyproject.toml" ]; then
  HEALTH_DETECTED=true
  ok "pyproject.toml found"

  if [ -d "$PROJECT_ROOT/.venv" ] || [ -d "$PROJECT_ROOT/venv" ]; then
    ok "  virtual environment: present"
  else
    warn "  virtual environment: not found"
  fi

  HAS_PYTEST=$(grep -c 'pytest' "$PROJECT_ROOT/pyproject.toml" 2>/dev/null || echo "0")
  if [ "$HAS_PYTEST" -gt 0 ]; then
    ok "  pytest: configured"
  else
    dim "  pytest: not configured"
  fi
fi

# Check Cargo.toml
if [ -f "$PROJECT_ROOT/Cargo.toml" ]; then
  HEALTH_DETECTED=true
  ok "Cargo.toml found"

  if [ -d "$PROJECT_ROOT/target" ]; then
    ok "  target/: build artifacts present"
  else
    dim "  target/: no build artifacts"
  fi
fi

# Check go.mod
if [ -f "$PROJECT_ROOT/go.mod" ]; then
  HEALTH_DETECTED=true
  ok "go.mod found"

  if [ -f "$PROJECT_ROOT/go.sum" ]; then
    ok "  go.sum: present"
  else
    warn "  go.sum: missing"
  fi
fi

if [ "$HEALTH_DETECTED" = false ]; then
  dim "No recognized build system detected (package.json, pyproject.toml, Cargo.toml, go.mod)"
fi

# ─────────────────────────────────────────────
# Auto-Fix Metrics
# ─────────────────────────────────────────────
section "Auto-Fix Metrics"

METRICS_FILE="$PROJECT_ROOT/.harness-metrics/auto-fix.jsonl"
if [ -f "$METRICS_FILE" ]; then
  TOTAL_RUNS=$(wc -l < "$METRICS_FILE" | tr -d ' ')
  SUCCESS_RUNS=$(grep -c '"success":true' "$METRICS_FILE" 2>/dev/null || echo "0")
  FAIL_RUNS=$((TOTAL_RUNS - SUCCESS_RUNS))

  ok "Total auto-fix attempts: $TOTAL_RUNS"
  ok "Successes: $SUCCESS_RUNS"
  if [ "$FAIL_RUNS" -gt 0 ]; then
    warn "Failures: $FAIL_RUNS"
  fi

  # P0 guard failures
  P0_FAILS=$(grep -c '"guard_result":1' "$METRICS_FILE" 2>/dev/null || echo "0")
  if [ "$P0_FAILS" -gt 0 ]; then
    err "P0 guard failures (hard-fail): $P0_FAILS"
  fi
else
  dim "No auto-fix metrics yet (.harness-metrics/auto-fix.jsonl)"
fi

# ─────────────────────────────────────────────
# Footer
# ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}================================================${NC}"
echo -e "${DIM}  Run with: ./scripts/status-dashboard.sh [project_root]${NC}"
echo ""
