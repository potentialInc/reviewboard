# Test Impact Analysis Template

Run only the tests affected by code changes. Inspired by Spotify's Bazel-based test selection and Google's TAP system.

## Concept

Instead of running the entire test suite on every change, analyze which files changed and run only the tests that depend on them. This reduces CI time by 50-80% for large projects.

## Strategy

```
Changed Files → Dependency Graph → Affected Tests → Run Subset
```

### Dependency Mapping

| Changed File Pattern | Affected Tests |
|---------------------|----------------|
| `src/service/*.ts` | `src/service/*.test.ts` + E2E tests using that service |
| `src/repo/*.ts` | `src/repo/*.test.ts` + service tests importing it |
| `src/ui/components/*.tsx` | Component tests + visual regression + E2E |
| `src/config/*` | All tests (config affects everything) |
| `package.json` | All tests (dependency change) |
| `tests/fixtures/*` | All tests using that fixture |
| `*.css` / `*.scss` | Visual regression tests only |
| `docs/*` | No tests |

## Implementation

### Script: Find Affected Tests

```bash
#!/usr/bin/env bash
set -euo pipefail

# test-impact.sh — Determine which tests to run based on changed files
# Usage: ./tests/test-impact.sh [base-branch]

BASE="${1:-main}"
CHANGED_FILES=$(git diff --name-only "$BASE"...HEAD)

if [ -z "$CHANGED_FILES" ]; then
  echo "No changes detected"
  exit 0
fi

echo "Changed files:"
echo "$CHANGED_FILES"
echo ""

RUN_ALL=false
TEST_FILES=""
VISUAL_ONLY=false

while IFS= read -r file; do
  case "$file" in
    # Config changes → run all tests
    package.json|tsconfig.json|*.config.ts|*.config.js|.env*)
      RUN_ALL=true
      break
      ;;
    # Source file → find colocated test
    src/*.ts|src/*.tsx)
      test_file="${file%.ts}.test.ts"
      test_file_tsx="${file%.tsx}.test.tsx"
      if [ -f "$test_file" ]; then
        TEST_FILES="$TEST_FILES $test_file"
      elif [ -f "$test_file_tsx" ]; then
        TEST_FILES="$TEST_FILES $test_file_tsx"
      fi
      # Also find tests that import this file
      module_name=$(basename "$file" | sed 's/\.\(ts\|tsx\)$//')
      importing_tests=$(grep -rl "from.*['\"].*${module_name}['\"]" --include="*.test.ts" --include="*.test.tsx" src/ 2>/dev/null || true)
      if [ -n "$importing_tests" ]; then
        TEST_FILES="$TEST_FILES $importing_tests"
      fi
      ;;
    # Style changes → visual regression only
    *.css|*.scss|*.module.css)
      VISUAL_ONLY=true
      ;;
    # Test file itself changed
    *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx)
      TEST_FILES="$TEST_FILES $file"
      ;;
    # Docs → no tests
    docs/*|*.md|LICENSE)
      ;;
    # Catch-all → run all
    *)
      RUN_ALL=true
      break
      ;;
  esac
done <<< "$CHANGED_FILES"

if [ "$RUN_ALL" = true ]; then
  echo "SCOPE=all"
  echo "Running: full test suite"
elif [ "$VISUAL_ONLY" = true ] && [ -z "$TEST_FILES" ]; then
  echo "SCOPE=visual"
  echo "Running: visual regression tests only"
elif [ -n "$TEST_FILES" ]; then
  # Deduplicate
  UNIQUE_TESTS=$(echo "$TEST_FILES" | tr ' ' '\n' | sort -u | tr '\n' ' ')
  echo "SCOPE=subset"
  echo "Running: $UNIQUE_TESTS"
else
  echo "SCOPE=none"
  echo "No tests affected by these changes"
fi
```

### CI Integration

```yaml
# .github/workflows/smart-test.yml
name: Smart Test Selection

on:
  pull_request:

jobs:
  analyze:
    runs-on: ubuntu-latest
    outputs:
      scope: ${{ steps.impact.outputs.scope }}
      tests: ${{ steps.impact.outputs.tests }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for diff
      - id: impact
        run: |
          RESULT=$(./tests/test-impact.sh origin/${{ github.base_ref }})
          SCOPE=$(echo "$RESULT" | grep "^SCOPE=" | cut -d= -f2)
          echo "scope=$SCOPE" >> "$GITHUB_OUTPUT"
          if [ "$SCOPE" = "subset" ]; then
            TESTS=$(echo "$RESULT" | grep "^Running:" | sed 's/Running: //')
            echo "tests=$TESTS" >> "$GITHUB_OUTPUT"
          fi

  test-all:
    needs: analyze
    if: needs.analyze.outputs.scope == 'all'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  test-subset:
    needs: analyze
    if: needs.analyze.outputs.scope == 'subset'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx jest ${{ needs.analyze.outputs.tests }}

  test-visual:
    needs: analyze
    if: needs.analyze.outputs.scope == 'visual'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --config tests/visual/visual-regression.config.ts

  skip:
    needs: analyze
    if: needs.analyze.outputs.scope == 'none'
    runs-on: ubuntu-latest
    steps:
      - run: echo "No tests affected by these changes"
```

## TypeScript Dependency Graph (Advanced)

For precise dependency analysis, use TypeScript's module resolution:

```typescript
// tests/analyze-deps.ts
// Run with: npx ts-node tests/analyze-deps.ts src/service/auth-service.ts
import * as ts from "typescript";
import * as path from "path";

function findDependents(targetFile: string, projectDir: string): string[] {
  const configPath = ts.findConfigFile(projectDir, ts.sys.fileExists);
  if (!configPath) return [];

  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectDir);

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const dependents: string[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;

    const imports = sourceFile.statements
      .filter(ts.isImportDeclaration)
      .map((imp) => {
        const moduleSpecifier = imp.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          return moduleSpecifier.text;
        }
        return null;
      })
      .filter(Boolean);

    const resolvedTarget = path.resolve(targetFile).replace(/\.(ts|tsx)$/, "");

    for (const imp of imports) {
      const resolved = ts.resolveModuleName(
        imp!,
        sourceFile.fileName,
        parsed.options,
        ts.sys
      );
      if (resolved.resolvedModule) {
        const resolvedPath = resolved.resolvedModule.resolvedFileName.replace(
          /\.(ts|tsx)$/,
          ""
        );
        if (resolvedPath === resolvedTarget) {
          dependents.push(sourceFile.fileName);
          break;
        }
      }
    }
  }

  return dependents;
}
```

## Impact Summary

| Project Size | Full Suite | With Impact Analysis | Savings |
|-------------|-----------|---------------------|---------|
| Small (< 100 tests) | 2 min | 30s | 75% |
| Medium (100-500 tests) | 10 min | 2 min | 80% |
| Large (500+ tests) | 30+ min | 5 min | 83% |

## Agent Integration

- **test-writer** agent uses dependency graph to determine test placement
- **reviewer** agent verifies that PRs include tests for changed code
- **devops-agent** sets up the smart test selection CI workflow
