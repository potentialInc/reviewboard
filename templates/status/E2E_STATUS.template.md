# E2E QA Status: {PROJECT_NAME}

## Overview

This document tracks end-to-end test coverage for the application.

**Tech Stack:** Playwright, TypeScript, Page Object Model

**Last Updated:** YYYY-MM-DD

---

## Test Coverage Matrix

### Authentication

| URL (Route) | Test Scenario Name | Status | Last Run |
|-------------|-------------------|--------|----------|
| /login | Display login form | | |
| /login | Show validation errors for empty form | | |
| /login | Login with valid credentials | | |
| /login | Show error for invalid credentials | | |
| /signup | Display signup form | | |
| /signup | Complete registration flow | | |

### [Feature] Pages

<!-- Copy this section for each feature area -->

| URL (Route) | Test Scenario Name | Status | Last Run |
|-------------|-------------------|--------|----------|
| | | | |

---

## Status Legend

| Status | Meaning |
|--------|---------|
| Not Started | Test not yet implemented |
| In Progress | Test currently being developed |
| Complete | Test implemented and passing |
| Skipped | Test exists but skipped |
| Blocked | Cannot implement due to dependency |

---

## Test Infrastructure

### Directory Structure

```
test/
├── tests/                        # Test files by category
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── signup.spec.ts
│   └── [feature]/
│       └── *.spec.ts
├── pages/                        # Page Object Models
│   ├── base.page.ts
│   └── auth/
│       └── login.page.ts
├── fixtures/                     # Test fixtures
│   └── auth.fixture.ts
└── utils/                        # Test utilities
    └── test-helpers.ts
```

### Page Objects

| Page Object | File | Routes Covered |
|-------------|------|----------------|
| | | |

---

## Running Tests

```bash
# Install Playwright browsers (first time)
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- test/tests/auth/login.spec.ts

# Run with UI mode (debugging)
npm run test:e2e:ui

# View test report
npm run test:e2e:report
```

---

## Test Summary

| Category | Total | Complete | Skipped | Not Started |
|----------|-------|----------|---------|-------------|
| Authentication | | | | |
| [Feature] | | | | |
| **Total** | | | | |

---

## Known Gaps & TODOs

### High Priority

| Route | Gap | Reason |
|-------|-----|--------|
| | | |

### Medium Priority

| Route | Gap | Reason |
|-------|-----|--------|
| | | |

---

## Notes

<!-- Test infrastructure notes, patterns used, blockers -->
