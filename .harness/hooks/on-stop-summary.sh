#!/usr/bin/env bash
#
# On-Stop Summary Hook
# Records a session summary to memory/PROGRESS.md when Claude stops.
# This creates persistent memory across sessions.
#
# Usage: Called automatically by Claude Code via .claude/settings.json

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROGRESS_FILE="$PROJECT_ROOT/memory/PROGRESS.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# Ensure memory directory and file exist
mkdir -p "$PROJECT_ROOT/memory"
touch "$PROGRESS_FILE"

# Get recent git changes as session summary
RECENT_CHANGES=""
BRANCH="unknown"
if command -v git &>/dev/null && [ -d "$PROJECT_ROOT/.git" ]; then
  RECENT_CHANGES=$(cd "$PROJECT_ROOT" && git diff --stat HEAD 2>/dev/null || echo "No git changes detected")
  BRANCH=$(cd "$PROJECT_ROOT" && git branch --show-current 2>/dev/null || echo "unknown")
fi

# Detect intent from skill activations log, with git fallback
INTENT="(no skill activation detected)"
AGENT="(auto)"
ACTIVATION_LOG="$PROJECT_ROOT/.worktree-logs/skill-activations.log"
if [ -f "$ACTIVATION_LOG" ]; then
  # Get the most recent activation from this session (last entry)
  LAST_ACTIVATION=$(tail -1 "$ACTIVATION_LOG" 2>/dev/null || true)
  if [ -n "$LAST_ACTIVATION" ]; then
    AGENT=$(echo "$LAST_ACTIVATION" | cut -d'|' -f2)
    KEYWORD=$(echo "$LAST_ACTIVATION" | cut -d'|' -f3)
    SNIPPET=$(echo "$LAST_ACTIVATION" | cut -d'|' -f4-)
    INTENT="$KEYWORD $SNIPPET"
  fi
fi

# Fallback: if no skill activation, use latest commit message as intent proxy
if [ "$INTENT" = "(no skill activation detected)" ]; then
  if command -v git &>/dev/null && [ -d "$PROJECT_ROOT/.git" ]; then
    LAST_COMMIT_MSG=$(cd "$PROJECT_ROOT" && git log --oneline -1 --since="1 hour ago" 2>/dev/null || true)
    if [ -n "$LAST_COMMIT_MSG" ]; then
      INTENT="(from commit) $LAST_COMMIT_MSG"
    fi
  fi
fi

# Determine outcome from git status
OUTCOME="session ended"
if command -v git &>/dev/null && [ -d "$PROJECT_ROOT/.git" ]; then
  COMMIT_COUNT=$(cd "$PROJECT_ROOT" && { git log --oneline --since="1 hour ago" 2>/dev/null || true; } | wc -l | tr -d ' ')
  if [ "$COMMIT_COUNT" -gt 0 ]; then
    OUTCOME="$COMMIT_COUNT commit(s) in last hour"
  fi
fi

# Enrich OUTCOME with failure signals
LAST_GUARD_FAIL="$PROJECT_ROOT/.harness-metrics/last-guard-failure"
if [ -f "$LAST_GUARD_FAIL" ]; then
  OUTCOME="$OUTCOME | GUARD P0 FAILED"
fi
LAST_AUTOFIX=$(ls -t "$PROJECT_ROOT/.worktree-logs/auto-fix-"*.log 2>/dev/null | head -1 || true)
if [ -n "$LAST_AUTOFIX" ] && grep -q "Max retries.*exhausted" "$LAST_AUTOFIX" 2>/dev/null; then
  OUTCOME="$OUTCOME | auto-fix exhausted"
fi

# ─────────────────────────────────────────────
# PROGRESS.md rotation: keep last 500 lines, archive the rest
# ─────────────────────────────────────────────
MAX_PROGRESS_LINES=500
ARCHIVE_FILE="$PROJECT_ROOT/memory/PROGRESS.archive.md"
CURRENT_LINES=$(wc -l < "$PROGRESS_FILE" | tr -d ' ')

if [ "$CURRENT_LINES" -gt "$MAX_PROGRESS_LINES" ]; then
  KEEP_LINES=$((MAX_PROGRESS_LINES / 2))
  ARCHIVE_LINES=$((CURRENT_LINES - KEEP_LINES))

  # Atomic archive: write to temp first, then move (crash-safe)
  ARCHIVE_TMPF=$(mktemp "$ARCHIVE_FILE.XXXXXX")
  if [ -f "$ARCHIVE_FILE" ]; then
    cp "$ARCHIVE_FILE" "$ARCHIVE_TMPF"
  fi
  head -n "$ARCHIVE_LINES" "$PROGRESS_FILE" >> "$ARCHIVE_TMPF"
  mv "$ARCHIVE_TMPF" "$ARCHIVE_FILE"
  sync 2>/dev/null || true  # flush to disk before truncating PROGRESS.md

  # Atomically replace PROGRESS.md with recent half
  TAIL_CONTENT=$(tail -n "$KEEP_LINES" "$PROGRESS_FILE")
  TMPF=$(mktemp "$PROGRESS_FILE.XXXXXX")
  printf '%s\n' "$TAIL_CONTENT" > "$TMPF"
  mv "$TMPF" "$PROGRESS_FILE"

  echo "[memory] PROGRESS.md rotated: archived $ARCHIVE_LINES lines → PROGRESS.archive.md (kept last $KEEP_LINES)"
fi

# Append session marker
if ! cat >> "$PROGRESS_FILE" << EOF

## Session: $TIMESTAMP
- **Intent**: $INTENT
- **Agent**: $AGENT
- **Branch**: $BRANCH
- **Outcome**: $OUTCOME
- **Changes**:
\`\`\`
$RECENT_CHANGES
\`\`\`

EOF
then
  echo "[memory] ERROR: Failed to write session summary to PROGRESS.md" >&2
  exit 2
fi

echo "[memory] Session summary appended to memory/PROGRESS.md"
