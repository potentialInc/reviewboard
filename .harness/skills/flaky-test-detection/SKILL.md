# Flaky Test Detection Skill

Automatically detect, quarantine, and manage flaky tests. Inspired by Spotify's Master Guardian system that manages 300k+ daily tests.

## Concept

A **flaky test** passes and fails non-deterministically on the same code. Flaky tests erode CI trust and waste developer time. This skill provides:

1. **Detection**: Run tests multiple times, flag inconsistent results
2. **Quarantine**: Isolate flaky tests so they don't block CI
3. **Tracking**: Log flaky test history for pattern analysis
4. **Auto-Retry**: Retry failures before marking as truly failed

## Directory Structure

```
tests/
├── flaky/
│   ├── flaky-registry.json      # Known flaky tests + metadata
│   ├── detect-flaky.sh          # Detection script (run N times)
│   ├── quarantine.config.ts     # Playwright quarantine config
│   └── FLAKY_REPORT.md          # Auto-generated flaky test report
```

## Detection Script

```bash
#!/usr/bin/env bash
set -euo pipefail

# detect-flaky.sh — Run tests N times, detect inconsistent results
# Usage: ./tests/flaky/detect-flaky.sh [test-command] [runs] [test-pattern]

TEST_CMD="${1:-npx playwright test}"
RUNS="${2:-3}"
PATTERN="${3:-}"
RESULTS_DIR="tests/flaky/.detection-runs"
REGISTRY="tests/flaky/flaky-registry.json"

mkdir -p "$RESULTS_DIR"

echo "Running tests $RUNS times to detect flaky tests..."

for i in $(seq 1 "$RUNS"); do
  echo "--- Run $i/$RUNS ---"
  if [ -n "$PATTERN" ]; then
    $TEST_CMD --grep "$PATTERN" --reporter=json > "$RESULTS_DIR/run-$i.json" 2>/dev/null || true
  else
    $TEST_CMD --reporter=json > "$RESULTS_DIR/run-$i.json" 2>/dev/null || true
  fi
done

# Compare results across runs
echo ""
echo "Analyzing results..."

# Extract test names and pass/fail from each run, find inconsistencies
node -e "
const fs = require('fs');
const runs = [];
for (let i = 1; i <= $RUNS; i++) {
  try {
    const data = JSON.parse(fs.readFileSync('$RESULTS_DIR/run-' + i + '.json', 'utf8'));
    const results = {};
    for (const suite of (data.suites || [])) {
      for (const spec of (suite.specs || [])) {
        const name = suite.title + ' > ' + spec.title;
        results[name] = spec.ok ? 'pass' : 'fail';
      }
    }
    runs.push(results);
  } catch (e) { runs.push({}); }
}

const allTests = [...new Set(runs.flatMap(r => Object.keys(r)))];
const flaky = [];
for (const test of allTests) {
  const outcomes = runs.map(r => r[test]).filter(Boolean);
  const unique = [...new Set(outcomes)];
  if (unique.length > 1) {
    flaky.push({
      test,
      outcomes,
      passRate: outcomes.filter(o => o === 'pass').length / outcomes.length,
      detectedAt: new Date().toISOString()
    });
  }
}

if (flaky.length === 0) {
  console.log('No flaky tests detected across $RUNS runs.');
} else {
  console.log('Flaky tests detected: ' + flaky.length);
  for (const f of flaky) {
    console.log('  - ' + f.test + ' (pass rate: ' + (f.passRate * 100).toFixed(0) + '%)');
  }

  // Update registry
  let registry = { version: '1.0', flakyTests: [] };
  try {
    registry = JSON.parse(fs.readFileSync('$REGISTRY', 'utf8'));
  } catch(e) {}

  for (const f of flaky) {
    const existing = registry.flakyTests.find(t => t.test === f.test);
    if (existing) {
      existing.detectionCount = (existing.detectionCount || 1) + 1;
      existing.lastDetected = f.detectedAt;
      existing.passRate = f.passRate;
    } else {
      registry.flakyTests.push({ ...f, detectionCount: 1, status: 'quarantined' });
    }
  }

  fs.writeFileSync('$REGISTRY', JSON.stringify(registry, null, 2));
  console.log('Registry updated: $REGISTRY');
}
"

# Cleanup
rm -rf "$RESULTS_DIR"
```

## Quarantine Config (Playwright)

```typescript
// quarantine.config.ts
// Import this in your main playwright config to skip quarantined tests
import * as fs from "fs";
import * as path from "path";

interface FlakyTest {
  test: string;
  status: "quarantined" | "monitoring" | "fixed";
  passRate: number;
}

interface FlakyRegistry {
  flakyTests: FlakyTest[];
}

export function getQuarantinedTests(): string[] {
  const registryPath = path.join(__dirname, "flaky-registry.json");

  try {
    const registry: FlakyRegistry = JSON.parse(
      fs.readFileSync(registryPath, "utf8")
    );
    return registry.flakyTests
      .filter((t) => t.status === "quarantined")
      .map((t) => t.test);
  } catch {
    return [];
  }
}

// Usage in playwright.config.ts:
// import { getQuarantinedTests } from "./tests/flaky/quarantine.config";
// const quarantined = getQuarantinedTests();
// grepInvert: quarantined.length ? new RegExp(quarantined.map(escapeRegex).join("|")) : undefined,
```

## Flaky Registry Format

```json
{
  "version": "1.0",
  "flakyTests": [
    {
      "test": "Dashboard > should load user data",
      "outcomes": ["pass", "fail", "pass"],
      "passRate": 0.67,
      "detectedAt": "2024-01-15T10:30:00Z",
      "lastDetected": "2024-01-20T14:00:00Z",
      "detectionCount": 3,
      "status": "quarantined",
      "rootCause": "Race condition in data fetching",
      "assignee": null
    }
  ]
}
```

## CI Integration with Auto-Retry

```yaml
# Add to existing CI workflow
- name: Run tests with retry
  run: |
    # First attempt
    if npx playwright test; then
      echo "All tests passed"
    else
      echo "Some tests failed, retrying failures..."
      # Retry only failed tests (Playwright built-in)
      npx playwright test --last-failed --retries=2
    fi

- name: Detect new flaky tests (weekly)
  if: github.event.schedule == 'cron(0 2 * * 0)'  # Sunday 2am
  run: |
    ./tests/flaky/detect-flaky.sh "npx playwright test" 5
    if [ -n "$(git diff tests/flaky/flaky-registry.json)" ]; then
      git add tests/flaky/flaky-registry.json
      git commit -m "chore: update flaky test registry"
      git push
    fi
```

## Report Generation

```bash
# Generate FLAKY_REPORT.md from registry
node -e "
const fs = require('fs');
const registry = JSON.parse(fs.readFileSync('tests/flaky/flaky-registry.json', 'utf8'));
const tests = registry.flakyTests || [];

let report = '# Flaky Test Report\n\n';
report += 'Generated: ' + new Date().toISOString().split('T')[0] + '\n\n';
report += '| Status | Count |\n|--------|-------|\n';

const quarantined = tests.filter(t => t.status === 'quarantined');
const monitoring = tests.filter(t => t.status === 'monitoring');
const fixed = tests.filter(t => t.status === 'fixed');

report += '| Quarantined | ' + quarantined.length + ' |\n';
report += '| Monitoring | ' + monitoring.length + ' |\n';
report += '| Fixed | ' + fixed.length + ' |\n\n';

if (quarantined.length > 0) {
  report += '## Quarantined Tests\n\n';
  report += '| Test | Pass Rate | Detections | Root Cause |\n';
  report += '|------|-----------|------------|------------|\n';
  for (const t of quarantined) {
    report += '| ' + t.test + ' | ' + (t.passRate * 100).toFixed(0) + '% | ' + t.detectionCount + ' | ' + (t.rootCause || 'Unknown') + ' |\n';
  }
}

fs.writeFileSync('tests/flaky/FLAKY_REPORT.md', report);
console.log('Report written to tests/flaky/FLAKY_REPORT.md');
"
```

## Workflow

1. **Weekly detection**: Cron job runs `detect-flaky.sh` with 5 iterations
2. **Auto-quarantine**: Newly detected flaky tests are quarantined automatically
3. **CI skips quarantined**: Main CI pipeline skips quarantined tests (warns in output)
4. **Manual triage**: Developer reviews `flaky-registry.json`, investigates root cause
5. **Fix and restore**: After fix, change status to `monitoring`, then `fixed`

## Agent Integration

- **test-writer** agent checks flaky registry before writing new tests
- **bug-fixer** agent can be pointed at flaky tests to investigate root causes
- **reviewer** agent flags PRs that introduce new flaky patterns (race conditions, timing dependencies)
