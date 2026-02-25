#!/usr/bin/env bash
#
# Autopilot — Persistent Autonomous Execution
# Runs team mode in a tmux session with rate limit recovery.
# Inspired by OpenAI Codex's autonomous agent execution model.
#
# Usage:
#   ./scripts/autopilot.sh "<prompt>"                    # Start autopilot
#   ./scripts/autopilot.sh --attach                      # Attach to running session
#   ./scripts/autopilot.sh --stop                        # Stop gracefully
#   ./scripts/autopilot.sh --status                      # Check status
#   ./scripts/autopilot.sh --help                        # Show help
#
# Monitor:
#   tmux attach -t claude-autopilot                      # Watch live
#   tail -f ~/.claude-harness/logs/autopilot.log           # Stream logs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SESSION_NAME="claude-autopilot"
LOG_DIR="${HOME}/.claude-harness/logs"
mkdir -p "$LOG_DIR" && chmod 700 "$LOG_DIR" 2>/dev/null || true
LOG_FILE="$LOG_DIR/autopilot.log"
# Defaults (overridden by harness.config.json if safeMode is on)
MAX_RETRIES=50
INITIAL_BACKOFF=60
CLAUDE_TIMEOUT=600   # 10 min per Claude call
GUARD_TIMEOUT=120    # 2 min for guard tests

# ── Safe Mode: respect harness.config.json policy ──
# Fail-safe: if config is missing or jq unavailable, assume safe mode (non-dev protection)
_CONFIG_FILE="$(dirname "$SCRIPT_DIR")/harness.config.json"
if [ -f "$_CONFIG_FILE" ] && command -v jq &>/dev/null; then
  _SAFE_MODE=$(jq -r '.safeMode // false' "$_CONFIG_FILE" 2>/dev/null)
else
  echo "[safe-mode] Config or jq not available — defaulting to safe mode."
  _SAFE_MODE="true"
fi
if [ "$_SAFE_MODE" = "true" ]; then
  _SAFE_RETRIES=3
  if [ -f "$_CONFIG_FILE" ] && command -v jq &>/dev/null; then
    _SAFE_RETRIES=$(jq -r '.restrictions.autoFixRetries // 3' "$_CONFIG_FILE" 2>/dev/null)
  fi
  MAX_RETRIES="$_SAFE_RETRIES"
  INITIAL_BACKOFF=120
  echo "[safe-mode] Autopilot limited: max_retries=$MAX_RETRIES, backoff=${INITIAL_BACKOFF}s"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  echo -e "${CYAN}Autopilot — Persistent Autonomous Execution${NC}"
  echo ""
  echo "Usage:"
  echo "  $0 \"<prompt>\"          Start autopilot with a prompt"
  echo "  $0 --attach             Attach to running session"
  echo "  $0 --stop               Stop gracefully"
  echo "  $0 --status             Check if autopilot is running"
  echo "  $0 --help               Show this help"
  echo ""
  echo "Examples:"
  echo "  $0 \"team: build user authentication from prd\""
  echo "  $0 \"Read TEAM_STATUS.md and continue the backlog\""
  echo ""
  echo "Monitor:"
  echo "  tmux attach -t $SESSION_NAME"
  echo "  tail -f $LOG_FILE"
}

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" >> "$LOG_FILE"
  echo -e "$msg"
}

# Cleanup temp files on exit
cleanup_autopilot() {
  [ -n "${_AUTOPILOT_PROMPT_FILE:-}" ] && rm -f "$_AUTOPILOT_PROMPT_FILE" 2>/dev/null || true
}
trap cleanup_autopilot EXIT INT TERM

# ─────────────────────────────────────────────
# Check prerequisites
# ─────────────────────────────────────────────
check_prereqs() {
  if ! command -v tmux &>/dev/null; then
    echo -e "${RED}Error: tmux is required. Install with: brew install tmux${NC}"
    exit 1
  fi
  if ! command -v claude &>/dev/null; then
    echo -e "${RED}Error: claude CLI is required.${NC}"
    exit 1
  fi
}

# ─────────────────────────────────────────────
# Check if session exists
# ─────────────────────────────────────────────
session_exists() {
  tmux has-session -t "$SESSION_NAME" 2>/dev/null
}

# ─────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────
cmd_attach() {
  if session_exists; then
    tmux attach -t "$SESSION_NAME"
  else
    echo -e "${YELLOW}No autopilot session running.${NC}"
    exit 1
  fi
}

cmd_stop() {
  if session_exists; then
    echo -e "${YELLOW}Sending stop signal to autopilot...${NC}"
    tmux send-keys -t "$SESSION_NAME" C-c
    sleep 2
    tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
    echo -e "${GREEN}Autopilot stopped.${NC}"
  else
    echo -e "${YELLOW}No autopilot session running.${NC}"
  fi
}

cmd_status() {
  if session_exists; then
    echo -e "${GREEN}Autopilot is running.${NC}"
    echo "  Session: $SESSION_NAME"
    echo "  Log: $LOG_FILE"
    echo ""
    echo "Recent log:"
    tail -5 "$LOG_FILE" 2>/dev/null || echo "  No log entries yet"
  else
    echo -e "${YELLOW}Autopilot is not running.${NC}"
    if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
      echo ""
      echo "Last session log (tail):"
      tail -10 "$LOG_FILE" 2>/dev/null
      # Surface errors/critical messages for non-dev visibility
      LAST_ERROR=$(grep -iE '\[P0\]|\[ERROR\]|CRITICAL|FAILED|timed out' "$LOG_FILE" 2>/dev/null | tail -3)
      if [ -n "$LAST_ERROR" ]; then
        echo ""
        echo -e "${RED}Last error(s) before exit:${NC}"
        echo "$LAST_ERROR"
      fi
    fi
  fi
}

cmd_start() {
  local prompt="${1:-}"

  if [ -z "$prompt" ]; then
    echo -e "${RED}Error: prompt required${NC}"
    usage
    exit 1
  fi

  check_prereqs

  # Check for existing session
  if session_exists; then
    echo -e "${YELLOW}Autopilot session already running.${NC}"
    echo "  Attach: tmux attach -t $SESSION_NAME"
    echo "  Stop:   $0 --stop"
    echo ""
    echo "Attach now? (y/N)"
    read -r confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
      cmd_attach
    fi
    exit 0
  fi

  # Initialize log
  echo "" > "$LOG_FILE"
  log "Autopilot starting"
  log "Project: $PROJECT_ROOT"
  log "Prompt: $prompt"
  log "Max retries: $MAX_RETRIES"

  # Write prompt to temp file to avoid shell injection
  PROMPT_FILE=$(mktemp "${TMPDIR:-/tmp}/claude-autopilot-prompt.XXXXXX")
  _AUTOPILOT_PROMPT_FILE="$PROMPT_FILE"
  printf '%s' "$prompt" > "$PROMPT_FILE"

  # Create tmux session running the extracted inner script
  # (Avoids fragile 3-level shell quoting inside tmux bash -c "...")
  tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_ROOT" \
    "$SCRIPT_DIR/autopilot-inner.sh" "$PROMPT_FILE" "$LOG_FILE" "$MAX_RETRIES" "$INITIAL_BACKOFF" "$CLAUDE_TIMEOUT" "$GUARD_TIMEOUT"

  echo -e "${GREEN}Autopilot started in tmux session: $SESSION_NAME${NC}"
  echo ""
  echo "Commands:"
  echo "  Watch:   tmux attach -t $SESSION_NAME"
  echo "  Logs:    tail -f $LOG_FILE"
  echo "  Stop:    $0 --stop"
  echo "  Status:  $0 --status"
}

# ─────────────────────────────────────────────
# Main dispatch
# ─────────────────────────────────────────────
COMMAND="${1:---help}"

case "$COMMAND" in
  --attach)   cmd_attach ;;
  --stop)     cmd_stop ;;
  --status)   cmd_status ;;
  --help|-h)  usage ;;
  *)          cmd_start "$COMMAND" ;;
esac
