#!/usr/bin/env bash
#
# Database Lifecycle Manager
# Detects ORM/database from project files and runs migrations, seeds,
# resets, and status checks accordingly.
#
# Usage:
#   ./harness/db-manager.sh detect [project_dir]   # Detect ORM/database from project files
#   ./harness/db-manager.sh migrate [project_dir]  # Run migrations
#   ./harness/db-manager.sh seed [project_dir]     # Run seed data
#   ./harness/db-manager.sh reset [project_dir]    # Reset database (with confirmation)
#   ./harness/db-manager.sh status [project_dir]   # Show migration status
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
  echo -e "${BOLD}Database Lifecycle Manager${NC}"
  echo ""
  echo "Usage:"
  echo "  $0 detect [project_dir]    Detect ORM/database from project files"
  echo "  $0 migrate [project_dir]   Run migrations"
  echo "  $0 seed [project_dir]      Run seed data"
  echo "  $0 reset [project_dir]     Reset database (with confirmation)"
  echo "  $0 status [project_dir]    Show migration status"
  echo ""
  echo "Supported ORMs:"
  echo "  Prisma, Alembic, TypeORM, Drizzle, Django, GORM"
  echo ""
  echo "Examples:"
  echo "  $0 detect ."
  echo "  $0 migrate /path/to/project"
  echo "  $0 reset"
  echo ""
  echo "Note: 'db:drop' is a safety catch in harness.config.json."
  echo "There is no separate 'drop' command. Use 'reset' to drop and rebuild."
}

resolve_dir() {
  local dir="${1:-$(pwd)}"
  if [[ "${dir}" == /* ]]; then
    echo "${dir}"
  else
    echo "$(pwd)/${dir}"
  fi
}

has_file() {
  [[ -f "${TARGET_DIR}/$1" ]]
}

has_dir() {
  [[ -d "${TARGET_DIR}/$1" ]]
}

pkg_has_dep() {
  local dep="$1"
  [[ -f "${TARGET_DIR}/package.json" ]] && grep -q "\"${dep}\"" "${TARGET_DIR}/package.json" 2>/dev/null
}

go_has_import() {
  local import_name="$1"
  grep -rl --include="*.go" "${import_name}" "${TARGET_DIR}" 2>/dev/null | head -1 > /dev/null 2>&1
}

# ─────────────────────────────────────────────
# ORM Detection
# ─────────────────────────────────────────────
DETECTED_ORM=""

detect_orm() {
  local dir="$1"
  TARGET_DIR="${dir}"  # global: used by has_dir/has_file/pkg_has_dep helpers

  # Prisma
  if has_dir "prisma" || has_file "schema.prisma" || has_file "prisma/schema.prisma"; then
    DETECTED_ORM="prisma"
    return
  fi

  # Alembic
  if has_dir "alembic" || has_file "alembic.ini"; then
    DETECTED_ORM="alembic"
    return
  fi

  # TypeORM
  if pkg_has_dep "typeorm"; then
    DETECTED_ORM="typeorm"
    return
  fi

  # Drizzle
  if pkg_has_dep "drizzle-orm" || pkg_has_dep "drizzle-kit"; then
    DETECTED_ORM="drizzle"
    return
  fi

  # Django
  if has_file "manage.py"; then
    DETECTED_ORM="django"
    return
  fi

  # GORM (Go)
  if has_file "go.mod" && grep -q "gorm" "${TARGET_DIR}/go.mod" 2>/dev/null; then
    DETECTED_ORM="gorm"
    return
  fi

  DETECTED_ORM=""
}

# ─────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────

cmd_detect() {
  local target_dir
  target_dir="$(resolve_dir "${1:-$(pwd)}")"

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Database Detection${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  detect_orm "${target_dir}"

  if [[ -z "${DETECTED_ORM}" ]]; then
    log_warn "No supported ORM/database tool detected."
    echo ""
    echo -e "${DIM}Supported: Prisma, Alembic, TypeORM, Drizzle, Django, GORM${NC}"
    exit 1
  fi

  local orm_display=""
  local migrate_cmd=""
  local seed_cmd=""
  local status_cmd=""
  local reset_cmd=""

  case "${DETECTED_ORM}" in
    prisma)
      orm_display="Prisma"
      migrate_cmd="npx prisma migrate dev"
      seed_cmd="npx prisma db seed"
      status_cmd="npx prisma migrate status"
      reset_cmd="npx prisma migrate reset"
      ;;
    alembic)
      orm_display="Alembic (SQLAlchemy)"
      migrate_cmd="alembic upgrade head"
      seed_cmd="python -m seeds.run (if exists)"
      status_cmd="alembic current"
      reset_cmd="alembic downgrade base"
      ;;
    typeorm)
      orm_display="TypeORM"
      migrate_cmd="npx typeorm migration:run -d src/data-source.ts"
      seed_cmd="npx typeorm-seeding seed -d src/data-source.ts"
      status_cmd="npx typeorm migration:show -d src/data-source.ts"
      reset_cmd="npx typeorm migration:revert -d src/data-source.ts"
      ;;
    drizzle)
      orm_display="Drizzle"
      migrate_cmd="npx drizzle-kit push"
      seed_cmd="npx tsx src/db/seed.ts (if exists)"
      status_cmd="npx drizzle-kit check"
      reset_cmd="npx drizzle-kit drop"
      ;;
    django)
      orm_display="Django"
      migrate_cmd="python manage.py migrate"
      seed_cmd="python manage.py loaddata"
      status_cmd="python manage.py showmigrations"
      reset_cmd="python manage.py flush"
      ;;
    gorm)
      orm_display="GORM (Go)"
      migrate_cmd="go run cmd/migrate/main.go"
      seed_cmd="go run cmd/seed/main.go"
      status_cmd="go run cmd/migrate/main.go --status"
      reset_cmd="go run cmd/migrate/main.go --reset"
      ;;
  esac

  echo -e "  ${BOLD}ORM Detected:${NC}   ${GREEN}${orm_display}${NC}"
  echo -e "  ${BOLD}Migrate:${NC}        ${YELLOW}${migrate_cmd}${NC}"
  echo -e "  ${BOLD}Seed:${NC}           ${YELLOW}${seed_cmd}${NC}"
  echo -e "  ${BOLD}Status:${NC}         ${YELLOW}${status_cmd}${NC}"
  echo -e "  ${BOLD}Reset:${NC}          ${YELLOW}${reset_cmd}${NC}"
  echo ""
}

cmd_migrate() {

  # requireConfirmation check (db:migrate)
  # Fail-safe: default to requiring confirmation. Only skip if config explicitly says so.
  local CONFIG_FILE="$SCRIPT_DIR/harness.config.json"
  local NEEDS_CONFIRM=true
  if [ -f "$CONFIG_FILE" ]; then
    if command -v jq &>/dev/null; then
      if ! jq -e '.restrictions.requireConfirmation | map(select(. == "db:migrate")) | length > 0' "$CONFIG_FILE" &>/dev/null; then
        NEEDS_CONFIRM=false
      fi
    else
      log_warn "jq not installed — cannot read config. Requiring confirmation for safety."
    fi
  else
    log_warn "harness.config.json not found. Requiring confirmation for safety."
  fi

  if [ "$NEEDS_CONFIRM" = true ]; then
    local CONFIRM_FLAG=false
    for arg in "$@"; do
      [ "$arg" = "--confirm" ] && CONFIRM_FLAG=true
    done
    if [ "$CONFIRM_FLAG" = false ]; then
      echo -e "${RED}[safety] Database migration requires confirmation.${NC}"
      echo -e "Run with --confirm flag: $0 migrate --confirm"
      return 1
    fi
  fi

  local target_dir
  target_dir="$(resolve_dir "${1:-$(pwd)}")"

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  detect_orm "${target_dir}"

  if [[ -z "${DETECTED_ORM}" ]]; then
    log_error "No supported ORM detected. Run '$0 detect' to check."
    exit 1
  fi

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Running Migrations (${DETECTED_ORM})${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  cd "${target_dir}"

  case "${DETECTED_ORM}" in
    prisma)
      log_info "Running: npx prisma migrate dev"
      npx prisma migrate dev
      ;;
    alembic)
      log_info "Running: alembic upgrade head"
      alembic upgrade head
      ;;
    typeorm)
      log_info "Running: npx typeorm migration:run"
      if [[ -f "${target_dir}/src/data-source.ts" ]]; then
        npx typeorm migration:run -d src/data-source.ts
      elif [[ -f "${target_dir}/src/data-source.js" ]]; then
        npx typeorm migration:run -d src/data-source.js
      else
        npx typeorm migration:run
      fi
      ;;
    drizzle)
      log_info "Running: npx drizzle-kit push"
      npx drizzle-kit push
      ;;
    django)
      log_info "Running: python manage.py migrate"
      python manage.py migrate
      ;;
    gorm)
      log_info "Running: go run cmd/migrate/main.go"
      if [[ -f "${target_dir}/cmd/migrate/main.go" ]]; then
        go run cmd/migrate/main.go
      else
        log_error "Migration entry point not found: cmd/migrate/main.go"
        exit 1
      fi
      ;;
  esac

  log_success "Migrations complete."
}

cmd_seed() {

  # requireConfirmation check (db:seed)
  # Fail-safe: default to requiring confirmation. Only skip if config explicitly says so.
  local CONFIG_FILE="$SCRIPT_DIR/harness.config.json"
  local NEEDS_CONFIRM=true
  if [ -f "$CONFIG_FILE" ]; then
    if command -v jq &>/dev/null; then
      if ! jq -e '.restrictions.requireConfirmation | map(select(. == "db:seed")) | length > 0' "$CONFIG_FILE" &>/dev/null; then
        NEEDS_CONFIRM=false
      fi
    else
      log_warn "jq not installed — cannot read config. Requiring confirmation for safety."
    fi
  else
    log_warn "harness.config.json not found. Requiring confirmation for safety."
  fi

  if [ "$NEEDS_CONFIRM" = true ]; then
    local CONFIRM_FLAG=false
    for arg in "$@"; do
      [ "$arg" = "--confirm" ] && CONFIRM_FLAG=true
    done
    if [ "$CONFIRM_FLAG" = false ]; then
      echo -e "${RED}[safety] Database seeding requires confirmation.${NC}"
      echo -e "Run with --confirm flag: $0 seed --confirm"
      return 1
    fi
  fi

  local target_dir
  target_dir="$(resolve_dir "${1:-$(pwd)}")"

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  detect_orm "${target_dir}"

  if [[ -z "${DETECTED_ORM}" ]]; then
    log_error "No supported ORM detected. Run '$0 detect' to check."
    exit 1
  fi

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Running Seeds (${DETECTED_ORM})${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  cd "${target_dir}"

  case "${DETECTED_ORM}" in
    prisma)
      log_info "Running: npx prisma db seed"
      npx prisma db seed
      ;;
    alembic)
      if [[ -d "${target_dir}/seeds" ]]; then
        log_info "Running: python -m seeds.run"
        python -m seeds.run
      else
        log_warn "No seeds/ directory found. Create seeds/run.py with your seed logic."
        exit 1
      fi
      ;;
    typeorm)
      log_info "Running: npx typeorm-seeding seed"
      if [[ -f "${target_dir}/src/data-source.ts" ]]; then
        npx typeorm-seeding seed -d src/data-source.ts
      else
        npx typeorm-seeding seed
      fi
      ;;
    drizzle)
      if [[ -f "${target_dir}/src/db/seed.ts" ]]; then
        log_info "Running: npx tsx src/db/seed.ts"
        npx tsx src/db/seed.ts
      elif [[ -f "${target_dir}/src/db/seed.js" ]]; then
        log_info "Running: node src/db/seed.js"
        node src/db/seed.js
      else
        log_warn "No seed file found. Create src/db/seed.ts with your seed logic."
        exit 1
      fi
      ;;
    django)
      log_info "Running: python manage.py loaddata"
      # Look for fixture files
      local fixtures
      fixtures=$(find "${target_dir}" -name "*.json" -path "*/fixtures/*" 2>/dev/null | head -5)
      if [[ -n "${fixtures}" ]]; then
        while IFS= read -r fixture; do
          local fixture_name
          fixture_name="$(basename "${fixture}")"
          log_info "Loading fixture: ${fixture_name}"
          python manage.py loaddata "${fixture_name}"
        done <<< "${fixtures}"
      else
        log_warn "No fixture files found in */fixtures/*.json"
        exit 1
      fi
      ;;
    gorm)
      if [[ -f "${target_dir}/cmd/seed/main.go" ]]; then
        log_info "Running: go run cmd/seed/main.go"
        go run cmd/seed/main.go
      else
        log_warn "No seed entry point found: cmd/seed/main.go"
        exit 1
      fi
      ;;
  esac

  log_success "Seeding complete."
}

cmd_reset() {

  # requireConfirmation check (config-driven gate)
  # Fail-safe: default to requiring confirmation. Only skip if config explicitly says so.
  local CONFIG_FILE="$SCRIPT_DIR/harness.config.json"
  local NEEDS_CONFIRM=true
  local CONFIRM_FLAG=false
  if [ -f "$CONFIG_FILE" ]; then
    if command -v jq &>/dev/null; then
      if ! jq -e '.restrictions.requireConfirmation | map(select(. == "db:reset")) | length > 0' "$CONFIG_FILE" &>/dev/null; then
        NEEDS_CONFIRM=false
      fi
    else
      log_warn "jq not installed — cannot read config. Requiring confirmation for safety."
    fi
  else
    log_warn "harness.config.json not found. Requiring confirmation for safety."
  fi

  for arg in "$@"; do
    [ "$arg" = "--confirm" ] && CONFIRM_FLAG=true
  done

  if [ "$NEEDS_CONFIRM" = true ] && [ "$CONFIRM_FLAG" = false ]; then
    echo -e "${RED}[safety] Database reset requires confirmation.${NC}"
    echo -e "The user must confirm this operation first."
    echo -e "Then run with --confirm flag: $0 reset --confirm"
    return 1
  fi

  local target_dir
  target_dir="$(resolve_dir "${1:-$(pwd)}")"

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  detect_orm "${target_dir}"

  if [[ -z "${DETECTED_ORM}" ]]; then
    log_error "No supported ORM detected. Run '$0 detect' to check."
    exit 1
  fi

  echo -e "${BOLD}${RED}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${RED}  Database Reset (${DETECTED_ORM})${NC}"
  echo -e "${BOLD}${RED}═══════════════════════════════════════════${NC}"
  echo ""
  if [ "$CONFIRM_FLAG" != true ]; then
    if [ -t 0 ]; then
      # Interactive terminal: prompt the user
      echo -e "${RED}WARNING: This will destroy all data in the database!${NC}"
      echo ""
      echo -n "Are you sure you want to reset the database? (type 'yes' to confirm): "
      read -r confirm
      if [[ "${confirm}" != "yes" ]]; then
        log_info "Reset cancelled."
        exit 0
      fi
    else
      # Non-interactive (agent/headless mode): require --confirm flag to prevent hang
      echo -e "${RED}[safety] Non-interactive mode detected. Database reset requires the --confirm flag.${NC}"
      echo -e "This command would destroy all data in the database."
      echo -e "Run with: $0 reset --confirm"
      exit 1
    fi
  fi


  cd "${target_dir}"

  case "${DETECTED_ORM}" in
    prisma)
      log_info "Running: npx prisma migrate reset --force"
      npx prisma migrate reset --force
      ;;
    alembic)
      log_info "Running: alembic downgrade base"
      alembic downgrade base
      log_info "Running: alembic upgrade head"
      alembic upgrade head
      ;;
    typeorm)
      log_info "Reverting all migrations..."
      if [[ -f "${target_dir}/src/data-source.ts" ]]; then
        npx typeorm schema:drop -d src/data-source.ts
        npx typeorm migration:run -d src/data-source.ts
      else
        npx typeorm schema:drop
        npx typeorm migration:run
      fi
      ;;
    drizzle)
      log_info "Running: npx drizzle-kit drop"
      npx drizzle-kit drop
      log_info "Running: npx drizzle-kit push"
      npx drizzle-kit push
      ;;
    django)
      log_info "Running: python manage.py flush --no-input"
      python manage.py flush --no-input
      ;;
    gorm)
      if [[ -f "${target_dir}/cmd/migrate/main.go" ]]; then
        log_info "Running: go run cmd/migrate/main.go --reset"
        go run cmd/migrate/main.go --reset
      else
        log_error "Migration entry point not found: cmd/migrate/main.go"
        exit 1
      fi
      ;;
  esac

  log_success "Database reset complete."
}

cmd_status() {
  local target_dir
  target_dir="$(resolve_dir "${1:-$(pwd)}")"

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  detect_orm "${target_dir}"

  if [[ -z "${DETECTED_ORM}" ]]; then
    log_error "No supported ORM detected. Run '$0 detect' to check."
    exit 1
  fi

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Migration Status (${DETECTED_ORM})${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  cd "${target_dir}"

  case "${DETECTED_ORM}" in
    prisma)
      log_info "Running: npx prisma migrate status"
      npx prisma migrate status
      ;;
    alembic)
      log_info "Running: alembic current"
      alembic current
      echo ""
      log_info "Running: alembic history"
      alembic history --verbose | head -20
      ;;
    typeorm)
      log_info "Running: npx typeorm migration:show"
      if [[ -f "${target_dir}/src/data-source.ts" ]]; then
        npx typeorm migration:show -d src/data-source.ts
      elif [[ -f "${target_dir}/src/data-source.js" ]]; then
        npx typeorm migration:show -d src/data-source.js
      else
        npx typeorm migration:show
      fi
      ;;
    drizzle)
      log_info "Running: npx drizzle-kit check"
      npx drizzle-kit check
      ;;
    django)
      log_info "Running: python manage.py showmigrations"
      python manage.py showmigrations
      ;;
    gorm)
      if [[ -f "${target_dir}/cmd/migrate/main.go" ]]; then
        log_info "Running: go run cmd/migrate/main.go --status"
        go run cmd/migrate/main.go --status
      else
        log_warn "Migration entry point not found: cmd/migrate/main.go"
        log_info "GORM detected via go.mod but no migration runner found."
        exit 1
      fi
      ;;
  esac
}

# ─────────────────────────────────────────────
# Main dispatch
# ─────────────────────────────────────────────
COMMAND="${1:-help}"
shift || true

case "${COMMAND}" in
  detect)  cmd_detect "$@" ;;
  migrate) cmd_migrate "$@" ;;
  seed)    cmd_seed "$@" ;;
  reset)   cmd_reset "$@" ;;
  status)  cmd_status "$@" ;;
  help|--help|-h) usage ;;
  *)
    log_error "Unknown command: ${COMMAND}"
    usage
    exit 1
    ;;
esac
