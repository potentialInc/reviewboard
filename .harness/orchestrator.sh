#!/usr/bin/env bash
#
# Parallel Agent Orchestrator
# Codex-style parallel execution: splits tasks into separate worktrees,
# runs Claude in each one concurrently, and collects results.
#
# Usage:
#   ./harness/orchestrator.sh tasks.json          # Run all tasks in parallel
#   ./harness/orchestrator.sh tasks.json --dry-run # Preview without executing
#   ./harness/orchestrator.sh tasks.json --serial  # Run one at a time
#
# tasks.json format:
# {
#   "tasks": [
#     { "name": "auth", "prompt": "Implement user authentication", "branch_from": "main" },
#     { "name": "payment", "prompt": "Add Stripe payment integration" }
#   ]
# }

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKTREE_MGR="$SCRIPT_DIR/worktree-manager.sh"
LOG_DIR="$PROJECT_ROOT/.worktree-logs"
RESULTS_FILE="$LOG_DIR/orchestrator-$(date '+%Y%m%d-%H%M%S').md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Timeouts (seconds)
AGENT_TIMEOUT=1800    # 30 min per agent
GUARD_TIMEOUT=120     # 2 min for guard tests
WAIT_POLL_INTERVAL=5  # polling interval for wait

# Portable timeout command (macOS: gtimeout, Linux: timeout)
_timeout_cmd() {
  if command -v timeout &>/dev/null; then
    timeout "$@"
  elif command -v gtimeout &>/dev/null; then
    gtimeout "$@"
  else
    echo -e "${RED}[ERROR] timeout/gtimeout not found. Cannot enforce execution time limits.${NC}" >&2
    echo -e "${RED}  Install: brew install coreutils (macOS) or apt-get install -y coreutils (Linux)${NC}" >&2
    echo -e "${RED}  Without timeout, agents could run indefinitely. Aborting for safety.${NC}" >&2
    exit 1
  fi
}

# Wait for PID with timeout (portable, no 'wait -t')
wait_with_timeout() {
  local pid=$1
  local max_secs=$2
  local elapsed=0

  while kill -0 "$pid" 2>/dev/null; do
    if [ "$elapsed" -ge "$max_secs" ]; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 124  # timeout exit code
    fi
    sleep "$WAIT_POLL_INTERVAL"
    elapsed=$((elapsed + WAIT_POLL_INTERVAL))
  done
  wait "$pid" 2>/dev/null
  return $?
}

# Cleanup on exit/interrupt: kill orphan agent processes
_AGENT_PIDS=()
cleanup_orchestrator() {
  if [ ${#_AGENT_PIDS[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}[cleanup] Stopping orphan agent processes...${NC}" >&2
    for pid in "${_AGENT_PIDS[@]}"; do
      kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
  fi
  # Remove temp files (PRD_ERR_FILE is set by mktemp during Phase 2)
  rm -f "${PRD_ERR_FILE:-}" 2>/dev/null || true
}
trap cleanup_orchestrator EXIT INT TERM

DRY_RUN=false
SERIAL=false
AUTO_PR=false
GUARD_P0_FAIL=0

# Parse flags
TASKS_FILE="${1:-}"
shift || true
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --serial) SERIAL=true ;;
    --auto-pr) AUTO_PR=true ;;
  esac
done

if [ -z "$TASKS_FILE" ] || [ ! -f "$TASKS_FILE" ]; then
  echo -e "${RED}Error: tasks.json file required${NC}"
  echo ""
  echo "Usage: $0 tasks.json [--dry-run] [--serial] [--auto-pr]"
  echo ""
  echo "Example tasks.json:"
  cat << 'EXAMPLE'
{
  "tasks": [
    {
      "name": "auth",
      "prompt": "Implement user authentication with JWT tokens. Create types in src/types/, service logic in src/service/auth.ts, and API routes in src/runtime/routes/auth.ts"
    },
    {
      "name": "database",
      "prompt": "Set up database connection pool in src/config/database.ts and create user repository in src/repo/user-repo.ts"
    }
  ]
}
EXAMPLE
  exit 1
fi

# Check dependencies
if ! command -v jq &>/dev/null; then
  echo -e "${RED}Error: jq is required. Install with: brew install jq${NC}"
  exit 1
fi

if ! command -v claude &>/dev/null; then
  echo -e "${RED}Error: claude CLI is required. Install from: https://claude.ai/download${NC}"
  exit 1
fi

# ── Validate tasks.json schema ──
if ! jq empty "$TASKS_FILE" 2>/dev/null; then
  echo -e "${RED}Error: $TASKS_FILE is not valid JSON.${NC}"
  echo -e "  What to do: Check for trailing commas, missing quotes, or unmatched braces."
  exit 1
fi
if ! jq -e '.tasks' "$TASKS_FILE" >/dev/null 2>&1; then
  echo -e "${RED}Error: $TASKS_FILE missing required 'tasks' array.${NC}"
  echo -e "  What to do: Ensure the file has a top-level 'tasks' key with an array value."
  exit 1
fi
TASK_VALIDATION_ERRORS=0
for i in $(seq 0 $(($(jq '.tasks | length' "$TASKS_FILE") - 1))); do
  TNAME=$(jq -r ".tasks[$i].name // \"\"" "$TASKS_FILE")
  TPROMPT=$(jq -r ".tasks[$i].prompt // \"\"" "$TASKS_FILE")
  if [ -z "$TNAME" ]; then
    echo -e "${RED}Error: tasks[$i] missing 'name' field.${NC}"
    TASK_VALIDATION_ERRORS=$((TASK_VALIDATION_ERRORS + 1))
  fi
  if [ -z "$TPROMPT" ]; then
    echo -e "${RED}Error: tasks[$i] missing 'prompt' field.${NC}"
    TASK_VALIDATION_ERRORS=$((TASK_VALIDATION_ERRORS + 1))
  fi
done
if [ "$TASK_VALIDATION_ERRORS" -gt 0 ]; then
  echo -e "${RED}Fix $TASK_VALIDATION_ERRORS validation error(s) in $TASKS_FILE before running.${NC}"
  exit 1
fi

# ── Safe Mode: limit parallel agents ──
# Fail-safe: if config is missing, assume safe mode (non-dev protection)
CONFIG_FILE="$SCRIPT_DIR/harness.config.json"
if [ -f "$CONFIG_FILE" ]; then
  SAFE_MODE=$(jq -r '.safeMode // false' "$CONFIG_FILE" 2>/dev/null)
else
  echo -e "${YELLOW}[safe-mode] harness.config.json not found — defaulting to safe mode (serial, max 1 agent).${NC}"
  SAFE_MODE="true"
fi
if [ "$SAFE_MODE" = "true" ]; then
  MAX_PARALLEL=5
  if [ -f "$CONFIG_FILE" ]; then
    MAX_PARALLEL=$(jq -r '.restrictions.maxParallelAgents // 5' "$CONFIG_FILE" 2>/dev/null)
  fi
  TASK_COUNT_CHECK=$(jq '.tasks | length' "$TASKS_FILE")
  if [ "$SERIAL" = false ] && [ "$TASK_COUNT_CHECK" -gt "$MAX_PARALLEL" ]; then
    echo -e "${YELLOW}[safe-mode] Task count ($TASK_COUNT_CHECK) exceeds limit ($MAX_PARALLEL). Switching to serial mode.${NC}"
    SERIAL=true
  fi
fi

# Parse tasks
TASK_COUNT=$(jq '.tasks | length' "$TASKS_FILE")
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Parallel Agent Orchestrator            ║${NC}"
echo -e "${CYAN}║   $(printf '%-39s' "Tasks: $TASK_COUNT")║${NC}"
echo -e "${CYAN}║   $(printf '%-39s' "Mode: $([ "$SERIAL" = true ] && echo "Serial" || echo "Parallel")")║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

mkdir -p "$LOG_DIR"

# Initialize results file
cat > "$RESULTS_FILE" << EOF
# Orchestrator Run: $(date '+%Y-%m-%d %H:%M')
## Tasks: $TASK_COUNT

EOF

# ─────────────────────────────────────────────
# Phase 1: Create all worktrees
# ─────────────────────────────────────────────
echo -e "\n${CYAN}Phase 1: Creating worktrees${NC}"
WORKTREE_BASE="$(dirname "$PROJECT_ROOT")/.claude-worktrees"

for i in $(seq 0 $((TASK_COUNT - 1))); do
  NAME=$(jq -r ".tasks[$i].name" "$TASKS_FILE")
  PROMPT=$(jq -r ".tasks[$i].prompt" "$TASKS_FILE")

  echo -e "  ${GREEN}[$((i + 1))/$TASK_COUNT]${NC} Creating worktree: $NAME"

  if [ "$DRY_RUN" = true ]; then
    echo -e "    ${YELLOW}[DRY RUN]${NC} Would create worktree '$NAME' with task: $PROMPT"
  else
    WORKTREE_ERR=$("$WORKTREE_MGR" create "$NAME" "$PROMPT" 2>&1) || {
      if echo "$WORKTREE_ERR" | grep -qi "already exists"; then
        echo -e "    ${YELLOW}Worktree '$NAME' already exists, reusing.${NC}"
      else
        echo -e "    ${RED}Worktree creation failed for '$NAME':${NC}"
        echo "$WORKTREE_ERR" | sed 's/^/      /'
        mkdir -p "$LOG_DIR"
        echo "$WORKTREE_ERR" >> "$LOG_DIR/worktree-errors.log"
      fi
    }
  fi
done

# ─────────────────────────────────────────────
# Phase 2: Launch Claude agents
# ─────────────────────────────────────────────
echo -e "\n${CYAN}Phase 2: Launching Claude agents${NC}"

PIDS=()
NAMES=()
FAILED=0

for i in $(seq 0 $((TASK_COUNT - 1))); do
  NAME=$(jq -r ".tasks[$i].name" "$TASKS_FILE")
  PROMPT=$(jq -r ".tasks[$i].prompt" "$TASKS_FILE")
  WORKTREE_PATH="$WORKTREE_BASE/$NAME"
  LOG_FILE="$LOG_DIR/$NAME.log"

  # Resolve active PRD for prompt injection (hard-fail on multiple active)
  PRD_LINE=""
  if [ -x "$SCRIPT_DIR/prd-resolver.sh" ]; then
    PRD_ERR_FILE=$(mktemp "${TMPDIR:-/tmp}/prd-resolver-err.XXXXXX")
    PRD_LINE=$("$SCRIPT_DIR/prd-resolver.sh" --inject 2>"$PRD_ERR_FILE") && PRD_EXIT=0 || PRD_EXIT=$?
    if [ "$PRD_EXIT" -eq 1 ]; then
      echo -e "${RED}[P0] Multiple active PRDs detected. Set exactly one PRD to status: active.${NC}"
      echo -e "${RED}     Fix: Edit extra PRDs' YAML headers — change 'status: active' to 'status: draft'.${NC}"
      cat "$PRD_ERR_FILE" | sed 's/^/  /' >&2
      rm -f "$PRD_ERR_FILE"
      exit 1
    fi
    rm -f "$PRD_ERR_FILE"
  fi

  FULL_PROMPT="Read CLAUDE.md and .claude-task first. $PRD_LINE If fixing bugs, check memory/MISTAKES.md. Then: $PROMPT. Follow architecture rules. Write tests. Run ./architecture/enforce.sh when done. Commit all changes."

  echo -e "  ${GREEN}[$((i + 1))/$TASK_COUNT]${NC} Launching agent: $NAME"

  if [ "$DRY_RUN" = true ]; then
    echo -e "    ${YELLOW}[DRY RUN]${NC} Would run claude in $WORKTREE_PATH"
    continue
  fi

  if [ "$SERIAL" = true ]; then
    # Run one at a time
    echo -e "    Running... (this may take a while)"
    (cd "$WORKTREE_PATH" && _timeout_cmd "$AGENT_TIMEOUT" claude -p "$FULL_PROMPT" > "$LOG_FILE" 2>&1) || {
      echo -e "    ${RED}Agent '$NAME' failed. Check $LOG_FILE${NC}"
      FAILED=$((FAILED + 1))
    }
    echo -e "    ${GREEN}Done.${NC} Log: $LOG_FILE"
  else
    # Run in parallel (with timeout per agent)
    (cd "$WORKTREE_PATH" && _timeout_cmd "$AGENT_TIMEOUT" claude -p "$FULL_PROMPT" > "$LOG_FILE" 2>&1) &
    local _pid=$!
    PIDS+=("$_pid")
    _AGENT_PIDS+=("$_pid")
    NAMES+=("$NAME")
    echo -e "    PID: $_pid — Log: $LOG_FILE"
  fi
done

# ─────────────────────────────────────────────
# Phase 3: Wait for completion (parallel mode)
# ─────────────────────────────────────────────
if [ "$SERIAL" = false ] && [ "$DRY_RUN" = false ] && [ ${#PIDS[@]} -gt 0 ]; then
  echo -e "\n${CYAN}Phase 3: Waiting for agents to complete${NC}"
  echo -e "  Running ${#PIDS[@]} agents in parallel..."

  FAILED=0
  for i in "${!PIDS[@]}"; do
    PID="${PIDS[$i]}"
    NAME="${NAMES[$i]}"

    if wait_with_timeout "$PID" "$AGENT_TIMEOUT"; then
      echo -e "  ${GREEN}[DONE]${NC} $NAME (PID: $PID)"
      echo "- [x] **$NAME**: Completed successfully" >> "$RESULTS_FILE"
    else
      WAIT_EXIT=$?
      if [ "$WAIT_EXIT" -eq 124 ]; then
        echo -e "  ${RED}[TIMEOUT]${NC} $NAME (PID: $PID) — Killed after ${AGENT_TIMEOUT}s"
        echo "- [ ] **$NAME**: Timed out after ${AGENT_TIMEOUT}s" >> "$RESULTS_FILE"
      else
        echo -e "  ${RED}[FAIL]${NC} $NAME (PID: $PID) — Check $LOG_DIR/$NAME.log"
        echo "- [ ] **$NAME**: Failed — see logs" >> "$RESULTS_FILE"
      fi
      FAILED=$((FAILED + 1))
    fi
  done
fi

# ─────────────────────────────────────────────
# Phase 3b: Validate guard integrity
# ─────────────────────────────────────────────
if [ "$DRY_RUN" = false ]; then
  TESTS_RUNNER="$SCRIPT_DIR/tests/run-tests.sh"
  if [ -x "$TESTS_RUNNER" ]; then
    echo -e "\n${CYAN}Phase 3b: Running guard tests${NC}"
    GUARD_RESULT=0
    _timeout_cmd "$GUARD_TIMEOUT" "$TESTS_RUNNER" guards 2>&1 || GUARD_RESULT=$?
    if [ "$GUARD_RESULT" -eq 0 ]; then
      echo -e "${GREEN}[guard] All guard tests passed.${NC}"
      echo "- [x] **GUARD CHECK**: All passed" >> "$RESULTS_FILE"
    elif [ "$GUARD_RESULT" -eq 2 ]; then
      echo -e "${YELLOW}[guard] Warning: Minor guard issues (P1/P2). Review recommended.${NC}"
      echo "- [~] **GUARD CHECK**: Warnings present" >> "$RESULTS_FILE"
    else
      # Exit code 1 = P0 failure, 124 = timeout, 127 = not found, other = treat as P0
      echo -e "${RED}[guard] CRITICAL: Guard tests failed (exit code: $GUARD_RESULT).${NC}"
      echo -e "${RED}[guard] Review agent changes before merging. Core protections may be violated.${NC}"
      AUTO_PR=false
      GUARD_P0_FAIL=1
      echo "- [ ] **GUARD CHECK**: CRITICAL failure (exit $GUARD_RESULT) — review required" >> "$RESULTS_FILE"
    fi
  fi
fi

# ─────────────────────────────────────────────
# Phase 4: Create PRs (if --auto-pr)
# ─────────────────────────────────────────────
if [ "$AUTO_PR" = true ] && [ "$DRY_RUN" = false ]; then
  echo -e "\n${CYAN}Phase 4: Creating Pull Requests${NC}"

  for i in $(seq 0 $((TASK_COUNT - 1))); do
    NAME=$(jq -r ".tasks[$i].name" "$TASKS_FILE")
    PROMPT=$(jq -r ".tasks[$i].prompt" "$TASKS_FILE")
    BRANCH="agent/$NAME"
    WORKTREE_PATH="$WORKTREE_BASE/$NAME"

    # Check if there are commits to push
    COMMITS=$(cd "$WORKTREE_PATH" && git log --oneline "main..$BRANCH" 2>/dev/null | wc -l || echo "0")

    if [ "$COMMITS" -gt 0 ]; then
      echo -e "  Creating PR for $NAME ($COMMITS commits)..."
      (cd "$WORKTREE_PATH" && git push -u origin "$BRANCH" 2>/dev/null) || true
      if command -v gh &>/dev/null; then
        (cd "$WORKTREE_PATH" && gh pr create \
          --title "agent/$NAME: $PROMPT" \
          --body "Automated PR by Claude Agent Orchestrator.\n\nTask: $PROMPT\nBranch: $BRANCH\nCommits: $COMMITS" \
          2>/dev/null) && echo -e "  ${GREEN}PR created for $NAME${NC}" || echo -e "  ${YELLOW}Could not create PR for $NAME${NC}"
      fi
    else
      echo -e "  ${YELLOW}No commits in $NAME — skipping PR${NC}"
    fi
  done
fi

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo -e "\n${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}Orchestrator Complete${NC}"
echo -e "  Tasks:   $TASK_COUNT"
echo -e "  Results: $RESULTS_FILE"
echo -e "  Logs:    $LOG_DIR/"
echo -e ""
echo -e "Next steps:"
echo -e "  1. Review logs: ${CYAN}cat $LOG_DIR/<task>.log${NC}"
echo -e "  2. Check worktrees: ${CYAN}$WORKTREE_MGR list${NC}"
echo -e "  3. Review changes: ${CYAN}$WORKTREE_MGR status <name>${NC}"
echo -e "  4. Clean up: ${CYAN}$WORKTREE_MGR cleanup-all${NC}"

# Exit with failure if any agents failed or guards failed
if [ "$GUARD_P0_FAIL" -gt 0 ]; then
  echo -e "\n${RED}Guard P0 failure detected. Exiting with error.${NC}"
  exit 1
fi
if [ "$FAILED" -gt 0 ]; then
  echo -e "\n${RED}$FAILED agent(s) failed. Review logs above.${NC}"
  exit 1
fi
