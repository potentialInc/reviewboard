#!/usr/bin/env bash
#
# Build Check Hook
# Runs on session stop. Auto-detects project type and runs build/test commands.
# If errors are found, suggests using auto-fix-loop.
#
# Usage: Called automatically by Claude Code on Stop event.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Skip if no source directory
[ ! -d "$PROJECT_ROOT/src" ] && exit 0

ERRORS=0
COMMANDS_RUN=0

# ── Auto-detect and run build/test ──

# Node.js (package.json)
if [ -f "$PROJECT_ROOT/package.json" ]; then
  # TypeScript check
  if [ -f "$PROJECT_ROOT/tsconfig.json" ]; then
    echo -e "${CYAN}[build-check] Running TypeScript check...${NC}"
    TSC_OUTPUT=$(cd "$PROJECT_ROOT" && npx tsc --noEmit 2>&1 || true)
    TSC_ERRORS=$(echo "$TSC_OUTPUT" | grep -cE "error TS[0-9]+:" 2>/dev/null || echo "0")
    COMMANDS_RUN=$((COMMANDS_RUN + 1))

    if [ "$TSC_ERRORS" -gt 0 ]; then
      echo -e "${RED}[build-check] TypeScript: $TSC_ERRORS error(s)${NC}"
      echo "$TSC_OUTPUT" | grep "error TS" | head -5
      ERRORS=$((ERRORS + TSC_ERRORS))
    else
      echo -e "${GREEN}[build-check] TypeScript: clean${NC}"
    fi
  fi

  # Test check (only if test script exists)
  if grep -q '"test"' "$PROJECT_ROOT/package.json" 2>/dev/null; then
    echo -e "${CYAN}[build-check] Running tests...${NC}"
    TEST_OUTPUT=$(cd "$PROJECT_ROOT" && npm test 2>&1 || true)
    if echo "$TEST_OUTPUT" | grep -qiE "(fail|error|FAIL)"; then
      FAIL_COUNT=$(echo "$TEST_OUTPUT" | grep -cE "(FAIL|✗|✕|×)" 2>/dev/null || echo "?")
      echo -e "${RED}[build-check] Tests: $FAIL_COUNT failure(s)${NC}"
      ERRORS=$((ERRORS + 1))
    else
      echo -e "${GREEN}[build-check] Tests: passing${NC}"
    fi
    COMMANDS_RUN=$((COMMANDS_RUN + 1))
  fi
fi

# Python (pyproject.toml or setup.py)
if [ -f "$PROJECT_ROOT/pyproject.toml" ] || [ -f "$PROJECT_ROOT/setup.py" ]; then
  if command -v pytest &>/dev/null; then
    echo -e "${CYAN}[build-check] Running pytest...${NC}"
    PYTEST_OUTPUT=$(cd "$PROJECT_ROOT" && pytest --tb=short 2>&1 || true)
    if echo "$PYTEST_OUTPUT" | grep -qE "failed"; then
      FAIL_COUNT=$(echo "$PYTEST_OUTPUT" | grep -oE "[0-9]+ failed" | head -1)
      echo -e "${RED}[build-check] pytest: $FAIL_COUNT${NC}"
      ERRORS=$((ERRORS + 1))
    else
      echo -e "${GREEN}[build-check] pytest: passing${NC}"
    fi
    COMMANDS_RUN=$((COMMANDS_RUN + 1))
  fi

  if command -v ruff &>/dev/null; then
    echo -e "${CYAN}[build-check] Running ruff...${NC}"
    RUFF_OUTPUT=$(cd "$PROJECT_ROOT" && ruff check src/ 2>&1 || true)
    RUFF_ERRORS=$(echo "$RUFF_OUTPUT" | grep -cE "^src/" 2>/dev/null || echo "0")
    COMMANDS_RUN=$((COMMANDS_RUN + 1))

    if [ "$RUFF_ERRORS" -gt 0 ]; then
      echo -e "${RED}[build-check] ruff: $RUFF_ERRORS issue(s)${NC}"
      ERRORS=$((ERRORS + RUFF_ERRORS))
    else
      echo -e "${GREEN}[build-check] ruff: clean${NC}"
    fi
  fi
fi

# Go (go.mod)
if [ -f "$PROJECT_ROOT/go.mod" ]; then
  echo -e "${CYAN}[build-check] Running go test...${NC}"
  GO_OUTPUT=$(cd "$PROJECT_ROOT" && go test ./... 2>&1 || true)
  if echo "$GO_OUTPUT" | grep -q "FAIL"; then
    echo -e "${RED}[build-check] go test: failures detected${NC}"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}[build-check] go test: passing${NC}"
  fi
  COMMANDS_RUN=$((COMMANDS_RUN + 1))
fi

# ── Harness self-test (smoke) ──
SMOKE_RUNNER="$PROJECT_ROOT/tests/run-tests.sh"
if [ -x "$SMOKE_RUNNER" ]; then
  echo -e "${CYAN}[build-check] Running harness smoke tests...${NC}"
  SMOKE_OUTPUT=$("$SMOKE_RUNNER" smoke 2>&1) || SMOKE_EXIT=$?
  SMOKE_EXIT=${SMOKE_EXIT:-0}

  if [ "$SMOKE_EXIT" -eq 0 ]; then
    echo -e "${GREEN}[build-check] Harness smoke: all pass${NC}"
  else
    echo -e "${YELLOW}[build-check] Harness smoke: issues found (exit $SMOKE_EXIT)${NC}"
    ERRORS=$((ERRORS + 1))
  fi
  COMMANDS_RUN=$((COMMANDS_RUN + 1))

  # ── Guard tests (P0/P1 — protected paths + layer violations) ──
  echo -e "${CYAN}[build-check] Running guard tests...${NC}"
  GUARD_OUTPUT=$("$SMOKE_RUNNER" guards 2>&1) || GUARD_EXIT=$?
  GUARD_EXIT=${GUARD_EXIT:-0}

  if [ "$GUARD_EXIT" -eq 0 ]; then
    echo -e "${GREEN}[build-check] Guard tests: all pass${NC}"
  elif [ "$GUARD_EXIT" -eq 1 ]; then
    echo -e "${RED}[build-check] CRITICAL: Guard tests failed (P0 — protected path violation)${NC}"
    echo -e "${RED}[build-check] What to do: Check git status, review changes to harness/hooks/architecture paths.${NC}"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${YELLOW}[build-check] Guard tests: warnings (P1/P2)${NC}"
    ERRORS=$((ERRORS + 1))
  fi
  COMMANDS_RUN=$((COMMANDS_RUN + 1))
fi

# ── Architecture check ──
echo -e "${CYAN}[build-check] Running architecture check...${NC}"
ARCH_OUTPUT=$("$PROJECT_ROOT/architecture/enforce.sh" "$PROJECT_ROOT/src" 2>&1 || true)
if echo "$ARCH_OUTPUT" | grep -q "violation"; then
  echo -e "${RED}[build-check] Architecture violations found${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}[build-check] Architecture: clean${NC}"
fi
COMMANDS_RUN=$((COMMANDS_RUN + 1))

# ── Summary ──
if [ "$COMMANDS_RUN" -eq 0 ]; then
  exit 0
fi

if [ "$ERRORS" -gt 0 ]; then
  echo -e ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}Found $ERRORS issue(s) across $COMMANDS_RUN check(s).${NC}"
  echo -e ""
  echo -e "Auto-fix: ${CYAN}./harness/auto-fix-loop.sh \"<failing-command>\" 3${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 1
fi
