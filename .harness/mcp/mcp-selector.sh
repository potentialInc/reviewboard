#!/usr/bin/env bash
set -euo pipefail

# MCP Server Selector — Recommend MCP servers based on detected tech stack
# Usage: ./mcp/mcp-selector.sh [project-dir]

PROJECT_DIR="${1:-.}"
HARNESS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MCP_CONFIG="$HARNESS_ROOT/mcp.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║   MCP Server Recommendations         ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
  echo ""
}

recommend() {
  local name="$1"
  local reason="$2"
  local status="$3"
  if [ "$status" = "active" ]; then
    echo -e "  ${GREEN}✓${NC} ${name} — ${reason} (already configured)"
  else
    echo -e "  ${YELLOW}+${NC} ${name} — ${reason} (recommended)"
  fi
}

# Check what's already configured
has_server() {
  local server="$1"
  if [ -f "$MCP_CONFIG" ] && command -v jq &>/dev/null; then
    jq -e ".mcpServers.\"$server\"" "$MCP_CONFIG" &>/dev/null && echo "active" || echo "missing"
  else
    echo "unknown"
  fi
}

print_header

# Always recommend Playwright for any project with UI
PLAYWRIGHT_STATUS=$(has_server "playwright")
recommend "playwright" "Browser automation for E2E testing" "$PLAYWRIGHT_STATUS"

# Check for database usage
HAS_DB=false
if [ -f "$PROJECT_DIR/prisma/schema.prisma" ] || \
   [ -f "$PROJECT_DIR/docker-compose.yml" ] || \
   [ -f "$PROJECT_DIR/docker-compose.yaml" ]; then
  HAS_DB=true
fi

# Check package files for DB references
for pkg_file in "$PROJECT_DIR/package.json" "$PROJECT_DIR/pyproject.toml" "$PROJECT_DIR/go.mod" "$PROJECT_DIR/Cargo.toml"; do
  if [ -f "$pkg_file" ]; then
    if grep -qi "postgres\|prisma\|sqlalchemy\|diesel\|sqlx\|pgx\|pg\b" "$pkg_file" 2>/dev/null; then
      HAS_DB=true
    fi
  fi
done

if [ "$HAS_DB" = true ]; then
  PG_STATUS=$(has_server "postgres")
  recommend "postgres" "Direct PostgreSQL access for database agent" "$PG_STATUS"
fi

# Always recommend GitHub for any git project
if [ -d "$PROJECT_DIR/.git" ]; then
  GH_STATUS=$(has_server "github")
  recommend "github" "GitHub API for issues, PRs, and repo management" "$GH_STATUS"
fi

# Check for filesystem-heavy operations (monorepos)
if [ -f "$PROJECT_DIR/turbo.json" ] || [ -f "$PROJECT_DIR/nx.json" ] || [ -f "$PROJECT_DIR/pnpm-workspace.yaml" ]; then
  FS_STATUS=$(has_server "filesystem")
  recommend "filesystem" "Enhanced file operations for monorepo management" "$FS_STATUS"
fi

# Check for Redis usage
for pkg_file in "$PROJECT_DIR/package.json" "$PROJECT_DIR/pyproject.toml" "$PROJECT_DIR/go.mod"; do
  if [ -f "$pkg_file" ]; then
    if grep -qi "redis\|ioredis\|bull\|celery" "$pkg_file" 2>/dev/null; then
      REDIS_STATUS=$(has_server "redis")
      recommend "redis" "Redis access for caching and queue management" "$REDIS_STATUS"
      break
    fi
  fi
done

echo ""
echo -e "${CYAN}Current MCP config:${NC} $MCP_CONFIG"
echo -e "${CYAN}Setup guide:${NC} docs/MCP-GUIDE.md"
echo ""

# Show environment requirements
echo -e "${YELLOW}Required environment variables:${NC}"
if [ "$(has_server "postgres")" = "active" ] || [ "$HAS_DB" = true ]; then
  echo "  DATABASE_URL — PostgreSQL connection string"
fi
if [ "$(has_server "github")" = "active" ] || [ -d "$PROJECT_DIR/.git" ]; then
  echo "  GITHUB_TOKEN — GitHub personal access token"
fi
echo ""
