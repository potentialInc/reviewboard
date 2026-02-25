#!/usr/bin/env bash
#
# Design Detector
# Detects available design assets and returns the appropriate agent and input path.
# Used by pipeline-runner.sh to select the right frontend agent for phase 6.
#
# Usage:
#   ./harness/design-detector.sh                  # Full report (JSON)
#   ./harness/design-detector.sh --agent-only     # Print only agent name
#   ./harness/design-detector.sh --input-only     # Print only input path
#
# Output (default JSON):
#   { "agent": "ui-builder", "input_type": "screenshot", "input_path": "design/screens/", "count": 3 }
#   { "agent": "ui-builder", "input_type": "html", "input_path": "design/mockups/", "count": 2 }
#   { "agent": "feature-builder", "input_type": "prd-text", "input_path": "", "count": 0 }

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

MODE="${1:---full}"

SCREENS_DIR="$PROJECT_ROOT/design/screens"
MOCKUPS_DIR="$PROJECT_ROOT/design/mockups"
FIGMA_DIR="$PROJECT_ROOT/design/figma"

# ─── Detection ────────────────────────────────────────────────────────────────
AGENT="feature-builder"
INPUT_TYPE="prd-text"
INPUT_PATH=""
COUNT=0

# Use find with explicit parentheses — portable, no brace-expansion or glob issues on macOS

# Priority 1: PNG/JPG screenshots in design/screens/
if [ -d "$SCREENS_DIR" ]; then
  screen_count=$(find "$SCREENS_DIR" \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.webp" \) 2>/dev/null | wc -l | tr -d ' ')
  if [ "$screen_count" -gt 0 ]; then
    AGENT="ui-builder"
    INPUT_TYPE="screenshot"
    INPUT_PATH="design/screens/"
    COUNT="$screen_count"
  fi
fi

# Priority 2: HTML mockups in design/mockups/ (if no screenshots)
if [ "$AGENT" = "feature-builder" ] && [ -d "$MOCKUPS_DIR" ]; then
  html_count=$(find "$MOCKUPS_DIR" \( -name "*.html" -o -name "*.htm" \) 2>/dev/null | wc -l | tr -d ' ')
  if [ "$html_count" -gt 0 ]; then
    AGENT="ui-builder"
    INPUT_TYPE="html"
    INPUT_PATH="design/mockups/"
    COUNT="$html_count"
  fi
fi

# Priority 3: Figma export (JSON or SVG) in design/figma/
if [ "$AGENT" = "feature-builder" ] && [ -d "$FIGMA_DIR" ]; then
  figma_count=$(find "$FIGMA_DIR" \( -name "*.json" -o -name "*.svg" \) 2>/dev/null | wc -l | tr -d ' ')
  if [ "$figma_count" -gt 0 ]; then
    AGENT="ui-builder"
    INPUT_TYPE="figma"
    INPUT_PATH="design/figma/"
    COUNT="$figma_count"
  fi
fi

# ─── Output ───────────────────────────────────────────────────────────────────
case "$MODE" in
  --agent-only)
    echo "$AGENT"
    ;;
  --input-only)
    echo "$INPUT_PATH"
    ;;
  --input-type)
    echo "$INPUT_TYPE"
    ;;
  *)
    # JSON output
    printf '{"agent":"%s","input_type":"%s","input_path":"%s","count":%s}\n' \
      "$AGENT" "$INPUT_TYPE" "$INPUT_PATH" "$COUNT"
    ;;
esac
