# Preview Deploy Auto-Test Template

Automatically run E2E tests against PR preview deployments. Inspired by Vercel's preview deployment + testing workflow.

## Concept

Every PR gets a preview URL (Vercel, Netlify, Cloudflare Pages, etc.). This template configures CI to:

1. Wait for the preview URL to be ready
2. Run the E2E test suite against that preview
3. Post results as a PR comment

## GitHub Actions Workflow

```yaml
# .github/workflows/preview-test.yml
name: Preview Deploy E2E

on:
  deployment_status:

jobs:
  test-preview:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - run: npm ci

      - run: npx playwright install --with-deps chromium

      - name: Run E2E against preview
        env:
          BASE_URL: ${{ github.event.deployment_status.target_url }}
        run: |
          echo "Testing preview: $BASE_URL"
          npx playwright test --project=chromium
        continue-on-error: true

      - name: Post results to PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            let body = '## Preview E2E Results\n\n';
            body += `**Preview URL**: ${process.env.DEPLOYMENT_URL}\n\n`;

            // Read Playwright results
            try {
              const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
              const passed = results.suites.flatMap(s => s.specs).filter(s => s.ok).length;
              const failed = results.suites.flatMap(s => s.specs).filter(s => !s.ok).length;
              const total = passed + failed;

              body += `| Status | Count |\n|--------|-------|\n`;
              body += `| Passed | ${passed} |\n`;
              body += `| Failed | ${failed} |\n`;
              body += `| Total | ${total} |\n\n`;

              if (failed > 0) {
                body += '### Failed Tests\n\n';
                const failedTests = results.suites.flatMap(s => s.specs).filter(s => !s.ok);
                for (const t of failedTests) {
                  body += `- ${t.title}\n`;
                }
              }

              body += `\n${failed === 0 ? 'All tests passed.' : 'Some tests failed. Review the artifacts for details.'}`;
            } catch {
              body += 'Could not parse test results. Check the workflow run for details.';
            }

            // Find the PR number from the deployment
            const { data: prs } = await github.rest.pulls.list({
              owner: context.repo.owner,
              repo: context.repo.repo,
              head: `${context.repo.owner}:${context.payload.deployment.ref}`,
              state: 'open'
            });

            if (prs.length > 0) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: prs[0].number,
                body
              });
            }
        env:
          DEPLOYMENT_URL: ${{ github.event.deployment_status.target_url }}

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: preview-test-report
          path: |
            playwright-report/
            test-results/
          retention-days: 7
```

## Vercel-Specific Setup

For Vercel projects, use the `vercel` deployment event:

```yaml
# Alternative trigger for Vercel
on:
  deployment_status:
    # Vercel fires deployment_status automatically
```

No additional configuration needed — Vercel creates `deployment_status` events by default.

## Netlify-Specific Setup

Netlify requires a webhook or the Netlify plugin approach:

```yaml
on:
  workflow_dispatch:
    inputs:
      preview_url:
        description: "Netlify preview URL"
        required: true

jobs:
  test-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --project=chromium
        env:
          BASE_URL: ${{ inputs.preview_url }}
```

## Playwright Config Adaptation

```typescript
// playwright.config.ts — ensure BASE_URL is configurable
import { defineConfig } from "@playwright/test";

export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
  },
  // ... rest of config
});
```

## Wait-for-URL Helper

For platforms that don't have deployment_status events:

```yaml
- name: Wait for preview URL
  run: |
    URL="${{ env.PREVIEW_URL }}"
    echo "Waiting for $URL to be ready..."
    for i in $(seq 1 30); do
      STATUS=$(curl -o /dev/null -s -w "%{http_code}" "$URL" || echo "000")
      if [ "$STATUS" = "200" ] || [ "$STATUS" = "301" ] || [ "$STATUS" = "302" ]; then
        echo "Preview is ready (HTTP $STATUS)"
        exit 0
      fi
      echo "Attempt $i: HTTP $STATUS, waiting 10s..."
      sleep 10
    done
    echo "Preview URL not ready after 5 minutes"
    exit 1
```

## Agent Integration

- **devops-agent** sets up the workflow file during CI/CD configuration
- **test-writer** generates the E2E tests that run against previews
- **reviewer** agent checks PR comments for test failures before approving
