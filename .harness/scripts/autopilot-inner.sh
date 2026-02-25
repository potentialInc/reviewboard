#!/usr/bin/env bash
#
# Autopilot Inner Loop — Runs inside tmux session
# Extracted from autopilot.sh to avoid fragile 3-level shell quoting.
#
# Usage (called by autopilot.sh, not directly):
#   ./scripts/autopilot-inner.sh <prompt_file> <log_file> <max_retries> <initial_backoff> <claude_timeout> <guard_timeout>

set -euo pipefail

PROMPT_FILE="${1:?prompt_file required}"
LOG_FILE="${2:?log_file required}"
MAX_RETRIES="${3:?max_retries required}"
BACKOFF="${4:?initial_backoff required}"
CLAUDE_TIMEOUT="${5:?claude_timeout required}"
GUARD_TIMEOUT="${6:?guard_timeout required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RETRY=0

# Read prompt and clean up temp file
PROMPT=$(cat "$PROMPT_FILE")
rm -f "$PROMPT_FILE"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" >> "$LOG_FILE"
  echo -e "$msg"
}

# Resolve active PRD and prepend to prompt (hard-fail on multiple active)
PRD_RESOLVER="$PROJECT_ROOT/harness/prd-resolver.sh"
if [ -x "$PRD_RESOLVER" ]; then
  PRD_ERR_FILE=$(mktemp "${TMPDIR:-/tmp}/prd-resolver-autopilot-err.XXXXXX")
  PRD_LINE=$("$PRD_RESOLVER" --inject 2>"$PRD_ERR_FILE") && PRD_EXIT=0 || PRD_EXIT=$?
  if [ "$PRD_EXIT" -eq 1 ]; then
    log '[P0] Multiple active PRDs detected. Cannot start autopilot.'
    cat "$PRD_ERR_FILE" >> "$LOG_FILE"
    rm -f "$PRD_ERR_FILE"
    exit 1
  fi
  rm -f "$PRD_ERR_FILE"
  if [ -n "$PRD_LINE" ]; then
    PROMPT="Read CLAUDE.md first. $PRD_LINE $PROMPT"
  fi
fi

# Detect timeout command
_TIMEOUT_CMD='timeout'
command -v timeout &>/dev/null || _TIMEOUT_CMD='gtimeout'
if ! command -v "$_TIMEOUT_CMD" &>/dev/null; then
  log '[ERROR] timeout/gtimeout not found. Cannot enforce execution time limits.'
  log '  What to do:'
  log '    macOS:  brew install coreutils  (provides gtimeout)'
  log '    Linux:  sudo apt-get install -y coreutils  (provides timeout)'
  log '  After installing, restart autopilot: ./scripts/autopilot.sh "<your-prompt>"'
  log '[ERROR] Autopilot stopped. Run: ./scripts/autopilot.sh --status to see this error.'
  exit 1
fi

while [ $RETRY -lt $MAX_RETRIES ]; do
  RETRY=$((RETRY + 1))
  log "=== Attempt $RETRY/$MAX_RETRIES ==="

  # Run Claude (with timeout to prevent indefinite hang)
  OUTPUT_FILE=$(mktemp "${TMPDIR:-/tmp}/claude-autopilot-output.XXXXXX")
  EXIT_CODE=0
  $_TIMEOUT_CMD "$CLAUDE_TIMEOUT" claude -p "$PROMPT" > "$OUTPUT_FILE" 2>&1 || EXIT_CODE=$?

  if [ "$EXIT_CODE" -eq 124 ]; then
    log "Claude timed out after ${CLAUDE_TIMEOUT}s. Retrying..."
  fi

  OUTPUT=$(cat "$OUTPUT_FILE" 2>/dev/null || echo '')

  # Check for TEAM_COMPLETE
  if echo "$OUTPUT" | grep -q 'TEAM_COMPLETE'; then
    log 'TEAM_COMPLETE detected. All tasks finished.'
    break
  fi

  # Check for manual stop
  if echo "$OUTPUT" | grep -qiE '(shutdown|manual.stop|user.stopped)'; then
    log 'Manual stop detected.'
    break
  fi

  # Check TEAM_STATUS.md for no remaining PENDING items
  STATUS_FILES=$(find "$PROJECT_ROOT" -name 'TEAM_STATUS.md' 2>/dev/null)
  if [ -n "$STATUS_FILES" ]; then
    PENDING=$(grep -c 'PENDING' $STATUS_FILES 2>/dev/null || echo '0')
    if [ "$PENDING" -eq 0 ]; then
      log 'No PENDING items in TEAM_STATUS.md. Done.'
      break
    fi
  fi

  # Check for rate limit
  if echo "$OUTPUT" | grep -qiE '(rate.limit|429|too many requests|quota.exceeded|throttl)'; then
    log "Rate limit detected. Waiting ${BACKOFF}s (attempt $RETRY)..."
    sleep $BACKOFF
    # Exponential backoff, max 300s
    BACKOFF=$((BACKOFF * 2))
    [ $BACKOFF -gt 300 ] && BACKOFF=300
    # Update prompt to resume
    PROMPT='Read TEAM_STATUS.md and CYCLE_LOG.md. Resume the team loop from where we left off. Continue until all items are resolved.'
    continue
  fi

  # Success or unexpected exit — reset backoff
  if [ $EXIT_CODE -eq 0 ]; then
    log 'Claude exited cleanly. Checking if more work needed...'
    BACKOFF=60
    PROMPT='Read TEAM_STATUS.md and CYCLE_LOG.md. Resume the team loop from where we left off. Continue until all items are resolved.'
    sleep 5
  else
    log "Claude exited with code $EXIT_CODE. Retrying in 30s..."
    sleep 30
    BACKOFF=60
    PROMPT='Read TEAM_STATUS.md and CYCLE_LOG.md. Resume the team loop from where we left off. Continue until all items are resolved.'
  fi

  rm -f "$OUTPUT_FILE" 2>/dev/null || true
done

if [ $RETRY -ge $MAX_RETRIES ]; then
  log "Max retries ($MAX_RETRIES) exhausted. Stopping autopilot."
fi

# Run guard tests before declaring completion
GUARD_RUNNER="$PROJECT_ROOT/tests/run-tests.sh"
if [ -x "$GUARD_RUNNER" ]; then
  log 'Running guard tests before exit...'
  GUARD_EXIT=0
  # Guard test with timeout
  _G_TIMEOUT_CMD='timeout'
  command -v timeout &>/dev/null || _G_TIMEOUT_CMD='gtimeout'
  if ! command -v "$_G_TIMEOUT_CMD" &>/dev/null; then _G_TIMEOUT_CMD=''; fi
  if [ -n "$_G_TIMEOUT_CMD" ]; then
    $_G_TIMEOUT_CMD "$GUARD_TIMEOUT" "$GUARD_RUNNER" guards 2>&1 | tee -a "$LOG_FILE" || GUARD_EXIT=$?
  else
    log '[WARN] timeout/gtimeout not found — running guard tests without timeout.'
    "$GUARD_RUNNER" guards 2>&1 | tee -a "$LOG_FILE" || GUARD_EXIT=$?
  fi
  if [ "$GUARD_EXIT" -ne 0 ]; then
    mkdir -p "$PROJECT_ROOT/.harness-metrics"
    echo "GUARD_FAILED|$(date -u '+%Y-%m-%dT%H:%M:%SZ')|exit_code=$GUARD_EXIT" > "$PROJECT_ROOT/.harness-metrics/last-guard-failure"
    if [ "$GUARD_EXIT" -eq 2 ]; then
      # P1/P2 soft-fail: warn but allow completion
      log 'WARNING: Guard tests had minor issues (P1/P2). Review changes before merging.'
    else
      # Exit 1, 124 (timeout), 127 (not found), or any unknown = P0 hard-fail
      log '[P0] CRITICAL: Guard tests FAILED (exit code: '$GUARD_EXIT'). DO NOT merge/push.'
      log '[P0] What to do: Review agent changes, undo protected-path modifications, then re-run guards.'
      exit 1
    fi
  else
    log 'Guard tests passed.'
  fi
fi

# Cleanup temp files
rm -f "$PRD_ERR_FILE" 2>/dev/null || true
log 'Autopilot session ended.'
