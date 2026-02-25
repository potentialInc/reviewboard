# E2E Test Auto-Generation Skill

## Purpose

Automatically generate Playwright E2E tests from routes and page components, using Page Object Model pattern.

## Trigger

- Magic keyword: `test:e2e` or `test:e2e-gen`
- Intent: "generate e2e tests", "create playwright tests", "add end-to-end tests"

## Workflow

### Phase 1: Route Discovery

Scan the project to find all user-facing routes:

**Next.js (App Router)**
```bash
# Find all page.tsx files (user-facing routes)
find src/app -name "page.tsx" | sort
```

**Output example:**
```
src/app/page.tsx                    → /
src/app/login/page.tsx              → /login
src/app/signup/page.tsx             → /signup
src/app/dashboard/page.tsx          → /dashboard
src/app/dashboard/settings/page.tsx → /dashboard/settings
src/app/products/page.tsx           → /products
src/app/products/[id]/page.tsx      → /products/:id
```

### Phase 2: Page Object Generation

For each route, generate a Page Object class:

```typescript
// test/pages/dashboard.page.ts
import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

export class DashboardPage extends BasePage {
  readonly heading: Locator;
  readonly userMenu: Locator;
  readonly sidebarNav: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { level: 1 });
    this.userMenu = page.getByTestId("user-menu");
    this.sidebarNav = page.getByRole("navigation");
  }

  async goto() {
    await this.page.goto("/dashboard");
    await this.page.waitForLoadState("networkidle");
  }

  async getTitle() {
    return this.heading.textContent();
  }

  async navigateTo(item: string) {
    await this.sidebarNav.getByRole("link", { name: item }).click();
  }
}
```

**Base Page Object:**

```typescript
// test/pages/base.page.ts
import { type Page } from "@playwright/test";

export class BasePage {
  constructor(protected readonly page: Page) {}

  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
  }

  async getToastMessage() {
    return this.page.getByRole("alert").textContent();
  }
}
```

### Phase 3: Test Generation

For each route, generate test scenarios:

**Auth-Protected Routes:**
```typescript
// test/tests/dashboard/dashboard.spec.ts
import { test, expect } from "@playwright/test";
import { DashboardPage } from "../../pages/dashboard.page";
import { LoginPage } from "../../pages/auth/login.page";

test.describe("Dashboard", () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    // Login before each test
    const login = new LoginPage(page);
    await login.goto();
    await login.loginAs("user@demo.com", "demo1234");
    dashboard = new DashboardPage(page);
  });

  test("should display dashboard after login", async () => {
    await expect(dashboard.heading).toBeVisible();
  });

  test("should show user menu", async () => {
    await expect(dashboard.userMenu).toBeVisible();
  });

  test("should navigate via sidebar", async ({ page }) => {
    await dashboard.navigateTo("Settings");
    await expect(page).toHaveURL(/settings/);
  });
});
```

**Public Routes:**
```typescript
// test/tests/auth/login.spec.ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/auth/login.page";

test.describe("Login Page", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test("should display login form", async () => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test("should show validation error for empty form", async () => {
    await loginPage.submitButton.click();
    // Check for validation feedback
  });

  test("should login with valid credentials", async ({ page }) => {
    await loginPage.loginAs("user@demo.com", "demo1234");
    await expect(page).toHaveURL(/dashboard/);
  });

  test("should show error for invalid credentials", async () => {
    await loginPage.loginAs("wrong@email.com", "wrongpass");
    await expect(loginPage.errorMessage).toBeVisible();
  });
});
```

### Phase 4: Test Infrastructure

**Playwright Config:**
```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

**Auth Fixture:**
```typescript
// test/fixtures/auth.fixture.ts
import { test as base, type Page } from "@playwright/test";
import { LoginPage } from "../pages/auth/login.page";

type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.loginAs("user@demo.com", "demo1234");
    await use(page);
  },
});
```

## File Structure Generated

```
test/
├── pages/                        # Page Object Models
│   ├── base.page.ts
│   ├── auth/
│   │   ├── login.page.ts
│   │   └── signup.page.ts
│   ├── dashboard.page.ts
│   └── settings.page.ts
├── tests/                        # Test files
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── signup.spec.ts
│   ├── dashboard/
│   │   └── dashboard.spec.ts
│   └── settings/
│       └── settings.spec.ts
├── fixtures/
│   └── auth.fixture.ts
└── utils/
    └── test-helpers.ts
```

## Status Tracking

After generation, create or update `E2E_STATUS.md` from `templates/status/E2E_STATUS.template.md`.

## Rules

- One Page Object per route/page
- Tests use Page Objects exclusively (never raw selectors in tests)
- Use `getByRole`, `getByTestId`, `getByText` — never CSS selectors
- Auth fixture for all protected routes
- Generate both desktop and mobile viewport tests
- Demo credentials from `templates/seed/seed-guide.md` convention
- Tests must be runnable without external dependencies (use dev server)
