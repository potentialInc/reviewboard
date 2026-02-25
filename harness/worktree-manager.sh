#!/usr/bin/env bash
#
# Git Worktree Manager for Parallel Claude Sessions
# Enables Codex-style parallel development by creating isolated worktrees,
# each with its own branch and Claude session.
#
# Usage:
#   ./harness/worktree-manager.sh create <name> "<task description>"
#   ./harness/worktree-manager.sh list
#   ./harness/worktree-manager.sh status <name>
#   ./harness/worktree-manager.sh cleanup <name>
#   ./harness/worktree-manager.sh cleanup-all

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKTREE_BASE="$(dirname "$PROJECT_ROOT")/.claude-worktrees"
LOG_DIR="$PROJECT_ROOT/.worktree-logs"
LOCK_STALE_SECONDS=300  # 5 min — locks older than this are considered stale

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running in interactive terminal
is_interactive() {
  [ -t 0 ]
}

# ─────────────────────────────────────────────
# Atomic Locking (mkdir-based, portable macOS + Linux)
# ─────────────────────────────────────────────
_HELD_LOCK=""

_lock_path() {
  echo "$WORKTREE_BASE/.lock-${1}"
}

# Get file modification time in seconds since epoch (portable)
_file_mtime() {
  stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0
}

acquire_lock() {
  local name="$1"
  local lock_dir
  lock_dir=$(_lock_path "$name")

  mkdir -p "$WORKTREE_BASE"

  # Attempt 1: try atomic mkdir
  if mkdir "$lock_dir" 2>/dev/null; then
    echo $$ > "$lock_dir/pid"
    _HELD_LOCK="$name"
    return 0
  fi

  # mkdir failed — check if existing lock is stale
  if [ -d "$lock_dir" ] && [ -f "$lock_dir/pid" ]; then
    local lock_time now lock_age
    lock_time=$(_file_mtime "$lock_dir/pid")
    now=$(date +%s)
    lock_age=$(( now - lock_time ))

    if [ "$lock_age" -gt "$LOCK_STALE_SECONDS" ]; then
      echo -e "${YELLOW}Removing stale lock for '$name' (age: ${lock_age}s)${NC}" >&2
      rm -rf "$lock_dir"
      # Attempt 2: retry after stale removal (another process may win)
      if mkdir "$lock_dir" 2>/dev/null; then
        echo $$ > "$lock_dir/pid"
        _HELD_LOCK="$name"
        return 0
      fi
    fi
  fi

  echo -e "${RED}Error: Another process is creating/cleaning worktree '$name'. Aborting.${NC}"
  return 1
}

release_lock() {
  local name="${1:-$_HELD_LOCK}"
  [ -z "$name" ] && return
  local lock_dir
  lock_dir=$(_lock_path "$name")
  rm -rf "$lock_dir" 2>/dev/null
  _HELD_LOCK=""
}

# Cleanup on exit — release any held lock
cleanup_worktree_mgr() {
  release_lock
}
trap cleanup_worktree_mgr EXIT INT TERM

usage() {
  echo -e "${CYAN}Git Worktree Manager for Parallel Claude Sessions${NC}"
  echo ""
  echo "Commands:"
  echo "  create <name> \"<task>\"   Create new worktree + branch for a task"
  echo "  list                      List all active worktrees"
  echo "  status <name>             Show status of a specific worktree"
  echo "  cleanup <name>            Remove a worktree and optionally delete branch"
  echo "  cleanup-all               Remove all worktrees"
  echo ""
  echo "Examples:"
  echo "  $0 create auth \"Implement user authentication module\""
  echo "  $0 create payment \"Add Stripe payment integration\""
  echo "  $0 list"
  echo "  $0 cleanup auth"
}

# ─────────────────────────────────────────────
# CREATE: New worktree for parallel Claude work
# ─────────────────────────────────────────────
cmd_create() {
  local name="${1:-}"
  local task="${2:-}"

  if [ -z "$name" ] || [ -z "$task" ]; then
    echo -e "${RED}Error: Both name and task are required${NC}"
    echo "Usage: $0 create <name> \"<task description>\""
    exit 1
  fi

  # Validate name: alphanumeric, hyphens, underscores only (no path traversal)
  if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo -e "${RED}Error: Name must contain only letters, numbers, hyphens, and underscores.${NC}"
    echo "Invalid name: '$name'"
    exit 1
  fi

  local branch="agent/$name"
  local worktree_path="$WORKTREE_BASE/$name"

  # Acquire atomic lock — prevents TOCTOU race when parallel agents
  # try to create the same worktree simultaneously
  if ! acquire_lock "$name"; then
    exit 1
  fi

  # Check if worktree already exists (now safe under lock)
  if [ -d "$worktree_path" ]; then
    release_lock "$name"
    echo -e "${RED}Error: Worktree '$name' already exists at $worktree_path${NC}"
    echo "Use '$0 status $name' to check its status or '$0 cleanup $name' to remove it."
    exit 1
  fi

  echo -e "${CYAN}Creating parallel workspace: $name${NC}"
  echo -e "  Branch: $branch"
  echo -e "  Path:   $worktree_path"
  echo -e "  Task:   $task"

  # Create the worktree directory
  mkdir -p "$WORKTREE_BASE"
  mkdir -p "$LOG_DIR"

  # Create branch and worktree
  cd "$PROJECT_ROOT"
  git worktree add -b "$branch" "$worktree_path" 2>/dev/null || {
    # Branch might already exist
    git worktree add "$worktree_path" "$branch" 2>/dev/null || {
      echo -e "${RED}Failed to create worktree. Check if branch '$branch' exists.${NC}"
      exit 1
    }
  }

  # Write task file so Claude knows what to do
  cat > "$worktree_path/.claude-task" << EOF
# Task: $name
# Created: $(date '+%Y-%m-%d %H:%M')
# Branch: $branch

## Objective
$task

## Instructions
1. Read CLAUDE.md for project context
2. Implement the task described above
3. Follow architecture rules in architecture/ARCHITECTURE.md
4. Write tests for all public functions
5. Run ./architecture/enforce.sh before finishing
6. Commit your changes with a descriptive message
EOF

  release_lock "$name"

  echo -e "${GREEN}Worktree created successfully!${NC}"
  echo ""
  echo -e "To start a Claude session in this worktree:"
  echo -e "  ${CYAN}cd $worktree_path && claude${NC}"
  echo ""
  echo -e "Or run headless:"
  echo -e "  ${CYAN}cd $worktree_path && claude --print \"Read .claude-task and complete the task\"${NC}"
}

# ─────────────────────────────────────────────
# LIST: Show all active worktrees
# ─────────────────────────────────────────────
cmd_list() {
  echo -e "${CYAN}Active Worktrees${NC}"
  echo "─────────────────────────────────────────"

  cd "$PROJECT_ROOT"
  local worktrees
  worktrees=$(git worktree list --porcelain 2>/dev/null)

  if [ -z "$worktrees" ]; then
    echo "No worktrees found."
    return
  fi

  while IFS= read -r line; do
    local path branch
    path=$(echo "$line" | awk '{print $1}')
    branch=$(echo "$line" | grep -o '\[.*\]' | tr -d '[]')

    # Check if it's one of our managed worktrees
    if [[ "$path" == "$WORKTREE_BASE"* ]]; then
      local name
      name=$(basename "$path")
      local task_file="$path/.claude-task"
      local task=""
      if [ -f "$task_file" ]; then
        task=$(grep "^## Objective" -A1 "$task_file" | tail -1)
      fi

      # Check for uncommitted changes
      local status="clean"
      if [ -n "$(cd "$path" && git status --porcelain 2>/dev/null)" ]; then
        status="modified"
      fi

      echo -e "${GREEN}[$name]${NC} ($branch) — $status"
      [ -n "$task" ] && echo -e "  Task: $task"
      echo -e "  Path: $path"
      echo ""
    fi
  done < <(git worktree list)
}

# ─────────────────────────────────────────────
# STATUS: Show details for one worktree
# ─────────────────────────────────────────────
cmd_status() {
  local name="${1:-}"
  if [ -z "$name" ]; then
    echo -e "${RED}Error: name required${NC}"
    exit 1
  fi

  local worktree_path="$WORKTREE_BASE/$name"
  if [ ! -d "$worktree_path" ]; then
    echo -e "${RED}Worktree '$name' not found.${NC}"
    exit 1
  fi

  echo -e "${CYAN}Worktree: $name${NC}"
  echo "─────────────────────────────────────────"

  # Show task
  if [ -f "$worktree_path/.claude-task" ]; then
    echo -e "\n${YELLOW}Task:${NC}"
    cat "$worktree_path/.claude-task"
  fi

  # Show git status
  echo -e "\n${YELLOW}Git Status:${NC}"
  (cd "$worktree_path" && git status --short)

  # Show recent commits
  echo -e "\n${YELLOW}Recent Commits:${NC}"
  (cd "$worktree_path" && git log --oneline -5 2>/dev/null || echo "No commits yet")

  # Show diff stats
  echo -e "\n${YELLOW}Changes:${NC}"
  (cd "$worktree_path" && git diff --stat 2>/dev/null || echo "No changes")
}

# ─────────────────────────────────────────────
# CLEANUP: Remove a worktree
# ─────────────────────────────────────────────
cmd_cleanup() {
  local name="${1:-}"
  if [ -z "$name" ]; then
    echo -e "${RED}Error: name required${NC}"
    exit 1
  fi

  local worktree_path="$WORKTREE_BASE/$name"
  local branch="agent/$name"

  if [ ! -d "$worktree_path" ]; then
    echo -e "${YELLOW}Worktree '$name' not found at $worktree_path${NC}"
    # Still try to prune
    cd "$PROJECT_ROOT"
    git worktree prune 2>/dev/null
    return
  fi

  # Acquire lock — prevents race between concurrent cleanup or create+cleanup
  if ! acquire_lock "$name"; then
    exit 1
  fi

  echo -e "${CYAN}Cleaning up worktree: $name${NC}"

  # Check for uncommitted changes
  if [ -n "$(cd "$worktree_path" && git status --porcelain 2>/dev/null)" ]; then
    echo -e "${YELLOW}WARNING: Worktree has uncommitted changes!${NC}"
    if is_interactive; then
      echo "Changes will be lost. Continue? (y/N)"
      read -r confirm
      if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Aborted."
        exit 0
      fi
    else
      echo -e "${RED}Non-interactive mode: refusing to delete worktree with uncommitted changes.${NC}"
      echo "Use 'git stash' first or run interactively."
      exit 1
    fi
  fi

  cd "$PROJECT_ROOT"
  git worktree remove "$worktree_path" --force 2>/dev/null || {
    rm -rf "$worktree_path"
    git worktree prune
  }

  release_lock "$name"

  echo -e "${GREEN}Worktree '$name' removed.${NC}"
  if is_interactive; then
    echo -e "Branch '$branch' still exists. Delete it? (y/N)"
    read -r confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
      git branch -D "$branch" 2>/dev/null && echo -e "${GREEN}Branch deleted.${NC}" || echo -e "${YELLOW}Could not delete branch.${NC}"
    fi
  else
    echo -e "${YELLOW}Non-interactive mode: branch '$branch' preserved. Delete manually with: git branch -D $branch${NC}"
  fi
}

# ─────────────────────────────────────────────
# CLEANUP-ALL: Remove all worktrees
# ─────────────────────────────────────────────
cmd_cleanup_all() {
  echo -e "${CYAN}Removing all managed worktrees...${NC}"

  if [ ! -d "$WORKTREE_BASE" ]; then
    echo "No worktrees found."
    return
  fi

  for dir in "$WORKTREE_BASE"/*/; do
    [ ! -d "$dir" ] && continue
    local name
    name=$(basename "$dir")
    cmd_cleanup "$name"
  done

  echo -e "${GREEN}All worktrees cleaned up.${NC}"
}

# ─────────────────────────────────────────────
# Main dispatch
# ─────────────────────────────────────────────
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  create)     cmd_create "$@" ;;
  list|ls)    cmd_list ;;
  status)     cmd_status "$@" ;;
  cleanup)    cmd_cleanup "$@" ;;
  cleanup-all) cmd_cleanup_all ;;
  help|--help|-h) usage ;;
  *)
    echo -e "${RED}Unknown command: $COMMAND${NC}"
    usage
    exit 1
    ;;
esac
