#!/usr/bin/env bash
#
# Phase Validator
# Checks that a pipeline phase produced the expected artifacts.
# Called by pipeline-runner.sh after each phase completes.
#
# Usage:
#   ./harness/phase-validator.sh <phase-name> [project-root]
#
# Exit codes:
#   0 = Validation passed
#   1 = Validation failed (expected artifacts missing)

set -euo pipefail

PHASE="${1:-}"
PROJECT_ROOT="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$PHASE" ]; then
  echo "Usage: $0 <phase-name> [project-root]" >&2
  exit 1
fi

PASS=0
FAIL=0
WARN=0

pass() { echo -e "${GREEN}  ✓ $1${NC}"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}  ✗ $1${NC}"; FAIL=$((FAIL+1)); }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; WARN=$((WARN+1)); }

# Check if directory exists and has files
dir_has_files() {
  local dir="$1"
  [ -d "$dir" ] && [ "$(ls -A "$dir" 2>/dev/null | wc -l)" -gt 0 ]
}

# Check if any file matches pattern
any_file_matches() {
  local pattern="$1"
  find "$PROJECT_ROOT" -name "$pattern" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -1 | grep -q .
}

echo ""
echo -e "  Validating phase: ${PHASE}"
echo ""

case "$PHASE" in

  # ── types ──────────────────────────────────────────────────────────────────
  types)
    # TypeScript/JS
    if any_file_matches "*.ts" || any_file_matches "*.js"; then
      if dir_has_files "$PROJECT_ROOT/src/types"; then
        pass "src/types/ directory exists with files"
      elif find "$PROJECT_ROOT" -name "types.ts" -not -path "*/node_modules/*" 2>/dev/null | head -1 | grep -q .; then
        pass "types.ts file found"
      else
        warn "No src/types/ directory found (may be in different location)"
      fi

      if find "$PROJECT_ROOT/src" -name "index.ts" 2>/dev/null | head -1 | grep -q .; then
        pass "index.ts export found"
      else
        warn "No index.ts export file found in src/"
      fi
    fi

    # Python
    if any_file_matches "*.py"; then
      if find "$PROJECT_ROOT" -name "models.py" -o -name "schemas.py" -o -name "types.py" 2>/dev/null | grep -v node_modules | head -1 | grep -q .; then
        pass "Python type/model file found"
      else
        warn "No Python type/model file found (models.py, schemas.py, types.py)"
      fi
    fi

    # Go
    if any_file_matches "*.go"; then
      if find "$PROJECT_ROOT" -name "types.go" -o -name "models.go" 2>/dev/null | head -1 | grep -q .; then
        pass "Go types file found"
      else
        warn "No Go types file found"
      fi
    fi
    ;;

  # ── database ───────────────────────────────────────────────────────────────
  database)
    # Migrations
    if dir_has_files "$PROJECT_ROOT/migrations" || dir_has_files "$PROJECT_ROOT/db/migrations" || dir_has_files "$PROJECT_ROOT/prisma"; then
      pass "Migration directory found"
    elif any_file_matches "*.sql" || any_file_matches "schema.prisma"; then
      pass "Schema/migration files found"
    else
      fail "No migrations directory or schema files found"
    fi

    # Repo/data access layer
    if dir_has_files "$PROJECT_ROOT/src/repo" || dir_has_files "$PROJECT_ROOT/src/repositories" || dir_has_files "$PROJECT_ROOT/src/db" || dir_has_files "$PROJECT_ROOT/repositories"; then
      pass "Repository/data access layer found"
    else
      warn "No repository layer found (expected src/repo/, src/repositories/, etc.)"
    fi
    ;;

  # ── backend ────────────────────────────────────────────────────────────────
  backend)
    # Services
    if dir_has_files "$PROJECT_ROOT/src/services" || dir_has_files "$PROJECT_ROOT/src/service" || dir_has_files "$PROJECT_ROOT/services"; then
      pass "Services layer found"
    else
      fail "No services directory found (expected src/services/)"
    fi

    # Routes/API
    if dir_has_files "$PROJECT_ROOT/src/routes" || dir_has_files "$PROJECT_ROOT/src/api" || dir_has_files "$PROJECT_ROOT/src/runtime" || dir_has_files "$PROJECT_ROOT/app/api"; then
      pass "API routes layer found"
    elif any_file_matches "router.ts" || any_file_matches "routes.ts" || any_file_matches "*.route.ts"; then
      pass "API route files found"
    else
      fail "No API routes found (expected src/routes/, src/api/, src/runtime/)"
    fi
    ;;

  # ── frontend ───────────────────────────────────────────────────────────────
  frontend)
    # Components
    if dir_has_files "$PROJECT_ROOT/src/components" || dir_has_files "$PROJECT_ROOT/components" || dir_has_files "$PROJECT_ROOT/src/ui"; then
      pass "UI components directory found"
    else
      fail "No components directory found (expected src/components/, components/)"
    fi

    # Pages
    if dir_has_files "$PROJECT_ROOT/src/pages" || dir_has_files "$PROJECT_ROOT/src/app" || dir_has_files "$PROJECT_ROOT/pages" || dir_has_files "$PROJECT_ROOT/app"; then
      pass "Pages/app directory found"
    else
      fail "No pages/app directory found"
    fi
    ;;

  # ── integrate ──────────────────────────────────────────────────────────────
  integrate)
    # API client or fetch wrappers
    if any_file_matches "*.client.ts" || any_file_matches "api.ts" || any_file_matches "apiClient.ts" || any_file_matches "*.api.ts"; then
      pass "API client file found"
    elif find "$PROJECT_ROOT/src" -name "*.ts" -exec grep -l "fetch\|axios\|ky\|superagent" {} \; 2>/dev/null | head -1 | grep -q .; then
      pass "API calls detected in frontend code"
    else
      warn "No explicit API client found — verify frontend is connected to backend"
    fi
    ;;

  # ── test ───────────────────────────────────────────────────────────────────
  test)
    # Test files
    if any_file_matches "*.test.ts" || any_file_matches "*.spec.ts" || any_file_matches "*.test.js" || any_file_matches "test_*.py" || any_file_matches "*_test.go"; then
      local test_count
      test_count=$(find "$PROJECT_ROOT" -name "*.test.ts" -o -name "*.spec.ts" -o -name "*.test.js" -o -name "test_*.py" -o -name "*_test.go" 2>/dev/null | grep -v node_modules | grep -v ".git" | wc -l | tr -d ' ')
      pass "Test files found (${test_count} file(s))"
    else
      fail "No test files found (expected *.test.ts, *.spec.ts, test_*.py, *_test.go)"
    fi

    # Test directory
    if dir_has_files "$PROJECT_ROOT/__tests__" || dir_has_files "$PROJECT_ROOT/tests" || dir_has_files "$PROJECT_ROOT/test" || dir_has_files "$PROJECT_ROOT/spec"; then
      pass "Test directory exists"
    else
      warn "No dedicated test directory found (tests colocated or missing)"
    fi
    ;;

  # ── qa ─────────────────────────────────────────────────────────────────────
  qa)
    # E2E tests
    if any_file_matches "*.e2e.ts" || any_file_matches "*.e2e.js" || dir_has_files "$PROJECT_ROOT/e2e" || dir_has_files "$PROJECT_ROOT/cypress" || dir_has_files "$PROJECT_ROOT/playwright"; then
      pass "E2E test files or directory found"
    else
      warn "No E2E tests found (expected *.e2e.ts, e2e/, cypress/, playwright/)"
    fi

    # QA report or screen status
    if [ -f "$PROJECT_ROOT/SCREEN_STATUS.md" ]; then
      pass "SCREEN_STATUS.md found (design QA completed)"
    else
      warn "No SCREEN_STATUS.md (design QA not run or not applicable)"
    fi
    ;;

  # ── deploy ─────────────────────────────────────────────────────────────────
  deploy)
    # Container config
    if [ -f "$PROJECT_ROOT/Dockerfile" ] || [ -f "$PROJECT_ROOT/docker-compose.yml" ] || [ -f "$PROJECT_ROOT/docker-compose.yaml" ]; then
      pass "Docker config found"
    else
      warn "No Dockerfile found — needed for containerized deployment"
    fi

    # CI/CD
    if dir_has_files "$PROJECT_ROOT/.github/workflows" || [ -f "$PROJECT_ROOT/.gitlab-ci.yml" ] || [ -f "$PROJECT_ROOT/vercel.json" ] || [ -f "$PROJECT_ROOT/fly.toml" ]; then
      pass "CI/CD config found"
    else
      warn "No CI/CD config found (.github/workflows/, vercel.json, fly.toml, etc.)"
    fi

    # Env template
    if [ -f "$PROJECT_ROOT/.env.example" ] || [ -f "$PROJECT_ROOT/.env.template" ]; then
      pass "Environment template found"
    else
      warn "No .env.example — add environment variable documentation"
    fi
    ;;

  # ── init / prd ─────────────────────────────────────────────────────────────
  init)
    if [ -f "$PROJECT_ROOT/CLAUDE.md" ]; then
      pass "CLAUDE.md exists"
    else
      fail "CLAUDE.md not found — project not initialized"
    fi
    ;;

  prd)
    if find "$PROJECT_ROOT/prd" -name "prd-*.md" 2>/dev/null | head -1 | grep -q .; then
      pass "PRD file found in prd/"
    else
      fail "No PRD file found in prd/"
    fi
    ;;

  # ── runtime-smoke ────────────────────────────────────────────────────────────
  runtime-smoke)
    # Find the app directory
    APP_DIR="$PROJECT_ROOT"
    [ -d "$PROJECT_ROOT/app" ] && [ -f "$PROJECT_ROOT/app/package.json" ] && APP_DIR="$PROJECT_ROOT/app"

    if [ -f "$APP_DIR/package.json" ]; then
      # Start dev server, wait, test basic endpoints, kill
      echo -e "${CYAN}  Starting dev server for smoke test...${NC}"
      (cd "$APP_DIR" && npm run dev &>/tmp/harness-smoke-server.log &)
      SMOKE_PID=$!
      sleep 8

      # Find the port (default 3000)
      SMOKE_PORT=3000
      if grep -q "localhost:3001" /tmp/harness-smoke-server.log 2>/dev/null; then
        SMOKE_PORT=3001
      fi

      SMOKE_FAIL=0
      # Test: server responds
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${SMOKE_PORT}/" 2>/dev/null || echo "000")
      if echo "$HTTP_CODE" | grep -qE "^(200|302|307)$"; then
        pass "Server responds on port ${SMOKE_PORT}"
      else
        fail "Server not responding on port ${SMOKE_PORT} (HTTP ${HTTP_CODE})"
        SMOKE_FAIL=1
      fi

      # Test: API routes return valid HTTP responses
      if [ "$SMOKE_FAIL" -eq 0 ]; then
        API_ROUTE=$(find "$APP_DIR/src/app/api" -name "route.ts" -not -path "*\[*" 2>/dev/null | head -1)
        if [ -n "$API_ROUTE" ]; then
          REL_PATH="${API_ROUTE#$APP_DIR/src/app}"
          URL_PATH=$(echo "$REL_PATH" | sed "s|/route\.ts||")
          HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${SMOKE_PORT}${URL_PATH}" 2>/dev/null || echo "000")
          if echo "$HTTP_CODE" | grep -qE "^[2345]"; then
            pass "API route responds: ${URL_PATH} (HTTP ${HTTP_CODE})"
          else
            warn "API route not responding: ${URL_PATH}"
          fi
        fi
      fi

      # Cleanup
      kill $SMOKE_PID 2>/dev/null
      wait $SMOKE_PID 2>/dev/null || true
      rm -f /tmp/harness-smoke-server.log
    else
      warn "No package.json found — skipping runtime smoke test"
    fi
    ;;

  *)
    warn "No validation rules defined for phase: ${PHASE}"
    ;;
esac

echo ""
echo -e "  Results: ${GREEN}${PASS} passed${NC}  ${RED}${FAIL} failed${NC}  ${YELLOW}${WARN} warnings${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
