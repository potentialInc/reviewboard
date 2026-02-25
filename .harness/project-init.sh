#!/usr/bin/env bash
#
# Project Initializer
# Bootstraps a new project from a template or installs the harness
# into an existing project with auto-detection.
#
# Usage:
#   ./harness/project-init.sh --template <name> --name <project_name>  # Init from template
#   ./harness/project-init.sh --detect [project_dir]                    # Init for existing project
#
# Templates: nextjs, fastapi, django, go-api, react-vite, expo, monorepo, rust-axum, generic
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_ROOT="$(dirname "$SCRIPT_DIR")"

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
  echo -e "${BOLD}Project Initializer${NC}"
  echo ""
  echo "Usage:"
  echo "  $0 --template <name> --name <project_name>   Init from template"
  echo "  $0 --detect [project_dir]                     Init for existing project"
  echo ""
  echo "Templates:"
  echo "  nextjs, fastapi, django, go-api, react-vite,"
  echo "  expo, monorepo, rust-axum, generic"
  echo ""
  echo "Examples:"
  echo "  $0 --template nextjs --name my-app"
  echo "  $0 --template fastapi --name my-api"
  echo "  $0 --detect /path/to/existing-project"
  echo "  $0 --detect ."
}

VALID_TEMPLATES=(
  "nextjs"
  "fastapi"
  "django"
  "go-api"
  "react-vite"
  "expo"
  "monorepo"
  "rust-axum"
  "generic"
)

is_valid_template() {
  local name="$1"
  for t in "${VALID_TEMPLATES[@]}"; do
    [[ "${t}" == "${name}" ]] && return 0
  done
  return 1
}

# ─────────────────────────────────────────────
# Stack Detection (for --detect mode)
# ─────────────────────────────────────────────
detect_stack() {
  local dir="$1"

  # Next.js
  if find "${dir}" -maxdepth 1 -name "next.config.*" -print -quit 2>/dev/null | grep -q .; then
    echo "nextjs"
    return
  fi

  # Monorepo
  if [[ -f "${dir}/turbo.json" ]] || [[ -f "${dir}/nx.json" ]] || [[ -f "${dir}/pnpm-workspace.yaml" ]]; then
    echo "monorepo"
    return
  fi

  # Expo
  if [[ -f "${dir}/package.json" ]] && grep -q '"expo"' "${dir}/package.json" 2>/dev/null; then
    echo "expo"
    return
  fi

  # React + Vite
  if find "${dir}" -maxdepth 1 -name "vite.config.*" -print -quit 2>/dev/null | grep -q . && [[ -f "${dir}/package.json" ]] && grep -q '"react"' "${dir}/package.json" 2>/dev/null; then
    echo "react-vite"
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
    echo "go-api"
    return
  fi

  # Rust (Axum)
  if [[ -f "${dir}/Cargo.toml" ]]; then
    echo "rust-axum"
    return
  fi

  echo "generic"
}

# ─────────────────────────────────────────────
# Core: Copy harness directories
# ─────────────────────────────────────────────
copy_harness_dirs() {
  local target_dir="$1"

  local dirs_to_copy=(
    "architecture"
    "hooks"
    "agents"
    "skills"
    "docs"
    "prd"
  )

  for dir in "${dirs_to_copy[@]}"; do
    local src="${HARNESS_ROOT}/${dir}"
    local dest="${target_dir}/${dir}"

    if [[ ! -d "${src}" ]]; then
      log_warn "Source directory not found, skipping: ${dir}/"
      continue
    fi

    if [[ -d "${dest}" ]]; then
      log_warn "Directory already exists, merging: ${dir}/"
    fi

    mkdir -p "${dest}"
    cp -R "${src}/." "${dest}/"
    log_success "Copied ${dir}/"
  done
}

# ─────────────────────────────────────────────
# Core: Generate CLAUDE.md
# ─────────────────────────────────────────────
generate_claude_md() {
  local target_dir="$1"
  local project_name="$2"
  local template_name="$3"

  local template_file="${HARNESS_ROOT}/templates/claude.template.md"
  local dest="${target_dir}/CLAUDE.md"

  if [[ ! -f "${template_file}" ]]; then
    log_warn "Template not found: ${template_file}. Skipping CLAUDE.md generation."
    return
  fi

  if [[ -f "${dest}" ]]; then
    log_warn "CLAUDE.md already exists. Backing up to CLAUDE.md.bak"
    cp "${dest}" "${dest}.bak"
  fi

  # Get default commands from stack-map.json if available
  local dev_cmd="" test_cmd="" build_cmd="" lint_cmd=""
  local stack_map="${HARNESS_ROOT}/templates/stack-map.json"

  # Map template names to stack-map keys
  local stack_key="${template_name}"
  [[ "${template_name}" == "expo" ]] && stack_key="expo"
  [[ "${template_name}" == "mobile-expo" ]] && stack_key="expo"

  if [[ -f "${stack_map}" ]]; then
    # Use grep-based parsing (no jq dependency)
    # Extract commands section for the matching stack
    local in_stack=false
    local in_commands=false
    while IFS= read -r line; do
      if echo "${line}" | grep -q "\"${stack_key}\""; then
        in_stack=true
      fi
      if [[ "${in_stack}" == true ]] && echo "${line}" | grep -q '"commands"'; then
        in_commands=true
      fi
      if [[ "${in_commands}" == true ]]; then
        if echo "${line}" | grep -q '"dev"'; then
          dev_cmd="$(echo "${line}" | sed 's/.*"dev"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/')"
        elif echo "${line}" | grep -q '"test"'; then
          test_cmd="$(echo "${line}" | sed 's/.*"test"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/')"
        elif echo "${line}" | grep -q '"build"'; then
          build_cmd="$(echo "${line}" | sed 's/.*"build"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/')"
        elif echo "${line}" | grep -q '"lint"'; then
          lint_cmd="$(echo "${line}" | sed 's/.*"lint"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/')"
        fi
        # End of commands block
        if echo "${line}" | grep -q '}' && [[ "${in_commands}" == true ]] && [[ -n "${dev_cmd}" || -n "${lint_cmd}" ]]; then
          break
        fi
      fi
    done < "${stack_map}"
  fi

  # Fallback defaults
  [[ -z "${dev_cmd}" ]] && dev_cmd="npm run dev"
  [[ -z "${test_cmd}" ]] && test_cmd="npm test"
  [[ -z "${build_cmd}" ]] && build_cmd="npm run build"
  [[ -z "${lint_cmd}" ]] && lint_cmd="npm run lint"

  local description="Agent-managed ${template_name} project."

  sed \
    -e "s|{PROJECT_NAME}|${project_name}|g" \
    -e "s|{PROJECT_DESCRIPTION}|${description}|g" \
    -e "s|{DEV_COMMAND}|${dev_cmd}|g" \
    -e "s|{TEST_COMMAND}|${test_cmd}|g" \
    -e "s|{LINT_COMMAND}|${lint_cmd}|g" \
    -e "s|{BUILD_COMMAND}|${build_cmd}|g" \
    "${template_file}" > "${dest}"

  log_success "Generated CLAUDE.md"
}

# ─────────────────────────────────────────────
# Core: Create memory directory
# ─────────────────────────────────────────────
create_memory_dir() {
  local target_dir="$1"
  local memory_dir="${target_dir}/memory"

  mkdir -p "${memory_dir}"

  local files=("DECISIONS.md" "PATTERNS.md" "MISTAKES.md" "PROGRESS.md")

  for file in "${files[@]}"; do
    local filepath="${memory_dir}/${file}"
    if [[ ! -f "${filepath}" ]]; then
      local title
      title="$(echo "${file}" | sed 's/\.md//' | tr '[:upper:]' '[:lower:]')"
      local capitalized
      capitalized="$(echo "${title}" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')"
      echo "# ${capitalized}" > "${filepath}"
      echo "" >> "${filepath}"
    fi
  done

  log_success "Created memory/ directory with empty tracking files"
}

# ─────────────────────────────────────────────
# Core: Make .sh files executable
# ─────────────────────────────────────────────
make_scripts_executable() {
  local target_dir="$1"
  local count=0

  while IFS= read -r -d '' sh_file; do
    chmod +x "${sh_file}"
    count=$((count + 1))
  done < <(find "${target_dir}" -name "*.sh" -type f -print0)

  log_success "Made ${count} .sh files executable"
}

# ─────────────────────────────────────────────
# Core: Add .gitignore entries
# ─────────────────────────────────────────────
setup_gitignore() {
  local target_dir="$1"
  local gitignore="${target_dir}/.gitignore"

  local harness_entries=(
    ""
    "# Claude Harness artifacts"
    ".worktree-logs/"
    ".claude-worktrees/"
    ".claude-task"
    ".env"
    ".env.local"
    ".env.*.local"
  )

  if [[ -f "${gitignore}" ]]; then
    # Check if harness entries already exist
    if grep -q "Claude Harness artifacts" "${gitignore}" 2>/dev/null; then
      log_info ".gitignore already has harness entries"
      return
    fi

    # Append harness entries
    for entry in "${harness_entries[@]}"; do
      echo "${entry}" >> "${gitignore}"
    done
    log_success "Added harness entries to existing .gitignore"
  else
    for entry in "${harness_entries[@]}"; do
      echo "${entry}" >> "${gitignore}"
    done
    log_success "Created .gitignore with harness entries"
  fi
}

# ─────────────────────────────────────────────
# Core: Print next steps
# ─────────────────────────────────────────────
print_next_steps() {
  local target_dir="$1"
  local template_name="$2"

  echo ""
  echo -e "${BOLD}${GREEN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${GREEN}  Project initialized!${NC}"
  echo -e "${BOLD}${GREEN}═══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${BOLD}Directory:${NC} ${target_dir}"
  echo -e "  ${BOLD}Template:${NC}  ${template_name}"
  echo ""
  echo "  Next steps:"
  echo "    1. Review CLAUDE.md and adjust commands for your project"
  echo "    2. Review architecture/ARCHITECTURE.md for layer rules"
  echo "    3. Review docs/CONVENTIONS.md for coding standards"
  echo "    4. Run: ./architecture/enforce.sh (to verify setup)"
  echo ""

  # Stack-specific hints
  local init_md="${HARNESS_ROOT}/templates/${template_name}/init.md"
  if [[ -f "${init_md}" ]]; then
    echo -e "  ${DIM}Template-specific guidance: templates/${template_name}/init.md${NC}"
  fi

  echo ""
  echo -e "  ${BOLD}Quick start:${NC}"
  echo -e "    ${CYAN}cd ${target_dir} && claude${NC}"
  echo ""
}

# ─────────────────────────────────────────────
# Mode: --template
# ─────────────────────────────────────────────
mode_template() {
  local template_name="$1"
  local project_name="$2"

  if ! is_valid_template "${template_name}"; then
    log_error "Unknown template: ${template_name}"
    echo ""
    echo "Available templates:"
    for t in "${VALID_TEMPLATES[@]}"; do
      echo "  - ${t}"
    done
    exit 1
  fi

  local target_dir
  target_dir="$(pwd)/${project_name}"

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Project Init: ${template_name}${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""
  log_info "Template:  ${template_name}"
  log_info "Project:   ${project_name}"
  log_info "Directory: ${target_dir}"
  echo ""

  # Create project directory
  if [[ -d "${target_dir}" ]]; then
    log_warn "Directory already exists: ${target_dir}"
    echo -n "Continue and install harness into existing directory? (y/N): "
    read -r confirm
    if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
      log_info "Aborted."
      exit 0
    fi
  else
    mkdir -p "${target_dir}"
    log_success "Created project directory"
  fi

  # Step 1: Copy harness directories
  copy_harness_dirs "${target_dir}"

  # Step 2: Generate CLAUDE.md
  generate_claude_md "${target_dir}" "${project_name}" "${template_name}"

  # Step 3: Create memory directory
  create_memory_dir "${target_dir}"

  # Step 4: Make scripts executable
  make_scripts_executable "${target_dir}"

  # Step 5: Setup .gitignore
  setup_gitignore "${target_dir}"

  # Step 6: Copy template-specific init.md if it exists
  local init_md="${HARNESS_ROOT}/templates/${template_name}/init.md"
  if [[ -f "${init_md}" ]]; then
    mkdir -p "${target_dir}/templates/${template_name}"
    cp "${init_md}" "${target_dir}/templates/${template_name}/init.md"
    log_success "Copied template guide: templates/${template_name}/init.md"
  fi

  # Copy status templates
  local status_dir="${HARNESS_ROOT}/templates/status"
  if [[ -d "${status_dir}" ]]; then
    mkdir -p "${target_dir}/templates/status"
    cp -R "${status_dir}/." "${target_dir}/templates/status/"
    log_success "Copied templates/status/"
  fi

  # Step 7: Create harness.config.json (safeMode: true — safe default for non-developers)
  cat > "${target_dir}/harness.config.json" << 'CONFIGEOF'
{
  "version": "1.0",
  "safeMode": true,
  "restrictions": {
    "maxParallelAgents": 5,
    "autoFixRetries": 3,
    "requireConfirmation": ["deploy", "deploy:preview", "deploy:promote", "db:reset", "db:migrate", "db:seed"]
  },
  "_protectedPathsSource": "architecture/rules.json"
}
CONFIGEOF
  log_success "Created harness.config.json (safeMode: true)"

  # Print next steps
  print_next_steps "${target_dir}" "${template_name}"
}

# ─────────────────────────────────────────────
# Mode: --detect
# ─────────────────────────────────────────────
mode_detect() {
  local target_dir="$1"

  if [[ "${target_dir}" != /* ]]; then
    target_dir="$(pwd)/${target_dir}"
  fi

  if [[ ! -d "${target_dir}" ]]; then
    log_error "Directory does not exist: ${target_dir}"
    exit 1
  fi

  # Resolve to absolute
  target_dir="$(cd "${target_dir}" && pwd)"

  local project_name
  project_name="$(basename "${target_dir}")"

  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  Project Init: Auto-Detect${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
  echo ""
  log_info "Project:   ${project_name}"
  log_info "Directory: ${target_dir}"
  echo ""

  # Detect stack
  local detected_stack
  detected_stack="$(detect_stack "${target_dir}")"
  log_info "Detected stack: ${BOLD}${detected_stack}${NC}"
  echo ""

  # Step 1: Copy harness directories
  copy_harness_dirs "${target_dir}"

  # Step 2: Generate CLAUDE.md
  generate_claude_md "${target_dir}" "${project_name}" "${detected_stack}"

  # Step 3: Create memory directory
  create_memory_dir "${target_dir}"

  # Step 4: Make scripts executable
  make_scripts_executable "${target_dir}"

  # Step 5: Setup .gitignore
  setup_gitignore "${target_dir}"

  # Copy status templates
  local status_dir="${HARNESS_ROOT}/templates/status"
  if [[ -d "${status_dir}" ]]; then
    mkdir -p "${target_dir}/templates/status"
    cp -R "${status_dir}/." "${target_dir}/templates/status/"
    log_success "Copied templates/status/"
  fi

  # Step 6: Create harness.config.json (safeMode: true for existing projects)
  cat > "${target_dir}/harness.config.json" << 'CONFIGEOF'
{
  "version": "1.0",
  "safeMode": true,
  "restrictions": {
    "maxParallelAgents": 5,
    "autoFixRetries": 3,
    "requireConfirmation": ["deploy", "deploy:preview", "deploy:promote", "db:reset", "db:migrate", "db:seed"]
  },
  "_protectedPathsSource": "architecture/rules.json"
}
CONFIGEOF
  log_success "Created harness.config.json (safeMode: true — safe default for existing projects)"

  # Print next steps
  print_next_steps "${target_dir}" "${detected_stack}"
}

# ─────────────────────────────────────────────
# Parse Arguments
# ─────────────────────────────────────────────
TEMPLATE=""
PROJECT_NAME=""
DETECT_DIR=""
MODE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --template|-t)
      MODE="template"
      TEMPLATE="${2:-}"
      shift 2 || { log_error "--template requires a value"; exit 1; }
      ;;
    --name|-n)
      PROJECT_NAME="${2:-}"
      shift 2 || { log_error "--name requires a value"; exit 1; }
      ;;
    --detect|-d)
      MODE="detect"
      DETECT_DIR="${2:-$(pwd)}"
      # Only shift 2 if next arg is not another flag
      if [[ $# -ge 2 && "${2}" != --* ]]; then
        shift 2
      else
        shift 1
      fi
      ;;
    --help|-h|help)
      usage
      exit 0
      ;;
    *)
      log_error "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────
if [[ -z "${MODE}" ]]; then
  usage
  exit 1
fi

case "${MODE}" in
  template)
    if [[ -z "${TEMPLATE}" ]]; then
      log_error "--template requires a template name"
      usage
      exit 1
    fi
    if [[ -z "${PROJECT_NAME}" ]]; then
      log_error "--name required when using --template"
      usage
      exit 1
    fi
    mode_template "${TEMPLATE}" "${PROJECT_NAME}"
    ;;
  detect)
    mode_detect "${DETECT_DIR}"
    ;;
esac
