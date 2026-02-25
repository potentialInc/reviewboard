#!/usr/bin/env bash
#
# Post-Edit Format Hook
# Auto-formats edited files using the project's formatter.
# Detects the appropriate formatter based on file type and available tools.
#
# Usage: Called automatically by Claude Code via .claude/settings.json
#        ./hooks/post-edit-format.sh "$FILE_PATH"

set -euo pipefail

FILE_PATH="${1:-}"
[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION="${FILE_PATH##*.}"

# ── TypeScript / JavaScript ──
case "$EXTENSION" in
  ts|tsx|js|jsx|mjs|cjs)
    if command -v prettier &>/dev/null; then
      prettier --write "$FILE_PATH" 2>/dev/null && echo "[format] Formatted with prettier: $(basename "$FILE_PATH")"
    elif [ -f "$PROJECT_ROOT/node_modules/.bin/prettier" ]; then
      "$PROJECT_ROOT/node_modules/.bin/prettier" --write "$FILE_PATH" 2>/dev/null && echo "[format] Formatted with prettier: $(basename "$FILE_PATH")"
    fi
    ;;

  # ── Python ──
  py)
    if command -v black &>/dev/null; then
      black --quiet "$FILE_PATH" 2>/dev/null && echo "[format] Formatted with black: $(basename "$FILE_PATH")"
    elif command -v ruff &>/dev/null; then
      ruff format "$FILE_PATH" 2>/dev/null && echo "[format] Formatted with ruff: $(basename "$FILE_PATH")"
    fi
    ;;

  # ── Go ──
  go)
    if command -v gofmt &>/dev/null; then
      gofmt -w "$FILE_PATH" 2>/dev/null && echo "[format] Formatted with gofmt: $(basename "$FILE_PATH")"
    fi
    ;;

  # ── Rust ──
  rs)
    if command -v rustfmt &>/dev/null; then
      rustfmt "$FILE_PATH" 2>/dev/null && echo "[format] Formatted with rustfmt: $(basename "$FILE_PATH")"
    fi
    ;;

  # ── CSS / SCSS ──
  css|scss|less)
    if command -v prettier &>/dev/null; then
      prettier --write "$FILE_PATH" 2>/dev/null && echo "[format] Formatted with prettier: $(basename "$FILE_PATH")"
    fi
    ;;

  # ── JSON / YAML ──
  json)
    if command -v prettier &>/dev/null; then
      prettier --write "$FILE_PATH" 2>/dev/null && echo "[format] Formatted: $(basename "$FILE_PATH")"
    fi
    ;;
esac
