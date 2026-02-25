#!/usr/bin/env bash
#
# Harness Install — Install claude-harness into an existing project
#
# Copies core harness directories, generates CLAUDE.md, detects tech stack,
# and makes all shell scripts executable.
#
# Usage:
#   ./scripts/harness-install.sh /path/to/target/project
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
NC='\033[0m'

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
log_info() {
  echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

usage() {
  echo -e "${BOLD}Harness Install${NC} — Install claude-harness into an existing project"
  echo ""
  echo "Usage:"
  echo "  $0 /path/to/target/project"
  echo ""
  echo "This will copy the following into your project:"
  echo "  architecture/  hooks/  agents/  skills/"
  echo "  memory/  docs/  templates/status/  harness.config.json"
  echo ""
  echo "It will also generate a CLAUDE.md and make all .sh files executable."
}

# ─────────────────────────────────────────────
# Validate arguments
# ─────────────────────────────────────────────
if [ $# -lt 1 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  usage
  exit 0
fi

TARGET_DIR="$1"

if [ ! -d "$TARGET_DIR" ]; then
  log_error "Target directory does not exist: $TARGET_DIR"
  exit 1
fi

# Resolve to absolute path
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  Harness Install${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
echo ""
log_info "Source:  $HARNESS_ROOT"
log_info "Target:  $TARGET_DIR"
echo ""

# ─────────────────────────────────────────────
# Copy directories
# ─────────────────────────────────────────────
DIRS_TO_COPY=(
  "architecture"
  "hooks"
  "agents"
  "skills"
  "memory"
  "docs"
)

for dir in "${DIRS_TO_COPY[@]}"; do
  src="$HARNESS_ROOT/$dir"
  dest="$TARGET_DIR/$dir"

  if [ ! -d "$src" ]; then
    log_warn "Source directory not found, skipping: $src"
    continue
  fi

  if [ -d "$dest" ]; then
    log_warn "Directory already exists, merging: $dir/"
  fi

  mkdir -p "$dest"
  cp -R "$src/." "$dest/"
  log_success "Copied $dir/"
done

# Copy templates/status/ separately
TEMPLATES_STATUS_SRC="$HARNESS_ROOT/templates/status"
TEMPLATES_STATUS_DEST="$TARGET_DIR/templates/status"

if [ -d "$TEMPLATES_STATUS_SRC" ]; then
  mkdir -p "$TEMPLATES_STATUS_DEST"
  cp -R "$TEMPLATES_STATUS_SRC/." "$TEMPLATES_STATUS_DEST/"
  log_success "Copied templates/status/"
else
  log_warn "Source directory not found, skipping: templates/status/"
fi

# ─────────────────────────────────────────────
# Copy harness.config.json (safe defaults for installed projects)
# ─────────────────────────────────────────────
HARNESS_CONFIG_SRC="$HARNESS_ROOT/harness.config.json"
HARNESS_CONFIG_DEST="$TARGET_DIR/harness.config.json"

if [ -f "$HARNESS_CONFIG_DEST" ]; then
  log_warn "harness.config.json already exists at target. Keeping existing config."
else
  if [ -f "$HARNESS_CONFIG_SRC" ] && command -v jq &>/dev/null; then
    jq '.safeMode = true' "$HARNESS_CONFIG_SRC" > "$HARNESS_CONFIG_DEST"
  else
    cat > "$HARNESS_CONFIG_DEST" << 'CONFIGEOF'
{
  "version": "1.0",
  "safeMode": true,
  "restrictions": {
    "maxParallelAgents": 5,
    "autoFixRetries": 3,
    "requireConfirmation": [
      "deploy", "deploy:preview", "deploy:promote",
      "db:reset", "db:migrate", "db:seed", "db:drop"
    ]
  }
}
CONFIGEOF
  fi
  log_success "Created harness.config.json (safeMode: true — safe default for installed projects)"
fi

# ─────────────────────────────────────────────
# Generate CLAUDE.md from template
# ─────────────────────────────────────────────
TEMPLATE_FILE="$HARNESS_ROOT/templates/claude.template.md"
CLAUDE_MD_DEST="$TARGET_DIR/CLAUDE.md"

if [ -f "$CLAUDE_MD_DEST" ]; then
  log_warn "CLAUDE.md already exists at target. Backing up to CLAUDE.md.bak"
  cp "$CLAUDE_MD_DEST" "$CLAUDE_MD_DEST.bak"
fi

if [ -f "$TEMPLATE_FILE" ]; then
  PROJECT_NAME="$(basename "$TARGET_DIR")"

  # Defaults
  PROJECT_DESCRIPTION="Agent-managed project."
  DEV_COMMAND="npm run dev"
  TEST_COMMAND="npm test"
  LINT_COMMAND="npm run lint"
  BUILD_COMMAND="npm run build"

  # ─────────────────────────────────────────────
  # Detect tech stack (if detector exists)
  # ─────────────────────────────────────────────
  STACK_DETECTOR="$HARNESS_ROOT/harness/stack-detector.sh"

  if [ -x "$STACK_DETECTOR" ]; then
    log_info "Running stack detector..."

    if command -v jq &>/dev/null; then
      # Use JSON output for reliable machine parsing
      DETECTED_JSON="$("$STACK_DETECTOR" json "$TARGET_DIR" 2>/dev/null || echo "")"
      if [ -n "$DETECTED_JSON" ]; then
        _framework="$(echo "$DETECTED_JSON" | jq -r '.framework // empty' 2>/dev/null)"
        [ -n "$_framework" ] && log_success "Detected stack: $_framework"

        _val="$(echo "$DETECTED_JSON" | jq -r '.commands.dev // empty' 2>/dev/null)"
        [ -n "$_val" ] && DEV_COMMAND="$_val"
        _val="$(echo "$DETECTED_JSON" | jq -r '.commands.test // empty' 2>/dev/null)"
        [ -n "$_val" ] && TEST_COMMAND="$_val"
        _val="$(echo "$DETECTED_JSON" | jq -r '.commands.lint // empty' 2>/dev/null)"
        [ -n "$_val" ] && LINT_COMMAND="$_val"
        _val="$(echo "$DETECTED_JSON" | jq -r '.commands.build // empty' 2>/dev/null)"
        [ -n "$_val" ] && BUILD_COMMAND="$_val"
      fi
    else
      # Fallback: run detect for display only (jq not available for JSON parsing)
      DETECTED_STACK="$("$STACK_DETECTOR" detect "$TARGET_DIR" 2>/dev/null || echo "")"
      if [ -n "$DETECTED_STACK" ]; then
        log_info "Stack detected (install jq for auto-command detection)"
      fi
    fi
  else
    log_info "No stack detector found. Using default commands."

    # Basic auto-detection based on config files
    if [ -f "$TARGET_DIR/pyproject.toml" ] || [ -f "$TARGET_DIR/setup.py" ]; then
      log_info "Detected Python project"
      DEV_COMMAND="python -m uvicorn main:app --reload"
      TEST_COMMAND="pytest"
      LINT_COMMAND="ruff check ."
      BUILD_COMMAND="python -m build"
    elif [ -f "$TARGET_DIR/Cargo.toml" ]; then
      log_info "Detected Rust project"
      DEV_COMMAND="cargo run"
      TEST_COMMAND="cargo test"
      LINT_COMMAND="cargo clippy"
      BUILD_COMMAND="cargo build --release"
    elif [ -f "$TARGET_DIR/go.mod" ]; then
      log_info "Detected Go project"
      DEV_COMMAND="go run ."
      TEST_COMMAND="go test ./..."
      LINT_COMMAND="golangci-lint run"
      BUILD_COMMAND="go build -o bin/ ."
    fi
    # Default remains npm for package.json or unknown projects
  fi

  # Substitute placeholders in template
  sed \
    -e "s|{PROJECT_NAME}|$PROJECT_NAME|g" \
    -e "s|{PROJECT_DESCRIPTION}|$PROJECT_DESCRIPTION|g" \
    -e "s|{DEV_COMMAND}|$DEV_COMMAND|g" \
    -e "s|{TEST_COMMAND}|$TEST_COMMAND|g" \
    -e "s|{LINT_COMMAND}|$LINT_COMMAND|g" \
    -e "s|{BUILD_COMMAND}|$BUILD_COMMAND|g" \
    "$TEMPLATE_FILE" > "$CLAUDE_MD_DEST"

  log_success "Generated CLAUDE.md"
else
  log_warn "Template not found: $TEMPLATE_FILE"
  log_warn "Skipping CLAUDE.md generation"
fi

# ─────────────────────────────────────────────
# Make all .sh files executable
# ─────────────────────────────────────────────
SH_COUNT=0
while IFS= read -r -d '' sh_file; do
  chmod +x "$sh_file"
  SH_COUNT=$((SH_COUNT + 1))
done < <(find "$TARGET_DIR" -name "*.sh" -type f -print0)

log_success "Made $SH_COUNT .sh files executable"

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Installation complete!${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  Target: ${BOLD}$TARGET_DIR${NC}"
echo ""
echo "  Next steps:"
echo "    1. Review CLAUDE.md and adjust commands for your project"
echo "    2. Review architecture/ARCHITECTURE.md for layer rules"
echo "    3. Review docs/CONVENTIONS.md for coding standards"
echo "    4. Run: ./architecture/enforce.sh (to verify setup)"
echo ""
