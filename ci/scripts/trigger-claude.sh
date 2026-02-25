#!/usr/bin/env bash
#
# Trigger Claude from CI
# Wrapper script for running Claude in CI environments.
#
# Usage: ./ci/scripts/trigger-claude.sh "<prompt>" [--commit] [--push]

set -euo pipefail

PROMPT="${1:-}"
DO_COMMIT=false
DO_PUSH=false

for arg in "$@"; do
  case "$arg" in
    --commit) DO_COMMIT=true ;;
    --push) DO_PUSH=true ;;
  esac
done

if [ -z "$PROMPT" ]; then
  echo "Usage: $0 \"<prompt>\" [--commit] [--push]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Safety policy check (match interactive path behavior) ──
if [ -f "$PROJECT_ROOT/harness.config.json" ] && command -v jq &>/dev/null; then
  while IFS= read -r rc; do
    [ -z "$rc" ] && continue
    rc_base="${rc%%:*}"
    if echo "$PROMPT" | grep -qiE "(^|[[:space:]])${rc_base}[: ]"; then
      echo "[ci] ERROR: Prompt contains '$rc_base' which requires confirmation."
      echo "  This keyword is in harness.config.json → restrictions.requireConfirmation."
      echo "  To override: set HARNESS_CI_CONFIRM=true environment variable."
      if [ "${HARNESS_CI_CONFIRM:-}" != "true" ]; then
        exit 1
      fi
      echo "[ci] WARNING: HARNESS_CI_CONFIRM=true set — proceeding with caution."
    fi
  done < <(jq -r '.restrictions.requireConfirmation[]' "$PROJECT_ROOT/harness.config.json" 2>/dev/null)
else
  for dk in deploy db secure; do
    if echo "$PROMPT" | grep -qiE "(^|[[:space:]])${dk}[: ]"; then
      echo "[ci] ERROR: '$dk' blocked (fail-safe — config or jq not available)."
      exit 1
    fi
  done
fi

echo "[ci] Running Claude with prompt..."
claude -p "$PROMPT"

# Run guard tests before committing (block protected path violations)
TESTS_RUNNER="$PROJECT_ROOT/tests/run-tests.sh"
if [ -x "$TESTS_RUNNER" ]; then
  echo "[ci] Running guard tests..."
  GUARD_EXIT=0
  "$TESTS_RUNNER" guards 2>&1 || GUARD_EXIT=$?
  if [ "$GUARD_EXIT" -eq 1 ]; then
    echo "[ci] ERROR: Guard tests failed (P0). Protected paths may have been modified."
    echo "[ci] Aborting commit/push. Review changes with: git diff --stat"
    exit 1
  elif [ "$GUARD_EXIT" -eq 2 ]; then
    echo "[ci] WARNING: Guard tests had minor issues (P1/P2). Proceeding with caution."
  fi
fi

if [ "$DO_COMMIT" = true ]; then
  git config user.name "Claude Agent"
  git config user.email "claude-agent@users.noreply.github.com"

  # Safety: exclude sensitive file patterns from staging to prevent accidental secret commits.
  # .gitignore should be the primary defense, but this is a fail-safe for files
  # that Claude may create outside of .gitignore coverage.
  SENSITIVE_EXCLUDES=(
    ':!.env' ':!.env.*' ':!*.pem' ':!*.key' ':!*.p12' ':!*.pfx'
    ':!*credentials*' ':!*secret*' ':!*.keystore'
  )
  git add -A -- "${SENSITIVE_EXCLUDES[@]}"

  # Warn if any sensitive files were left unstaged
  UNSTAGED_SENSITIVE=$(git status --porcelain | grep -E '\.(env|pem|key|p12|pfx|keystore)' || true)
  if [ -n "$UNSTAGED_SENSITIVE" ]; then
    echo "[ci] WARNING: Sensitive files detected but excluded from staging:"
    echo "$UNSTAGED_SENSITIVE" | sed 's/^/  /'
    echo "[ci] Review these files manually before committing."
  fi

  if git diff --cached --quiet; then
    echo "[ci] No changes to commit, skipping."
  else
    git commit -m "ci: auto-fix by Claude agent"
  fi
fi

if [ "$DO_PUSH" = true ]; then
  BRANCH=$(git branch --show-current)

  # Guard: block push to protected branches unless explicitly allowed
  PROTECTED_BRANCHES="main master"
  ALLOW_BRANCHES="${HARNESS_ALLOW_PUSH_BRANCHES:-}"
  for pb in $PROTECTED_BRANCHES; do
    if [ "$BRANCH" = "$pb" ]; then
      if echo "$ALLOW_BRANCHES" | grep -qw "$pb"; then
        echo "[ci] WARNING: Pushing to protected branch '$pb' (explicitly allowed via HARNESS_ALLOW_PUSH_BRANCHES)."
      else
        echo "[ci] ERROR: Push to protected branch '$pb' blocked."
        echo "  Set HARNESS_ALLOW_PUSH_BRANCHES=\"$pb\" to override."
        exit 1
      fi
    fi
  done

  git push origin "$BRANCH"
fi
