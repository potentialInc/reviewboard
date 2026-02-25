# Visual Regression Testing Skill

Automated screenshot comparison to catch unintended visual changes. Inspired by Percy/Chromatic and Netflix's visual testing pipeline.

## Concept

Every screen has a **baseline screenshot**. On each change, a new screenshot is taken and compared pixel-by-pixel. Differences above a threshold are flagged for review.

## Directory Structure

```
tests/
├── visual/
│   ├── baselines/           # Golden screenshots (committed to git)
│   │   ├── dashboard-desktop.png
│   │   ├── dashboard-mobile.png
│   │   └── login-desktop.png
│   ├── current/             # Latest screenshots (gitignored)
│   ├── diffs/               # Diff images (gitignored)
│   ├── visual-regression.config.ts
│   └── visual-regression.test.ts
```

## Setup

### 1. Playwright Config Extension

```typescript
// visual-regression.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "visual-regression.test.ts",
  snapshotDir: "./baselines",
  snapshotPathTemplate: "{snapshotDir}/{arg}-{projectName}{ext}",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,   // 1% pixel difference threshold
      threshold: 0.2,             // Color difference sensitivity (0-1)
      animations: "disabled",     // Disable animations for stable screenshots
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["iPhone 14"] } },
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
  },
});
```

### 2. Test File Template

```typescript
// visual-regression.test.ts
import { test, expect } from "@playwright/test";

// Screen registry: add all screens to test here
const screens = [
  { name: "login", path: "/login", auth: false },
  { name: "dashboard", path: "/dashboard", auth: true },
  { name: "settings", path: "/settings", auth: true },
  // Add screens as they are implemented
];

// Auth helper
async function authenticate(page) {
  // Use demo credentials from templates/seed/seed-guide.md
  await page.goto("/login");
  await page.fill('[name="email"]', "user@demo.com");
  await page.fill('[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**");
}

for (const screen of screens) {
  test(`visual: ${screen.name}`, async ({ page }) => {
    if (screen.auth) {
      await authenticate(page);
    }

    await page.goto(screen.path);
    await page.waitForLoadState("networkidle");

    // Wait for fonts and images to load
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot(`${screen.name}.png`, {
      fullPage: true,
    });
  });
}
```

### 3. Gitignore Additions

```gitignore
# Visual regression
tests/visual/current/
tests/visual/diffs/
tests/visual/test-results/
```

## Workflow

### Taking Baselines (First Run)

```bash
# Generate baseline screenshots
npx playwright test --config tests/visual/visual-regression.config.ts --update-snapshots

# Review baselines visually
ls tests/visual/baselines/

# Commit baselines
git add tests/visual/baselines/
git commit -m "test: add visual regression baselines"
```

### Running Comparisons

```bash
# Compare current state against baselines
npx playwright test --config tests/visual/visual-regression.config.ts

# If differences found, review diff images in:
# tests/visual/test-results/
```

### Updating Baselines (Intentional Changes)

```bash
# After intentional UI changes, update baselines
npx playwright test --config tests/visual/visual-regression.config.ts --update-snapshots

# Review changes
git diff --stat tests/visual/baselines/

# Commit updated baselines with the UI change
git add tests/visual/baselines/
git commit -m "test: update visual baselines for <change>"
```

## CI Integration

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression
on:
  pull_request:
    paths:
      - "src/**/*.tsx"
      - "src/**/*.css"
      - "src/**/tailwind*"
      - "public/**"

jobs:
  visual-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm start &
      - run: npx playwright test --config tests/visual/visual-regression.config.ts
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: visual-diff-report
          path: tests/visual/test-results/
          retention-days: 7
```

## Threshold Guide

| Scenario | maxDiffPixelRatio | threshold |
|----------|-------------------|-----------|
| Strict (pixel-perfect) | 0.001 | 0.1 |
| Standard (recommended) | 0.01 | 0.2 |
| Relaxed (dynamic content) | 0.05 | 0.3 |

## Masking Dynamic Content

For areas with dynamic content (timestamps, avatars, ads), use Playwright's mask option:

```typescript
await expect(page).toHaveScreenshot("dashboard.png", {
  mask: [
    page.locator(".timestamp"),
    page.locator(".user-avatar"),
    page.locator('[data-testid="dynamic-content"]'),
  ],
});
```

## Agent Integration

- **test-writer** agent should generate visual tests alongside unit/E2E tests
- **design-qa** agent uses visual regression to quantify fidelity scores
- **ui-builder** agent updates baselines when implementing new screens
