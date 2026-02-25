# Cross-Browser Testing Template

Playwright multi-browser project configuration for consistent behavior across Chrome, Firefox, Safari, and mobile viewports.

## Playwright Config

```typescript
// playwright.config.ts — cross-browser project setup
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
    process.env.CI ? ["github"] : ["list"],
  ],

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // --- Desktop Browsers ---
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    // --- Mobile Viewports ---
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },

    // --- Tablet ---
    {
      name: "tablet",
      use: { ...devices["iPad (gen 7)"] },
    },
  ],

  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

## CI Matrix Strategy

Run browsers in parallel across CI runners:

```yaml
# .github/workflows/cross-browser.yml
name: Cross-Browser E2E

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  e2e:
    strategy:
      fail-fast: false
      matrix:
        project: [chromium, firefox, webkit, mobile-chrome, mobile-safari]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npx playwright install --with-deps ${{ matrix.project == 'mobile-chrome' && 'chromium' || matrix.project == 'mobile-safari' && 'webkit' || matrix.project }}
      - run: npm run build
      - run: npx playwright test --project=${{ matrix.project }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: report-${{ matrix.project }}
          path: playwright-report/
          retention-days: 7
```

## Browser-Specific Test Annotations

Skip or modify tests for specific browsers:

```typescript
import { test, expect } from "@playwright/test";

// Skip on specific browser
test("drag and drop", async ({ page, browserName }) => {
  test.skip(browserName === "firefox", "Firefox drag API differs");
  // ... test implementation
});

// Different behavior per browser
test("file upload", async ({ page, browserName }) => {
  if (browserName === "webkit") {
    // Safari-specific handling
    await page.setInputFiles('input[type="file"]', "test.pdf");
  } else {
    // Chrome/Firefox
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click('button:has-text("Upload")'),
    ]);
    await fileChooser.setFiles("test.pdf");
  }
});
```

## Browser Coverage Matrix

| Feature | Chrome | Firefox | Safari | Mobile Chrome | Mobile Safari |
|---------|--------|---------|--------|---------------|---------------|
| Core navigation | Required | Required | Required | Required | Required |
| Forms & inputs | Required | Required | Required | Required | Required |
| Auth flows | Required | Required | Required | Required | Required |
| File uploads | Required | Required | Best-effort | N/A | N/A |
| Drag & drop | Required | Best-effort | Best-effort | N/A | N/A |
| WebSocket | Required | Required | Required | Required | Required |

## Local Development

```bash
# Run all browsers
npx playwright test

# Run single browser
npx playwright test --project=chromium

# Run mobile only
npx playwright test --project=mobile-chrome --project=mobile-safari

# Debug in specific browser
npx playwright test --project=webkit --debug
```

## Agent Integration

- **test-writer** agent generates browser-aware E2E tests
- **devops-agent** sets up the CI matrix workflow
- **ui-builder** agent tests responsive layouts across viewports
