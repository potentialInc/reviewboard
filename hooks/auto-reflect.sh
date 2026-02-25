#!/usr/bin/env bash
#
# Auto-Reflect Hook
# Analyzes session transcript for learning signals (corrections, preferences)
# and auto-records them in memory/PATTERNS.md.
#
# Complements on-stop-summary.sh:
#   on-stop-summary.sh → PROGRESS.md (what happened)
#   auto-reflect.sh    → PATTERNS.md (what was learned)
#
# Usage: Called automatically by Claude Code on Stop event.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATTERNS_FILE="$PROJECT_ROOT/memory/PATTERNS.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# Ensure memory directory and file exist
mkdir -p "$PROJECT_ROOT/memory"
touch "$PATTERNS_FILE"

# Consume stdin if piped (Claude Code Stop event sends JSON)
if [ ! -t 0 ]; then
  cat > /dev/null
fi

# Helper: append pattern only if not already present (dedup by pattern name)
append_pattern() {
  local pattern_name="$1"
  local where="$2"
  local rule="$3"
  local why="$4"

  # Check for duplicate (same pattern name already in file)
  if grep -qF "### Pattern: $pattern_name" "$PATTERNS_FILE" 2>/dev/null; then
    echo "[reflect] Pattern '$pattern_name' already recorded — skipping"
    return
  fi

  if ! cat >> "$PATTERNS_FILE" << EOF

---

### Pattern: $pattern_name
- **Where**: $where
- **Rule**: $rule
- **Why**: $why
EOF
  then
    echo "[reflect] ERROR: Failed to write pattern to PATTERNS.md" >&2
    exit 2
  fi
}

# ── Detect learning signals from git diff ──
if command -v git &>/dev/null && [ -d "$PROJECT_ROOT/.git" ]; then
  CHANGED_FILES=$(cd "$PROJECT_ROOT" && { git diff --name-only HEAD 2>/dev/null || true; })

  if [ -n "$CHANGED_FILES" ]; then
    # Architecture rules modified
    if echo "$CHANGED_FILES" | grep -q "architecture/"; then
      append_pattern "Architecture rules updated ($TIMESTAMP)" \
        "architecture/" \
        "Architecture rules were modified — review DECISIONS.md for rationale" \
        "Auto-detected from git changes on $TIMESTAMP"
      echo "[reflect] Architecture changes detected — logged to PATTERNS.md"
    fi

    # New source modules created
    NEW_DIRS=$(echo "$CHANGED_FILES" | grep "src/" | sed 's|/[^/]*$||' | sort -u | head -5 || true)
    if [ -n "$NEW_DIRS" ]; then
      append_pattern "New modules added ($TIMESTAMP)" \
        "$NEW_DIRS" \
        "New source modules were created — ensure they follow layer rules" \
        "Auto-detected from git changes on $TIMESTAMP"
      echo "[reflect] New module creation detected — logged to PATTERNS.md"
    fi

    # Dependency changes detected
    if echo "$CHANGED_FILES" | grep -qE "(package\.json|pyproject\.toml|go\.mod|Cargo\.toml|Gemfile)"; then
      DEP_FILES=$(echo "$CHANGED_FILES" | grep -E "(package\.json|pyproject\.toml|go\.mod|Cargo\.toml|Gemfile)" | head -3)
      append_pattern "Dependencies changed ($TIMESTAMP)" \
        "$DEP_FILES" \
        "Dependencies were added or removed — verify compatibility" \
        "Auto-detected from git changes on $TIMESTAMP"
      echo "[reflect] Dependency changes detected — logged to PATTERNS.md"
    fi

    # New test files created
    if echo "$CHANGED_FILES" | grep -qE "\.(test|spec)\.(ts|js|tsx|jsx)$|test_.*\.py$|.*_test\.go$"; then
      TEST_FILES=$(echo "$CHANGED_FILES" | grep -E "\.(test|spec)\.|test_|_test\." | head -3)
      append_pattern "Tests added ($TIMESTAMP)" \
        "$TEST_FILES" \
        "New test files were created — maintain test coverage" \
        "Auto-detected from git changes on $TIMESTAMP"
      echo "[reflect] New test files detected — logged to PATTERNS.md"
    fi
  fi
fi

# ── Auto-populate MISTAKES.md from auto-fix failures ──
MISTAKES_FILE="$PROJECT_ROOT/memory/MISTAKES.md"
METRICS_FILE="$PROJECT_ROOT/.harness-metrics/auto-fix.jsonl"

if [ -f "$METRICS_FILE" ]; then
  # Find recent failures (last 10 entries with success:false)
  RECENT_FAILURES=""
  if command -v jq &>/dev/null; then
    RECENT_FAILURES=$(tail -10 "$METRICS_FILE" | while IFS= read -r line; do
      IS_FAIL=$(echo "$line" | jq -r 'select(.success == false) | .command' 2>/dev/null || true)
      [ -n "$IS_FAIL" ] && echo "$IS_FAIL"
    done)
  else
    # Fallback: grep for success:false
    RECENT_FAILURES=$(tail -10 "$METRICS_FILE" | grep '"success":false' | head -3 || true)
  fi

  if [ -n "$RECENT_FAILURES" ]; then
    touch "$MISTAKES_FILE"
    while IFS= read -r failed_cmd; do
      [ -z "$failed_cmd" ] && continue
      MISTAKE_KEY="Auto-fix failure: $failed_cmd"
      if ! grep -qF "$MISTAKE_KEY" "$MISTAKES_FILE" 2>/dev/null; then
        cat >> "$MISTAKES_FILE" << MISTAKE

---

### $MISTAKE_KEY
- **When**: $TIMESTAMP
- **Pattern**: Command \`$failed_cmd\` failed during auto-fix loop
- **Action**: Check error output in .worktree-logs/auto-fix-*.log
MISTAKE
        echo "[reflect] Recorded failure pattern to MISTAKES.md: $failed_cmd"
      fi
    done <<< "$RECENT_FAILURES"
  fi
fi

# ── Auto-populate MISTAKES.md from guard P0 failures ──
LAST_GUARD_FAIL="$PROJECT_ROOT/.harness-metrics/last-guard-failure"
if [ -f "$LAST_GUARD_FAIL" ] && [ -s "$LAST_GUARD_FAIL" ]; then
  touch "$MISTAKES_FILE"
  GUARD_INFO=$(cat "$LAST_GUARD_FAIL")
  GUARD_KEY="Guard P0 failure ($TIMESTAMP)"
  if ! grep -qF "$GUARD_INFO" "$MISTAKES_FILE" 2>/dev/null; then
    if cat >> "$MISTAKES_FILE" << MISTAKE

---

### $GUARD_KEY
- **When**: $TIMESTAMP
- **Detail**: $GUARD_INFO
- **Pattern**: Guard tests failed — protected path or core integrity violation
- **Action**: Review git diff, revert protected-path changes, re-run ./tests/run-tests.sh guards
MISTAKE
    then
      echo "[reflect] Recorded guard P0 failure to MISTAKES.md"
      # Only remove the failure marker AFTER successfully recording it
      rm -f "$LAST_GUARD_FAIL"
    else
      echo "[reflect] ERROR: Failed to write guard failure to MISTAKES.md" >&2
      exit 2
    fi
  else
    # Already recorded — safe to remove the marker
    rm -f "$LAST_GUARD_FAIL"
  fi
fi

echo "[reflect] Auto-reflect complete."
