---
description: Fix navigation routing in HTML prototype files with live Playwright testing
argument-hint: "<html-dir> --live-url <url> [--push]"
---

# Set HTML Routing

Test and fix navigation links in static HTML files deployed to GitHub Pages.

## Prerequisites

1. **Playwright** — `playwright-cli` (preferred) or Playwright MCP
2. **GitHub Pages deployed** — run `aura-to-git` first
3. **Live URL** — `https://{org}.github.io/{project}/`

## Usage

```
set-html-routing <html-dir> --live-url <url>
set-html-routing ./generated-screens/my-app --live-url https://myorg.github.io/HTML-my-app/
set-html-routing ./screens --live-url https://myorg.github.io/HTML-my-app/ --push
```

| Argument | Description | Default |
|----------|-------------|---------|
| `<html-dir>` | Local HTML files directory | (required) |
| `--live-url` | GitHub Pages URL | (required) |
| `--push` | Auto-push fixes after testing | false |
| `--demo-account` | Login test credentials | `demo@demo.com:1234` |

## Workflow

### Phase 1: Live Navigation Test

```bash
# Open live site
playwright-cli -s=routing-test open {live-url} --persistent

# For each page with navigation:
playwright-cli -s=routing-test snapshot    # Get element refs
playwright-cli -s=routing-test click {ref} # Click each nav link
playwright-cli -s=routing-test snapshot    # Verify destination
```

Record for each link: page, link text, expected target, actual target, status (ok/broken).

### Phase 2: Analyze Issues

| Issue Type | Example | Fix |
|------------|---------|-----|
| Broken link | `href="#"` stays on same page | Update to correct file path |
| Wrong target | "Dashboard" → wrong file | Fix to correct file |
| Missing handler | Login form does nothing | Add form submit handler |
| 404 error | Link to non-existent file | Create file or remove link |

### Phase 3: Fix Local HTML Files

For each issue found:

**Fix navigation links:**
```html
<!-- Before --> <a href="#">My Contracts</a>
<!-- After -->  <a href="./09-my-contracts.html">My Contracts</a>
```

**Fix wrong targets:**
```html
<!-- Before --> <a href="./08-my-ideas.html">Dashboard</a>
<!-- After -->  <a href="./04-dashboard.html">Dashboard</a>
```

**Add login form handler (if missing):**
```html
<script>
(function() {
  const form = document.querySelector('form');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.querySelector('input[type="email"]');
    const password = document.querySelector('input[type="password"]');
    if (email && password && email.value && password.value) {
      location.href = './04-dashboard.html';
    }
  });
})();
</script>
```

### Phase 4: Report & Push

Show diff summary, get confirmation, then:

```bash
TEMP_DIR="/tmp/{project}-deploy"
cp {html-dir}/*.html "$TEMP_DIR/"
cd "$TEMP_DIR"
git add . && git commit -m "fix: Update navigation routing" && git push
sleep 30  # Wait for Pages rebuild
```

### Phase 5: Verify Fixes

Re-run navigation tests from Phase 1 on live site to confirm all fixes work.

## Auto-Mapping Rules

| Link Text | Target Pattern |
|-----------|---------------|
| Dashboard | `*dashboard*` |
| Home | `*landing*` |
| Profile | `*profile*` |
| Settings | `*settings*` |
| Sign In / Login | `*login*` |
| Sign Up / Register | `*signup*` |
| Log Out | `*landing*` |
| Logo | `*landing*` |

## Rules

- Always test on live site before fixing local files
- Never modify files without showing the user what changed
- Use playwright-cli named sessions for isolation
- Push only with user confirmation (unless `--push` flag)

## Error Handling

- Live site not accessible: check if Pages is deployed, suggest waiting 1-2 minutes
- Playwright not available: **STOP** and report setup instructions
- Push failed: report manual git commands for user to run

## Related

- Previous step: `aura-to-git`
- Full pipeline: `prd-to-design-prompts` → `prompts-to-aura` → `aura-to-git` → this
