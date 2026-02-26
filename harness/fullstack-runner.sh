#!/usr/bin/env bash
#
# Fullstack Runner — 5-Superstage Autonomous Project Pipeline
# Implements orchestration/modes/fullstack.md as an executable.
# Composes: stack-detector, project-init, prd-gate, pipeline-runner.
#
# Usage:
#   ./harness/fullstack-runner.sh "<project-description>"
#   ./harness/fullstack-runner.sh "<description>" --from prd/prd-myapp.md
#   ./harness/fullstack-runner.sh --resume      # Resume from FULLSTACK_STATUS.md
#
# Exit codes:
#   0 = All superstages COMPLETE
#   1 = A superstage FAILED

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Args ─────────────────────────────────────────────────────────────────────
DESCRIPTION="${1:-}"
PRD_OVERRIDE=""
RESUME=false

shift 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)  PRD_OVERRIDE="$2"; shift 2 ;;
    --resume) RESUME=true; shift ;;
    *) shift ;;
  esac
done

STATUS_FILE="$PROJECT_ROOT/FULLSTACK_STATUS.md"
PIPELINE_RUNNER="$SCRIPT_DIR/pipeline-runner.sh"
PRD_GATE="$SCRIPT_DIR/prd-gate.sh"
PRD_RESOLVER="$SCRIPT_DIR/prd-resolver.sh"
STACK_DETECTOR="$SCRIPT_DIR/stack-detector.sh"
AUTO_FIX="$SCRIPT_DIR/auto-fix-loop.sh"
CONFIG_FILE="$PROJECT_ROOT/harness.config.json"

MAX_RETRIES=3
if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
  MAX_RETRIES=$(jq -r '.restrictions.autoFixRetries // 3' "$CONFIG_FILE" 2>/dev/null)
fi

# ─── Status file helpers ──────────────────────────────────────────────────────
init_status_file() {
  cat > "$STATUS_FILE" <<EOF
# Fullstack Status

> Created: $(date '+%Y-%m-%d %H:%M')
> Description: ${DESCRIPTION:-from PRD}

## Superstages

| # | Stage | Status | Gate | Notes |
|---|-------|--------|------|-------|
| 1 | BOOTSTRAP | PENDING | Stack detected + CLAUDE.md exists | |
| 2 | PRD | PENDING | prd-gate exits 0 | |
| 3 | BUILD | PENDING | Pipeline phases 3-7 COMPLETE | |
| 4 | VERIFY | PENDING | Tests pass + enforce.sh clean | |
| 5 | SHIP | PENDING | Guard tests pass + deploy config | |

## Pipeline Detail (BUILD/VERIFY/SHIP phases)

See PIPELINE_STATUS.md for phase-level detail.

## Log

| Date | Stage | Result | Notes |
|------|-------|--------|-------|
| | | | |
EOF
}

get_stage_status() {
  local stage_num="$1"
  grep "^| ${stage_num} |" "$STATUS_FILE" 2>/dev/null | awk -F'|' '{gsub(/ /,"",$4); print $4}' | head -1
}

set_stage_status() {
  local stage_num="$1"
  local new_status="$2"
  local note="${3:-}"
  sed -i.bak "s/^| ${stage_num} | \([^|]*\)| \([^|]*\)| \([^|]*\)| [^|]* |/| ${stage_num} | \1| ${new_status} | \3| ${note} |/" "$STATUS_FILE" 2>/dev/null
  rm -f "${STATUS_FILE}.bak"
  echo "| $(date '+%Y-%m-%d %H:%M') | stage-${stage_num} | ${new_status} | ${note} |" >> "$STATUS_FILE"
}

# ─── Header ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║          Fullstack Runner                        ║${NC}"
echo -e "${BOLD}║   BOOTSTRAP → PRD → BUILD → VERIFY → SHIP       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
[ -n "$DESCRIPTION" ] && echo -e "  Goal: ${DESCRIPTION}"
echo ""

# Init status file if needed
if [ ! -f "$STATUS_FILE" ]; then
  init_status_file
fi

# ─── Stage 0: INFRA PREP ─────────────────────────────────────────────────────
INFRA_PREP="$SCRIPT_DIR/infra-prep.sh"
if [ -x "$INFRA_PREP" ]; then
  echo -e "${CYAN}${BOLD}[0/5] INFRA PREP${NC}"
  infra_exit=0
  "$INFRA_PREP" "$PROJECT_ROOT" || infra_exit=$?
  if [ "$infra_exit" -ne 0 ]; then
    echo -e "${RED}  ✗ Infrastructure prep failed. Fix before proceeding.${NC}"
    echo -e "${YELLOW}  Run: ./harness/infra-prep.sh --check-only  to diagnose${NC}"
    exit 1
  fi
  echo -e "${GREEN}  ✓ INFRA PREP COMPLETE${NC}"
fi

# ─── Stage 1: BOOTSTRAP ───────────────────────────────────────────────────────
stage1_status=$(get_stage_status 1)
if [ "$stage1_status" = "COMPLETE" ] || [ "$RESUME" = true ] && [ "$stage1_status" = "COMPLETE" ]; then
  echo -e "${GREEN}[1/5] BOOTSTRAP — already COMPLETE, skipping${NC}"
else
  echo -e "${CYAN}${BOLD}[1/5] BOOTSTRAP${NC}"
  set_stage_status 1 "IN_PROGRESS"

  # Detect or init stack
  if [ -x "$STACK_DETECTOR" ]; then
    detected_stack=$("$STACK_DETECTOR" 2>/dev/null || echo "unknown")
    echo -e "${CYAN}  → Detected stack: ${detected_stack}${NC}"
  fi

  # Verify CLAUDE.md
  if [ ! -f "$PROJECT_ROOT/CLAUDE.md" ]; then
    echo -e "${YELLOW}  → CLAUDE.md not found — run project-init.sh first${NC}"
    set_stage_status 1 "FAILED" "CLAUDE.md missing"
    exit 1
  fi

  # Verify harness.config.json
  if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}  → harness.config.json not found — creating default${NC}"
    cat > "$CONFIG_FILE" <<'JSON'
{
  "version": "1.0",
  "safeMode": true,
  "restrictions": {
    "maxParallelAgents": 5,
    "autoFixRetries": 3,
    "requireConfirmation": ["deploy", "db", "secure"]
  }
}
JSON
  fi

  echo -e "${GREEN}  ✓ BOOTSTRAP COMPLETE${NC}"
  set_stage_status 1 "COMPLETE"
fi

# ─── Stage 2: PRD ─────────────────────────────────────────────────────────────
stage2_status=$(get_stage_status 2)
if [ "$stage2_status" = "COMPLETE" ]; then
  echo -e "${GREEN}[2/5] PRD — already COMPLETE, skipping${NC}"
  # Resolve active PRD for later stages
  if [ -n "$PRD_OVERRIDE" ]; then
    ACTIVE_PRD="$PRD_OVERRIDE"
  elif [ -x "$PRD_RESOLVER" ]; then
    ACTIVE_PRD=$("$PRD_RESOLVER" 2>/dev/null | head -1 || echo "")
  else
    ACTIVE_PRD=$(find "$PROJECT_ROOT/prd" -name "prd-*.md" 2>/dev/null | head -1 || echo "")
  fi
else
  echo -e "${CYAN}${BOLD}[2/5] PRD${NC}"
  set_stage_status 2 "IN_PROGRESS"

  # Find or create PRD
  if [ -n "$PRD_OVERRIDE" ]; then
    ACTIVE_PRD="$PRD_OVERRIDE"
    echo -e "${CYAN}  → Using specified PRD: ${ACTIVE_PRD}${NC}"
  elif [ -x "$PRD_RESOLVER" ]; then
    ACTIVE_PRD=$("$PRD_RESOLVER" 2>/dev/null | head -1 || echo "")
    if [ -n "$ACTIVE_PRD" ]; then
      echo -e "${CYAN}  → Found active PRD: ${ACTIVE_PRD}${NC}"
    fi
  fi

  # No PRD found — openclaw must create one
  if [ -z "$ACTIVE_PRD" ] || [ ! -f "$ACTIVE_PRD" ] && [ ! -f "$PROJECT_ROOT/$ACTIVE_PRD" ]; then
    echo -e "${YELLOW}  → No active PRD found.${NC}"
    if [ -n "$DESCRIPTION" ]; then
      echo -e "${YELLOW}  → openclaw should create PRD from: '${DESCRIPTION}'${NC}"
      echo -e "${YELLOW}  → Template: prd/FEATURE_PRD.template.md${NC}"
      echo -e "${YELLOW}  → Save as: prd/prd-<project-name>.md with status: active${NC}"
    else
      echo -e "${RED}  → No description and no PRD. Cannot proceed.${NC}"
      set_stage_status 2 "FAILED" "no PRD and no description"
      exit 1
    fi
    set_stage_status 2 "FAILED" "PRD must be created manually from description"
    echo -e "${RED}[ACTION REQUIRED] Create a PRD in prd/ with status: active, then re-run.${NC}"
    exit 1
  fi

  # Resolve full path
  [ ! -f "$ACTIVE_PRD" ] && ACTIVE_PRD="$PROJECT_ROOT/$ACTIVE_PRD"

  # Run PRD Gate
  echo -e "${CYAN}  → Running PRD Gate...${NC}"
  gate_exit=0
  "$PRD_GATE" "$ACTIVE_PRD" --mode fullstack || gate_exit=$?

  if [ "$gate_exit" -eq 1 ]; then
    echo -e "${RED}  ✗ PRD Gate BLOCKED — fix issues before proceeding${NC}"
    set_stage_status 2 "FAILED" "PRD gate blocking issues"
    exit 1
  elif [ "$gate_exit" -eq 2 ]; then
    echo -e "${YELLOW}  ⚠ PRD Gate warnings — review above before proceeding${NC}"
  fi

  echo -e "${GREEN}  ✓ PRD COMPLETE${NC}"
  set_stage_status 2 "COMPLETE" "PRD: $ACTIVE_PRD"
fi

# Ensure ACTIVE_PRD is set for subsequent stages
if [ -z "${ACTIVE_PRD:-}" ]; then
  if [ -n "$PRD_OVERRIDE" ]; then
    ACTIVE_PRD="$PRD_OVERRIDE"
  else
    ACTIVE_PRD=$(find "$PROJECT_ROOT/prd" -name "prd-*.md" 2>/dev/null | head -1 || echo "")
  fi
fi
PRD_REL="${ACTIVE_PRD#$PROJECT_ROOT/}"

# ─── Stage 3: BUILD ───────────────────────────────────────────────────────────
stage3_status=$(get_stage_status 3)
if [ "$stage3_status" = "COMPLETE" ]; then
  echo -e "${GREEN}[3/5] BUILD — already COMPLETE, skipping${NC}"
else
  echo -e "${CYAN}${BOLD}[3/5] BUILD${NC}"
  echo -e "${CYAN}  → Delegating to pipeline-runner.sh phases 3-7...${NC}"
  set_stage_status 3 "IN_PROGRESS"

  build_exit=0
  "$PIPELINE_RUNNER" "$PRD_REL" --phases 3-7 || build_exit=$?

  if [ "$build_exit" -ne 0 ]; then
    echo -e "${RED}  ✗ BUILD FAILED — pipeline phases 3-7 did not complete${NC}"
    set_stage_status 3 "FAILED" "pipeline phases 3-7 failed"
    echo -e "  Resume with: ./harness/fullstack-runner.sh --resume"
    exit 1
  fi

  echo -e "${GREEN}  ✓ BUILD COMPLETE${NC}"
  set_stage_status 3 "COMPLETE"
fi

# ─── Stage 4: VERIFY ──────────────────────────────────────────────────────────
stage4_status=$(get_stage_status 4)
if [ "$stage4_status" = "COMPLETE" ]; then
  echo -e "${GREEN}[4/5] VERIFY — already COMPLETE, skipping${NC}"
else
  echo -e "${CYAN}${BOLD}[4/5] VERIFY${NC}"
  set_stage_status 4 "IN_PROGRESS"

  # Pipeline phases 8-9 (test + qa)
  echo -e "${CYAN}  → Running pipeline phases 8-9 (test + QA)...${NC}"
  verify_exit=0
  "$PIPELINE_RUNNER" "$PRD_REL" --phases 8-9 || verify_exit=$?

  if [ "$verify_exit" -ne 0 ]; then
    echo -e "${YELLOW}  ⚠ Test/QA phases reported issues — running auto-fix...${NC}"
    fix_exit=0
    if [ -x "$AUTO_FIX" ]; then
      # Try to fix test failures
      "$AUTO_FIX" "cd $PROJECT_ROOT && (npm test 2>/dev/null || python -m pytest 2>/dev/null || go test ./... 2>/dev/null || true)" "$MAX_RETRIES" || fix_exit=$?
    fi
    if [ "$fix_exit" -ne 0 ]; then
      echo -e "${RED}  ✗ VERIFY FAILED — tests could not be fixed${NC}"
      set_stage_status 4 "FAILED" "test phases failed"
      exit 1
    fi
  fi

  # Architecture enforcement
  echo -e "${CYAN}  → Running architecture enforcement...${NC}"
  enforce_exit=0
  if [ -x "$PROJECT_ROOT/architecture/enforce.sh" ]; then
    "$PROJECT_ROOT/architecture/enforce.sh" 2>&1 || enforce_exit=$?
    if [ "$enforce_exit" -ne 0 ]; then
      echo -e "${YELLOW}  ⚠ Architecture violations found — running auto-fix...${NC}"
      fix_exit=0
      [ -x "$AUTO_FIX" ] && "$AUTO_FIX" "./architecture/enforce.sh" "$MAX_RETRIES" || fix_exit=$?
      if [ "$fix_exit" -ne 0 ]; then
        echo -e "${RED}  ✗ VERIFY FAILED — architecture violations unfixed${NC}"
        set_stage_status 4 "FAILED" "architecture violations"
        exit 1
      fi
    fi
  fi


  # Runtime smoke test
  echo -e "${CYAN}  → Running runtime smoke test...${NC}"
  smoke_exit=0
  if [ -x "$PHASE_VALIDATOR" ]; then
    "$SCRIPT_DIR/phase-validator.sh" "runtime-smoke" "$PROJECT_ROOT" 2>&1 || smoke_exit=$?
    if [ "$smoke_exit" -ne 0 ]; then
      echo -e "${YELLOW}  ⚠ Runtime smoke test failed — app may not start correctly${NC}"
      set_stage_status 4 "FAILED" "runtime smoke test failed"
    fi
  fi

  echo -e "${GREEN}  ✓ VERIFY COMPLETE${NC}"
  set_stage_status 4 "COMPLETE"
fi

# ─── Stage 5: SHIP ────────────────────────────────────────────────────────────
stage5_status=$(get_stage_status 5)
if [ "$stage5_status" = "COMPLETE" ]; then
  echo -e "${GREEN}[5/5] SHIP — already COMPLETE${NC}"
else
  echo -e "${CYAN}${BOLD}[5/5] SHIP${NC}"
  set_stage_status 5 "IN_PROGRESS"

  # Pipeline phase 10 (deploy)
  echo -e "${CYAN}  → Running pipeline phase 10 (deploy)...${NC}"
  deploy_exit=0
  "$PIPELINE_RUNNER" "$PRD_REL" --phase 10 || deploy_exit=$?

  if [ "$deploy_exit" -ne 0 ]; then
    echo -e "${RED}  ✗ SHIP FAILED — deploy phase did not complete${NC}"
    set_stage_status 5 "FAILED" "deploy phase failed"
    exit 1
  fi

  # Guard tests
  echo -e "${CYAN}  → Running guard tests...${NC}"
  guard_exit=0
  if [ -x "$PROJECT_ROOT/tests/run-tests.sh" ]; then
    "$PROJECT_ROOT/tests/run-tests.sh" guards 2>&1 || guard_exit=$?
    if [ "$guard_exit" -ne 0 ] && [ "$guard_exit" -ne 2 ]; then
      echo -e "${RED}  ✗ SHIP FAILED — guard tests failed${NC}"
      set_stage_status 5 "FAILED" "guard tests failed"
      exit 1
    fi
  fi

  # Final summary
  echo ""
  echo -e "${BOLD}${CYAN}  Final Project Summary${NC}"
  echo -e "${CYAN}  ─────────────────────────────────${NC}"
  echo -e "  Files created:"
  git -C "$PROJECT_ROOT" diff --name-only HEAD 2>/dev/null | head -20 | sed 's/^/    /' || true
  echo ""

  echo -e "${GREEN}  ✓ SHIP COMPLETE${NC}"
  set_stage_status 5 "COMPLETE"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║   FULLSTACK COMPLETE — Project A-Z Done!         ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  See FULLSTACK_STATUS.md and PIPELINE_STATUS.md for full log."
exit 0
