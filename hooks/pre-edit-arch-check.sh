#!/usr/bin/env bash
#
# Pre-Edit Architecture Check Hook
# Runs before every Edit/Write to validate the target file's layer position.
# If the file is in src/, checks that it doesn't violate layer dependency rules.
#
# Usage: Called automatically by Claude Code via .claude/settings.json
#        ./hooks/pre-edit-arch-check.sh "$FILE_PATH"

set -euo pipefail

FILE_PATH="${1:-}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_BUNDLE="$PROJECT_ROOT/cli/dist/harness-cli.mjs"
CLI_SRC="$PROJECT_ROOT/cli/src/index.ts"

# ── Tier 1: Built bundle (fastest, ~20ms) ──
if [ -n "$FILE_PATH" ] && [ -f "$CLI_BUNDLE" ] && command -v node &>/dev/null; then
  exec node "$CLI_BUNDLE" path check "$FILE_PATH"
fi

# ── Tier 2: tsx direct execution (~80ms) ──
TSX_BIN="$PROJECT_ROOT/cli/node_modules/.bin/tsx"
if [ -n "$FILE_PATH" ] && [ -f "$CLI_SRC" ] && [ -x "$TSX_BIN" ]; then
  exec "$TSX_BIN" "$CLI_SRC" path check "$FILE_PATH"
fi

# ── Tier 3: Original shell logic ──
RULES_FILE="$PROJECT_ROOT/architecture/rules.json"

# ─── Protected Path Check ───
# Load from central file, fall back to inline list
PROTECTED_PATHS_TXT="$PROJECT_ROOT/architecture/protected-paths.txt"
HARDCODED_PROTECTED=()
if [ -f "$PROTECTED_PATHS_TXT" ]; then
  while IFS= read -r _line; do
    _line="${_line%%#*}"  # strip comments
    _line="$(echo "$_line" | xargs)"  # trim whitespace
    [ -n "$_line" ] && HARDCODED_PROTECTED+=("$_line")
  done < "$PROTECTED_PATHS_TXT"
fi
if [ ${#HARDCODED_PROTECTED[@]} -eq 0 ]; then
  HARDCODED_PROTECTED=("harness/" "hooks/" "architecture/" ".claude/" "CLAUDE.md")
fi

# normalize_path: resolve . and .. components in pure bash (no external tools needed)
# Works on macOS and Linux regardless of installed utilities
normalize_path() {
  local path="$1"
  local is_absolute=false
  [[ "$path" == /* ]] && is_absolute=true

  local IFS='/'
  local parts=()
  local normalized=()

  # Split into components
  for part in $path; do
    [ -z "$part" ] && continue
    parts+=("$part")
  done

  # Resolve . and ..
  for part in "${parts[@]}"; do
    if [ "$part" = "." ]; then
      continue
    elif [ "$part" = ".." ]; then
      if [ ${#normalized[@]} -gt 0 ]; then
        normalized=("${normalized[@]:0:$((${#normalized[@]}-1))}")
      fi
    else
      normalized+=("$part")
    fi
  done

  # Rejoin
  local result=""
  for part in "${normalized[@]}"; do
    result="${result}/${part}"
  done

  if [ "$is_absolute" = true ]; then
    echo "${result:-/}"
  else
    echo "${result#/}"
  fi
}

# Resolve symlinks: follow the chain to the real target (up to 10 hops).
# macOS stock readlink lacks -f flag; it only resolves one symlink level.
# We loop to handle multi-level chains (A→B→harness/core.sh).
# Falls back to python3 os.path.realpath if readlink is unavailable.
RESOLVED_PATH="$FILE_PATH"
_resolve_symlinks() {
  local path="$1"
  local hops=0
  local max_hops=10
  while [ -L "$path" ] && [ "$hops" -lt "$max_hops" ]; do
    local target
    target=$(readlink "$path" 2>/dev/null || echo "$path")
    if [[ "$target" != /* ]]; then
      target="$(dirname "$path")/$target"
    fi
    path="$target"
    hops=$((hops + 1))
  done
  echo "$path"
}

if [ -L "$FILE_PATH" ]; then
  # Try python3 realpath first (most robust, handles all edge cases)
  if command -v python3 &>/dev/null; then
    RESOLVED_PATH=$(python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$FILE_PATH" 2>/dev/null) || RESOLVED_PATH=$(_resolve_symlinks "$FILE_PATH")
  else
    RESOLVED_PATH=$(_resolve_symlinks "$FILE_PATH")
  fi
fi

# Normalize the path to resolve any .. or . components
CANONICAL_PATH=$(normalize_path "$RESOLVED_PATH")
CANONICAL_ROOT=$(normalize_path "$PROJECT_ROOT")

# Compute relative path
REL_PATH="${CANONICAL_PATH#"$CANONICAL_ROOT/"}"

check_protected() {
  local path="$1"
  shift
  local protected_list=("$@")

  for protected in "${protected_list[@]}"; do
    if [[ "$path" == "$protected"* ]] || [[ "$path" == "$protected" ]]; then
      return 0  # matched
    fi
  done
  return 1  # not matched
}

# Load protected paths (jq if available, hardcoded fallback otherwise)
if command -v jq &>/dev/null && [ -f "$RULES_FILE" ]; then
  # Dynamic: read from rules.json (compatible with bash 3.x — no mapfile)
  PROTECTED_PATHS=()
  while IFS= read -r line; do
    [ -n "$line" ] && PROTECTED_PATHS+=("$line")
  done < <(jq -r '.protected_paths.paths[]' "$RULES_FILE" 2>/dev/null)

  # If rules.json is corrupt or missing protected_paths, fall back to hardcoded list
  if [ ${#PROTECTED_PATHS[@]} -eq 0 ]; then
    echo "[arch-check] WARNING: rules.json has no protected paths (corrupt?). Using hardcoded fallback." >&2
    PROTECTED_PATHS=("${HARDCODED_PROTECTED[@]}")
  fi

  ALLOWED_EDITS=()
  while IFS= read -r line; do
    [ -n "$line" ] && ALLOWED_EDITS+=("$line")
  done < <(jq -r '.exceptions.allowed_core_edits[]' "$RULES_FILE" 2>/dev/null)

  if check_protected "$REL_PATH" "${PROTECTED_PATHS[@]}"; then
    # Check if explicitly allowed
    is_allowed=false
    if [ ${#ALLOWED_EDITS[@]} -gt 0 ]; then
      for allowed in "${ALLOWED_EDITS[@]}"; do
        if [[ "$REL_PATH" == "$allowed"* ]] || [[ "$REL_PATH" == "$allowed" ]]; then
          is_allowed=true
          break
        fi
      done
    fi

    if [ "$is_allowed" = false ]; then
      echo "[arch-check] BLOCKED: '$REL_PATH' is a protected harness path."
      echo "[arch-check] Protected paths: ${PROTECTED_PATHS[*]}"
      echo "[arch-check] To allow edits, a human must add this path to 'exceptions.allowed_core_edits' in architecture/rules.json"
      exit 2
    fi
  fi
else
  # Degraded mode: hardcoded list, no exceptions check (jq not available)
  if check_protected "$REL_PATH" "${HARDCODED_PROTECTED[@]}"; then
    echo "[arch-check] BLOCKED: '$REL_PATH' is a protected harness path (degraded mode — jq not installed)."
    echo "[arch-check] Install jq to enable dynamic exceptions via architecture/rules.json"
    echo "[arch-check]   macOS:  brew install jq"
    echo "[arch-check]   Linux:  sudo apt-get install -y jq"
    exit 2
  fi
fi

# Only check layer rules for files under src/
if [[ ! "$FILE_PATH" =~ ^(.*/)?src/ ]]; then
  exit 0
fi

# Extract the layer from the file path (e.g., src/service/foo.ts → service)
LAYER=$(echo "$FILE_PATH" | sed -n 's|.*/src/\([^/]*\)/.*|\1|p')

if [ -z "$LAYER" ]; then
  exit 0
fi

LAYERS=("types" "config" "repo" "service" "runtime" "ui")
LAYER_INDEX=-1

for i in "${!LAYERS[@]}"; do
  if [ "${LAYERS[$i]}" = "$LAYER" ]; then
    LAYER_INDEX=$i
    break
  fi
done

# If the file's layer isn't in our layer model, skip
if [ "$LAYER_INDEX" -eq -1 ]; then
  exit 0
fi

# Inform the agent about the current layer context
echo "[arch-check] Editing file in layer '$LAYER' (level $LAYER_INDEX)."
echo "[arch-check] This layer can only import from: ${LAYERS[*]:0:$LAYER_INDEX}"
echo "[arch-check] Forbidden imports from: ${LAYERS[*]:$((LAYER_INDEX + 1))}"
