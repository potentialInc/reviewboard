#!/usr/bin/env bash
#
# Harness Test Runner
# Runs smoke tests, guard tests, or all tests with graded failure policy.
#
# Usage: ./tests/run-tests.sh [smoke|guards|all]
#        Default: all
#
# Failure Grades:
#   P0 (protected paths guard): hard-fail — stops auto-fix immediately
#   P1 (layer violation guard): warn — logged, does not stop
#   P2 (smoke tests): warn — escalate to hard-fail after 3 consecutive failures
#
# Exit codes:
#   0 = all passed
#   1 = P0 failure (hard-fail)
#   2 = P1/P2 warnings only (soft-fail)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUITE="${1:-all}"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0
P0_FAIL=0
P1_FAIL=0
P2_FAIL=0

run_test() {
  local test_file="$1"
  local grade="$2"
  local name
  name=$(basename "$test_file" .sh)

  printf "  %-40s" "$name"

  if [ ! -x "$test_file" ]; then
    echo -e "${YELLOW}SKIP${NC} (not executable)"
    SKIP=$((SKIP + 1))
    return
  fi

  local output
  output=$("$test_file" 2>&1) && exit_code=$? || exit_code=$?

  if [ "$exit_code" -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    case "$grade" in
      P0)
        echo -e "${RED}FAIL [P0 hard-fail]${NC}"
        P0_FAIL=$((P0_FAIL + 1))
        ;;
      P1)
        echo -e "${YELLOW}FAIL [P1 warn]${NC}"
        P1_FAIL=$((P1_FAIL + 1))
        ;;
      P2)
        echo -e "${YELLOW}FAIL [P2 warn]${NC}"
        P2_FAIL=$((P2_FAIL + 1))
        ;;
    esac
    # Show last few lines of output on failure
    echo "$output" | tail -3 | sed 's/^/    /'
  fi
}

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Harness Test Runner                    ║${NC}"
echo -e "${CYAN}║   Suite: $SUITE                              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"

# Run smoke tests
if [ "$SUITE" = "smoke" ] || [ "$SUITE" = "all" ]; then
  echo -e "\n${CYAN}=== Smoke Tests (P2) ===${NC}"
  for test_file in "$SCRIPT_DIR"/smoke/test-*.sh; do
    [ ! -f "$test_file" ] && continue
    run_test "$test_file" "P2"
  done
fi

# Run guard tests
if [ "$SUITE" = "guards" ] || [ "$SUITE" = "all" ]; then
  echo -e "\n${CYAN}=== Guard Tests ===${NC}"

  # P0 guards (protected paths — core security)
  if [ -f "$SCRIPT_DIR/guards/test-protected-paths.sh" ]; then
    run_test "$SCRIPT_DIR/guards/test-protected-paths.sh" "P0"
  fi

  # P0 guards (path traversal & symlink prevention)
  if [ -f "$SCRIPT_DIR/guards/test-path-traversal.sh" ]; then
    run_test "$SCRIPT_DIR/guards/test-path-traversal.sh" "P0"
  fi

  # P0 guards (guard exit code handling)
  if [ -f "$SCRIPT_DIR/guards/test-guard-exit-codes.sh" ]; then
    run_test "$SCRIPT_DIR/guards/test-guard-exit-codes.sh" "P0"
  fi

  # P0 guards (rules.json fallback protection)
  if [ -f "$SCRIPT_DIR/guards/test-rules-json-fallback.sh" ]; then
    run_test "$SCRIPT_DIR/guards/test-rules-json-fallback.sh" "P0"
  fi

  # P0 guards (orchestrator guard integration)
  if [ -f "$SCRIPT_DIR/guards/test-orchestrator-guard-integration.sh" ]; then
    run_test "$SCRIPT_DIR/guards/test-orchestrator-guard-integration.sh" "P0"
  fi

  # P0 guards (auto-fix guard failure handling)
  if [ -f "$SCRIPT_DIR/guards/test-auto-fix-guard-failure.sh" ]; then
    run_test "$SCRIPT_DIR/guards/test-auto-fix-guard-failure.sh" "P0"
  fi

  # P0 guards (bash-guard shell fallback — fail-closed without Node.js)
  if [ -f "$SCRIPT_DIR/guards/test-bash-guard-shell-fallback.sh" ]; then
    run_test "$SCRIPT_DIR/guards/test-bash-guard-shell-fallback.sh" "P0"
  fi

  # P1 guards (layer violations)
  if [ -f "$SCRIPT_DIR/guards/test-layer-violation.sh" ]; then
    run_test "$SCRIPT_DIR/guards/test-layer-violation.sh" "P1"
  fi

  # P1 guards (PRD resolver)
  if [ -f "$SCRIPT_DIR/guards/test-prd-resolver.sh" ]; then
    run_test "$SCRIPT_DIR/guards/test-prd-resolver.sh" "P1"
  fi
fi

# Summary
echo -e "\n${CYAN}=== Summary ===${NC}"
TOTAL=$((PASS + FAIL + SKIP))
echo -e "  Total:  $TOTAL"
echo -e "  ${GREEN}Passed: $PASS${NC}"
[ "$FAIL" -gt 0 ] && echo -e "  ${RED}Failed: $FAIL${NC}" || echo -e "  Failed: 0"
[ "$SKIP" -gt 0 ] && echo -e "  ${YELLOW}Skipped: $SKIP${NC}"

if [ "$P0_FAIL" -gt 0 ]; then
  echo -e "\n  ${RED}CRITICAL: $P0_FAIL core protection test(s) failed${NC}"
  echo -e "  ${RED}What this means: Changes touched protected system files (hooks, architecture, harness).${NC}"
  echo -e "  ${RED}What to do:${NC}"
  echo -e "  ${RED}  1. See what changed:    git diff HEAD~1 --stat${NC}"
  echo -e "  ${RED}  2. Save work aside:     git stash${NC}"
  echo -e "  ${RED}  3. Or undo last commit: git reset --soft HEAD~1${NC}"
  echo -e "  ${RED}  4. Re-run tests:        ./tests/run-tests.sh guards${NC}"
  echo -e "  ${RED}  If unsure, ask your developer to review.${NC}"
fi
if [ "$P1_FAIL" -gt 0 ]; then
  echo -e "  ${YELLOW}WARNING: $P1_FAIL architecture test(s) failed${NC}"
  echo -e "  ${YELLOW}What this means: Code imports violate the layer dependency rules.${NC}"
  echo -e "  ${YELLOW}What to do: Check architecture/ARCHITECTURE.md for allowed import directions.${NC}"
fi
if [ "$P2_FAIL" -gt 0 ]; then
  echo -e "  ${YELLOW}INFO: $P2_FAIL environment test(s) failed${NC}"
  echo -e "  ${YELLOW}What this means: Basic harness health checks didn't pass.${NC}"
  echo -e "  ${YELLOW}What to do: Run ./tests/run-tests.sh smoke to see details.${NC}"
fi

# Minimum test count guard — catch silent bypass
if [ "$TOTAL" -eq 0 ] || { [ "$PASS" -eq 0 ] && [ "$FAIL" -eq 0 ]; }; then
  echo -e "\n  ${RED}ERROR: No tests were executed (total=$TOTAL, pass=$PASS).${NC}"
  echo -e "  ${RED}What this means: The test suite found nothing to run. This is likely a setup issue.${NC}"
  echo -e "  ${RED}What to do: Check that test files in tests/ are executable (chmod +x).${NC}"
  exit 1
fi

# Minimum expected test count — detect accidental test deletion
MIN_EXPECTED_GUARDS=9
MIN_EXPECTED_SMOKE=13
if [ "$SUITE" = "guards" ] || [ "$SUITE" = "all" ]; then
  GUARD_COUNT=$(find "$SCRIPT_DIR/guards" -name "test-*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$GUARD_COUNT" -lt "$MIN_EXPECTED_GUARDS" ]; then
    echo -e "\n  ${YELLOW}WARNING: Only $GUARD_COUNT guard test(s) found (expected at least $MIN_EXPECTED_GUARDS).${NC}"
    echo -e "  ${YELLOW}What this means: Guard tests may have been accidentally deleted. Protection level is degraded.${NC}"
    echo -e "  ${YELLOW}What to do: Check tests/guards/ for missing test files. Compare with git history.${NC}"
    # Test deletion is a security risk — treat as P0 (disables protections silently)
    P0_FAIL=$((P0_FAIL + 1))
  fi
fi
if [ "$SUITE" = "smoke" ] || [ "$SUITE" = "all" ]; then
  SMOKE_COUNT=$(find "$SCRIPT_DIR/smoke" -name "test-*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$SMOKE_COUNT" -lt "$MIN_EXPECTED_SMOKE" ]; then
    echo -e "\n  ${YELLOW}WARNING: Only $SMOKE_COUNT smoke test(s) found (expected at least $MIN_EXPECTED_SMOKE).${NC}"
    echo -e "  ${YELLOW}What this means: Smoke tests may have been accidentally deleted.${NC}"
    echo -e "  ${YELLOW}What to do: Check tests/smoke/ for missing test files. Compare with git history.${NC}"
    # Missing smoke tests degrade monitoring
    FAIL=$((FAIL + 1))
  fi
fi

# Exit code based on grade
if [ "$P0_FAIL" -gt 0 ]; then
  exit 1  # Hard-fail
elif [ "$FAIL" -gt 0 ]; then
  exit 2  # Soft-fail (warnings only)
else
  exit 0  # All passed
fi
