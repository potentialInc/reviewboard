#!/usr/bin/env bash
#
# Schema Analyzer — Detects FK ambiguity and relationship issues in SQL schemas
# Warns when a Supabase/PostgREST nested select would fail due to multiple
# foreign key paths between tables.
#
# Usage:
#   ./harness/schema-analyzer.sh [schema.sql]
#   ./harness/schema-analyzer.sh --project [project-root]
#
# Exit codes:
#   0 = No issues found
#   1 = Ambiguous FK relationships detected
#   2 = Schema file not found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

SCHEMA_FILE=""
ISSUES=0

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ROOT="${2:-$PROJECT_ROOT}"; shift 2 ;;
    *) SCHEMA_FILE="$1"; shift ;;
  esac
done

# Auto-detect schema file
if [ -z "$SCHEMA_FILE" ]; then
  SCHEMA_FILE=$(find "$PROJECT_ROOT" -maxdepth 4 -name "schema.sql" \
    -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -1)
fi

if [ -z "$SCHEMA_FILE" ] || [ ! -f "$SCHEMA_FILE" ]; then
  echo -e "${RED}Schema file not found.${NC}"
  echo "Usage: $0 [schema.sql] or $0 --project [project-root]"
  exit 2
fi

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  Schema Analyzer${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
echo -e "  Schema: ${SCHEMA_FILE}"
echo ""

# ─── 1. Extract FK relationships to temp file ─────────────────────────────────
# Format: source_table target_table fk_column
FK_FILE=$(mktemp)
trap "rm -f $FK_FILE" EXIT

CURRENT_TABLE=""
while IFS= read -r line; do
  if echo "$line" | grep -qi "^create table"; then
    CURRENT_TABLE=$(echo "$line" | sed -E 's/create table[[:space:]]+(if not exists[[:space:]]+)?([a-zA-Z_]+).*/\2/i')
    continue
  fi

  if [ -n "$CURRENT_TABLE" ] && echo "$line" | grep -qi "references"; then
    col_name=$(echo "$line" | sed -E 's/^[[:space:]]*([a-zA-Z_]+)[[:space:]]+.*/\1/')
    target=$(echo "$line" | sed -E 's/.*references[[:space:]]+([a-zA-Z_]+)\(.*/\1/i')
    if [ -n "$target" ] && [ "$target" != "$line" ]; then
      echo "$CURRENT_TABLE $target $col_name" >> "$FK_FILE"
    fi
  fi

  if echo "$line" | grep -q "^)"; then
    CURRENT_TABLE=""
  fi
done < "$SCHEMA_FILE"

# ─── 2. Detect direct FK ambiguity ────────────────────────────────────────────
echo -e "${CYAN}  [1/3] Checking FK ambiguity (multiple FKs from same table)...${NC}"

# Find source tables that have multiple FKs to the same target
sort "$FK_FILE" | awk '{print $1, $2}' | sort | uniq -c | sort -rn | while read -r count src tgt; do
  if [ "$count" -gt 1 ]; then
    echo -e "${YELLOW}  ⚠ Table '${src}' has ${count} FK paths to '${tgt}'${NC}"
    echo -e "    → PostgREST nested select from '${tgt}' will be ambiguous"
    echo -e "    → Fix: Use explicit FK hint in Supabase query"
    ISSUES=$((ISSUES+1))
  fi
done

# ─── 3. Detect junction table ambiguity ────────────────────────────────────────
echo -e "${CYAN}  [2/3] Checking indirect FK paths (junction tables)...${NC}"

# For each target table, find all tables that reference it
while read -r src1 tgt1 col1; do
  # Find if there's a junction table: another table that both references src1 AND tgt1
  while read -r src2 tgt2 col2; do
    [ "$src2" = "$src1" ] && continue  # skip same table
    if [ "$tgt2" = "$tgt1" ]; then
      # src2 also references tgt1. Does src2 reference src1 too?
      if grep -q "^${src2} ${src1} " "$FK_FILE" 2>/dev/null; then
        echo -e "${RED}  ✗ Ambiguous path: '${tgt1}' ← '${src1}' (direct via ${col1})${NC}"
        echo -e "${RED}    AND '${tgt1}' ← '${src2}' ← '${src1}' (junction)${NC}"
        echo -e "    → Querying '${tgt1}' with nested '${src1}(...)' will fail"
        echo -e "    → Fix: Query '${src1}' in a separate query or use FK hint"
        ISSUES=$((ISSUES+1))
      fi
    fi
  done < "$FK_FILE"
done < "$FK_FILE"

# ─── 4. Additional checks ─────────────────────────────────────────────────────
echo -e "${CYAN}  [3/3] Additional checks...${NC}"

# CASCADE DELETE warnings on user/account tables
while IFS= read -r line; do
  if echo "$line" | grep -qi "on delete cascade"; then
    table_ctx=$(echo "$line" | sed -E 's/.*references[[:space:]]+([a-zA-Z_]+).*/\1/i')
    col_ctx=$(echo "$line" | sed -E 's/^[[:space:]]*([a-zA-Z_]+).*/\1/')
    if echo "$col_ctx $table_ctx" | grep -qi "account\|user\|member\|client"; then
      echo -e "${YELLOW}  ⚠ CASCADE DELETE on '${col_ctx}' referencing '${table_ctx}'. Consider SET NULL for user/account data.${NC}"
    fi
  fi
done < "$SCHEMA_FILE"

# Count FK policies
CASCADE_COUNT=$(grep -ci "on delete cascade" "$SCHEMA_FILE" 2>/dev/null || echo "0")
SET_NULL_COUNT=$(grep -ci "on delete set null" "$SCHEMA_FILE" 2>/dev/null || echo "0")
echo -e "  FK policies: ${CASCADE_COUNT} CASCADE, ${SET_NULL_COUNT} SET NULL"

# ─── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ "$ISSUES" -gt 0 ]; then
  echo -e "${RED}  Found ${ISSUES} FK ambiguity issue(s). Fix before using nested selects.${NC}"
  exit 1
else
  echo -e "${GREEN}  No FK ambiguity issues found.${NC}"
  exit 0
fi
