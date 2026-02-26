#!/usr/bin/env bash
#
# Infrastructure Prep — Pre-pipeline environment preparation
# Ensures Docker, local DB, and required services are running before build.
#
# Usage:
#   ./harness/infra-prep.sh [project-root]
#   ./harness/infra-prep.sh --check-only     # Dry-run: report status without starting
#
# Exit codes:
#   0 = All infrastructure ready
#   1 = Infrastructure could not be started (manual action needed)
#   2 = Check-only mode: some services not running

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${1:-$(dirname "$SCRIPT_DIR")}"
CHECK_ONLY=false

for arg in "$@"; do
  [ "$arg" = "--check-only" ] && CHECK_ONLY=true
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "${GREEN}  ✓ $1${NC}"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}  ✗ $1${NC}"; FAIL=$((FAIL+1)); }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; WARN=$((WARN+1)); }

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  Infrastructure Prep${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
echo ""

# ─── 1. Docker ─────────────────────────────────────────────────────────────────
echo -e "${CYAN}  [1/4] Docker${NC}"

if ! command -v docker &>/dev/null; then
  fail "Docker not installed"
else
  # Check if Docker daemon is running
  if docker info &>/dev/null 2>&1; then
    pass "Docker daemon running"
  else
    if [ "$CHECK_ONLY" = true ]; then
      fail "Docker daemon not running"
    else
      echo -e "${YELLOW}  → Docker daemon not running. Starting Docker Desktop...${NC}"
      # macOS
      if [ "$(uname)" = "Darwin" ]; then
        open -a Docker 2>/dev/null || true
      fi
      # Wait up to 60s for Docker to be ready
      for i in $(seq 1 30); do
        if docker info &>/dev/null 2>&1; then
          pass "Docker daemon started (waited ${i}x2s)"
          break
        fi
        if [ "$i" -eq 30 ]; then
          fail "Docker daemon did not start within 60s"
        fi
        sleep 2
      done
    fi
  fi
fi

# ─── 2. Supabase Local ────────────────────────────────────────────────────────
echo -e "${CYAN}  [2/4] Supabase Local${NC}"

NEEDS_SUPABASE=false
# Detect if project uses Supabase
if grep -rq "supabase" "$PROJECT_ROOT/package.json" 2>/dev/null || \
   grep -rq "@supabase" "$PROJECT_ROOT/package.json" 2>/dev/null || \
   find "$PROJECT_ROOT" -maxdepth 3 -name "*.ts" -exec grep -l "createServiceSupabase\|createServerClient\|createBrowserClient" {} \; 2>/dev/null | head -1 | grep -q .; then
  NEEDS_SUPABASE=true
fi

if [ "$NEEDS_SUPABASE" = true ]; then
  if ! command -v npx &>/dev/null; then
    fail "npx not found (needed for supabase CLI)"
  else
    # Check if supabase is already running
    SUPABASE_STATUS=$(npx supabase status -o env 2>&1 || echo "NOT_RUNNING")
    if echo "$SUPABASE_STATUS" | grep -q "API_URL="; then
      pass "Supabase local already running"
      # Extract keys for .env setup
      SUPABASE_URL=$(echo "$SUPABASE_STATUS" | grep "^API_URL=" | cut -d'"' -f2)
      SUPABASE_ANON=$(echo "$SUPABASE_STATUS" | grep "^ANON_KEY=" | cut -d'"' -f2)
      SUPABASE_SERVICE=$(echo "$SUPABASE_STATUS" | grep "^SERVICE_ROLE_KEY=" | cut -d'"' -f2)
    else
      if [ "$CHECK_ONLY" = true ]; then
        fail "Supabase not running"
      else
        # Check if supabase is initialized
        if [ ! -f "$PROJECT_ROOT/supabase/config.toml" ]; then
          echo -e "${YELLOW}  → Initializing Supabase...${NC}"
          (cd "$PROJECT_ROOT" && npx supabase init 2>/dev/null) || true
        fi
        echo -e "${YELLOW}  → Starting Supabase local...${NC}"
        if (cd "$PROJECT_ROOT" && npx supabase start 2>&1 | tail -5); then
          SUPABASE_STATUS=$(cd "$PROJECT_ROOT" && npx supabase status -o env 2>&1)
          SUPABASE_URL=$(echo "$SUPABASE_STATUS" | grep "^API_URL=" | cut -d'"' -f2)
          SUPABASE_ANON=$(echo "$SUPABASE_STATUS" | grep "^ANON_KEY=" | cut -d'"' -f2)
          SUPABASE_SERVICE=$(echo "$SUPABASE_STATUS" | grep "^SERVICE_ROLE_KEY=" | cut -d'"' -f2)
          pass "Supabase local started"
        else
          fail "Supabase start failed"
        fi
      fi
    fi

    # Run schema if SQL file exists and tables are empty
    if [ -n "${SUPABASE_URL:-}" ]; then
      SCHEMA_FILE=$(find "$PROJECT_ROOT" -maxdepth 4 -name "schema.sql" -not -path "*/node_modules/*" 2>/dev/null | head -1)
      if [ -n "$SCHEMA_FILE" ] && [ "$CHECK_ONLY" = false ]; then
        # Check if tables already exist
        TABLE_COUNT=$(docker exec -i supabase_db_app psql -U postgres -d postgres -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" 2>/dev/null | tr -d ' ' || echo "0")
        if [ "${TABLE_COUNT:-0}" -le 1 ]; then
          echo -e "${YELLOW}  → Running schema.sql...${NC}"
          if docker exec -i supabase_db_app psql -U postgres -d postgres < "$SCHEMA_FILE" &>/dev/null; then
            pass "Schema applied: $SCHEMA_FILE"
          else
            warn "Schema apply had errors (may be partial)"
          fi
        else
          pass "Schema already applied (${TABLE_COUNT} tables)"
        fi
      fi
    fi
  fi
else
  pass "Supabase not needed (no @supabase dependency)"
fi

# ─── 3. Environment Variables ──────────────────────────────────────────────────
echo -e "${CYAN}  [3/4] Environment Variables${NC}"

# Find the app directory (where package.json with next/supabase is)
APP_DIR="$PROJECT_ROOT"
if [ -d "$PROJECT_ROOT/app" ] && [ -f "$PROJECT_ROOT/app/package.json" ]; then
  APP_DIR="$PROJECT_ROOT/app"
fi

ENV_FILE="$APP_DIR/.env.local"
ENV_EXAMPLE="$APP_DIR/.env.local.example"

if [ -f "$ENV_FILE" ]; then
  pass ".env.local exists"
  # Validate key vars
  MISSING_VARS=0
  for var in NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SESSION_SECRET; do
    if ! grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
      warn "Missing: $var in .env.local"
      MISSING_VARS=$((MISSING_VARS+1))
    fi
  done
  if [ "$MISSING_VARS" -eq 0 ]; then
    pass "All required env vars present"
  fi
elif [ "$CHECK_ONLY" = false ] && [ -n "${SUPABASE_URL:-}" ]; then
  # Auto-generate .env.local from Supabase credentials
  echo -e "${YELLOW}  → Auto-generating .env.local...${NC}"
  cat > "$ENV_FILE" << ENVEOF
# Supabase (local — auto-generated by infra-prep.sh)
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE}

# Session signing
SESSION_SECRET=$(openssl rand -hex 16 2>/dev/null || echo "auto-generated-dev-secret-32chars!!")

# Admin credentials
ADMIN_ID=admin
ADMIN_PASSWORD=Potential
ENVEOF

  # Try to discover Slack token from sibling projects
  SLACK_TOKEN=""
  for sibling_env in "$(dirname "$PROJECT_ROOT")"/*/.*env $(dirname "$PROJECT_ROOT")/*/.env; do
    if [ -f "$sibling_env" ]; then
      token=$(grep "^SLACK_BOT_TOKEN=" "$sibling_env" 2>/dev/null | head -1 | cut -d'=' -f2-)
      if [ -n "$token" ]; then
        SLACK_TOKEN="$token"
        echo -e "${CYAN}  → Found Slack token from: $(basename "$(dirname "$sibling_env")")${NC}"
        break
      fi
    fi
  done
  if [ -n "$SLACK_TOKEN" ]; then
    echo "" >> "$ENV_FILE"
    echo "# Slack (auto-discovered from sibling project)" >> "$ENV_FILE"
    echo "SLACK_BOT_TOKEN=${SLACK_TOKEN}" >> "$ENV_FILE"
  fi

  pass ".env.local auto-generated"
else
  if [ -f "$ENV_EXAMPLE" ]; then
    warn ".env.local not found (template exists at .env.local.example)"
  else
    fail ".env.local not found"
  fi
fi

# ─── 4. Node Dependencies ─────────────────────────────────────────────────────
echo -e "${CYAN}  [4/4] Dependencies${NC}"

if [ -f "$APP_DIR/package.json" ]; then
  if [ -d "$APP_DIR/node_modules" ]; then
    pass "node_modules exists"
  elif [ "$CHECK_ONLY" = false ]; then
    echo -e "${YELLOW}  → Installing dependencies...${NC}"
    (cd "$APP_DIR" && npm install --silent 2>&1 | tail -3) || true
    pass "Dependencies installed"
  else
    fail "node_modules missing"
  fi
fi

# ─── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "  Results: ${GREEN}${PASS} passed${NC}  ${RED}${FAIL} failed${NC}  ${YELLOW}${WARN} warnings${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  if [ "$CHECK_ONLY" = true ]; then
    exit 2
  fi
  exit 1
fi

# Export for subsequent scripts
if [ -n "${SUPABASE_URL:-}" ]; then
  echo "SUPABASE_URL=${SUPABASE_URL}"
  echo "SUPABASE_ANON_KEY=${SUPABASE_ANON}"
  echo "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE}"
fi

exit 0
