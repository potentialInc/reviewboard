#!/usr/bin/env bash
#
# Skill Activation Prompt Hook
# Detects magic keywords and skill triggers in user prompts.
# Replaces on-prompt-context-inject.sh with unified skill + context detection.
#
# Usage: Called automatically by Claude Code on UserPromptSubmit event.
#        Reads prompt from stdin (JSON: {"prompt": "..."})

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_BUNDLE="$PROJECT_ROOT/cli/dist/harness-cli.mjs"
CLI_SRC="$PROJECT_ROOT/cli/src/index.ts"

# ── Tier 1: Built bundle (fastest, ~20ms) ──
if [ -f "$CLI_BUNDLE" ] && command -v node &>/dev/null; then
  exec node "$CLI_BUNDLE" skill detect
fi

# ── Tier 2: tsx direct execution (~80ms) ──
TSX_BIN="$PROJECT_ROOT/cli/node_modules/.bin/tsx"
if [ -f "$CLI_SRC" ] && [ -x "$TSX_BIN" ]; then
  exec "$TSX_BIN" "$CLI_SRC" skill detect
fi

# ── Tier 3: Original shell logic (always works) ──
RULES_FILE="$PROJECT_ROOT/skills/skill-rules.json"

# Read prompt from stdin or argument
if [ -t 0 ]; then
  PROMPT="${1:-}"
else
  INPUT=$(cat)
  # Try to extract prompt from JSON
  if command -v jq &>/dev/null; then
    PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || echo "$INPUT")
  else
    # Fallback: extract prompt with grep
    PROMPT=$(echo "$INPUT" | grep -o '"prompt"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"prompt"[[:space:]]*:[[:space:]]*"//;s/"$//' || echo "$INPUT")
  fi
fi

[ -z "$PROMPT" ] && exit 0
[ ! -f "$RULES_FILE" ] && exit 0

PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# ── Magic Keyword Detection ──
# Look for patterns like "fix:", "build:", "team:" at start or after whitespace
MAGIC=""
MAGIC_SKILL=""

if command -v jq &>/dev/null; then
  # Extract all magic keywords from rules
  while IFS='|' read -r keyword skill; do
    if echo "$PROMPT_LOWER" | grep -qE "(^|[[:space:]])${keyword}[[:space:]]"; then
      MAGIC="$keyword"
      MAGIC_SKILL="$skill"
      break
    fi
  done < <(jq -r '.skills | to_entries[] | select(.value.magicKeyword) | .value.magicKeyword + "|" + .key' "$RULES_FILE" 2>/dev/null)
else
  # Fail-safe: without jq, check if prompt contains ANY magic keyword.
  # If a magic keyword is detected, BLOCK execution (exit 2) because agent binding,
  # PRD injection, and enforcement are all impossible without jq.
  # This prevents silent degradation where a non-dev thinks an agent is active but it isn't.
  KNOWN_KEYWORDS="build fix test refactor review arch deploy db secure perf docs design parallel pipeline team fullstack design-qa"
  MATCHED_KEYWORD=""
  for kw in $KNOWN_KEYWORDS; do
    if echo "$PROMPT_LOWER" | grep -qE "(^|[[:space:]])${kw}:[[:space:]]"; then
      MATCHED_KEYWORD="$kw"
      break
    fi
  done

  if [ -n "$MATCHED_KEYWORD" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⛔ BLOCKED: jq is not installed. Magic keyword '${MATCHED_KEYWORD}:' cannot activate safely."
    echo ""
    echo "  Without jq, the harness CANNOT:"
    echo "    - Bind the correct agent (e.g., feature-builder, bug-fixer)"
    echo "    - Inject the active PRD (Source of Truth)"
    echo "    - Enforce agent selection rules"
    echo "    - Read safety configuration (requireConfirmation)"
    echo ""
    echo "  What to do:"
    echo "    1. Install jq:"
    echo "         macOS:  brew install jq"
    echo "         Linux:  sudo apt-get install -y jq"
    echo "    2. Then retry your prompt"
    echo ""
    echo "  Your prompt was NOT processed. No changes were made."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 2
  fi

  # No magic keyword detected — allow through (plain prompt, no agent binding expected)
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "WARNING: jq is not installed."
  echo ""
  echo "  Magic keywords (build: fix: test: etc.) will NOT activate agents."
  echo "  PRD binding and agent enforcement are DISABLED."
  echo ""
  echo "  Install now:"
  echo "    macOS:  brew install jq"
  echo "    Linux:  sudo apt-get install -y jq"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
fi

if [ -n "$MAGIC" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "MAGIC KEYWORD: $MAGIC → $MAGIC_SKILL"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Check if this keyword requires confirmation (non-dev safety)
  # If confirmation is required, BLOCK execution (exit 2) so the agent MUST get user approval first
  CONFIG_FILE="$PROJECT_ROOT/harness.config.json"
  NEEDS_BLOCKING=false
  MAGIC_BASE="${MAGIC%:}"  # strip trailing colon for matching (e.g. "deploy:" → "deploy")
  if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    REQUIRE_CONFIRM=$(jq -r '.restrictions.requireConfirmation // [] | .[]' "$CONFIG_FILE" 2>/dev/null)
    for rc_keyword in $REQUIRE_CONFIRM; do
      if [[ "$rc_keyword" == "$MAGIC_BASE" ]] || [[ "$rc_keyword" == "$MAGIC_BASE:"* ]]; then
        NEEDS_BLOCKING=true
        echo ""
        echo "⛔ CONFIRMATION REQUIRED: '$MAGIC' can cause irreversible changes."
        echo ""
        echo "This prompt is BLOCKED until the user explicitly confirms."
        echo "You MUST:"
        echo "  1. Explain to the user what will happen (which environment, what data is affected)"
        echo "  2. Ask the user to confirm (e.g., 'Should I proceed with this?')"
        echo "  3. Only after the user says yes, resubmit the prompt"
        echo ""
        echo "Examples of dangerous commands that need --confirm flag:"
        echo "  ./harness/deploy-manager.sh promote --confirm"
        echo "  ./harness/db-manager.sh reset --confirm"
        echo ""
        echo "Do NOT proceed without explicit user confirmation."
        echo ""
        break
      fi
    done
  else
    # Fail-safe: config missing or jq unavailable — default to blocking dangerous keywords
    DANGEROUS_DEFAULTS="deploy db secure"
    for dk in $DANGEROUS_DEFAULTS; do
      if [ "$MAGIC_BASE" = "$dk" ]; then
        NEEDS_BLOCKING=true
        echo ""
        echo "⛔ CONFIRMATION REQUIRED (fail-safe): '$MAGIC' blocked because harness.config.json is missing or unreadable."
        echo ""
        echo "  Without config, the harness cannot verify which keywords require confirmation."
        echo "  For safety, '$MAGIC_BASE' is blocked by default."
        echo ""
        echo "  What to do:"
        echo "    1. Generate config: ./harness/project-init.sh --detect ."
        echo "    2. Or manually create harness.config.json with requireConfirmation settings"
        echo "    3. Then retry your prompt"
        echo ""
        break
      fi
    done
  fi

  # Inject active PRD (Source of Truth) — ensures every magic keyword task reads the PRD
  PRD_RESOLVER="$PROJECT_ROOT/harness/prd-resolver.sh"
  if [ -x "$PRD_RESOLVER" ]; then
    PRD_LINE=$("$PRD_RESOLVER" --inject 2>/dev/null) || {
      echo ""
      echo "WARNING: PRD injection failed (prd-resolver.sh returned error)."
      echo "ACTION: Manually check the prd/ directory for an active PRD before proceeding."
      PRD_LINE=""
    }
    if [ -n "$PRD_LINE" ]; then
      echo ""
      echo "SOURCE OF TRUTH: Read CLAUDE.md first. $PRD_LINE"
    fi
  else
    echo ""
    echo "WARNING: prd-resolver.sh not found or not executable. PRD (Source of Truth) was NOT injected."
    echo "ACTION: Manually read the active PRD in the prd/ directory before starting work."
  fi

  # Log skill activation
  ACTIVATION_LOG="$PROJECT_ROOT/.worktree-logs/skill-activations.log"
  mkdir -p "$(dirname "$ACTIVATION_LOG")"
  SNIPPET=$(echo "$PROMPT" | head -c 80 | tr '\n' ' ')
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ')|$MAGIC_SKILL|$MAGIC|$SNIPPET" >> "$ACTIVATION_LOG"

  # Get skill details and enforcement level
  if command -v jq &>/dev/null; then
    SKILL_TYPE=$(jq -r --arg s "$MAGIC_SKILL" '.skills[$s].type // "agent"' "$RULES_FILE" 2>/dev/null)
    SKILL_FILE=$(jq -r --arg s "$MAGIC_SKILL" '.skills[$s].file // ""' "$RULES_FILE" 2>/dev/null)
    ENFORCEMENT=$(jq -r --arg s "$MAGIC_SKILL" '.skills[$s].enforcement // "suggest"' "$RULES_FILE" 2>/dev/null)

    if [ -n "$SKILL_FILE" ] && [ ! -f "$PROJECT_ROOT/$SKILL_FILE" ]; then
      echo ""
      echo "WARNING: Skill file not found: $SKILL_FILE"
      echo "  What to do:"
      echo "    1. Check that $SKILL_FILE exists in the project root"
      echo "    2. If the file was moved, update skills/skill-rules.json"
      echo "    3. Re-run your prompt after fixing"
      echo ""
    elif [ "$SKILL_TYPE" = "agent" ]; then
      echo "ACTION: Load agent instructions from $SKILL_FILE"
    elif [ "$SKILL_TYPE" = "mode" ]; then
      echo "ACTION: Follow orchestration mode in $SKILL_FILE"
    else
      echo "ACTION: Reference $SKILL_FILE"
    fi

    if [ "$ENFORCEMENT" = "require" ]; then
      echo ""
      echo "BINDING: You MUST use $MAGIC_SKILL ($SKILL_FILE). This is a hard requirement."
      echo "Do NOT choose a different agent or skip these instructions."
      echo "If the task doesn't fit this agent, tell the user and ask them to rephrase."
    fi
  fi

  # ── Memory injection for magic keyword context ──
  MAGIC_BASE="${MAGIC%:}"
  if [[ "$MAGIC_BASE" == "fix" ]] || [[ "$MAGIC_BASE" == "test" ]]; then
    MISTAKES_FILE="$PROJECT_ROOT/memory/MISTAKES.md"
    if [ -f "$MISTAKES_FILE" ] && [ -s "$MISTAKES_FILE" ]; then
      echo ""
      echo "KNOWN BUG PATTERNS (from memory/MISTAKES.md):"
      echo "---"
      tail -30 "$MISTAKES_FILE"
      echo "---"
    fi
  fi

  if [[ "$MAGIC_BASE" == "arch" ]] || [[ "$MAGIC_BASE" == "refactor" ]]; then
    DECISIONS_FILE="$PROJECT_ROOT/memory/DECISIONS.md"
    if [ -f "$DECISIONS_FILE" ] && [ -s "$DECISIONS_FILE" ]; then
      echo ""
      echo "ARCHITECTURE DECISIONS (from memory/DECISIONS.md):"
      echo "---"
      tail -40 "$DECISIONS_FILE"
      echo "---"
    fi
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # If confirmation was required, BLOCK execution (exit 2 = hook rejection)
  if [ "$NEEDS_BLOCKING" = true ]; then
    exit 2
  fi
  exit 0
fi

# ── Keyword Matching ──
MATCHED_SKILLS=""

if command -v jq &>/dev/null; then
  while IFS='|' read -r skill priority keywords; do
    MATCH_COUNT=0
    for kw in $keywords; do
      if echo "$PROMPT_LOWER" | grep -qiw "$kw"; then
        MATCH_COUNT=$((MATCH_COUNT + 1))
      fi
    done
    # Require 2+ keyword matches to reduce false positives on generic prompts
    if [ "$MATCH_COUNT" -ge 2 ]; then
      MATCHED_SKILLS="${MATCHED_SKILLS}${skill}(${priority})|"
    fi
  done < <(jq -r '.skills | to_entries[] | .key + "|" + .value.priority + "|" + (.value.promptTriggers.keywords // [] | join(" "))' "$RULES_FILE" 2>/dev/null)
fi

if [ -n "$MATCHED_SKILLS" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "SKILL SUGGESTIONS:"

  # Output deduplicated matches
  echo "$MATCHED_SKILLS" | tr '|' '\n' | sort -u | while read -r match; do
    [ -z "$match" ] && continue
    echo "  → $match"
  done

  echo ""
  echo "TIP: Use magic keywords for instant activation (e.g., fix: test: build:)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

# ── Context Injection (actual memory content, not just hints) ──
if echo "$PROMPT_LOWER" | grep -qiE "(bug|fix|error|fail|broken)"; then
  MISTAKES_FILE="$PROJECT_ROOT/memory/MISTAKES.md"
  if [ -f "$MISTAKES_FILE" ] && [ -s "$MISTAKES_FILE" ]; then
    echo ""
    echo "KNOWN BUG PATTERNS (from memory/MISTAKES.md):"
    echo "---"
    # Inject last 30 lines (covers ~5 most recent patterns)
    tail -30 "$MISTAKES_FILE"
    echo "---"
    echo "Apply these patterns to avoid repeating past mistakes."
  fi
fi

if echo "$PROMPT_LOWER" | grep -qiE "(decide|choice|approach|which|how to)"; then
  DECISIONS_FILE="$PROJECT_ROOT/memory/DECISIONS.md"
  if [ -f "$DECISIONS_FILE" ] && [ -s "$DECISIONS_FILE" ]; then
    echo ""
    echo "ARCHITECTURE DECISIONS (from memory/DECISIONS.md):"
    echo "---"
    tail -40 "$DECISIONS_FILE"
    echo "---"
    echo "Respect existing decisions. If proposing a change, document the rationale."
  fi
fi

if echo "$PROMPT_LOWER" | grep -qiE "(architect|layer|import|depend)"; then
  echo "Architecture rules apply. Read architecture/ARCHITECTURE.md for allowed import directions."
fi

# ── New agent context hints ──
if echo "$PROMPT_LOWER" | grep -qiE "(deploy|docker|kubernetes|k8s|ci.?cd|infrastructure|container|vercel|aws|gcp)"; then
  echo "[context] DevOps agent available. Use 'deploy:' magic keyword for infrastructure tasks."
fi

if echo "$PROMPT_LOWER" | grep -qiE "(database|schema|migration|query|sql|model|seed|orm|prisma|sqlalchemy)"; then
  echo "[context] Database agent available. Use 'db:' magic keyword for schema/migration tasks."
fi

if echo "$PROMPT_LOWER" | grep -qiE "(security|vulnerab|secret|auth|permission|owasp|xss|injection|csrf)"; then
  echo "[context] Security agent available. Use 'secure:' magic keyword for security audits."
fi

if echo "$PROMPT_LOWER" | grep -qiE "(performance|slow|optimize|bundle|profile|cache|latency|core.web.vitals)"; then
  echo "[context] Performance agent available. Use 'perf:' magic keyword for optimization."
fi

if echo "$PROMPT_LOWER" | grep -qiE "(document|readme|api.doc|changelog|swagger|openapi|jsdoc)"; then
  echo "[context] Documentation agent available. Use 'docs:' magic keyword for documentation."
fi
