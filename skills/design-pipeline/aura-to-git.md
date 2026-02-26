---
description: Deploy HTML prototype files to GitHub Pages for live preview
argument-hint: "<project-name> --html-dir <path> [--org <organization>]"
---

# AURA to Git

Create a new GitHub repository, push HTML prototype files, and enable GitHub Pages.

## Prerequisites

1. **GitHub CLI**: `brew install gh` + `gh auth login`
2. **HTML files**: Directory with generated screens (from `prompts-to-aura`)

## Usage

```
aura-to-git <project-name> --html-dir <path>
aura-to-git crowd-building --html-dir ./generated-screens/crowd-building
aura-to-git my-app --html-dir ./screens --org myorg
aura-to-git my-app --html-dir ./screens --private
```

| Argument | Description | Default |
|----------|-------------|---------|
| `<project-name>` | Repo name (created as `HTML-{name}`) | (required) |
| `--html-dir` | HTML files directory | (required) |
| `--org` | GitHub organization | user's default |
| `--private` | Create private repo | false (public) |
| `--no-pages` | Skip GitHub Pages setup | false |

## Workflow

### Step 1: Validate Prerequisites

```bash
which gh                          # gh CLI installed
gh auth status                    # authenticated
ls {html-dir}/*.html              # HTML files exist
```

### Step 2: Create Repository

```bash
gh repo create {org}/HTML-{project-name} --public --description "Generated prototype"
```

### Step 3: Push HTML Files

```bash
TEMP_DIR="/tmp/HTML-{project-name}-deploy"
mkdir -p "$TEMP_DIR"
cp {html-dir}/*.html "$TEMP_DIR/"

# Create index.html from landing page if not exists
if [ ! -f "$TEMP_DIR/index.html" ]; then
  cp "$TEMP_DIR/01-"*.html "$TEMP_DIR/index.html" 2>/dev/null || \
  cp "$(ls "$TEMP_DIR"/*.html | head -1)" "$TEMP_DIR/index.html"
fi

cd "$TEMP_DIR"
git init && git add . && git commit -m "feat: Initial prototype"
git remote add origin "https://github.com/{org}/HTML-{project-name}.git"
git push -u origin main
```

### Step 4: Enable GitHub Pages

```bash
gh api repos/{org}/HTML-{project-name}/pages \
  --method POST \
  --field source='{"branch":"main","path":"/"}'  \
  --field build_type=legacy
```

### Step 5: Verify & Report

```
Repository: https://github.com/{org}/HTML-{project-name}
Live URL:   https://{org}.github.io/HTML-{project-name}/

Files pushed: {N} HTML files
Pages status: Live

Next step: set-html-routing --live-url https://{org}.github.io/HTML-{project-name}/
```

## Safety Rules

1. **NEVER modify existing repositories** — only creates NEW repos
2. **NEVER push to existing repos** — always creates fresh repo
3. **NEVER clone into current project** — uses /tmp directory only
4. **Always work in /tmp** — protect user's project directory

## Error Handling

- gh CLI not installed: report installation instructions
- Not authenticated: report `gh auth login` instructions
- HTML directory empty: **STOP** and suggest running `prompts-to-aura` first
- Repo name already exists: ask user to choose different name or confirm deletion
- Pages activation fails: report manual steps via GitHub Settings

## Related

- Previous step: `prompts-to-aura`
- Next step: `set-html-routing`
