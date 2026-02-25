#!/usr/bin/env bash
#
# Config Validator — Validates harness.config.json schema
# Catches typos, missing keys, bad types, and unknown fields.
#
# Exit codes:
#   0 = valid (no issues)
#   1 = errors (missing required keys, bad types)
#   2 = warnings only (unknown keys, empty arrays)
#
# Usage:
#   ./harness/config-validator.sh                    # Validate project config
#   ./harness/config-validator.sh /path/to/config    # Validate specific file

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${1:-$PROJECT_ROOT/harness.config.json}"
CLI_BUNDLE="$PROJECT_ROOT/cli/dist/harness-cli.mjs"
CLI_SRC="$PROJECT_ROOT/cli/src/index.ts"

# ── Tier 1: Built bundle (fastest, ~20ms) ──
if [ -f "$CLI_BUNDLE" ] && command -v node &>/dev/null; then
  exec node "$CLI_BUNDLE" config validate "$CONFIG_FILE"
fi

# ── Tier 2: tsx direct execution (~80ms) ──
TSX_BIN="$PROJECT_ROOT/cli/node_modules/.bin/tsx"
if [ -f "$CLI_SRC" ] && [ -x "$TSX_BIN" ]; then
  exec "$TSX_BIN" "$CLI_SRC" config validate "$CONFIG_FILE"
fi

# ── Tier 3: Original shell logic (jq required) ──

ERRORS=0
WARNINGS=0

error() { echo "[config] ERROR: $1"; ERRORS=$((ERRORS + 1)); }
warn()  { echo "[config] WARNING: $1"; WARNINGS=$((WARNINGS + 1)); }
ok()    { echo "[config] OK: $1"; }

# ── Prerequisite: jq ──
if ! command -v jq &>/dev/null; then
  echo "[config] ERROR: jq is required for config validation."
  echo "  Install: brew install jq (macOS) or apt-get install -y jq (Linux)"
  exit 1
fi

# ── File exists? ──
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[config] ERROR: Config file not found: $CONFIG_FILE"
  echo "  What to do: Run ./harness/project-init.sh --detect . to generate one."
  exit 1
fi

# ── Valid JSON? ──
if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
  echo "[config] ERROR: $CONFIG_FILE is not valid JSON."
  echo "  What to do: Check for trailing commas, missing quotes, or unmatched braces."
  exit 1
fi

ok "Valid JSON"

# ── Required keys ──
REQUIRED_KEYS=("version" "safeMode" "restrictions")
for key in "${REQUIRED_KEYS[@]}"; do
  VAL=$(jq -r ".$key // \"__MISSING__\"" "$CONFIG_FILE" 2>/dev/null)
  if [ "$VAL" = "__MISSING__" ] || [ "$VAL" = "null" ]; then
    error "Missing required key: '$key'"
  fi
done

# ── Required restriction sub-keys ──
RESTRICTION_KEYS=("maxParallelAgents" "autoFixRetries" "requireConfirmation")
for key in "${RESTRICTION_KEYS[@]}"; do
  VAL=$(jq -r ".restrictions.$key // \"__MISSING__\"" "$CONFIG_FILE" 2>/dev/null)
  if [ "$VAL" = "__MISSING__" ] || [ "$VAL" = "null" ]; then
    error "Missing required key: 'restrictions.$key'"
  fi
done

# ── Type checks ──
VERSION_TYPE=$(jq -r '.version | type' "$CONFIG_FILE" 2>/dev/null)
if [ "$VERSION_TYPE" != "string" ]; then
  error "'version' must be a string (got $VERSION_TYPE)"
fi

SAFE_TYPE=$(jq -r '.safeMode | type' "$CONFIG_FILE" 2>/dev/null)
if [ "$SAFE_TYPE" != "boolean" ]; then
  error "'safeMode' must be a boolean (got $SAFE_TYPE)"
fi

MPA_TYPE=$(jq -r '.restrictions.maxParallelAgents | type' "$CONFIG_FILE" 2>/dev/null)
if [ "$MPA_TYPE" != "number" ]; then
  error "'restrictions.maxParallelAgents' must be a number (got $MPA_TYPE)"
fi

AFR_TYPE=$(jq -r '.restrictions.autoFixRetries | type' "$CONFIG_FILE" 2>/dev/null)
if [ "$AFR_TYPE" != "number" ]; then
  error "'restrictions.autoFixRetries' must be a number (got $AFR_TYPE)"
fi

RC_TYPE=$(jq -r '.restrictions.requireConfirmation | type' "$CONFIG_FILE" 2>/dev/null)
if [ "$RC_TYPE" != "array" ]; then
  error "'restrictions.requireConfirmation' must be an array (got $RC_TYPE)"
fi

# ── requireConfirmation content validation ──
KNOWN_RC_VALUES=("deploy" "deploy:preview" "deploy:promote" "db" "db:migrate" "db:seed" "db:reset" "secure")
if [ "$RC_TYPE" = "array" ]; then
  RC_LENGTH=$(jq '.restrictions.requireConfirmation | length' "$CONFIG_FILE" 2>/dev/null)
  if [ "$RC_LENGTH" -eq 0 ]; then
    warn "'restrictions.requireConfirmation' is empty — no dangerous keywords will be blocked."
  fi

  while IFS= read -r val; do
    [ -z "$val" ] && continue
    FOUND=false
    for known in "${KNOWN_RC_VALUES[@]}"; do
      if [ "$val" = "$known" ]; then
        FOUND=true
        break
      fi
    done
    if [ "$FOUND" = false ]; then
      warn "Unknown requireConfirmation value: '$val' (known: ${KNOWN_RC_VALUES[*]})"
    fi
  done < <(jq -r '.restrictions.requireConfirmation[]' "$CONFIG_FILE" 2>/dev/null)
fi

# ── Unknown top-level keys ──
KNOWN_TOP_KEYS=("version" "safeMode" "restrictions" "_protectedPathsSource")
while IFS= read -r key; do
  [ -z "$key" ] && continue
  FOUND=false
  for known in "${KNOWN_TOP_KEYS[@]}"; do
    if [ "$key" = "$known" ]; then
      FOUND=true
      break
    fi
  done
  if [ "$FOUND" = false ]; then
    warn "Unknown top-level key: '$key' (typo? known keys: ${KNOWN_TOP_KEYS[*]})"
  fi
done < <(jq -r 'keys[]' "$CONFIG_FILE" 2>/dev/null)

# ── Unknown restriction keys ──
KNOWN_RESTRICTION_KEYS=("maxParallelAgents" "autoFixRetries" "requireConfirmation")
while IFS= read -r key; do
  [ -z "$key" ] && continue
  FOUND=false
  for known in "${KNOWN_RESTRICTION_KEYS[@]}"; do
    if [ "$key" = "$known" ]; then
      FOUND=true
      break
    fi
  done
  if [ "$FOUND" = false ]; then
    warn "Unknown restriction key: '$key' (typo? known keys: ${KNOWN_RESTRICTION_KEYS[*]})"
  fi
done < <(jq -r '.restrictions | keys[]' "$CONFIG_FILE" 2>/dev/null)

# ── Summary ──
echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "[config] FAILED: $ERRORS error(s), $WARNINGS warning(s)"
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo "[config] PASSED with $WARNINGS warning(s)"
  exit 2
else
  echo "[config] PASSED: Config is valid"
  exit 0
fi
