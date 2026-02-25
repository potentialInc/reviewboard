#!/usr/bin/env bash
#
# Auto-Fix Loop
# Codex-style autonomous error resolution: runs a command, and if it fails,
# sends the error to Claude for fixing, then retries. Repeats up to N times.
#
# Usage:
#   ./harness/auto-fix-loop.sh "<command>" [max_retries] [--verbose]
#
# Examples:
#   ./harness/auto-fix-loop.sh "npm test" 3
#   ./harness/auto-fix-loop.sh "npm run build" 5 --verbose
#   ./harness/auto-fix-loop.sh "python -m pytest" 3
#   ./harness/auto-fix-loop.sh "./architecture/enforce.sh" 2

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/.worktree-logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Timeouts (seconds)
COMMAND_TIMEOUT=300   # 5 min per command execution
CLAUDE_TIMEOUT=600    # 10 min per Claude fix
GUARD_TIMEOUT=120     # 2 min for guard tests

# Portable timeout command
_timeout_cmd() {
  if command -v timeout &>/dev/null; then
    timeout "$@"
  elif command -v gtimeout &>/dev/null; then
    gtimeout "$@"
  else
    echo -e "${RED}[ERROR] timeout/gtimeout not found. Cannot enforce execution time limits.${NC}" >&2
    echo -e "${RED}  Install: brew install coreutils (macOS) or apt-get install -y coreutils (Linux)${NC}" >&2
    echo -e "${RED}  Without timeout, commands could run indefinitely. Aborting for safety.${NC}" >&2
    exit 1
  fi
}

# Filter secrets from text before sending to Claude
filter_secrets() {
  # Delimiter ~ avoids conflict with ERE alternation | on macOS BSD sed.
  # ~ is safe: virtually never appears in secrets/connection strings.
  sed -E \
    -e 's~(postgres|mysql|mongodb(\+srv)?)://[^:]+:[^@]+@~\1://***:***@~g' \
    -e 's~(AKIA|ASIA)[A-Z0-9]{16}~***AWS_KEY***~g' \
    -e 's~sk-[a-zA-Z0-9]{20,}~***API_KEY***~g' \
    -e 's~eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}~***JWT***~g' \
    -e 's~ghp_[a-zA-Z0-9]{36}~***GH_TOKEN***~g' \
    -e 's~xox[bpsa]-[a-zA-Z0-9-]+~***SLACK_TOKEN***~g' \
    -e 's~sk-ant-[a-zA-Z0-9_-]{20,}~***ANTHROPIC_KEY***~g' \
    -e 's~(sk_live|rk_live|pk_live)_[a-zA-Z0-9]{20,}~***STRIPE_KEY***~g' \
    -e 's~-----BEGIN[[:space:]]+(RSA|OPENSSH|EC|DSA)?[[:space:]]*PRIVATE KEY-----~***PRIVATE_KEY***~g' \
    -e 's~DefaultEndpointsProtocol=https;[^;]*AccountKey=[^;]+~***AZURE_CONN***~g' \
    -e 's~password[[:space:]]*[:=][[:space:]]*[^[:space:]]+~password=***~gi' \
    -e 's~secret[[:space:]]*[:=][[:space:]]*[^[:space:]]+~secret=***~gi'
}

# Cleanup on exit/interrupt
cleanup_autofix() {
  # Nothing critical to clean up, but ensure metrics dir state is consistent
  true
}
trap cleanup_autofix EXIT INT TERM

COMMAND="${1:-}"
MAX_RETRIES="${2:-3}"
VERBOSE=false
CONFIG_FILE="$SCRIPT_DIR/harness.config.json"
METRICS_DIR="$PROJECT_ROOT/.harness-metrics"
TESTS_RUNNER="$SCRIPT_DIR/tests/run-tests.sh"
SMOKE_FAIL_COUNT=0

# Helper: escape string for safe JSON embedding
json_escape_str() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' '
}

for arg in "$@"; do
  [ "$arg" = "--verbose" ] && VERBOSE=true
done

# ── Safe Mode: limit retries ──
# Fail-safe: if config is missing or jq unavailable, assume safe mode (non-dev protection)
if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
  SAFE_MODE=$(jq -r '.safeMode // false' "$CONFIG_FILE" 2>/dev/null)
else
  echo -e "${YELLOW}[safe-mode] Config or jq not available — defaulting to safe mode (retries=3).${NC}"
  SAFE_MODE="true"
fi
if [ "$SAFE_MODE" = "true" ]; then
  SAFE_MAX=3
  if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    SAFE_MAX=$(jq -r '.restrictions.autoFixRetries // 3' "$CONFIG_FILE" 2>/dev/null)
  fi
  if [ "$MAX_RETRIES" -gt "$SAFE_MAX" ]; then
    echo -e "${YELLOW}[safe-mode] Limiting retries from $MAX_RETRIES to $SAFE_MAX${NC}"
    MAX_RETRIES="$SAFE_MAX"
  fi
fi

if [ -z "$COMMAND" ]; then
  echo -e "${RED}Error: command required${NC}"
  echo ""
  echo "Usage: $0 \"<command>\" [max_retries] [--verbose]"
  echo ""
  echo "Examples:"
  echo "  $0 \"npm test\" 3"
  echo "  $0 \"npm run build\" 5"
  echo "  $0 \"./architecture/enforce.sh\" 2"
  exit 1
fi

if ! command -v claude &>/dev/null; then
  echo -e "${RED}Error: claude CLI required${NC}"
  exit 1
fi

mkdir -p "$LOG_DIR"
LOOP_LOG="$LOG_DIR/auto-fix-$(date '+%Y%m%d-%H%M%S').log"

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Auto-Fix Loop                          ║${NC}"
echo -e "${CYAN}║   Command: $(printf '%-29s' "$COMMAND")║${NC}"
echo -e "${CYAN}║   Max retries: $MAX_RETRIES                           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

ATTEMPT=0
while [ "$ATTEMPT" -le "$MAX_RETRIES" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo -e "\n${CYAN}─── Attempt $ATTEMPT/$((MAX_RETRIES + 1)) ───${NC}"

  # Run the command and capture output
  ERROR_OUTPUT=""
  EXIT_CODE=0

  # Security note: bash -c is used instead of eval to run the command in a
  # subshell, limiting side-effects on the current shell environment.
  # Callers should still ensure COMMAND is from a trusted source.
  # Timeout prevents indefinite hangs.
  ERROR_OUTPUT=$(_timeout_cmd "$COMMAND_TIMEOUT" bash -c "$COMMAND" 2>&1) || EXIT_CODE=$?

  if [ "$EXIT_CODE" -eq 124 ]; then
    echo -e "${RED}Command timed out after ${COMMAND_TIMEOUT}s${NC}"
  fi

  if [ "$EXIT_CODE" -eq 0 ]; then
    echo -e "${GREEN}Command succeeded on attempt $ATTEMPT!${NC}"

    if [ "$VERBOSE" = true ]; then
      echo -e "\n${CYAN}Output:${NC}"
      echo "$ERROR_OUTPUT"
    fi

    # Log success
    cat >> "$LOOP_LOG" << EOF
## Attempt $ATTEMPT: SUCCESS
Command: $COMMAND
Exit code: 0
$([ "$VERBOSE" = true ] && echo "Output: $ERROR_OUTPUT")

EOF
    # Run guard tests on success too (verify fix didn't corrupt harness)
    GUARD_RESULT=0
    if [ -x "$TESTS_RUNNER" ]; then
      echo -e "${CYAN}[guard] Running guard tests after success...${NC}"
      _timeout_cmd "$GUARD_TIMEOUT" "$TESTS_RUNNER" guards >/dev/null 2>&1 || GUARD_RESULT=$?
      if [ "$GUARD_RESULT" -ne 0 ] && [ "$GUARD_RESULT" -ne 2 ]; then
        echo -e "${RED}[guard] CRITICAL: Guard check failed after successful command.${NC}"
        echo -e "${RED}[guard] What this means: The command passed, but core system files were modified.${NC}"
        echo -e "${RED}[guard] What to do:${NC}"
        echo -e "${RED}[guard]   1. Check current state: git status${NC}"
        echo -e "${RED}[guard]   2. See what changed:    git diff HEAD~1 --stat${NC}"
        echo -e "${RED}[guard]   3. Save work aside:     git stash -u${NC}"
        echo -e "${RED}[guard]   4. Re-run tests:        ./tests/run-tests.sh guards${NC}"
        echo -e "${RED}[guard]   5. (With developer) Undo commit: git reset --soft HEAD~1${NC}"
        echo -e "${RED}[guard]   If unsure, ask your developer to review before taking action.${NC}"
        # Log metric with guard failure
        mkdir -p "$METRICS_DIR"
        echo "{\"timestamp\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"command\":\"$(json_escape_str "$COMMAND")\",\"attempt\":$ATTEMPT,\"success\":true,\"guard_result\":1}" >> "$METRICS_DIR/auto-fix.jsonl"
        exit 1
      elif [ "$GUARD_RESULT" -eq 2 ]; then
        echo -e "${YELLOW}[guard] Warning: Minor guard issues detected. Review recommended.${NC}"
      fi
    fi

    # Log success metric
    mkdir -p "$METRICS_DIR"
    echo "{\"timestamp\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"command\":\"$(json_escape_str "$COMMAND")\",\"attempt\":$ATTEMPT,\"success\":true,\"guard_result\":$GUARD_RESULT}" >> "$METRICS_DIR/auto-fix.jsonl"

    echo -e "\n${GREEN}Auto-fix loop complete. $ATTEMPT attempt(s) needed.${NC}"
    exit 0
  fi

  # Command failed
  echo -e "${RED}Command failed (exit code: $EXIT_CODE)${NC}"

  # Log failure
  cat >> "$LOOP_LOG" << EOF
## Attempt $ATTEMPT: FAILED
Command: $COMMAND
Exit code: $EXIT_CODE
Error output:
\`\`\`
$ERROR_OUTPUT
\`\`\`

EOF

  # Check if we've exhausted retries
  if [ "$ATTEMPT" -gt "$MAX_RETRIES" ]; then
    echo -e "${RED}Max retries ($MAX_RETRIES) exhausted. Manual intervention needed.${NC}"
    echo -e "Error log: $LOOP_LOG"
    echo -e "\n${YELLOW}Last error output:${NC}"
    echo "$ERROR_OUTPUT" | tail -30
    exit 1
  fi

  # Send to Claude for fixing
  echo -e "${YELLOW}Sending error to Claude for auto-fix...${NC}"

  # Truncate error output if too long (keep last 100 lines) and filter secrets
  TRUNCATED_ERROR=$(echo "$ERROR_OUTPUT" | tail -100 | filter_secrets)

  FIX_PROMPT="The following command failed:

\`\`\`
$COMMAND
\`\`\`

Error output (last 100 lines):
\`\`\`
$TRUNCATED_ERROR
\`\`\`

Fix the code to make this command pass. Read CLAUDE.md first for project context. Follow architecture rules. Only modify the minimum necessary files. Do not add unnecessary changes."

  # Run Claude to fix (with timeout to prevent indefinite hang)
  CLAUDE_OUTPUT=""
  CLAUDE_OUTPUT=$(_timeout_cmd "$CLAUDE_TIMEOUT" claude -p "$FIX_PROMPT" 2>&1) || {
    CLAUDE_EXIT=$?
    if [ "$CLAUDE_EXIT" -eq 124 ]; then
      echo -e "${RED}Claude timed out after ${CLAUDE_TIMEOUT}s.${NC}"
    else
      echo -e "${RED}Claude failed to process the fix request.${NC}"
    fi
    echo "$CLAUDE_OUTPUT" | tail -10
  }

  if [ "$VERBOSE" = true ]; then
    echo -e "\n${CYAN}Claude response:${NC}"
    echo "$CLAUDE_OUTPUT" | tail -20
  fi

  # Log Claude's response
  cat >> "$LOOP_LOG" << EOF
### Claude Fix Response (Attempt $ATTEMPT):
$(echo "$CLAUDE_OUTPUT" | tail -30)

EOF

  echo -e "${GREEN}Claude applied fixes. Retrying...${NC}"

  # ── Guard Tests: check harness integrity after fix ──
  if [ -x "$TESTS_RUNNER" ]; then
    echo -e "${CYAN}[guard] Running guard tests after fix...${NC}"
    GUARD_RESULT=0
    _timeout_cmd "$GUARD_TIMEOUT" "$TESTS_RUNNER" guards >/dev/null 2>&1 || GUARD_RESULT=$?

    # Log metrics
    mkdir -p "$METRICS_DIR"
    echo "{\"timestamp\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"command\":\"$(json_escape_str "$COMMAND")\",\"attempt\":$ATTEMPT,\"success\":false,\"guard_result\":$GUARD_RESULT}" >> "$METRICS_DIR/auto-fix.jsonl"

    if [ "$GUARD_RESULT" -ne 0 ] && [ "$GUARD_RESULT" -ne 2 ]; then
      # P0 hard-fail: exit 1, 124 (timeout), 127 (not found), or any unknown code
      echo -e "${RED}[guard] CRITICAL: Core protection test failed. Stopping auto-fix immediately.${NC}"
      echo -e "${RED}[guard] What this means: The fix modified protected system files (hooks, architecture, harness).${NC}"
      echo -e "${RED}[guard] What to do:${NC}"
      echo -e "${RED}[guard]   1. Check current state: git status${NC}"
      echo -e "${RED}[guard]   2. See what changed:    git diff HEAD~1 --stat${NC}"
      echo -e "${RED}[guard]   3. Save work aside:     git stash -u${NC}"
      echo -e "${RED}[guard]   4. Re-run tests:        ./tests/run-tests.sh guards${NC}"
      echo -e "${RED}[guard]   5. (With developer) Undo commit: git reset --soft HEAD~1${NC}"
      echo -e "${RED}[guard]   If unsure, ask your developer to review before taking action.${NC}"
      exit 1
    elif [ "$GUARD_RESULT" -eq 2 ]; then
      # P1/P2 soft-fail: log warning
      echo -e "${YELLOW}[guard] Warning: Minor guard issues detected. Continuing with caution.${NC}"
    fi
  fi

  sleep 1
done
