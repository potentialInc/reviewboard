#!/usr/bin/env bash
#
# Common utilities for claude-harness shell scripts.
# Source this file instead of duplicating colors, logging, and timeout detection.
#
# Usage: source "$(dirname "$0")/lib/common.sh"
#    or: source "$PROJECT_ROOT/harness/lib/common.sh"

# ─────────────────────────────────────────────
# Colors (safe for non-interactive use)
# ─────────────────────────────────────────────
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export CYAN='\033[0;36m'
export YELLOW='\033[1;33m'
export NC='\033[0m'

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# ─────────────────────────────────────────────
# Timeout command (macOS + Linux portable)
# ─────────────────────────────────────────────
# Sets TIMEOUT_CMD to the available timeout binary, or empty string if none.
# macOS: `brew install coreutils` provides `gtimeout`.
TIMEOUT_CMD=""
if command -v timeout &>/dev/null; then
  TIMEOUT_CMD="timeout"
elif command -v gtimeout &>/dev/null; then
  TIMEOUT_CMD="gtimeout"
fi

# Run a command with timeout. Falls through without timeout if no binary found.
# Usage: run_with_timeout <seconds> <command> [args...]
run_with_timeout() {
  local seconds="$1"
  shift
  if [ -n "$TIMEOUT_CMD" ]; then
    "$TIMEOUT_CMD" "$seconds" "$@"
  else
    "$@"
  fi
}

# ─────────────────────────────────────────────
# Safe Mode helpers
# ─────────────────────────────────────────────
# Load safeMode from harness.config.json. Defaults to true if unavailable.
# Usage: load_safe_mode "$PROJECT_ROOT"
#        echo "Safe mode: $HARNESS_SAFE_MODE"
load_safe_mode() {
  local project_root="${1:-.}"
  local config_file="$project_root/harness.config.json"
  HARNESS_SAFE_MODE="true"

  if [ -f "$config_file" ] && command -v jq &>/dev/null; then
    HARNESS_SAFE_MODE=$(jq -r '.safeMode // true' "$config_file" 2>/dev/null || echo "true")
  fi
  export HARNESS_SAFE_MODE
}
