#!/usr/bin/env bash
# Guard test: enforce.sh detects layer violations
# Grade: P1 (warn — logged to report, does not stop auto-fix)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENFORCE="$SCRIPT_DIR/architecture/enforce.sh"

echo "[guard] Testing layer violation detection..."

if [ ! -x "$ENFORCE" ]; then
  echo "[FAIL] enforce.sh not found or not executable"
  exit 1
fi

# Create temp directory with a known violation: types/ importing from service/
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/types" "$TMPDIR/service"

# Create a types file that imports from service (violation: types cannot import service)
# Uses @/ and src/ import patterns which enforce.sh reliably detects
cat > "$TMPDIR/types/user-types.ts" << 'EOF'
import { UserService } from '@/service/user-service'
import { formatUser } from 'src/service/format'

export interface User {
  id: string
  name: string
}
EOF

# Create the service file
cat > "$TMPDIR/service/user-service.ts" << 'EOF'
export class UserService {
  getUser(id: string) { return { id, name: 'test' } }
}
EOF

# Run enforce.sh on the temp directory
OUTPUT=$("$ENFORCE" "$TMPDIR" 2>&1) || EXIT_CODE=$?
EXIT_CODE=${EXIT_CODE:-0}

# enforce.sh should detect the violation and exit 1
if [ "$EXIT_CODE" -eq 1 ]; then
  echo "[PASS] enforce.sh detected layer violation (exit 1)"
elif [ "$EXIT_CODE" -eq 0 ]; then
  echo "[FAIL] enforce.sh missed the layer violation (exit 0)"
  echo "Output: $OUTPUT"
  exit 1
else
  echo "[FAIL] enforce.sh exited with unexpected code $EXIT_CODE"
  echo "Output: $OUTPUT"
  exit 1
fi

# Verify the output mentions the violation
if echo "$OUTPUT" | grep -q "VIOLATION"; then
  echo "[PASS] enforce.sh output includes violation message"
else
  echo "[FAIL] enforce.sh output missing violation message"
  exit 1
fi
