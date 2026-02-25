#!/usr/bin/env bash
#
# Pipeline Runner — Sequential Phase Execution Engine
# Reads PRD, executes phases in order, checkpoints progress in PIPELINE_STATUS.md.
#
# Usage:
#   ./harness/pipeline-runner.sh <prd-path>               # Run all phases
#   ./harness/pipeline-runner.sh <prd-path> --phase 4     # Run single phase
#   ./harness/pipeline-runner.sh <prd-path> --phases 3-7  # Run range
#   ./harness/pipeline-runner.sh <prd-path> --resume      # Resume from last checkpoint
#
# Exit codes:
#   0 = All phases COMPLETE
#   1 = One or more phases FAILED (unrecoverable)
#   2 = Blocked by PRD gate

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Args ─────────────────────────────────────────────────────────────────────
PRD_PATH="${1:-}"
START_PHASE=1
END_PHASE=10
RESUME=false
SINGLE_PHASE=""

if [ -z "$PRD_PATH" ]; then
  echo -e "${RED}Usage: $0 <prd-path> [--phase N | --phases N-M | --resume]${NC}" >&2
  exit 1
fi

shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase)   SINGLE_PHASE="$2"; START_PHASE="$2"; END_PHASE="$2"; shift 2 ;;
    --phases)
      START_PHASE="${2%%-*}"
      END_PHASE="${2##*-}"
      shift 2 ;;
    --resume)  RESUME=true; shift ;;
    *) shift ;;
  esac
done

# Resolve PRD path (optional for phase 1-2, required for 3+)
PRD_FULL=""
if [ -n "$PRD_PATH" ]; then
  PRD_FULL="$PRD_PATH"
  [ ! -f "$PRD_FULL" ] && PRD_FULL="$PROJECT_ROOT/$PRD_PATH"
  if [ ! -f "$PRD_FULL" ] && [ "$START_PHASE" -gt 2 ]; then
    echo -e "${RED}ERROR: PRD file not found: $PRD_PATH${NC}" >&2
    exit 1
  elif [ ! -f "$PRD_FULL" ]; then
    echo -e "${YELLOW}Note: PRD path '$PRD_PATH' not found — phase 2 (prd) will resolve it via prd-resolver.sh${NC}"
    PRD_PATH=""
    PRD_FULL=""
  fi
elif [ "$START_PHASE" -gt 2 ]; then
  # No PRD given but needed — try auto-resolve
  resolved=$("$SCRIPT_DIR/prd-resolver.sh" 2>/dev/null || echo "")
  if [ -z "$resolved" ]; then
    echo -e "${RED}ERROR: No PRD specified and none found in prd/. Required for phases 3+.${NC}" >&2
    exit 1
  fi
  PRD_PATH="$resolved"
  PRD_FULL="$PROJECT_ROOT/$PRD_PATH"
  echo -e "${CYAN}Auto-resolved PRD: ${PRD_PATH}${NC}"
fi

STATUS_FILE="$PROJECT_ROOT/PIPELINE_STATUS.md"
AGENT_MANIFEST="$SCRIPT_DIR/agents/agent-manifest.json"
CONFIG_FILE="$SCRIPT_DIR/harness.config.json"
AUTO_FIX="$SCRIPT_DIR/auto-fix-loop.sh"
PROMPT_BUILDER="$SCRIPT_DIR/prompt-builder.sh"
PHASE_VALIDATOR="$SCRIPT_DIR/phase-validator.sh"
PRD_GATE="$SCRIPT_DIR/prd-gate.sh"
LOG_DIR="$PROJECT_ROOT/.worktree-logs"
mkdir -p "$LOG_DIR"

# ─── Config ───────────────────────────────────────────────────────────────────
MAX_RETRIES=3
if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
  MAX_RETRIES=$(jq -r '.restrictions.autoFixRetries // 3' "$CONFIG_FILE" 2>/dev/null)
fi

CLAUDE_TIMEOUT=1800  # 30 min per phase

# Portable timeout
_timeout() {
  if command -v timeout &>/dev/null; then timeout "$@"
  elif command -v gtimeout &>/dev/null; then gtimeout "$@"
  else "$@"; fi
}

# ─── Phase definitions ────────────────────────────────────────────────────────
# Format: "phase_name:agent:prerequisites"
PHASES=(
  "1:init:feature-builder:"
  "2:prd:feature-builder:1"
  "3:types:feature-builder:2"
  "4:database:database-agent:3"
  "5:backend:feature-builder:3,4"
  "6:frontend:feature-builder:3"
  "7:integrate:feature-builder:5,6"
  "8:test:test-writer:7"
  "9:qa:test-writer:8"
  "10:deploy:devops-agent:9"
)

phase_name()  { echo "${1}" | cut -d: -f2; }
phase_agent() { echo "${1}" | cut -d: -f3; }
phase_prereqs() { echo "${1}" | cut -d: -f4; }

# ─── Status file helpers ──────────────────────────────────────────────────────
init_status_file() {
  local project_name
  project_name=$(basename "$PROJECT_ROOT")
  local stack=""
  [ -f "$PROJECT_ROOT/package.json" ] && stack="node"
  [ -f "$PROJECT_ROOT/pyproject.toml" ] && stack="python"
  [ -f "$PROJECT_ROOT/go.mod" ] && stack="go"

  cp "$SCRIPT_DIR/templates/status/PIPELINE_STATUS.template.md" "$STATUS_FILE" 2>/dev/null || cat > "$STATUS_FILE" <<EOF
# Pipeline Status: ${project_name}

> Created: $(date '+%Y-%m-%d %H:%M')
> Mode: pipeline

## Progress

| # | Phase | Domain | Status | Prerequisites | Output | Notes |
|---|---|---|---|---|---|---|
| 1 | init | base | PENDING | — | Project scaffold | |
| 2 | prd | base | PENDING | init | Requirements doc | |
| 3 | types | base | PENDING | prd | src/types/ | |
| 4 | database | backend | PENDING | types | Schema, migrations | |
| 5 | backend | backend | PENDING | types, database | Services, APIs | |
| 6 | frontend | frontend | PENDING | types | UI components | |
| 7 | integrate | frontend | PENDING | backend, frontend | API integration | |
| 8 | test | qa | PENDING | integrate | Unit + integration tests | |
| 9 | qa | qa | PENDING | test | E2E tests, QA report | |
| 10 | deploy | base | PENDING | qa | Deployment config | |

**Status**: \`PENDING\` → \`IN_PROGRESS\` → \`COMPLETE\` | \`FAILED\` | \`SKIPPED\`

## Execution Log

| Date | Phase | Duration | Result | Notes |
|---|---|---|---|---|
| | | | | |

## Configuration

- **Project**: ${project_name}
- **Tech Stack**: ${stack:-unknown}
- **PRD**: ${PRD_PATH}
EOF
  # Replace template vars if template was copied
  sed -i.bak "s/{PROJECT_NAME}/${project_name}/g; s|{PRD_PATH}|${PRD_PATH}|g; s/{TECH_STACK}/${stack:-unknown}/g; s/{DATE}/$(date '+%Y-%m-%d')/g" "$STATUS_FILE" 2>/dev/null && rm -f "${STATUS_FILE}.bak"
}

get_phase_status() {
  local phase_num="$1"
  grep "^| ${phase_num} |" "$STATUS_FILE" 2>/dev/null | awk -F'|' '{gsub(/ /,"",$5); print $5}' | head -1
}

set_phase_status() {
  local phase_num="$1"
  local new_status="$2"
  local note="${3:-}"
  # Update status column (4th pipe-delimited field)
  sed -i.bak "s/^| ${phase_num} | \([^|]*\)| \([^|]*\)| [A-Z_]* |/| ${phase_num} | \1| \2| ${new_status} |/" "$STATUS_FILE" 2>/dev/null
  rm -f "${STATUS_FILE}.bak"
  # Append to log
  if [ -n "$note" ]; then
    echo "| $(date '+%Y-%m-%d %H:%M') | phase-${phase_num} | — | ${new_status} | ${note} |" >> "$STATUS_FILE"
  fi
}

log_phase_result() {
  local phase_num="$1"
  local phase_name_str="$2"
  local start_time="$3"
  local result="$4"
  local note="${5:-}"
  local duration=$(( $(date +%s) - start_time ))
  echo "| $(date '+%Y-%m-%d %H:%M') | ${phase_name_str} | ${duration}s | ${result} | ${note} |" >> "$STATUS_FILE"
}

# ─── Prerequisite checker ─────────────────────────────────────────────────────
check_prerequisites() {
  local prereqs="$1"
  [ -z "$prereqs" ] && return 0

  IFS=',' read -ra req_list <<< "$prereqs"
  for req_num in "${req_list[@]}"; do
    req_num="${req_num// /}"
    [ -z "$req_num" ] && continue
    local req_status
    req_status=$(get_phase_status "$req_num")
    if [ "$req_status" != "COMPLETE" ] && [ "$req_status" != "SKIPPED" ]; then
      echo -e "${YELLOW}  Prerequisite phase $req_num is $req_status — cannot start yet${NC}" >&2
      return 1
    fi
  done
  return 0
}

# ─── Agent selection for phase 6 (design detection) ──────────────────────────
select_frontend_agent() {
  local design_agent="feature-builder"
  if [ -x "$SCRIPT_DIR/design-detector.sh" ]; then
    local detected
    detected=$("$SCRIPT_DIR/design-detector.sh" --agent-only 2>/dev/null || echo "feature-builder")
    design_agent="$detected"
  else
    # Manual detection fallback (portable find, no brace expansion)
    if find "$PROJECT_ROOT/design/screens" \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) 2>/dev/null | head -1 | grep -q .; then
      design_agent="ui-builder"
    elif find "$PROJECT_ROOT/design/mockups" -name "*.html" 2>/dev/null | head -1 | grep -q .; then
      design_agent="ui-builder"
    fi
  fi
  echo "$design_agent"
}

# ─── Phase executor ───────────────────────────────────────────────────────────
run_phase() {
  local phase_entry="$1"
  local phase_num
  phase_num=$(echo "$phase_entry" | cut -d: -f1)
  local pname
  pname=$(phase_name "$phase_entry")
  local agent
  agent=$(phase_agent "$phase_entry")
  local prereqs
  prereqs=$(phase_prereqs "$phase_entry")

  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${CYAN}  Phase ${phase_num}: ${pname} (agent: ${agent})${NC}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # Check current status
  local current_status
  current_status=$(get_phase_status "$phase_num")

  if [ "$current_status" = "COMPLETE" ] || [ "$current_status" = "SKIPPED" ]; then
    echo -e "${GREEN}  ✓ Phase ${phase_num} already ${current_status} — skipping${NC}"
    return 0
  fi

  # Check prerequisites
  if ! check_prerequisites "$prereqs"; then
    echo -e "${RED}  ✗ Prerequisites not met for phase ${phase_num}${NC}"
    return 1
  fi

  # Override agent for frontend (design detection)
  if [ "$pname" = "frontend" ]; then
    agent=$(select_frontend_agent)
    echo -e "${CYAN}  → Frontend agent selected: ${agent}${NC}"
  fi

  # Mark IN_PROGRESS
  set_phase_status "$phase_num" "IN_PROGRESS"

  local start_time
  start_time=$(date +%s)
  local phase_log="$LOG_DIR/phase-${phase_num}-${pname}-$(date '+%Y%m%d-%H%M%S').log"

  # ── Phase-specific shortcuts (skip claude for deterministic setup phases) ──
  if [ "$pname" = "init" ]; then
    echo -e "${CYAN}  → Running project-init.sh --detect...${NC}"
    local init_exit=0
    "$SCRIPT_DIR/project-init.sh" --detect "$PROJECT_ROOT" 2>&1 | tee "$phase_log" || init_exit=$?
    if [ "$init_exit" -ne 0 ]; then
      echo -e "${RED}  ✗ project-init.sh failed${NC}"
      set_phase_status "$phase_num" "FAILED"
      log_phase_result "$phase_num" "$pname" "$start_time" "FAILED" "project-init.sh failed"
      return 1
    fi
    echo -e "${GREEN}  ✓ Phase ${phase_num} (${pname}) COMPLETE${NC}"
    set_phase_status "$phase_num" "COMPLETE"
    log_phase_result "$phase_num" "$pname" "$start_time" "COMPLETE" ""
    return 0
  fi

  if [ "$pname" = "prd" ]; then
    echo -e "${CYAN}  → Validating active PRD via prd-resolver + prd-gate...${NC}"
    local resolved_prd
    resolved_prd=$("$SCRIPT_DIR/prd-resolver.sh" 2>/dev/null || echo "")
    if [ -z "$resolved_prd" ]; then
      echo -e "${RED}  ✗ No active PRD found. Create prd/prd-<name>.md with status: active${NC}"
      set_phase_status "$phase_num" "FAILED"
      log_phase_result "$phase_num" "$pname" "$start_time" "FAILED" "no active PRD"
      return 1
    fi
    local gate_exit=0
    "$PRD_GATE" "$SCRIPT_DIR/$resolved_prd" --mode all || gate_exit=$?
    if [ "$gate_exit" -eq 1 ]; then
      echo -e "${RED}  ✗ PRD Gate BLOCKED. Fix PRD issues before pipeline can proceed.${NC}"
      set_phase_status "$phase_num" "FAILED"
      log_phase_result "$phase_num" "$pname" "$start_time" "FAILED" "PRD gate blocking"
      return 1
    fi
    # If we got here, update PRD_PATH for all subsequent phases
    PRD_PATH="$resolved_prd"
    echo -e "${GREEN}  ✓ Phase ${phase_num} (${pname}) COMPLETE — using PRD: ${PRD_PATH}${NC}"
    set_phase_status "$phase_num" "COMPLETE"
    log_phase_result "$phase_num" "$pname" "$start_time" "COMPLETE" "PRD: $PRD_PATH"
    return 0
  fi

  # Build prompt
  echo -e "${CYAN}  → Building prompt for ${agent}...${NC}"
  local prompt
  prompt=$("$PROMPT_BUILDER" "$agent" "$PRD_PATH" "$pname" 2>/dev/null)

  # Execute claude
  echo -e "${CYAN}  → Executing phase ${phase_num} (${pname}) with ${agent}...${NC}"
  echo -e "${CYAN}  → Log: ${phase_log}${NC}"

  local claude_exit=0
  local claude_output=""

  claude_output=$(_timeout "$CLAUDE_TIMEOUT" claude -p "$prompt" 2>&1 | tee "$phase_log") || claude_exit=$?

  if [ "$claude_exit" -eq 124 ]; then
    echo -e "${RED}  ✗ Phase ${phase_num} timed out after ${CLAUDE_TIMEOUT}s${NC}"
    set_phase_status "$phase_num" "FAILED"
    log_phase_result "$phase_num" "$pname" "$start_time" "FAILED" "timed out"
    return 1
  fi

  # Check for explicit PHASE_BLOCKED signal
  if echo "$claude_output" | grep -q "PHASE_BLOCKED:"; then
    local block_reason
    block_reason=$(echo "$claude_output" | grep "PHASE_BLOCKED:" | head -1)
    echo -e "${RED}  ✗ Phase ${phase_num} blocked: ${block_reason}${NC}"
    set_phase_status "$phase_num" "FAILED"
    log_phase_result "$phase_num" "$pname" "$start_time" "FAILED" "blocked: $block_reason"
    return 1
  fi

  # Validate phase output
  echo -e "${CYAN}  → Validating phase ${phase_num} output...${NC}"
  local validation_exit=0
  if [ -x "$PHASE_VALIDATOR" ]; then
    "$PHASE_VALIDATOR" "$pname" "$PROJECT_ROOT" 2>&1 || validation_exit=$?
  fi

  if [ "$validation_exit" -ne 0 ]; then
    echo -e "${YELLOW}  ⚠ Phase ${phase_num} validation failed — attempting auto-fix...${NC}"
    local fix_exit=0
    if [ -x "$AUTO_FIX" ]; then
      "$AUTO_FIX" "./architecture/enforce.sh" "$MAX_RETRIES" 2>&1 || fix_exit=$?
    fi

    if [ "$fix_exit" -ne 0 ]; then
      echo -e "${RED}  ✗ Phase ${phase_num} FAILED — validation could not be fixed${NC}"
      set_phase_status "$phase_num" "FAILED"
      log_phase_result "$phase_num" "$pname" "$start_time" "FAILED" "validation failed after $MAX_RETRIES auto-fix attempts"
      return 1
    fi
  fi

  # Success
  echo -e "${GREEN}  ✓ Phase ${phase_num} (${pname}) COMPLETE${NC}"
  set_phase_status "$phase_num" "COMPLETE"
  log_phase_result "$phase_num" "$pname" "$start_time" "COMPLETE" ""
  return 0
}

# ─── Main ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║         Pipeline Runner                  ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo -e "  PRD: ${PRD_PATH}"
echo -e "  Phases: ${START_PHASE}–${END_PHASE}"
echo ""

# PRD Gate (only for full runs, not single-phase)
if [ -z "$SINGLE_PHASE" ] && [ -x "$PRD_GATE" ]; then
  echo -e "${CYAN}→ Running PRD Gate validation...${NC}"
  gate_exit=0
  "$PRD_GATE" "$PRD_FULL" --mode all || gate_exit=$?
  if [ "$gate_exit" -eq 1 ]; then
    echo -e "${RED}Pipeline BLOCKED by PRD Gate. Fix issues and retry.${NC}"
    exit 2
  elif [ "$gate_exit" -eq 2 ]; then
    echo -e "${YELLOW}PRD Gate warnings detected. Review above before proceeding.${NC}"
  fi
fi

# Init status file if not exists
if [ ! -f "$STATUS_FILE" ]; then
  echo -e "${CYAN}→ Initializing PIPELINE_STATUS.md...${NC}"
  init_status_file
fi

# Execute phases
FAILED_PHASES=()
COMPLETE_PHASES=()

for phase_entry in "${PHASES[@]}"; do
  phase_num=$(echo "$phase_entry" | cut -d: -f1)

  # Skip if outside requested range
  if [ "$phase_num" -lt "$START_PHASE" ] || [ "$phase_num" -gt "$END_PHASE" ]; then
    # Mark as SKIPPED if in skip range and currently PENDING
    current=$(get_phase_status "$phase_num")
    if [ "$current" = "PENDING" ] && [ "$phase_num" -lt "$START_PHASE" ]; then
      set_phase_status "$phase_num" "SKIPPED"
    fi
    continue
  fi

  # Check resume mode
  if [ "$RESUME" = true ]; then
    current=$(get_phase_status "$phase_num")
    if [ "$current" = "COMPLETE" ] || [ "$current" = "SKIPPED" ]; then
      echo -e "${GREEN}→ Phase ${phase_num} already ${current} (resuming, skipping)${NC}"
      COMPLETE_PHASES+=("$phase_num")
      continue
    fi
  fi

  # Run the phase
  phase_ok=true
  run_phase "$phase_entry" || phase_ok=false

  if [ "$phase_ok" = true ]; then
    COMPLETE_PHASES+=("$phase_num")
  else
    FAILED_PHASES+=("$phase_num")
    echo -e "${RED}  Pipeline stopping at failed phase ${phase_num}${NC}"
    break
  fi
done

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║         Pipeline Summary                 ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo -e "  Completed: ${#COMPLETE_PHASES[@]} phase(s): ${COMPLETE_PHASES[*]:-none}"
echo -e "  Failed:    ${#FAILED_PHASES[@]} phase(s): ${FAILED_PHASES[*]:-none}"
echo ""

if [ "${#FAILED_PHASES[@]}" -gt 0 ]; then
  echo -e "${RED}Pipeline INCOMPLETE — ${#FAILED_PHASES[@]} phase(s) failed.${NC}"
  echo -e "Resume with: ./harness/pipeline-runner.sh ${PRD_PATH} --resume"
  exit 1
fi

echo -e "${GREEN}Pipeline COMPLETE — all phases done.${NC}"

# Run final guard tests
if [ -x "$SCRIPT_DIR/tests/run-tests.sh" ]; then
  echo -e "${CYAN}→ Running final guard tests...${NC}"
  "$SCRIPT_DIR/tests/run-tests.sh" guards 2>&1 || {
    echo -e "${YELLOW}⚠ Guard tests reported issues. Review before deploying.${NC}"
  }
fi

exit 0
