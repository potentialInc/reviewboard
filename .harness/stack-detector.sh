#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# stack-detector.sh — Auto-detect tech stack for any project directory
# ============================================================================
# Usage:
#   ./harness/stack-detector.sh detect [project_dir]   # Auto-detect tech stack
#   ./harness/stack-detector.sh commands [project_dir]  # Show detected dev/test/build commands
#   ./harness/stack-detector.sh json [project_dir]      # Output as JSON
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."

# --- Colors ----------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# --- Globals ---------------------------------------------------------------
DETECTED_LANGUAGE=""
DETECTED_FRAMEWORK=""
DETECTED_PKG_MANAGER=""
DETECTED_TEST_RUNNER=""
DETECTED_LINTER=""
DETECTED_DB_ORM=""
DETECTED_DB_ENGINE=""
DETECTED_DEPLOYMENT=""
CMD_DEV=""
CMD_TEST=""
CMD_BUILD=""
CMD_LINT=""

# --- Helpers ---------------------------------------------------------------

has_file() {
  [[ -e "${TARGET_DIR}/$1" ]]
}

has_glob() {
  find "${TARGET_DIR}" -maxdepth 1 -name "$1" -print -quit 2>/dev/null | grep -q .
}

has_dir() {
  [[ -d "${TARGET_DIR}/$1" ]]
}

file_contains() {
  local file="$1"
  local pattern="$2"
  [[ -f "${TARGET_DIR}/${file}" ]] && grep -q "${pattern}" "${TARGET_DIR}/${file}" 2>/dev/null
}

pkg_has_dep() {
  local dep="$1"
  if [[ -f "${TARGET_DIR}/package.json" ]]; then
    grep -q "\"${dep}\"" "${TARGET_DIR}/package.json" 2>/dev/null
  else
    return 1
  fi
}

pyproject_has_dep() {
  local dep="$1"
  if [[ -f "${TARGET_DIR}/pyproject.toml" ]]; then
    grep -qi "${dep}" "${TARGET_DIR}/pyproject.toml" 2>/dev/null
  else
    return 1
  fi
}

gemfile_has_dep() {
  local dep="$1"
  if [[ -f "${TARGET_DIR}/Gemfile" ]]; then
    grep -q "${dep}" "${TARGET_DIR}/Gemfile" 2>/dev/null
  else
    return 1
  fi
}

pkg_json_script() {
  local script_name="$1"
  if [[ -f "${TARGET_DIR}/package.json" ]]; then
    grep -q "\"${script_name}\"" "${TARGET_DIR}/package.json" 2>/dev/null
  else
    return 1
  fi
}

# --- Detection Functions ---------------------------------------------------

detect_language() {
  if has_file "tsconfig.json"; then
    DETECTED_LANGUAGE="TypeScript"
  elif has_file "package.json"; then
    DETECTED_LANGUAGE="JavaScript"
  elif has_file "pyproject.toml" || has_file "requirements.txt"; then
    DETECTED_LANGUAGE="Python"
  elif has_file "go.mod"; then
    DETECTED_LANGUAGE="Go"
  elif has_file "Cargo.toml"; then
    DETECTED_LANGUAGE="Rust"
  elif has_file "Gemfile"; then
    DETECTED_LANGUAGE="Ruby"
  elif has_file "pom.xml" || has_file "build.gradle"; then
    DETECTED_LANGUAGE="Java/Kotlin"
  elif has_file "Package.swift"; then
    DETECTED_LANGUAGE="Swift"
  else
    DETECTED_LANGUAGE="Unknown"
  fi
}

detect_framework() {
  # Check for Next.js
  if has_glob "next.config.*"; then
    DETECTED_FRAMEWORK="Next.js"
    return
  fi

  # Check for Nuxt/Vue
  if has_glob "nuxt.config.*"; then
    DETECTED_FRAMEWORK="Nuxt/Vue"
    return
  fi

  # Check for SvelteKit
  if has_glob "svelte.config.*"; then
    DETECTED_FRAMEWORK="SvelteKit"
    return
  fi

  # Check for Angular
  if has_file "angular.json"; then
    DETECTED_FRAMEWORK="Angular"
    return
  fi

  # Check for Expo (before generic React Native)
  if pkg_has_dep "expo"; then
    DETECTED_FRAMEWORK="Expo/React Native"
    return
  fi

  # Check for React Native
  if pkg_has_dep "react-native"; then
    DETECTED_FRAMEWORK="React Native"
    return
  fi

  # Check for FastAPI
  if pkg_has_dep "fastapi" || pyproject_has_dep "fastapi"; then
    DETECTED_FRAMEWORK="FastAPI"
    return
  fi
  if has_file "app/main.py" && file_contains "app/main.py" "uvicorn\|fastapi"; then
    DETECTED_FRAMEWORK="FastAPI"
    return
  fi

  # Check for Django
  if has_file "manage.py"; then
    DETECTED_FRAMEWORK="Django"
    return
  fi

  # Check for Rails
  if gemfile_has_dep "rails"; then
    DETECTED_FRAMEWORK="Rails"
    return
  fi

  # Check for Vite + React
  if has_glob "vite.config.*" && pkg_has_dep "react"; then
    DETECTED_FRAMEWORK="React + Vite"
    return
  fi

  # Check for plain Vite
  if has_glob "vite.config.*"; then
    DETECTED_FRAMEWORK="Vite"
    return
  fi

  DETECTED_FRAMEWORK="None detected"
}

detect_package_manager() {
  if has_file "bun.lockb"; then
    DETECTED_PKG_MANAGER="bun"
  elif has_file "pnpm-lock.yaml"; then
    DETECTED_PKG_MANAGER="pnpm"
  elif has_file "yarn.lock"; then
    DETECTED_PKG_MANAGER="yarn"
  elif has_file "package-lock.json"; then
    DETECTED_PKG_MANAGER="npm"
  elif has_file "poetry.lock"; then
    DETECTED_PKG_MANAGER="poetry"
  elif has_file "Pipfile.lock"; then
    DETECTED_PKG_MANAGER="pipenv"
  elif has_file "go.sum"; then
    DETECTED_PKG_MANAGER="go mod"
  elif has_file "Cargo.lock"; then
    DETECTED_PKG_MANAGER="cargo"
  elif has_file "Gemfile.lock"; then
    DETECTED_PKG_MANAGER="bundler"
  else
    DETECTED_PKG_MANAGER="None detected"
  fi
}

detect_test_runner() {
  # Vitest
  if has_glob "vitest.config.*" || pkg_has_dep "vitest"; then
    DETECTED_TEST_RUNNER="vitest"
    return
  fi

  # Jest
  if has_glob "jest.config.*" || pkg_has_dep "jest"; then
    DETECTED_TEST_RUNNER="jest"
    return
  fi

  # Pytest
  if has_file "pytest.ini" || has_file "conftest.py"; then
    DETECTED_TEST_RUNNER="pytest"
    return
  fi
  if pyproject_has_dep "pytest"; then
    DETECTED_TEST_RUNNER="pytest"
    return
  fi

  # Go test (use find for Bash 3.2 compatibility — compgen ** requires globstar)
  if find "${TARGET_DIR}" -name "*_test.go" -print -quit 2>/dev/null | grep -q .; then
    DETECTED_TEST_RUNNER="go test"
    return
  fi

  # Cargo test
  if has_file "Cargo.toml"; then
    DETECTED_TEST_RUNNER="cargo test"
    return
  fi

  # RSpec for Ruby
  if has_dir "spec" && has_file "Gemfile"; then
    DETECTED_TEST_RUNNER="rspec"
    return
  fi

  DETECTED_TEST_RUNNER="None detected"
}

detect_database() {
  DETECTED_DB_ORM=""
  DETECTED_DB_ENGINE=""

  # Prisma
  if has_dir "prisma" || has_file "schema.prisma" || has_file "prisma/schema.prisma"; then
    DETECTED_DB_ORM="Prisma"
  fi

  # SQLAlchemy + Alembic
  if has_dir "alembic" || has_file "alembic.ini"; then
    DETECTED_DB_ORM="SQLAlchemy + Alembic"
  fi

  # TypeORM
  if pkg_has_dep "typeorm"; then
    DETECTED_DB_ORM="TypeORM"
  fi

  # Drizzle
  if pkg_has_dep "drizzle-orm" || pkg_has_dep "drizzle"; then
    DETECTED_DB_ORM="Drizzle"
  fi

  # Mongoose
  if pkg_has_dep "mongoose"; then
    DETECTED_DB_ORM="Mongoose"
    DETECTED_DB_ENGINE="MongoDB"
  fi

  # PostgreSQL via docker-compose
  if file_contains "docker-compose.yml" "postgres"; then
    DETECTED_DB_ENGINE="PostgreSQL"
  elif file_contains "docker-compose.yaml" "postgres"; then
    DETECTED_DB_ENGINE="PostgreSQL"
  fi

  # MySQL via docker-compose
  if [[ -z "${DETECTED_DB_ENGINE}" ]]; then
    if file_contains "docker-compose.yml" "mysql"; then
      DETECTED_DB_ENGINE="MySQL"
    elif file_contains "docker-compose.yaml" "mysql"; then
      DETECTED_DB_ENGINE="MySQL"
    fi
  fi

  # DATABASE_URL in .env
  if [[ -z "${DETECTED_DB_ENGINE}" ]] && has_file ".env"; then
    if file_contains ".env" "DATABASE_URL"; then
      if grep "DATABASE_URL" "${TARGET_DIR}/.env" 2>/dev/null | grep -qi "postgres"; then
        DETECTED_DB_ENGINE="PostgreSQL"
      elif grep "DATABASE_URL" "${TARGET_DIR}/.env" 2>/dev/null | grep -qi "mysql"; then
        DETECTED_DB_ENGINE="MySQL"
      elif grep "DATABASE_URL" "${TARGET_DIR}/.env" 2>/dev/null | grep -qi "sqlite"; then
        DETECTED_DB_ENGINE="SQLite"
      else
        DETECTED_DB_ENGINE="Database present"
      fi
    fi
  fi
}

detect_linter() {
  # ESLint
  if has_glob ".eslintrc*" || has_glob "eslint.config.*"; then
    DETECTED_LINTER="ESLint"
    return
  fi

  # Biome
  if has_file "biome.json"; then
    DETECTED_LINTER="Biome"
    return
  fi

  # Ruff
  if has_file "ruff.toml" || pyproject_has_dep "ruff"; then
    DETECTED_LINTER="ruff"
    return
  fi

  # golangci-lint
  if has_file ".golangci.yml" || has_file ".golangci.yaml"; then
    DETECTED_LINTER="golangci-lint"
    return
  fi

  # Clippy (Rust)
  if has_file "Cargo.toml"; then
    DETECTED_LINTER="clippy"
    return
  fi

  # Rubocop
  if has_file ".rubocop.yml"; then
    DETECTED_LINTER="rubocop"
    return
  fi

  DETECTED_LINTER="None detected"
}

detect_deployment() {
  if has_file "vercel.json"; then
    DETECTED_DEPLOYMENT="Vercel"
    return
  fi

  if has_file "fly.toml"; then
    DETECTED_DEPLOYMENT="Fly.io"
    return
  fi

  if has_file "serverless.yml" || has_file "serverless.yaml"; then
    DETECTED_DEPLOYMENT="Serverless Framework"
    return
  fi

  if has_file "app.yaml"; then
    DETECTED_DEPLOYMENT="Google App Engine"
    return
  fi

  # GitHub Actions deploy
  if has_dir ".github/workflows"; then
    if grep -rl "deploy" "${TARGET_DIR}/.github/workflows/" > /dev/null 2>&1; then
      DETECTED_DEPLOYMENT="GitHub Actions deploy"
    fi
  fi

  if has_file "docker-compose.yml" || has_file "docker-compose.yaml"; then
    DETECTED_DEPLOYMENT="${DETECTED_DEPLOYMENT:+${DETECTED_DEPLOYMENT} + }Docker Compose"
  elif has_file "Dockerfile"; then
    DETECTED_DEPLOYMENT="${DETECTED_DEPLOYMENT:+${DETECTED_DEPLOYMENT} + }Docker"
  fi

  if [[ -z "${DETECTED_DEPLOYMENT}" ]]; then
    DETECTED_DEPLOYMENT="None detected"
  fi
}

# --- Command Inference -----------------------------------------------------

infer_commands() {
  local pm="${DETECTED_PKG_MANAGER}"

  # Helper to get run command prefix based on package manager
  local run_prefix=""
  case "${pm}" in
    npm)    run_prefix="npm run" ;;
    yarn)   run_prefix="yarn" ;;
    pnpm)   run_prefix="pnpm" ;;
    bun)    run_prefix="bun run" ;;
    *)      run_prefix="" ;;
  esac

  # Dev command
  if [[ -n "${run_prefix}" ]] && pkg_json_script "dev"; then
    CMD_DEV="${run_prefix} dev"
  elif [[ "${DETECTED_FRAMEWORK}" == "Django" ]]; then
    CMD_DEV="python manage.py runserver"
  elif [[ "${DETECTED_FRAMEWORK}" == "FastAPI" ]]; then
    CMD_DEV="uvicorn app.main:app --reload"
  elif [[ "${DETECTED_FRAMEWORK}" == "Rails" ]]; then
    CMD_DEV="bin/rails server"
  elif [[ "${DETECTED_LANGUAGE}" == "Go" ]]; then
    CMD_DEV="go run ./cmd/main.go"
  elif [[ "${DETECTED_LANGUAGE}" == "Rust" ]]; then
    CMD_DEV="cargo run"
  fi

  # Test command
  if [[ "${DETECTED_TEST_RUNNER}" == "vitest" ]]; then
    if [[ -n "${run_prefix}" ]] && pkg_json_script "test"; then
      CMD_TEST="${run_prefix} test"
    else
      CMD_TEST="npx vitest run"
    fi
  elif [[ "${DETECTED_TEST_RUNNER}" == "jest" ]]; then
    if [[ -n "${run_prefix}" ]] && pkg_json_script "test"; then
      CMD_TEST="${run_prefix} test"
    else
      CMD_TEST="npx jest"
    fi
  elif [[ "${DETECTED_TEST_RUNNER}" == "pytest" ]]; then
    CMD_TEST="pytest"
  elif [[ "${DETECTED_TEST_RUNNER}" == "go test" ]]; then
    CMD_TEST="go test ./..."
  elif [[ "${DETECTED_TEST_RUNNER}" == "cargo test" ]]; then
    CMD_TEST="cargo test"
  elif [[ "${DETECTED_TEST_RUNNER}" == "rspec" ]]; then
    CMD_TEST="bundle exec rspec"
  elif [[ -n "${run_prefix}" ]] && pkg_json_script "test"; then
    CMD_TEST="${run_prefix} test"
  fi

  # Build command
  if [[ -n "${run_prefix}" ]] && pkg_json_script "build"; then
    CMD_BUILD="${run_prefix} build"
  elif [[ "${DETECTED_LANGUAGE}" == "Go" ]]; then
    CMD_BUILD="go build -o bin/app ./cmd/main.go"
  elif [[ "${DETECTED_LANGUAGE}" == "Rust" ]]; then
    CMD_BUILD="cargo build --release"
  elif has_file "Dockerfile"; then
    CMD_BUILD="docker build -t app ."
  fi

  # Lint command
  if [[ -n "${run_prefix}" ]] && pkg_json_script "lint"; then
    CMD_LINT="${run_prefix} lint"
  elif [[ "${DETECTED_LINTER}" == "ruff" ]]; then
    CMD_LINT="ruff check ."
  elif [[ "${DETECTED_LINTER}" == "golangci-lint" ]]; then
    CMD_LINT="golangci-lint run"
  elif [[ "${DETECTED_LINTER}" == "clippy" ]]; then
    CMD_LINT="cargo clippy"
  elif [[ "${DETECTED_LINTER}" == "rubocop" ]]; then
    CMD_LINT="bundle exec rubocop"
  elif [[ "${DETECTED_LINTER}" == "Biome" ]]; then
    CMD_LINT="npx biome check ."
  fi
}

# --- Run All Detection -----------------------------------------------------

run_detection() {
  detect_language
  detect_framework
  detect_package_manager
  detect_test_runner
  detect_database
  detect_linter
  detect_deployment
  infer_commands
}

# --- Output Formats --------------------------------------------------------

format_db() {
  local result=""
  if [[ -n "${DETECTED_DB_ORM}" && -n "${DETECTED_DB_ENGINE}" ]]; then
    result="${DETECTED_DB_ORM} (${DETECTED_DB_ENGINE})"
  elif [[ -n "${DETECTED_DB_ORM}" ]]; then
    result="${DETECTED_DB_ORM}"
  elif [[ -n "${DETECTED_DB_ENGINE}" ]]; then
    result="${DETECTED_DB_ENGINE}"
  else
    result="None detected"
  fi
  echo "${result}"
}

output_detect() {
  local db_display
  db_display="$(format_db)"

  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}${CYAN}STACK DETECTION RESULTS${RESET}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "  ${BOLD}Language:${RESET}     ${GREEN}${DETECTED_LANGUAGE}${RESET}"
  echo -e "  ${BOLD}Framework:${RESET}    ${GREEN}${DETECTED_FRAMEWORK}${RESET}"
  echo -e "  ${BOLD}Package Mgr:${RESET}  ${GREEN}${DETECTED_PKG_MANAGER}${RESET}"
  echo -e "  ${BOLD}Test Runner:${RESET}  ${GREEN}${DETECTED_TEST_RUNNER}${RESET}"
  echo -e "  ${BOLD}Linter:${RESET}       ${GREEN}${DETECTED_LINTER}${RESET}"
  echo -e "  ${BOLD}Database:${RESET}     ${GREEN}${db_display}${RESET}"
  echo -e "  ${BOLD}Deployment:${RESET}   ${GREEN}${DETECTED_DEPLOYMENT}${RESET}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}

output_commands() {
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}${CYAN}DETECTED COMMANDS${RESET}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  if [[ -n "${CMD_DEV}" ]]; then
    echo -e "  ${BOLD}dev:${RESET}   ${YELLOW}${CMD_DEV}${RESET}"
  else
    echo -e "  ${BOLD}dev:${RESET}   ${DIM}(not detected)${RESET}"
  fi
  if [[ -n "${CMD_TEST}" ]]; then
    echo -e "  ${BOLD}test:${RESET}  ${YELLOW}${CMD_TEST}${RESET}"
  else
    echo -e "  ${BOLD}test:${RESET}  ${DIM}(not detected)${RESET}"
  fi
  if [[ -n "${CMD_BUILD}" ]]; then
    echo -e "  ${BOLD}build:${RESET} ${YELLOW}${CMD_BUILD}${RESET}"
  else
    echo -e "  ${BOLD}build:${RESET} ${DIM}(not detected)${RESET}"
  fi
  if [[ -n "${CMD_LINT}" ]]; then
    echo -e "  ${BOLD}lint:${RESET}  ${YELLOW}${CMD_LINT}${RESET}"
  else
    echo -e "  ${BOLD}lint:${RESET}  ${DIM}(not detected)${RESET}"
  fi
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}

json_escape() {
  local str="$1"
  str="${str//\\/\\\\}"
  str="${str//\"/\\\"}"
  echo "${str}"
}

output_json() {
  local lang framework pm test_runner linter deployment
  local db_orm db_engine
  local dev test build lint

  lang="$(json_escape "${DETECTED_LANGUAGE}")"
  framework="$(json_escape "${DETECTED_FRAMEWORK}")"
  pm="$(json_escape "${DETECTED_PKG_MANAGER}")"
  test_runner="$(json_escape "${DETECTED_TEST_RUNNER}")"
  linter="$(json_escape "${DETECTED_LINTER}")"
  deployment="$(json_escape "${DETECTED_DEPLOYMENT}")"
  db_orm="$(json_escape "${DETECTED_DB_ORM}")"
  db_engine="$(json_escape "${DETECTED_DB_ENGINE}")"
  dev="$(json_escape "${CMD_DEV}")"
  test="$(json_escape "${CMD_TEST}")"
  build="$(json_escape "${CMD_BUILD}")"
  lint="$(json_escape "${CMD_LINT}")"

  # Normalize values to lowercase for JSON keys
  local lang_lower framework_lower pm_lower test_lower linter_lower deploy_lower
  lang_lower="$(echo "${lang}" | tr '[:upper:]' '[:lower:]' | tr '/' '-')"
  framework_lower="$(echo "${framework}" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr '/' '-')"
  pm_lower="$(echo "${pm}" | tr '[:upper:]' '[:lower:]')"
  test_lower="$(echo "${test_runner}" | tr '[:upper:]' '[:lower:]')"
  linter_lower="$(echo "${linter}" | tr '[:upper:]' '[:lower:]')"
  deploy_lower="$(echo "${deployment}" | tr '[:upper:]' '[:lower:]')"

  local db_json
  if [[ -n "${db_orm}" && -n "${db_engine}" ]]; then
    db_json="{ \"orm\": \"${db_orm}\", \"engine\": \"$(echo "${db_engine}" | tr '[:upper:]' '[:lower:]')\" }"
  elif [[ -n "${db_orm}" ]]; then
    db_json="{ \"orm\": \"${db_orm}\", \"engine\": null }"
  elif [[ -n "${db_engine}" ]]; then
    db_json="{ \"orm\": null, \"engine\": \"$(echo "${db_engine}" | tr '[:upper:]' '[:lower:]')\" }"
  else
    db_json="null"
  fi

  cat <<ENDJSON
{
  "language": "${lang_lower}",
  "framework": "${framework_lower}",
  "package_manager": "${pm_lower}",
  "test_runner": "${test_lower}",
  "linter": "${linter_lower}",
  "database": ${db_json},
  "deployment": "${deploy_lower}",
  "commands": {
    "dev": "${dev}",
    "test": "${test}",
    "build": "${build}",
    "lint": "${lint}"
  }
}
ENDJSON
}

# --- Usage -----------------------------------------------------------------

usage() {
  echo ""
  echo -e "${BOLD}Usage:${RESET}"
  echo -e "  ${GREEN}./harness/stack-detector.sh${RESET} ${CYAN}detect${RESET}  [project_dir]   # Auto-detect tech stack"
  echo -e "  ${GREEN}./harness/stack-detector.sh${RESET} ${CYAN}commands${RESET} [project_dir]   # Show detected dev/test/build commands"
  echo -e "  ${GREEN}./harness/stack-detector.sh${RESET} ${CYAN}json${RESET}    [project_dir]    # Output as JSON"
  echo ""
  echo -e "${DIM}If project_dir is omitted, the current directory is used.${RESET}"
  echo ""
}

# --- Main ------------------------------------------------------------------

main() {
  local command="${1:-}"
  local target="${2:-$(pwd)}"

  if [[ -z "${command}" ]]; then
    usage
    exit 1
  fi

  # Resolve target directory
  if [[ "${target}" == /* ]]; then
    TARGET_DIR="${target}"
  else
    TARGET_DIR="$(pwd)/${target}"
  fi

  if [[ ! -d "${TARGET_DIR}" ]]; then
    echo -e "${RED}Error: Directory '${TARGET_DIR}' does not exist.${RESET}" >&2
    exit 1
  fi

  run_detection

  case "${command}" in
    detect)
      output_detect
      ;;
    commands)
      output_commands
      ;;
    json)
      output_json
      ;;
    *)
      echo -e "${RED}Error: Unknown command '${command}'${RESET}" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
