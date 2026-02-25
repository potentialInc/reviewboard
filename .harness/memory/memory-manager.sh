#!/usr/bin/env bash
#
# Memory Manager
# Manages memory files: archive old entries, search across memory, generate summaries.
#
# Usage:
#   memory-manager.sh archive              Archive PROGRESS.md entries older than 200 lines
#   memory-manager.sh search <keyword>     Search across all memory files
#   memory-manager.sh summary              Output a brief summary from all memory files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MEMORY_DIR="$SCRIPT_DIR"
ARCHIVE_DIR="$MEMORY_DIR/archive"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  echo "Usage: $0 {archive|search|summary} [args]"
  echo ""
  echo "Commands:"
  echo "  archive            Archive PROGRESS.md entries older than 200 lines"
  echo "  search <keyword>   Search across all memory files"
  echo "  summary            Output a brief summary from all memory files"
  exit 1
}

# ─────────────────────────────────────────────
# archive: Move old PROGRESS.md entries to archive
# ─────────────────────────────────────────────
cmd_archive() {
  local progress_file="$MEMORY_DIR/PROGRESS.md"
  local max_lines=200

  if [ ! -f "$progress_file" ]; then
    echo -e "${YELLOW}No PROGRESS.md found — nothing to archive.${NC}"
    return
  fi

  local total_lines
  total_lines=$(wc -l < "$progress_file")

  if [ "$total_lines" -le "$max_lines" ]; then
    echo -e "${GREEN}PROGRESS.md has $total_lines lines (limit: $max_lines) — no archiving needed.${NC}"
    return
  fi

  mkdir -p "$ARCHIVE_DIR"

  local timestamp
  timestamp=$(date +%Y%m%d-%H%M%S)
  local archive_file="$ARCHIVE_DIR/progress-$timestamp.md"

  # Calculate how many lines to archive (everything beyond the most recent 200)
  local lines_to_archive=$((total_lines - max_lines))

  echo -e "${CYAN}Archiving $lines_to_archive lines from PROGRESS.md to $archive_file${NC}"

  # Extract older lines (from the top) into the archive
  head -n "$lines_to_archive" "$progress_file" > "$archive_file"

  # Keep only the most recent lines
  local temp_file
  temp_file=$(mktemp) || { echo -e "${RED}Failed to create temp file for rotation${NC}" >&2; return 1; }
  tail -n "$max_lines" "$progress_file" > "$temp_file"
  mv "$temp_file" "$progress_file"

  echo -e "${GREEN}Archived $lines_to_archive lines to: $archive_file${NC}"
  echo -e "${GREEN}PROGRESS.md trimmed to $max_lines lines.${NC}"
}

# ─────────────────────────────────────────────
# search: Search across all memory files
# ─────────────────────────────────────────────
cmd_search() {
  local keyword="${1:-}"

  if [ -z "$keyword" ]; then
    echo -e "${RED}Error: search requires a keyword argument.${NC}"
    echo "Usage: $0 search <keyword>"
    exit 1
  fi

  echo -e "${CYAN}Searching memory files for: ${keyword}${NC}"
  echo ""

  local found=0

  for file in "$MEMORY_DIR"/*.md; do
    [ ! -f "$file" ] && continue

    local matches
    matches=$(grep -in "$keyword" "$file" 2>/dev/null || true)

    if [ -n "$matches" ]; then
      echo -e "${GREEN}── $(basename "$file") ──${NC}"
      echo "$matches"
      echo ""
      found=1
    fi
  done

  # Also search archive if it exists
  if [ -d "$ARCHIVE_DIR" ]; then
    for file in "$ARCHIVE_DIR"/*.md; do
      [ ! -f "$file" ] && continue

      local matches
      matches=$(grep -in "$keyword" "$file" 2>/dev/null || true)

      if [ -n "$matches" ]; then
        echo -e "${GREEN}── archive/$(basename "$file") ──${NC}"
        echo "$matches"
        echo ""
        found=1
      fi
    done
  fi

  if [ "$found" -eq 0 ]; then
    echo -e "${YELLOW}No matches found for '${keyword}' in memory files.${NC}"
  fi
}

# ─────────────────────────────────────────────
# summary: Output brief summary from all memory files
# ─────────────────────────────────────────────
cmd_summary() {
  echo -e "${CYAN}=== Memory Summary ===${NC}"
  echo ""

  # DECISIONS.md summary
  if [ -f "$MEMORY_DIR/DECISIONS.md" ]; then
    local decision_count
    decision_count=$(grep -c "^### ADR-" "$MEMORY_DIR/DECISIONS.md" 2>/dev/null || echo "0")
    echo -e "${GREEN}Decisions:${NC} $decision_count ADR(s) recorded"
    grep "^### ADR-" "$MEMORY_DIR/DECISIONS.md" 2>/dev/null | sed 's/^### /  - /' || true
    echo ""
  fi

  # PATTERNS.md summary
  if [ -f "$MEMORY_DIR/PATTERNS.md" ]; then
    local pattern_count
    pattern_count=$(grep -c "^### Pattern:" "$MEMORY_DIR/PATTERNS.md" 2>/dev/null || echo "0")
    echo -e "${GREEN}Patterns:${NC} $pattern_count pattern(s) recorded"
    grep "^### Pattern:" "$MEMORY_DIR/PATTERNS.md" 2>/dev/null | sed 's/^### /  - /' || true
    echo ""
  fi

  # MISTAKES.md summary
  if [ -f "$MEMORY_DIR/MISTAKES.md" ]; then
    local mistake_count
    mistake_count=$(grep -c "^### Mistake:" "$MEMORY_DIR/MISTAKES.md" 2>/dev/null || echo "0")
    echo -e "${GREEN}Mistakes:${NC} $mistake_count mistake(s) logged"
    grep "^### Mistake:" "$MEMORY_DIR/MISTAKES.md" 2>/dev/null | sed 's/^### /  - /' || true
    echo ""
  fi

  # PROGRESS.md summary
  if [ -f "$MEMORY_DIR/PROGRESS.md" ]; then
    local progress_lines
    progress_lines=$(wc -l < "$MEMORY_DIR/PROGRESS.md")
    echo -e "${GREEN}Progress:${NC} $progress_lines lines in PROGRESS.md"

    # Count archived files if any
    if [ -d "$ARCHIVE_DIR" ]; then
      local archive_count
      archive_count=$(find "$ARCHIVE_DIR" -name "*.md" -type f 2>/dev/null | wc -l)
      echo "  ($archive_count archived file(s) in memory/archive/)"
    fi
    echo ""
  fi

  # STACK-CONTEXT.md summary
  if [ -f "$MEMORY_DIR/STACK-CONTEXT.md" ]; then
    echo -e "${GREEN}Stack Context:${NC} $(head -1 "$MEMORY_DIR/STACK-CONTEXT.md" | sed 's/^# //')"
    echo ""
  fi
}

# ─────────────────────────────────────────────
# Main dispatch
# ─────────────────────────────────────────────
command="${1:-}"
shift || true

case "$command" in
  archive)
    cmd_archive
    ;;
  search)
    cmd_search "$@"
    ;;
  summary)
    cmd_summary
    ;;
  *)
    usage
    ;;
esac
