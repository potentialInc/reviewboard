#!/usr/bin/env bash
#
# Prompt Builder
# Assembles a complete Claude prompt for a given agent + phase + PRD.
# Injects: agent instructions, relevant PRD sections, memory context.
#
# Usage:
#   ./harness/prompt-builder.sh <agent-name> <prd-path> <phase-name>
#
# Output: prompt text to stdout
#
# Examples:
#   ./harness/prompt-builder.sh database-agent prd/prd-auth.md database
#   ./harness/prompt-builder.sh feature-builder prd/prd-auth.md backend
#   ./harness/prompt-builder.sh ui-builder prd/prd-auth.md frontend

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

AGENT="${1:-}"
PRD_PATH="${2:-}"
PHASE="${3:-}"

if [ -z "$AGENT" ] || [ -z "$PRD_PATH" ] || [ -z "$PHASE" ]; then
  echo "Usage: $0 <agent-name> <prd-path> <phase-name>" >&2
  exit 1
fi

if [ ! -f "$PROJECT_ROOT/$PRD_PATH" ] && [ ! -f "$PRD_PATH" ]; then
  echo "ERROR: PRD file not found: $PRD_PATH" >&2
  exit 1
fi
# Resolve PRD path
PRD_FULL="$PRD_PATH"
[ ! -f "$PRD_FULL" ] && PRD_FULL="$PROJECT_ROOT/$PRD_PATH"

AGENT_FILE="$SCRIPT_DIR/agents/${AGENT}.md"
if [ ! -f "$AGENT_FILE" ]; then
  echo "ERROR: Agent file not found: $AGENT_FILE" >&2
  exit 1
fi

# ─── Phase → PRD Section mapping ──────────────────────────────────────────────
prd_sections_for_phase() {
  case "$1" in
    types)     echo "## 2. Terminology\n## 7. DB Schema" ;;
    database)  echo "## 7. DB Schema\n## 8. API Endpoints" ;;
    backend)   echo "## 8. API Endpoints\n## 11. Non-Functional Requirements" ;;
    frontend)  echo "## 6. User Flows\n## 9. UI Specifications" ;;
    integrate) echo "## 8. API Endpoints\n## 5. System Modules" ;;
    test)      echo "## 10. Acceptance Criteria" ;;
    qa)        echo "## 10. Acceptance Criteria\n## 11. Non-Functional Requirements" ;;
    deploy)    echo "## 11. Non-Functional Requirements\n## 1. Overview" ;;
    *)         echo "" ;;
  esac
}

# ─── Phase → Expected output ───────────────────────────────────────────────────
phase_expected_output() {
  case "$1" in
    types)     echo "src/types/ directory with index file and type exports" ;;
    database)  echo "migrations/ or db/schema files, src/repo/ or similar data access layer" ;;
    backend)   echo "src/services/ and src/routes/ (or equivalent) with API endpoints" ;;
    frontend)  echo "src/components/ and src/pages/ (or src/app/ for Next.js) with UI components" ;;
    integrate) echo "API client wiring, frontend connected to backend endpoints" ;;
    test)      echo "Unit and integration tests covering all public functions (*.test.ts or equivalent)" ;;
    qa)        echo "E2E test suite, QA report, SCREEN_STATUS.md (if design assets exist)" ;;
    deploy)    echo "Dockerfile or equivalent, CI/CD config, environment template (.env.example)" ;;
    *)         echo "Phase-specific artifacts as defined in PRD" ;;
  esac
}

# ─── Extract relevant PRD sections ────────────────────────────────────────────
extract_prd_sections() {
  local prd_file="$1"
  local section_headers="$2"
  local content=""

  if [ -z "$section_headers" ]; then
    # No specific section — return full PRD
    cat "$prd_file"
    return
  fi

  # Extract each specified section
  # Uses a robust approach: find the header line, then collect until the next ## heading
  while IFS= read -r header; do
    header="${header//\\n/}"
    [ -z "$header" ] && continue
    # Escape special regex chars in the header for awk matching
    escaped_header=$(printf '%s\n' "$header" | sed 's/[[\.*^$()+?{|]/\\&/g')
    section=$(awk "
      /^${escaped_header}/ { found=1; print; next }
      found && /^## / && !/^${escaped_header}/ { found=0 }
      found { print }
    " "$prd_file" 2>/dev/null || true)
    if [ -n "$section" ]; then
      content="${content}\n${section}"
    fi
  done <<< "$(echo -e "$section_headers" | tr '\\n' '\n')"

  if [ -z "$content" ]; then
    # Fallback: include full PRD
    cat "$prd_file"
  else
    echo -e "$content"
  fi
}

# ─── Load memory context ───────────────────────────────────────────────────────
MISTAKES=""
PATTERNS=""
DECISIONS=""

if [ -f "$SCRIPT_DIR/memory/MISTAKES.md" ]; then
  MISTAKES=$(cat "$SCRIPT_DIR/memory/MISTAKES.md")
fi
if [ -f "$SCRIPT_DIR/memory/PATTERNS.md" ]; then
  PATTERNS=$(cat "$SCRIPT_DIR/memory/PATTERNS.md")
fi
if [ -f "$SCRIPT_DIR/memory/DECISIONS.md" ]; then
  DECISIONS=$(cat "$SCRIPT_DIR/memory/DECISIONS.md")
fi

# ─── Load agent instructions ───────────────────────────────────────────────────
AGENT_INSTRUCTIONS=$(cat "$AGENT_FILE")

# ─── Extract PRD content ───────────────────────────────────────────────────────
SECTIONS=$(prd_sections_for_phase "$PHASE")
PRD_CONTENT=$(extract_prd_sections "$PRD_FULL" "$SECTIONS")
EXPECTED_OUTPUT=$(phase_expected_output "$PHASE")

# ─── Assemble prompt ───────────────────────────────────────────────────────────
cat <<PROMPT
Read CLAUDE.md first for project context and architecture rules.

═══════════════════════════════════════════════════════════
AGENT ROLE & INSTRUCTIONS
═══════════════════════════════════════════════════════════

${AGENT_INSTRUCTIONS}

═══════════════════════════════════════════════════════════
CURRENT TASK: Phase — ${PHASE}
═══════════════════════════════════════════════════════════

You are executing pipeline phase: **${PHASE}**

Expected deliverables when this phase is COMPLETE:
${EXPECTED_OUTPUT}

═══════════════════════════════════════════════════════════
PRD — SOURCE OF TRUTH (relevant sections)
═══════════════════════════════════════════════════════════

${PRD_CONTENT}

$([ -n "$MISTAKES" ] && echo "═══════════════════════════════════════════════════════════
KNOWN MISTAKES TO AVOID (from memory/MISTAKES.md)
═══════════════════════════════════════════════════════════

${MISTAKES}
")
$([ -n "$PATTERNS" ] && echo "═══════════════════════════════════════════════════════════
DISCOVERED PATTERNS (from memory/PATTERNS.md)
═══════════════════════════════════════════════════════════

${PATTERNS}
")
$([ -n "$DECISIONS" ] && echo "═══════════════════════════════════════════════════════════
ARCHITECTURE DECISIONS (from memory/DECISIONS.md)
═══════════════════════════════════════════════════════════

${DECISIONS}
")
═══════════════════════════════════════════════════════════
EXECUTION INSTRUCTIONS
═══════════════════════════════════════════════════════════

1. Implement everything required for the **${PHASE}** phase
2. Follow the architecture layer rules (top-down only: types→config→repo→service→runtime→ui)
3. Write tests for all public functions
4. Run ./architecture/enforce.sh when done — fix any violations before stopping
5. Commit all changes with a clear message: "feat(${PHASE}): <what was implemented>"
6. When complete, output exactly: PHASE_COMPLETE: ${PHASE}

If you encounter a blocker you cannot resolve:
- Document it in .claude-task with: PHASE_BLOCKED: ${PHASE} — <reason>
- Do NOT silently fail or partially complete
PROMPT
