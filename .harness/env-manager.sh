#!/usr/bin/env bash
#
# Environment & Secrets Manager
# Manages .env files, validates required variables, and generates
# stack-specific environment templates.
#
# Usage:
#   ./harness/env-manager.sh init [project_dir]     # Create .env and .env.example
#   ./harness/env-manager.sh check [project_dir]    # Validate required env vars are set
#   ./harness/env-manager.sh template [stack]        # Show .env template for a stack
#
# Supported stacks: nextjs, fastapi, django, go, generic
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
  echo -e "${BOLD}Environment & Secrets Manager${NC}"
  echo ""
  echo "Usage:"
  echo "  $0 init [project_dir]      Create .env and .env.example"
  echo "  $0 check [project_dir]     Validate required env vars are set"
  echo "  $0 template [stack]        Show .env template for a stack"
  echo "  $0 discover [dir] [root]   Find reusable secrets from sibling projects"
  echo ""
  echo "Supported stacks:"
  echo "  nextjs, fastapi, django, go, generic"
  echo ""
  echo "Examples:"
  echo "  $0 init ."
  echo "  $0 check /path/to/project"
  echo "  $0 template nextjs"
}

resolve_dir() {
  local dir="${1:-$(pwd)}"
  if [[ "${dir}" == /* ]]; then
    echo "${dir}"
  else
    echo "$(pwd)/${dir}"
  fi
}

# ─────────────────────────────────────────────
# Stack Detection
# ─────────────────────────────────────────────
detect_stack() {
  local dir="$1"

  # Next.js
  if find "${dir}" -maxdepth 1 -name "next.config.*" -print -quit 2>/dev/null | grep -q .; then
    echo "nextjs"
    return
  fi

  # FastAPI
  if [[ -f "${dir}/pyproject.toml" ]] && grep -qi "fastapi" "${dir}/pyproject.toml" 2>/dev/null; then
    echo "fastapi"
    return
  fi
  if [[ -f "${dir}/requirements.txt" ]] && grep -qi "fastapi" "${dir}/requirements.txt" 2>/dev/null; then
    echo "fastapi"
    return
  fi

  # Django
  if [[ -f "${dir}/manage.py" ]]; then
    echo "django"
    return
  fi

  # Go
  if [[ -f "${dir}/go.mod" ]]; then
    echo "go"
    return
  fi

  # Generic fallback
  echo "generic"
}

# ─────────────────────────────────────────────
# Template Generators
# ─────────────────────────────────────────────
template_common() {
  cat << 'ENVEOF'
# ─────────────────────────────────────────────
# Common
# ─────────────────────────────────────────────
PORT=3000
LOG_LEVEL=info
ENVEOF
}

template_nextjs() {
  cat << 'ENVEOF'
# ─────────────────────────────────────────────
# Next.js
# ─────────────────────────────────────────────
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Public (exposed to browser)
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Auth
NEXTAUTH_SECRET=change-me-to-a-random-secret
NEXTAUTH_URL=http://localhost:3000
ENVEOF
}

template_fastapi() {
  cat << 'ENVEOF'
# ─────────────────────────────────────────────
# FastAPI
# ─────────────────────────────────────────────
PYTHON_ENV=development
PORT=8000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Security
SECRET_KEY=change-me-to-a-random-secret

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Debug
DEBUG=true
ENVEOF
}

template_django() {
  cat << 'ENVEOF'
# ─────────────────────────────────────────────
# Django
# ─────────────────────────────────────────────
PYTHON_ENV=development
PORT=8000
LOG_LEVEL=info

# Security
DJANGO_SECRET_KEY=change-me-to-a-random-secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Hosts
ALLOWED_HOSTS=localhost,127.0.0.1

# Debug
DEBUG=true
ENVEOF
}

template_go() {
  cat << 'ENVEOF'
# ─────────────────────────────────────────────
# Go
# ─────────────────────────────────────────────
PORT=8080
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Gin mode (debug | release | test)
GIN_MODE=debug
ENVEOF
}

template_generic() {
  cat << 'ENVEOF'
# ─────────────────────────────────────────────
# Generic
# ─────────────────────────────────────────────
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# API
API_KEY=change-me
ENVEOF
}

get_template() {
  local stack="$1"
  case "${stack}" in
    nextjs)   template_nextjs ;;
    fastapi)  template_fastapi ;;
    django)   template_django ;;
    go)       template_go ;;
    generic)  template_generic ;;
    *)
      log_error "Unknown stack: ${stack}"
      echo "Supported stacks: nextjs, fastapi, django, go, generic"
      exit 1
      ;;
  esac
}

# ─────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────

cmd_init() {
  local target_dir
  target_dir="$(resolve_dir "${1:-$(pwd)}")"

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Environment Init${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  # Detect stack
  local stack
  stack="$(detect_stack "${target_dir}")"
  log_info "Detected stack: ${BOLD}${stack}${NC}"

  # Generate .env.example
  local env_example="${target_dir}/.env.example"
  if [[ -f "${env_example}" ]]; then
    log_warn ".env.example already exists. Backing up to .env.example.bak"
    cp "${env_example}" "${env_example}.bak"
  fi

  get_template "${stack}" > "${env_example}"
  log_success "Created .env.example"

  # Generate .env from .env.example (only if .env does not exist)
  local env_file="${target_dir}/.env"
  if [[ -f "${env_file}" ]]; then
    log_warn ".env already exists. Skipping (will not overwrite)."
  else
    cp "${env_example}" "${env_file}"
    log_success "Created .env from .env.example"
  fi

  # Ensure .env is in .gitignore
  local gitignore="${target_dir}/.gitignore"
  if [[ -f "${gitignore}" ]]; then
    if ! grep -qx '.env' "${gitignore}" 2>/dev/null; then
      echo "" >> "${gitignore}"
      echo "# Environment secrets" >> "${gitignore}"
      echo ".env" >> "${gitignore}"
      echo ".env.local" >> "${gitignore}"
      echo ".env.*.local" >> "${gitignore}"
      log_success "Added .env to existing .gitignore"
    else
      log_info ".env already in .gitignore"
    fi
  else
    cat > "${gitignore}" << 'GIEOF'
# Environment secrets
.env
.env.local
.env.*.local
GIEOF
    log_success "Created .gitignore with .env entries"
  fi

  echo ""
  echo -e "${GREEN}Environment initialized for ${BOLD}${stack}${NC}${GREEN} stack.${NC}"
  echo -e "${DIM}Edit .env with your actual values before running the project.${NC}"
}

cmd_check() {
  local target_dir
  target_dir="$(resolve_dir "${1:-$(pwd)}")"

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  local env_file="${target_dir}/.env"
  local env_example="${target_dir}/.env.example"

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Environment Check${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  if [[ ! -f "${env_example}" ]]; then
    log_error ".env.example not found at ${target_dir}"
    echo -e "${DIM}Run '$0 init' first to create it.${NC}"
    exit 1
  fi

  if [[ ! -f "${env_file}" ]]; then
    log_error ".env not found at ${target_dir}"
    echo -e "${DIM}Run '$0 init' first to create it.${NC}"
    exit 1
  fi

  # Extract variable names from .env.example (skip comments and blank lines)
  local missing=0
  local present=0
  local total=0

  while IFS= read -r line; do
    # Skip comments and blank lines
    [[ -z "${line}" ]] && continue
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue

    # Extract variable name (everything before the = sign)
    local var_name
    var_name="$(echo "${line}" | cut -d'=' -f1 | xargs)"
    [[ -z "${var_name}" ]] && continue

    total=$((total + 1))

    # Check if the variable exists in .env
    if grep -q "^${var_name}=" "${env_file}" 2>/dev/null; then
      # Check if the value is non-empty
      local value
      value="$(grep "^${var_name}=" "${env_file}" | cut -d'=' -f2-)"
      if [[ -z "${value}" ]]; then
        log_warn "${var_name} is set but empty"
        missing=$((missing + 1))
      else
        log_success "${var_name}"
        present=$((present + 1))
      fi
    else
      log_error "${var_name} is MISSING"
      missing=$((missing + 1))
    fi
  done < "${env_example}"

  echo ""
  echo -e "${BOLD}${CYAN}───────────────────────────────────────────${NC}"
  echo -e "  Total: ${total}  Present: ${GREEN}${present}${NC}  Missing: ${RED}${missing}${NC}"
  echo -e "${BOLD}${CYAN}───────────────────────────────────────────${NC}"

  if [[ "${missing}" -gt 0 ]]; then
    echo ""
    log_warn "Some required variables are missing or empty."
    echo -e "${DIM}Compare .env against .env.example and fill in missing values.${NC}"
    exit 1
  else
    echo ""
    log_success "All environment variables are set."
  fi
}

cmd_template() {
  local stack="${1:-generic}"

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Environment Template: ${stack}${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  get_template "${stack}"
}

# ─────────────────────────────────────────────
# Main dispatch
# ─────────────────────────────────────────────
cmd_discover() {
  local target_dir
  target_dir="$(resolve_dir "${1:-$(pwd)}")"
  local search_root="${2:-$(dirname "$target_dir")}"

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Secret Discovery${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  Target: ${target_dir}"
  echo -e "  Searching in: ${search_root}"
  echo ""

  local found=0
  local discovered_vars=""

  # Scan all sibling project .env files
  for env_file in "${search_root}"/*/.env "${search_root}"/*/.env.local "${search_root}"/*/*/.env "${search_root}"/*/*/.env.local; do
    [ -f "$env_file" ] || continue
    # Skip target project itself
    case "$env_file" in "${target_dir}"*) continue ;; esac

    local project_name
    project_name=$(basename "$(dirname "$env_file")")

    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      [[ "$line" =~ ^[[:space:]]*# ]] && continue

      local var_name
      var_name=$(echo "$line" | cut -d"=" -f1 | xargs)
      [[ -z "$var_name" ]] && continue

      # Check for known reusable secrets
      case "$var_name" in
        SLACK_BOT_TOKEN|SLACK_WEBHOOK_URL|NOTION_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)
          local value
          value=$(echo "$line" | cut -d"=" -f2-)
          if [ -n "$value" ]; then
            echo -e "${GREEN}  ✓ ${var_name}${NC} — from ${DIM}${project_name}${NC}"
            discovered_vars="${discovered_vars}${var_name}=${value}n"
            found=$((found + 1))
          fi
          ;;
        *_API_KEY|*_TOKEN|*_SECRET)
          local value
          value=$(echo "$line" | cut -d"=" -f2-)
          if [ -n "$value" ]; then
            echo -e "${CYAN}  ? ${var_name}${NC} — from ${DIM}${project_name}${NC} (may be project-specific)"
            found=$((found + 1))
          fi
          ;;
      esac
    done < "$env_file"
  done

  echo ""
  if [ "$found" -gt 0 ]; then
    log_success "Discovered ${found} secret(s) from sibling projects"
    echo ""
    echo -e "${YELLOW}To apply discovered secrets, add them to your .env or .env.local:${NC}"
    echo -e "${DIM}$(echo -e "$discovered_vars")${NC}"
  else
    log_warn "No reusable secrets found in sibling projects"
  fi
}

COMMAND="${1:-help}"
shift || true

case "${COMMAND}" in
  init)     cmd_init "$@" ;;
  check)    cmd_check "$@" ;;
  template) cmd_template "$@" ;;
  discover) cmd_discover "$@" ;;
  help|--help|-h) usage ;;
  *)
    log_error "Unknown command: ${COMMAND}"
    usage
    exit 1
    ;;
esac
