#!/usr/bin/env bash
#
# Deployment Orchestration Manager
# Detects, initializes, and manages deployments across multiple platforms.
#
# Usage:
#   ./harness/deploy-manager.sh detect [project_dir]         # Detect deployment config
#   ./harness/deploy-manager.sh init <target> [project_dir]  # Generate deployment config
#   ./harness/deploy-manager.sh preview [project_dir]        # Deploy to preview/staging
#   ./harness/deploy-manager.sh promote [project_dir]        # Promote to production
#   ./harness/deploy-manager.sh status [project_dir]         # Check deployment status
#
# Supported targets: vercel, fly, docker, railway
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
  echo -e "${BOLD}Deployment Orchestration Manager${NC}"
  echo ""
  echo "Usage:"
  echo "  $0 detect [project_dir]          Detect deployment config"
  echo "  $0 init <target> [project_dir]   Generate deployment config"
  echo "  $0 preview [project_dir]         Deploy to preview/staging"
  echo "  $0 promote [project_dir]         Promote to production"
  echo "  $0 status [project_dir]          Check deployment status"
  echo ""
  echo "Supported targets for init:"
  echo "  vercel, fly, docker, railway"
  echo ""
  echo "Examples:"
  echo "  $0 detect ."
  echo "  $0 init docker /path/to/project"
  echo "  $0 preview"
  echo "  $0 promote"
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
# Language Detection (for Dockerfile generation)
# ─────────────────────────────────────────────
detect_language() {
  local dir="$1"

  if [[ -f "${dir}/package.json" ]]; then
    echo "node"
  elif [[ -f "${dir}/pyproject.toml" ]] || [[ -f "${dir}/requirements.txt" ]]; then
    echo "python"
  elif [[ -f "${dir}/go.mod" ]]; then
    echo "go"
  elif [[ -f "${dir}/Cargo.toml" ]]; then
    echo "rust"
  else
    echo "unknown"
  fi
}

# ─────────────────────────────────────────────
# Platform Detection
# ─────────────────────────────────────────────
DETECTED_PLATFORM=""

detect_platform() {
  local dir="$1"
  local platforms=()

  if [[ -f "${dir}/vercel.json" ]]; then
    platforms+=("vercel")
  fi

  if [[ -f "${dir}/fly.toml" ]]; then
    platforms+=("fly")
  fi

  if [[ -f "${dir}/railway.json" ]]; then
    platforms+=("railway")
  fi

  if [[ -f "${dir}/serverless.yml" ]] || [[ -f "${dir}/serverless.yaml" ]]; then
    platforms+=("serverless")
  fi

  if [[ -f "${dir}/docker-compose.yml" ]] || [[ -f "${dir}/docker-compose.yaml" ]]; then
    platforms+=("docker-compose")
  elif [[ -f "${dir}/Dockerfile" ]]; then
    platforms+=("docker")
  fi

  if [[ ${#platforms[@]} -eq 0 ]]; then
    DETECTED_PLATFORM=""
  else
    DETECTED_PLATFORM="${platforms[0]}"
  fi

  # Return all platforms for display
  echo "${platforms[*]}"
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
  echo -e "${BOLD}${CYAN}  Deployment Detection${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  local platforms
  platforms="$(detect_platform "${target_dir}")"

  if [[ -z "${platforms}" ]]; then
    log_warn "No deployment configuration detected."
    echo ""
    echo -e "${DIM}Use '$0 init <target>' to generate one.${NC}"
    echo -e "${DIM}Supported targets: vercel, fly, docker, railway${NC}"
    exit 1
  fi

  echo -e "  ${BOLD}Detected platforms:${NC}"
  for platform in ${platforms}; do
    local config_file=""
    case "${platform}" in
      vercel)         config_file="vercel.json" ;;
      fly)            config_file="fly.toml" ;;
      railway)        config_file="railway.json" ;;
      serverless)     config_file="serverless.yml" ;;
      docker-compose) config_file="docker-compose.yml" ;;
      docker)         config_file="Dockerfile" ;;
    esac
    echo -e "    ${GREEN}${platform}${NC} ${DIM}(${config_file})${NC}"
  done

  echo ""
  echo -e "  ${BOLD}Primary platform:${NC} ${GREEN}${DETECTED_PLATFORM}${NC}"
  echo ""
}

cmd_init() {
  local target="${1:-}"
  local target_dir
  target_dir="$(resolve_dir "${2:-$(pwd)}")"

  if [[ -z "${target}" ]]; then
    log_error "Target platform required."
    echo ""
    echo "Usage: $0 init <target> [project_dir]"
    echo "Targets: vercel, fly, docker, railway"
    exit 1
  fi

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Deployment Init: ${target}${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  local project_name
  project_name="$(basename "${target_dir}")"

  case "${target}" in
    vercel)
      _init_vercel "${target_dir}" "${project_name}"
      ;;
    fly)
      _init_fly "${target_dir}" "${project_name}"
      ;;
    docker)
      _init_docker "${target_dir}" "${project_name}"
      ;;
    railway)
      _init_railway "${target_dir}" "${project_name}"
      ;;
    *)
      log_error "Unknown target: ${target}"
      echo "Supported targets: vercel, fly, docker, railway"
      exit 1
      ;;
  esac

  echo ""
  log_success "Deployment config generated for ${target}."
  echo -e "${DIM}Review the generated files and adjust as needed.${NC}"
}

_init_vercel() {
  local dir="$1"
  local name="$2"
  local config_file="${dir}/vercel.json"

  if [[ -f "${config_file}" ]]; then
    log_warn "vercel.json already exists. Backing up to vercel.json.bak"
    cp "${config_file}" "${config_file}.bak"
  fi

  cat > "${config_file}" << VEOF
{
  "\$schema": "https://openapi.vercel.sh/vercel.json",
  "projectSettings": {
    "framework": null
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
VEOF

  log_success "Created vercel.json"
}

_init_fly() {
  local dir="$1"
  local name="$2"
  local config_file="${dir}/fly.toml"

  if [[ -f "${config_file}" ]]; then
    log_warn "fly.toml already exists. Backing up to fly.toml.bak"
    cp "${config_file}" "${config_file}.bak"
  fi

  local internal_port="8080"
  if [[ -f "${dir}/package.json" ]]; then
    internal_port="3000"
  elif [[ -f "${dir}/pyproject.toml" ]] || [[ -f "${dir}/manage.py" ]]; then
    internal_port="8000"
  fi

  cat > "${config_file}" << FEOF
app = "${name}"
primary_region = "iad"

[build]

[http_service]
  internal_port = ${internal_port}
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[checks]
  [checks.health]
    type = "http"
    port = ${internal_port}
    path = "/health"
    interval = "15s"
    timeout = "5s"
FEOF

  log_success "Created fly.toml"
}

_init_docker() {
  local dir="$1"
  local name="$2"
  local lang
  lang="$(detect_language "${dir}")"

  # Create Dockerfile
  local dockerfile="${dir}/Dockerfile"
  if [[ -f "${dockerfile}" ]]; then
    log_warn "Dockerfile already exists. Backing up to Dockerfile.bak"
    cp "${dockerfile}" "${dockerfile}.bak"
  fi

  case "${lang}" in
    node)
      cat > "${dockerfile}" << 'DEOF'
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Build
FROM base AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
DEOF
      ;;
    python)
      cat > "${dockerfile}" << 'DEOF'
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements*.txt pyproject.toml* ./
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null \
    || pip install --no-cache-dir .

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
DEOF
      ;;
    go)
      cat > "${dockerfile}" << 'DEOF'
FROM golang:1.22-alpine AS build

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/app ./cmd/main.go

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
COPY --from=build /bin/app /bin/app

EXPOSE 8080
CMD ["/bin/app"]
DEOF
      ;;
    rust)
      cat > "${dockerfile}" << 'DEOF'
FROM rust:1.77-slim AS build

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/release/app /usr/local/bin/app

EXPOSE 8080
CMD ["app"]
DEOF
      ;;
    *)
      cat > "${dockerfile}" << 'DEOF'
FROM ubuntu:22.04

WORKDIR /app
COPY . .

EXPOSE 8080
CMD ["./start.sh"]
DEOF
      ;;
  esac

  log_success "Created Dockerfile (${lang})"

  # Create docker-compose.yml
  local compose_file="${dir}/docker-compose.yml"
  if [[ -f "${compose_file}" ]]; then
    log_warn "docker-compose.yml already exists. Skipping."
  else
    local port="8080"
    [[ "${lang}" == "node" ]] && port="3000"
    [[ "${lang}" == "python" ]] && port="8000"

    cat > "${compose_file}" << CEOF
version: "3.8"

services:
  app:
    build: .
    ports:
      - "${port}:${port}"
    env_file:
      - .env
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ${name}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
CEOF

    log_success "Created docker-compose.yml"
  fi
}

_init_railway() {
  local dir="$1"
  local name="$2"
  local config_file="${dir}/railway.json"

  if [[ -f "${config_file}" ]]; then
    log_warn "railway.json already exists. Backing up to railway.json.bak"
    cp "${config_file}" "${config_file}.bak"
  fi

  cat > "${config_file}" << REOF
{
  "\$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
REOF

  log_success "Created railway.json"
}

cmd_preview() {

  # requireConfirmation check (deploy or deploy:preview)
  # Fail-safe: default to requiring confirmation. Only skip if config explicitly says so.
  local CONFIG_FILE="$SCRIPT_DIR/harness.config.json"
  local NEEDS_CONFIRM=true
  if [ -f "$CONFIG_FILE" ]; then
    if command -v jq &>/dev/null; then
      if ! jq -e '.restrictions.requireConfirmation | map(select(. == "deploy" or . == "deploy:preview")) | length > 0' "$CONFIG_FILE" &>/dev/null; then
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
      echo -e "${RED}[safety] Preview deployment requires confirmation.${NC}"
      echo -e "The user must confirm this operation first."
      echo -e "Then run with --confirm flag: $0 preview --confirm"
      return 1
    fi
  fi

  local target_dir
  target_dir="$(resolve_dir "${1:-$(pwd)}")"

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  detect_platform "${target_dir}" > /dev/null

  if [[ -z "${DETECTED_PLATFORM}" ]]; then
    log_error "No deployment platform detected. Run '$0 init <target>' first."
    exit 1
  fi

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Preview Deploy (${DETECTED_PLATFORM})${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  cd "${target_dir}"

  case "${DETECTED_PLATFORM}" in
    vercel)
      log_info "Running: vercel deploy"
      if command -v vercel &>/dev/null; then
        vercel deploy
      else
        log_error "Vercel CLI not installed. Run: npm i -g vercel"
        exit 1
      fi
      ;;
    fly)
      log_info "Running: fly deploy --staging"
      if command -v fly &>/dev/null; then
        fly deploy
      elif command -v flyctl &>/dev/null; then
        flyctl deploy
      else
        log_error "Fly CLI not installed. See: https://fly.io/docs/hands-on/install-flyctl/"
        exit 1
      fi
      ;;
    docker|docker-compose)
      log_info "Running: docker compose up --build -d"
      docker compose up --build -d
      ;;
    railway)
      log_info "Running: railway up"
      if command -v railway &>/dev/null; then
        railway up
      else
        log_error "Railway CLI not installed. Run: npm i -g @railway/cli"
        exit 1
      fi
      ;;
    serverless)
      log_info "Running: npx serverless deploy --stage dev"
      npx serverless deploy --stage dev
      ;;
    *)
      log_error "Preview deploy not supported for: ${DETECTED_PLATFORM}"
      exit 1
      ;;
  esac

  log_success "Preview deployment complete."
}

cmd_promote() {

  # requireConfirmation check (internal safety net — agent should already have user confirmation)
  # Fail-safe: default to requiring confirmation. Only skip if config explicitly says so.
  local CONFIG_FILE="$SCRIPT_DIR/harness.config.json"
  local NEEDS_CONFIRM=true
  if [ -f "$CONFIG_FILE" ]; then
    if command -v jq &>/dev/null; then
      if ! jq -e '.restrictions.requireConfirmation | map(select(. == "deploy" or . == "deploy:promote")) | length > 0' "$CONFIG_FILE" &>/dev/null; then
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
      echo -e "${RED}[safety] Production deployment requires confirmation.${NC}"
      echo -e "The user must confirm this operation first."
      echo -e "Then run with --confirm flag: $0 promote --confirm"
      return 1
    fi
  fi

  local target_dir
  target_dir="$(resolve_dir "${1:-$(pwd)}")"

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  detect_platform "${target_dir}" > /dev/null

  if [[ -z "${DETECTED_PLATFORM}" ]]; then
    log_error "No deployment platform detected. Run '$0 init <target>' first."
    exit 1
  fi

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Production Deploy (${DETECTED_PLATFORM})${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  echo -e "${YELLOW}Promoting to production...${NC}"

  cd "${target_dir}"

  case "${DETECTED_PLATFORM}" in
    vercel)
      log_info "Running: vercel deploy --prod"
      if command -v vercel &>/dev/null; then
        vercel deploy --prod
      else
        log_error "Vercel CLI not installed. Run: npm i -g vercel"
        exit 1
      fi
      ;;
    fly)
      log_info "Running: fly deploy --strategy rolling"
      if command -v fly &>/dev/null; then
        fly deploy --strategy rolling
      elif command -v flyctl &>/dev/null; then
        flyctl deploy --strategy rolling
      else
        log_error "Fly CLI not installed. See: https://fly.io/docs/hands-on/install-flyctl/"
        exit 1
      fi
      ;;
    docker|docker-compose)
      log_info "Running: docker compose -f docker-compose.yml up --build -d"
      docker compose -f docker-compose.yml up --build -d
      ;;
    railway)
      log_info "Running: railway up --detach"
      if command -v railway &>/dev/null; then
        railway up --detach
      else
        log_error "Railway CLI not installed. Run: npm i -g @railway/cli"
        exit 1
      fi
      ;;
    serverless)
      log_info "Running: npx serverless deploy --stage prod"
      npx serverless deploy --stage prod
      ;;
    *)
      log_error "Production deploy not supported for: ${DETECTED_PLATFORM}"
      exit 1
      ;;
  esac

  log_success "Production deployment complete."
}

cmd_status() {
  local target_dir
  target_dir="$(resolve_dir "${1:-$(pwd)}")"

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  detect_platform "${target_dir}" > /dev/null

  if [[ -z "${DETECTED_PLATFORM}" ]]; then
    log_error "No deployment platform detected."
    exit 1
  fi

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Deployment Status (${DETECTED_PLATFORM})${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""

  cd "${target_dir}"

  case "${DETECTED_PLATFORM}" in
    vercel)
      if command -v vercel &>/dev/null; then
        log_info "Checking Vercel deployment status..."
        vercel ls 2>/dev/null | head -10 || log_warn "Could not retrieve Vercel status."
      else
        log_warn "Vercel CLI not installed."
      fi
      ;;
    fly)
      if command -v fly &>/dev/null; then
        log_info "Checking Fly.io status..."
        fly status
      elif command -v flyctl &>/dev/null; then
        flyctl status
      else
        log_warn "Fly CLI not installed."
      fi
      ;;
    docker|docker-compose)
      log_info "Checking Docker container status..."
      docker compose ps 2>/dev/null || docker ps 2>/dev/null || log_warn "Docker not available."
      ;;
    railway)
      if command -v railway &>/dev/null; then
        log_info "Checking Railway status..."
        railway status
      else
        log_warn "Railway CLI not installed."
      fi
      ;;
    serverless)
      log_info "Checking Serverless deployment..."
      npx serverless info 2>/dev/null || log_warn "Could not retrieve Serverless status."
      ;;
    *)
      log_warn "Status check not supported for: ${DETECTED_PLATFORM}"
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
  init)    cmd_init "$@" ;;
  preview) cmd_preview "$@" ;;
  promote) cmd_promote "$@" ;;
  status)  cmd_status "$@" ;;
  help|--help|-h) usage ;;
  *)
    log_error "Unknown command: ${COMMAND}"
    usage
    exit 1
    ;;
esac
