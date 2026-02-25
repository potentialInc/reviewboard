#!/usr/bin/env bash
#
# Pre-Edit Security Check Hook
# Scans file content being written for common security issues:
# hardcoded secrets, API keys, passwords, tokens.
#
# Usage: Called automatically by Claude Code via .claude/settings.json
#        ./hooks/pre-edit-security-check.sh "$FILE_PATH"

set -euo pipefail

FILE_PATH="${1:-}"
[ -z "$FILE_PATH" ] && exit 0

# Skip non-source files (but NOT .json — config JSON can contain secrets)
case "$FILE_PATH" in
  *.md|*.txt|*.toml|*.lock|*.css|*.svg|*.png|*.jpg)
    exit 0
    ;;
esac

# Skip known-safe JSON files (no secrets expected)
case "$(basename "$FILE_PATH")" in
  package.json|package-lock.json|tsconfig.json|tsconfig.*.json|.eslintrc.json|.prettierrc.json|*.schema.json|composer.json|composer.lock)
    exit 0
    ;;
esac

# Skip test files and fixtures
case "$FILE_PATH" in
  *test*|*spec*|*fixture*|*mock*|*__tests__*)
    exit 0
    ;;
esac

# Only check if file exists
[ ! -f "$FILE_PATH" ] && exit 0

WARNINGS=0

warn() {
  echo -e "[SECURITY] $1"
  WARNINGS=$((WARNINGS + 1))
}

# ── Check for hardcoded secrets ──
# AWS keys
if grep -qE "AKIA[0-9A-Z]{16}" "$FILE_PATH" 2>/dev/null; then
  warn "Possible AWS Access Key detected in $FILE_PATH"
fi

# Generic API keys / tokens (long hex/base64 strings assigned to key-like vars)
if grep -qE "(api[_-]?key|api[_-]?secret|auth[_-]?token|access[_-]?token|secret[_-]?key|private[_-]?key)\s*[:=]\s*['\"][A-Za-z0-9+/=_-]{20,}['\"]" "$FILE_PATH" 2>/dev/null; then
  warn "Possible hardcoded API key/token in $FILE_PATH"
fi

# Password assignments
if grep -qE "(password|passwd|pwd)\s*[:=]\s*['\"][^'\"]{4,}['\"]" "$FILE_PATH" 2>/dev/null; then
  warn "Possible hardcoded password in $FILE_PATH"
fi

# JWT tokens
if grep -qE "eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}" "$FILE_PATH" 2>/dev/null; then
  warn "Possible hardcoded JWT token in $FILE_PATH"
fi

# Private keys
if grep -qE "-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----" "$FILE_PATH" 2>/dev/null; then
  warn "Private key detected in $FILE_PATH — never commit private keys!"
fi

# Database connection strings with credentials
if grep -qE "(postgres|mysql|mongodb)://[^:]+:[^@]+@" "$FILE_PATH" 2>/dev/null; then
  warn "Database connection string with credentials in $FILE_PATH — use environment variables instead"
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo "[SECURITY] BLOCKED: Found $WARNINGS potential secret(s) in $FILE_PATH."
  echo "[SECURITY] Use environment variables instead of hardcoding secrets."
  echo "[SECURITY] Store secrets in .env (gitignored) and reference via process.env / os.environ."
  echo ""
  echo "[SECURITY] What to do:"
  echo "  1. Remove the hardcoded secret from the code"
  echo "  2. Add the value to .env (ensure .env is in .gitignore)"
  echo "  3. Reference it via process.env.VAR_NAME or os.environ['VAR_NAME']"
  echo "  4. Re-attempt the edit"
  exit 2
fi
