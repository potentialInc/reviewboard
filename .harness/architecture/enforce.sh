#!/usr/bin/env bash
#
# Architecture Enforcement Script
# Validates code against rules defined in architecture/rules.json
# Designed to produce educational error messages so agents learn from violations.
#
# Usage: ./architecture/enforce.sh [src_directory]
#        Default src_directory: ./src

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RULES_FILE="$SCRIPT_DIR/rules.json"
SRC_DIR="${1:-$PROJECT_ROOT/src}"
ERRORS=0

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log_error() {
  echo -e "${RED}[VIOLATION]${NC} $1" >&2
  echo -e "${CYAN}[LEARN]${NC} $2" >&2
  ERRORS=$((ERRORS + 1))
}

log_warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_ok() {
  echo -e "${GREEN}[OK]${NC} $1"
}

# ─────────────────────────────────────────────
# Stack-rules auto-loading
# ─────────────────────────────────────────────
STACK_RULES=""
if [ -x "$PROJECT_ROOT/harness/stack-detector.sh" ] && command -v jq &>/dev/null; then
  DETECTED_FRAMEWORK=$(cd "$PROJECT_ROOT" && "$PROJECT_ROOT/harness/stack-detector.sh" json 2>/dev/null | jq -r '.framework // empty' 2>/dev/null || true)
  if [ -n "$DETECTED_FRAMEWORK" ] && [ -f "$SCRIPT_DIR/stack-rules/$DETECTED_FRAMEWORK.json" ]; then
    STACK_RULES="$SCRIPT_DIR/stack-rules/$DETECTED_FRAMEWORK.json"
    log_ok "Loaded stack rules: $DETECTED_FRAMEWORK"
  fi
fi

# ─────────────────────────────────────────────
# Check 0: Protected path integrity
# ─────────────────────────────────────────────
check_protected_paths() {
  echo -e "\n${CYAN}=== Checking Protected Path Integrity ===${NC}"

  if ! command -v git &>/dev/null || [ ! -d "$PROJECT_ROOT/.git" ]; then
    log_ok "Not a git repo — skipping protected path check"
    return
  fi

  local protected_paths=()
  local allowed_edits=()

  if command -v jq &>/dev/null; then
    while IFS= read -r _line; do
      [ -n "$_line" ] && protected_paths+=("$_line")
    done < <(jq -r '.protected_paths.paths[]' "$RULES_FILE" 2>/dev/null)

    while IFS= read -r _line; do
      [ -n "$_line" ] && allowed_edits+=("$_line")
    done < <(jq -r '.exceptions.allowed_core_edits[]' "$RULES_FILE" 2>/dev/null)
  else
    # Load from central file, fall back to inline list
    log_warn "jq not available — loading from protected-paths.txt"
    local _txt="$PROJECT_ROOT/architecture/protected-paths.txt"
    if [ -f "$_txt" ]; then
      while IFS= read -r _line; do
        _line="${_line%%#*}"; _line="$(echo "$_line" | xargs)"
        [ -n "$_line" ] && protected_paths+=("$_line")
      done < "$_txt"
    fi
    if [ ${#protected_paths[@]} -eq 0 ]; then
      protected_paths=("harness/" "hooks/" "architecture/" ".claude/" "CLAUDE.md")
    fi
  fi

  local changed_files
  # Include both unstaged and staged changes
  changed_files=$(cd "$PROJECT_ROOT" && { git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null; } | sort -u || true)

  if [ -z "$changed_files" ]; then
    log_ok "No uncommitted changes in protected paths"
    return
  fi

  local violations=0
  # Guard against empty arrays (Bash 3.2 + set -u compatibility)
  if [ ${#protected_paths[@]} -eq 0 ]; then
    log_ok "No protected paths configured"
    return
  fi
  while IFS= read -r file; do
    for protected in "${protected_paths[@]}"; do
      if [[ "$file" == "$protected"* ]]; then
        # Check if allowed
        local is_allowed=false
        if [ ${#allowed_edits[@]} -gt 0 ]; then
          for allowed in "${allowed_edits[@]}"; do
            if [[ "$file" == "$allowed"* ]] || [[ "$file" == "$allowed" ]]; then
              is_allowed=true
              break
            fi
          done
        fi

        if [ "$is_allowed" = false ]; then
          log_error \
            "Uncommitted change in protected path: $file" \
            "This file is part of the harness core ($protected). If this edit was intentional, a human must add it to 'exceptions.allowed_core_edits' in architecture/rules.json."
          violations=$((violations + 1))
        fi
      fi
    done
  done <<< "$changed_files"

  [ "$violations" -eq 0 ] && log_ok "No unauthorized changes in protected paths"
}

# ─────────────────────────────────────────────
# Check 1: Layer dependency direction
# ─────────────────────────────────────────────
check_layer_deps() {
  echo -e "\n${CYAN}=== Checking Layer Dependencies ===${NC}"

  # Load layer order from rules.json (fallback to hardcoded)
  local layers=()
  if command -v jq &>/dev/null && [ -f "$RULES_FILE" ]; then
    while IFS= read -r _layer; do
      [ -n "$_layer" ] && layers+=("$_layer")
    done < <(jq -r '.layers.order[]' "$RULES_FILE" 2>/dev/null)
  fi
  if [ ${#layers[@]} -eq 0 ]; then
    layers=("types" "config" "repo" "service" "runtime" "ui")
  fi

  for i in "${!layers[@]}"; do
    local current="${layers[$i]}"
    local current_dir="$SRC_DIR/$current"

    [ ! -d "$current_dir" ] && continue

    # Check that this layer doesn't import from lower layers
    for j in $(seq $((i + 1)) $((${#layers[@]} - 1))); do
      local forbidden="${layers[$j]}"

      # Search for imports from forbidden layers
      # Use word boundary (/) after layer name to prevent false positives:
      # e.g. "ui" must not match "uuid", "build", "guide" etc.
      local violations
      violations=$(grep -rn \
        -e "from ['\"]\.\.?/.*$forbidden[/'\"]" \
        -e "from ['\"]@/.*$forbidden[/'\"]" \
        -e "from ['\"]src/.*$forbidden[/'\"]" \
        -e "import.*from ['\"]\.\.?/.*$forbidden[/'\"]" \
        -e "import.*from ['\"]@/.*$forbidden[/'\"]" \
        -e "import.*from ['\"]src/.*$forbidden[/'\"]" \
        -e "require(['\"]\.\.?/.*$forbidden[/'\"]" \
        -e "require(['\"]@/.*$forbidden[/'\"]" \
        -e "require(['\"]src/.*$forbidden[/'\"]" \
        "$current_dir" 2>/dev/null || true)

      if [ -n "$violations" ]; then
        log_error \
          "Layer '$current' imports from '$forbidden'" \
          "Dependencies must flow top-down: types → config → repo → service → runtime → ui. '$current' (layer $i) cannot import from '$forbidden' (layer $j). Move shared logic to a higher layer or use dependency injection."
        echo "$violations" | head -5
      fi
    done
  done

  [ "$ERRORS" -eq 0 ] && log_ok "Layer dependencies are clean"
}

# ─────────────────────────────────────────────
# Check 2: File size limits
# ─────────────────────────────────────────────
check_file_sizes() {
  echo -e "\n${CYAN}=== Checking File Sizes ===${NC}"
  # Load max_lines from rules.json (fallback to 300)
  local max_lines=300
  if command -v jq &>/dev/null && [ -f "$RULES_FILE" ]; then
    local json_max
    json_max=$(jq -r '.file_rules.max_lines // 300' "$RULES_FILE" 2>/dev/null)
    [ -n "$json_max" ] && [ "$json_max" -gt 0 ] 2>/dev/null && max_lines="$json_max"
  fi
  local warned=0

  if [ ! -d "$SRC_DIR" ]; then
    log_ok "No src directory yet — skipping file size check"
    return
  fi

  while IFS= read -r file; do
    local lines
    lines=$(wc -l < "$file")
    if [ "$lines" -gt "$max_lines" ]; then
      log_error \
        "$file has $lines lines (max: $max_lines)" \
        "Large files are hard for agents to reason about. Split into smaller files with one concern each. Consider extracting helper functions, types, or constants into separate files."
      warned=1
    fi
  done < <(find "$SRC_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.js" -o -name "*.jsx" -o -name "*.go" -o -name "*.rs" \) 2>/dev/null)

  [ "$warned" -eq 0 ] && log_ok "All files within size limits"
}

# ─────────────────────────────────────────────
# Check 3: Naming conventions
# ─────────────────────────────────────────────
check_naming() {
  echo -e "\n${CYAN}=== Checking Naming Conventions ===${NC}"
  local warned=0

  if [ ! -d "$SRC_DIR" ]; then
    log_ok "No src directory yet — skipping naming check"
    return
  fi

  while IFS= read -r file; do
    local basename
    basename=$(basename "$file")
    # Remove extension
    local name="${basename%.*}"

    # Check kebab-case (allow dots for extensions like .test.ts)
    if [[ ! "$name" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*(\.[a-z]+)*$ ]] && \
       [[ ! "$name" =~ ^__[a-z]+__$ ]] && \
       [[ "$name" != "index" ]]; then
      local expected
      expected="$(echo "$name" | awk '{gsub(/[A-Z]/, "-&"); gsub(/^-/, ""); gsub(/_/, "-"); print tolower($0)}')"
      log_error \
        "File '$file' doesn't follow kebab-case naming. Expected: $expected" \
        "Rename the file to kebab-case: $expected"
      warned=1
    fi
  done < <(find "$SRC_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null)

  [ "$warned" -eq 0 ] && log_ok "Naming conventions look good"
}

# ─────────────────────────────────────────────
# Check 4: Circular dependency detection
# ─────────────────────────────────────────────
check_circular() {
  echo -e "\n${CYAN}=== Checking Circular Dependencies ===${NC}"

  if [ ! -d "$SRC_DIR" ]; then
    log_ok "No src directory yet — skipping circular dependency check"
    return
  fi

  # Simple circular detection: A imports B and B imports A
  local modules
  modules=$(find "$SRC_DIR" -maxdepth 1 -type d -not -path "$SRC_DIR" 2>/dev/null | sort)

  for mod_a in $modules; do
    local name_a
    name_a=$(basename "$mod_a")
    for mod_b in $modules; do
      local name_b
      name_b=$(basename "$mod_b")
      [ "$name_a" = "$name_b" ] && continue
      # Avoid double-counting: only check pairs where a < b alphabetically
      [[ "$name_a" > "$name_b" ]] && continue

      local a_imports_b
      a_imports_b=$(grep -rl "from.*['\"].*/$name_b" "$mod_a" 2>/dev/null | head -1 || true)
      local b_imports_a
      b_imports_a=$(grep -rl "from.*['\"].*/$name_a" "$mod_b" 2>/dev/null | head -1 || true)

      if [ -n "$a_imports_b" ] && [ -n "$b_imports_a" ]; then
        log_error \
          "Circular dependency: '$name_a' <-> '$name_b'" \
          "Circular dependencies make code unpredictable and hard to test. Extract shared logic into a common module that both can import, or use dependency injection to break the cycle."
      fi
    done
  done

  log_ok "Circular dependency check complete"
}

# ─────────────────────────────────────────────
# Check 5: Module boundary enforcement
# ─────────────────────────────────────────────
check_module_boundaries() {
  echo -e "\n${CYAN}=== Checking Module Boundaries ===${NC}"

  if [ ! -d "$SRC_DIR" ]; then
    log_ok "No src directory yet — skipping module boundary check"
    return
  fi

  local modules
  modules=$(find "$SRC_DIR" -maxdepth 1 -type d -not -path "$SRC_DIR" 2>/dev/null)

  for mod in $modules; do
    local name
    name=$(basename "$mod")

    # Check if module has a public entry point
    local has_index=false
    for entry in "index.ts" "index.js" "index.py" "__init__.py" "mod.rs"; do
      [ -f "$mod/$entry" ] && has_index=true && break
    done

    if [ "$has_index" = false ] && [ "$(find "$mod" -type f | wc -l)" -gt 0 ]; then
      log_warn \
        "Module '$name' has no public entry point (index.ts, __init__.py, etc.). Other modules should import through a public interface, not reach into internal files."
    fi
  done

  log_ok "Module boundary check complete"
}

# ─────────────────────────────────────────────
# Run all checks
# ─────────────────────────────────────────────
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Architecture Enforcement Check         ║${NC}"
echo -e "${CYAN}║   Rules: architecture/rules.json         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo -e "Source: $SRC_DIR"

check_protected_paths
check_layer_deps
check_file_sizes
check_naming
check_circular
check_module_boundaries

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo -e "\n${CYAN}=== Summary ===${NC}"
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}Found $ERRORS violation(s). Fix these before merging.${NC}"
  exit 1
else
  echo -e "${GREEN}All checks passed. Architecture is clean.${NC}"
  exit 0
fi
