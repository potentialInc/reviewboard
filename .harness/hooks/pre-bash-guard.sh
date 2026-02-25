#!/usr/bin/env bash
#
# Pre-Bash Guard — Blocks dangerous Bash commands.
#
# Three-tier execution:
#   Tier 1: Node.js CLI bundle (full protection, ~20ms)
#   Tier 2: tsx direct execution (full protection, ~80ms)
#   Tier 3: Shell-only fallback (critical patterns only — network attacks + protected path writes)
#
# Called by Claude Code PreToolUse hook with matcher "Bash".
# Receives JSON on stdin: {"tool_input":{"command":"..."}}
# Exit 0 = allow, exit 2 = block.
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_BUNDLE="$PROJECT_ROOT/cli/dist/harness-cli.mjs"
CLI_SRC="$PROJECT_ROOT/cli/src/index.ts"

# Read stdin into variable (hook input is JSON)
INPUT=$(cat)

# Tier 1: Built bundle (fastest, ~20ms)
if [ -f "$CLI_BUNDLE" ] && command -v node &>/dev/null; then
  echo "$INPUT" | exec node "$CLI_BUNDLE" bash-guard
  exit $?
fi

# Tier 2: tsx direct execution (~80ms) — tsx also requires node
TSX_BIN="$PROJECT_ROOT/cli/node_modules/.bin/tsx"
if [ -f "$CLI_SRC" ] && [ -x "$TSX_BIN" ] && command -v node &>/dev/null; then
  echo "$INPUT" | exec "$TSX_BIN" "$CLI_SRC" bash-guard
  exit $?
fi

# ────────────────────────────────────────────────────────────
# Tier 3: Shell-only fallback (fail-closed on critical patterns)
#
# Covers the highest-risk attack vectors without Node.js:
#   - Dangerous network patterns (curl|bash, wget|sh)
#   - Writes to protected paths (hooks/, harness/, architecture/, .claude/, CLAUDE.md)
#
# Limitations vs. TypeScript guard:
#   - No package-install warnings (npm install, pip install)
#   - No regex-based write-target extraction (uses heuristic matching)
#   - sed-based JSON extraction may fail on commands with escaped quotes
# ────────────────────────────────────────────────────────────

echo "[bash-guard] WARNING: Running in shell-only fallback mode (degraded protection)." >&2
echo "[bash-guard] Install Node.js (v18+) for full bash-guard protection." >&2

# ── Step 1: Extract command from stdin JSON ──
COMMAND=""
if command -v jq &>/dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || COMMAND=""
else
  # Minimal JSON extraction for the known {"tool_input":{"command":"..."}} shape.
  # Extract value between "command":" and the last "}
  COMMAND=$(echo "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/p' | sed 's/[[:space:]]*}[[:space:]]*$//' | head -1)
fi

if [ -z "$COMMAND" ]; then
  echo "[bash-guard] ERROR: Shell fallback could not extract command from stdin. Blocking for safety." >&2
  exit 2
fi

# ── Step 2: Dangerous network patterns → BLOCK ──
if echo "$COMMAND" | grep -qE '\bcurl\b.*\|[[:space:]]*(bash|sh|zsh)\b'; then
  echo "[bash-guard] BLOCKED (shell fallback): curl pipe to shell detected." >&2
  echo "  Command: $(echo "$COMMAND" | head -c 120)" >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bwget\b.*\|[[:space:]]*(bash|sh|zsh)\b'; then
  echo "[bash-guard] BLOCKED (shell fallback): wget pipe to shell detected." >&2
  echo "  Command: $(echo "$COMMAND" | head -c 120)" >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bcurl\b.*\|[[:space:]]*sudo\b'; then
  echo "[bash-guard] BLOCKED (shell fallback): curl pipe to sudo detected." >&2
  echo "  Command: $(echo "$COMMAND" | head -c 120)" >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bwget\b.*\|[[:space:]]*sudo\b'; then
  echo "[bash-guard] BLOCKED (shell fallback): wget pipe to sudo detected." >&2
  echo "  Command: $(echo "$COMMAND" | head -c 120)" >&2
  exit 2
fi

# ── Step 3: Protected path write detection → BLOCK ──

# Load protected paths from file, fall back to hardcoded list
PROTECTED_PATHS_FILE="$PROJECT_ROOT/architecture/protected-paths.txt"
PROTECTED_LIST=""
if [ -f "$PROTECTED_PATHS_FILE" ]; then
  while IFS= read -r _line; do
    # Strip comments and whitespace
    _line="${_line%%#*}"
    _cleaned=$(echo "$_line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    if [ -n "$_cleaned" ]; then
      PROTECTED_LIST="$PROTECTED_LIST $_cleaned"
    fi
  done < "$PROTECTED_PATHS_FILE"
fi
if [ -z "$PROTECTED_LIST" ]; then
  PROTECTED_LIST="harness/ hooks/ architecture/ .claude/ CLAUDE.md"
fi

# Check if command has a write indicator
HAS_WRITE=false
if echo "$COMMAND" | grep -qE '>>?[[:space:]]|\btee\b|\brm\b|\bcp\b|\bmv\b|\bsed\b[[:space:]]+-i|\bchmod\b|\bchown\b'; then
  HAS_WRITE=true
fi

if [ "$HAS_WRITE" = true ]; then
  for protected in $PROTECTED_LIST; do
    # Remove trailing slash for flexible matching
    p_clean="${protected%/}"
    # Match the protected path as a word boundary in the command
    # Handles: hooks/file.sh, ./hooks/file.sh, "hooks/file.sh"
    if echo "$COMMAND" | grep -qE "(^|[[:space:]./\"'])${p_clean}(/|[[:space:]\"']|$)"; then
      echo "[bash-guard] BLOCKED (shell fallback): Write to protected path detected." >&2
      echo "  Protected path: $protected" >&2
      echo "  Command: $(echo "$COMMAND" | head -c 120)" >&2
      exit 2
    fi
  done
fi

# ── Step 4: No critical patterns matched — allow ──
exit 0
