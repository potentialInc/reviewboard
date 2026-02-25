#!/usr/bin/env bash
#
# Report Generator
# Generates a client-facing PROJECT_REPORT.md from status files,
# memory, and architecture documentation.
#
# Usage:
#   ./scripts/generate-report.sh [project_dir]   # Generate PROJECT_REPORT.md
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────
PROJECT_ROOT="${1:-$(pwd)}"

if [[ ! -d "${PROJECT_ROOT}" ]]; then
  log_error "Directory does not exist: ${PROJECT_ROOT}"
  exit 1
fi

# Resolve to absolute path
if [[ "${PROJECT_ROOT}" != /* ]]; then
  PROJECT_ROOT="$(cd "${PROJECT_ROOT}" && pwd)"
fi

PROJECT_NAME="$(basename "${PROJECT_ROOT}")"
DATE="$(date '+%Y-%m-%d %H:%M')"

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  Report Generator${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"
echo ""
log_info "Project: ${PROJECT_NAME}"
log_info "Directory: ${PROJECT_ROOT}"
echo ""

# ─────────────────────────────────────────────
# Find the template
# ─────────────────────────────────────────────
TEMPLATE_FILE=""
CANDIDATE_PATHS=(
  "${PROJECT_ROOT}/templates/status/PROJECT_REPORT.template.md"
  "${HARNESS_ROOT}/templates/status/PROJECT_REPORT.template.md"
)

for candidate in "${CANDIDATE_PATHS[@]}"; do
  if [[ -f "${candidate}" ]]; then
    TEMPLATE_FILE="${candidate}"
    break
  fi
done

if [[ -z "${TEMPLATE_FILE}" ]]; then
  log_error "PROJECT_REPORT.template.md not found."
  log_info "Searched: ${CANDIDATE_PATHS[*]}"
  exit 1
fi

log_info "Using template: ${TEMPLATE_FILE}"

# ─────────────────────────────────────────────
# Detect status source (TEAM_STATUS or PIPELINE_STATUS)
# ─────────────────────────────────────────────
STATUS_FILE=""
STATUS_TYPE=""

if [[ -f "${PROJECT_ROOT}/TEAM_STATUS.md" ]]; then
  STATUS_FILE="${PROJECT_ROOT}/TEAM_STATUS.md"
  STATUS_TYPE="team"
  log_info "Status source: TEAM_STATUS.md"
elif [[ -f "${PROJECT_ROOT}/PIPELINE_STATUS.md" ]]; then
  STATUS_FILE="${PROJECT_ROOT}/PIPELINE_STATUS.md"
  STATUS_TYPE="pipeline"
  log_info "Status source: PIPELINE_STATUS.md"
else
  log_warn "No TEAM_STATUS.md or PIPELINE_STATUS.md found. Report will have limited data."
fi

# ─────────────────────────────────────────────
# Extract data from status file
# ─────────────────────────────────────────────
COMPLETED_COUNT=0
IN_PROGRESS_COUNT=0
BLOCKED_COUNT=0
PENDING_COUNT=0
TOTAL_COUNT=0
CURRENT_PHASE="Unknown"

COMPLETED_ITEMS="*No completed items found.*"
IN_PROGRESS_ITEMS="*No items in progress.*"
BLOCKED_ITEMS="*No blocked items.*"
PENDING_ITEMS="*No pending items.*"

if [[ -n "${STATUS_FILE}" ]]; then
  # Count statuses
  COMPLETED_COUNT=$(grep -ciE 'COMPLETED|DONE|COMPLETE' "${STATUS_FILE}" 2>/dev/null || echo "0")
  IN_PROGRESS_COUNT=$(grep -ciE 'IN.PROGRESS|RUNNING|ACTIVE' "${STATUS_FILE}" 2>/dev/null || echo "0")
  BLOCKED_COUNT=$(grep -ciE 'BLOCKED|FAILED' "${STATUS_FILE}" 2>/dev/null || echo "0")
  PENDING_COUNT=$(grep -ciE 'PENDING' "${STATUS_FILE}" 2>/dev/null || echo "0")
  TOTAL_COUNT=$((COMPLETED_COUNT + IN_PROGRESS_COUNT + BLOCKED_COUNT + PENDING_COUNT))

  # Detect current phase
  PHASE_LINE=$(grep -iE '(phase|current).*:' "${STATUS_FILE}" 2>/dev/null | head -1 || echo "")
  if [[ -n "${PHASE_LINE}" ]]; then
    CURRENT_PHASE="$(echo "${PHASE_LINE}" | sed 's/.*:[[:space:]]*//' | sed 's/[*_]//g' | xargs)"
  fi

  # Extract completed items (lines with COMPLETED/DONE status)
  COMPLETED_LINES=$(grep -iE 'COMPLETED|DONE|COMPLETE' "${STATUS_FILE}" 2>/dev/null || echo "")
  if [[ -n "${COMPLETED_LINES}" ]]; then
    COMPLETED_ITEMS=""
    while IFS= read -r line; do
      [[ -z "${line}" ]] && continue
      COMPLETED_ITEMS="${COMPLETED_ITEMS}- ${line}
"
    done <<< "${COMPLETED_LINES}"
  fi

  # Extract in-progress items
  IN_PROGRESS_LINES=$(grep -iE 'IN.PROGRESS|RUNNING|ACTIVE' "${STATUS_FILE}" 2>/dev/null | grep -viE '^>|^#|^\*\*Status' || echo "")
  if [[ -n "${IN_PROGRESS_LINES}" ]]; then
    IN_PROGRESS_ITEMS=""
    while IFS= read -r line; do
      [[ -z "${line}" ]] && continue
      IN_PROGRESS_ITEMS="${IN_PROGRESS_ITEMS}- ${line}
"
    done <<< "${IN_PROGRESS_LINES}"
  fi

  # Extract blocked items
  BLOCKED_LINES=$(grep -iE 'BLOCKED|FAILED' "${STATUS_FILE}" 2>/dev/null | grep -viE '^>|^#|^\*\*Status' || echo "")
  if [[ -n "${BLOCKED_LINES}" ]]; then
    BLOCKED_ITEMS=""
    while IFS= read -r line; do
      [[ -z "${line}" ]] && continue
      BLOCKED_ITEMS="${BLOCKED_ITEMS}- ${line}
"
    done <<< "${BLOCKED_LINES}"
  fi

  # Extract pending items
  PENDING_LINES=$(grep -iE 'PENDING' "${STATUS_FILE}" 2>/dev/null | grep -viE '^>|^#|^\*\*Status' || echo "")
  if [[ -n "${PENDING_LINES}" ]]; then
    PENDING_ITEMS=""
    while IFS= read -r line; do
      [[ -z "${line}" ]] && continue
      PENDING_ITEMS="${PENDING_ITEMS}- ${line}
"
    done <<< "${PENDING_LINES}"
  fi
fi

# ─────────────────────────────────────────────
# Extract decisions from memory
# ─────────────────────────────────────────────
DECISIONS="*No architectural decisions recorded yet.*"
DECISIONS_FILE="${PROJECT_ROOT}/memory/DECISIONS.md"

if [[ -f "${DECISIONS_FILE}" ]]; then
  local_decisions="$(tail -n +2 "${DECISIONS_FILE}" 2>/dev/null | head -30 || echo "")"
  if [[ -n "${local_decisions}" ]] && [[ "${local_decisions}" =~ [[:alpha:]] ]]; then
    DECISIONS="${local_decisions}"
  fi
fi

# ─────────────────────────────────────────────
# Extract architecture summary
# ─────────────────────────────────────────────
ARCHITECTURE="*No architecture documentation found.*"
ARCH_FILE="${PROJECT_ROOT}/architecture/ARCHITECTURE.md"

if [[ -f "${ARCH_FILE}" ]]; then
  # Extract the first meaningful section (up to 30 lines)
  local_arch="$(head -40 "${ARCH_FILE}" 2>/dev/null || echo "")"
  if [[ -n "${local_arch}" ]]; then
    ARCHITECTURE="${local_arch}"
  fi
fi

# ─────────────────────────────────────────────
# Test coverage (best-effort detection)
# ─────────────────────────────────────────────
COVERAGE="N/A"

# Check for common coverage output files
if [[ -f "${PROJECT_ROOT}/coverage/coverage-summary.json" ]]; then
  # Try to extract total line coverage from Jest/Vitest
  COVERAGE_PCT=$(grep -oE '"pct"[[:space:]]*:[[:space:]]*[0-9.]+' "${PROJECT_ROOT}/coverage/coverage-summary.json" 2>/dev/null | head -1 | grep -oE '[0-9.]+' || echo "")
  if [[ -n "${COVERAGE_PCT}" ]]; then
    COVERAGE="${COVERAGE_PCT}%"
  fi
elif [[ -f "${PROJECT_ROOT}/htmlcov/index.html" ]]; then
  # Try to extract from Python coverage
  COVERAGE_PCT=$(grep -oE '[0-9]+%' "${PROJECT_ROOT}/htmlcov/index.html" 2>/dev/null | head -1 || echo "")
  if [[ -n "${COVERAGE_PCT}" ]]; then
    COVERAGE="${COVERAGE_PCT}"
  fi
fi

# ─────────────────────────────────────────────
# Generate report
# ─────────────────────────────────────────────
OUTPUT_FILE="${PROJECT_ROOT}/PROJECT_REPORT.md"

log_info "Generating report..."

# Read template and substitute placeholders
REPORT_CONTENT=$(cat "${TEMPLATE_FILE}")

# Use a temporary file for safe multi-line substitution
TEMP_FILE=$(mktemp)
echo "${REPORT_CONTENT}" > "${TEMP_FILE}"

# Simple placeholder replacements
sed -i.bak \
  -e "s|{PROJECT_NAME}|${PROJECT_NAME}|g" \
  -e "s|{DATE}|${DATE}|g" \
  -e "s|{PHASE}|${CURRENT_PHASE}|g" \
  -e "s|{COMPLETED}|${COMPLETED_COUNT}|g" \
  -e "s|{TOTAL}|${TOTAL_COUNT}|g" \
  -e "s|{BLOCKED_COUNT}|${BLOCKED_COUNT}|g" \
  -e "s|{COVERAGE}|${COVERAGE}|g" \
  "${TEMP_FILE}"
rm -f "${TEMP_FILE}.bak"

# For multi-line substitutions, use awk
awk -v completed="${COMPLETED_ITEMS}" \
    -v in_progress="${IN_PROGRESS_ITEMS}" \
    -v blocked="${BLOCKED_ITEMS}" \
    -v pending="${PENDING_ITEMS}" \
    -v decisions="${DECISIONS}" \
    -v arch="${ARCHITECTURE}" \
    '{
      gsub(/{COMPLETED_ITEMS}/, completed);
      gsub(/{IN_PROGRESS_ITEMS}/, in_progress);
      gsub(/{BLOCKED_ITEMS}/, blocked);
      gsub(/{PENDING_ITEMS}/, pending);
      gsub(/{DECISIONS}/, decisions);
      gsub(/{ARCHITECTURE}/, arch);
      print;
    }' "${TEMP_FILE}" > "${OUTPUT_FILE}"

# Clean up temp files
rm -f "${TEMP_FILE}" "${TEMP_FILE}.bak"

log_success "Generated PROJECT_REPORT.md"

# ─────────────────────────────────────────────
# Print summary
# ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}───────────────────────────────────────────${NC}"
echo -e "${BOLD}${CYAN}  Report Summary${NC}"
echo -e "${BOLD}${CYAN}───────────────────────────────────────────${NC}"
echo -e "  ${BOLD}Project:${NC}       ${PROJECT_NAME}"
echo -e "  ${BOLD}Phase:${NC}         ${CURRENT_PHASE}"
echo -e "  ${BOLD}Completed:${NC}     ${GREEN}${COMPLETED_COUNT}${NC}"
echo -e "  ${BOLD}In Progress:${NC}   ${YELLOW}${IN_PROGRESS_COUNT}${NC}"
echo -e "  ${BOLD}Blocked:${NC}       ${RED}${BLOCKED_COUNT}${NC}"
echo -e "  ${BOLD}Pending:${NC}       ${DIM}${PENDING_COUNT}${NC}"
echo -e "  ${BOLD}Total:${NC}         ${TOTAL_COUNT}"
echo -e "  ${BOLD}Coverage:${NC}      ${COVERAGE}"
echo -e "${BOLD}${CYAN}───────────────────────────────────────────${NC}"
echo ""
echo -e "  ${BOLD}Output:${NC} ${OUTPUT_FILE}"
echo ""
