---
description: Full design pipeline — PRD to live HTML prototype in one command
argument-hint: "<prd-path> [--skip-git] [--output <dir>]"
magicKeyword: "design:"
---

# Design Pipeline — One Command, PRD to Prototype

Run the complete design pipeline from PRD to deployed HTML prototype.

## Usage

```
design: prd/prd-myapp.md
design: prd/prd-myapp.md --skip-git
design: prd/prd-myapp.md --output ./design/screens
```

| Argument | Description | Default |
|----------|-------------|---------|
| `<prd-path>` | Active PRD file | auto-detected via `prd-resolver.sh` |
| `--skip-git` | Skip GitHub Pages deployment | false |
| `--output` | HTML output directory | `design/generated-screens/{project}/` |

---

## PRD Gate (runs before everything)

Before any stage executes, validate the PRD:

```bash
./harness/prd-gate.sh <prd-path> --mode design
```

| Result | Action |
|--------|--------|
| Exit 0 | Proceed to Stage 1 |
| Exit 1 (BLOCKING) | **STOP immediately** — show issues, instruct user to run `prd: <prd-path>` |
| Exit 2 (WARNINGS) | Show warnings, ask user to confirm each one before proceeding |

Design pipeline is especially strict: **Section 9 App Type, Design Style, Icon Library must all be set.**

---

## Pipeline Stages

```
PRD
 │
 ▼
[1] prd-to-design-prompts     → design/aura-prompts.md
 │
 ▼
[2] prompts-to-aura           → design/generated-screens/{project}/*.html
 │
 ▼
[3] set-html-routing          → fix navigation in local HTML files
 │
 ├─ [4a] aura-to-git          → GitHub Pages live preview URL  (skip with --skip-git)
 │
 ▼
[5] copy to design/mockups/   → ready for ui-builder + html-to-react
 │
 ▼
DONE ✓  design/mockups/ populated
        SCREEN_STATUS.md created
        (fullstack: will auto-run html-to-react from here)
```

---

## Stage 1: PRD → Design Prompts

**Reads**: PRD Section 9 (UI Specifications) — Design Tokens + Screen descriptions
**Outputs**: `design/aura-prompts.md`

Follow `skills/design-pipeline/prd-to-design-prompts.md` exactly.

Required fields from PRD Section 9 Design Tokens:
- App Type, Design Style, Icon Library → YAML frontmatter
- Primary Color, Font Family → design system prefix
- Each `### Screen:` block → one `## Page:` section

**If any of App Type / Design Style / Icon Library are `{TBD}` or missing**:
- **STOP** and ask the user before proceeding
- Do not guess defaults — these three fields directly determine Aura's output quality

---

## Stage 2: Prompts → Aura HTML

**Reads**: `design/aura-prompts.md`
**Outputs**: `design/generated-screens/{project}/*.html`

Follow `skills/design-pipeline/prompts-to-aura.md` exactly.

- Open AURA.build via Playwright
- For each `## Page:` section: prefix with `## Design System`, submit, download HTML
- Save as `{output-dir}/{page-slug}.html`
- Verify file count matches `total_pages` in frontmatter

**If Playwright / playwright-cli not available**: STOP, report setup instructions, do not continue

---

## Stage 3: Fix HTML Routing

**Reads**: `design/generated-screens/{project}/*.html`
**Outputs**: Fixed HTML files in-place

Follow `skills/design-pipeline/set-html-routing.md` exactly.

- Test navigation on local files (file:// protocol)
- Fix broken `href="#"` links to correct `./page-slug.html` targets
- Add login form handler if missing
- Do NOT push to GitHub yet (that's Stage 4)

---

## Stage 4: Deploy to GitHub Pages (optional)

Skip if `--skip-git` flag is set.

Follow `skills/design-pipeline/aura-to-git.md` exactly.

- Create `HTML-{project-name}` repo
- Push fixed HTML files
- Enable GitHub Pages
- Run `set-html-routing` again on live URL to verify

Report live URL: `https://{org}.github.io/HTML-{project-name}/`

---

## Stage 5: Copy to design/mockups/

This stage hands off to the rest of the pipeline.

```bash
mkdir -p design/mockups
cp design/generated-screens/{project}/*.html design/mockups/
```

Then create `SCREEN_STATUS.md` from `templates/status/SCREEN_STATUS.template.md`:
- Populate with one row per HTML file
- Status: PENDING for all screens
- Source ref: relative path to the HTML file in `design/mockups/`

---

## Completion Report

```
## Design Pipeline Complete

Project: {project-name}
Screens: {N} HTML files

Outputs:
  design/aura-prompts.md          — design prompts
  design/mockups/                 — {N} HTML files (ready for html-to-react)
  SCREEN_STATUS.md                — {N} screens pending QA
  {GitHub Pages URL}              — live prototype (if git stage ran)

Next steps:
  fullstack: → continues automatically (html-to-react → ui-builder → backend → ...)
  html-to-react design/mockups/   → convert to React manually
  design-qa:                      → run fidelity QA on implementation
```

---

## Auto-Skip Rules

| Condition | Action |
|-----------|--------|
| `design/aura-prompts.md` exists and is newer than PRD | Skip Stage 1 |
| `design/generated-screens/{project}/` has correct file count | Skip Stage 2 |
| `design/mockups/` already populated | Skip Stage 5, report and continue |

---

## Error Handling

- PRD not found: run `./harness/prd-resolver.sh`, if none found STOP and ask user
- PRD Section 9 missing App Type / Design Style / Icon Library: STOP, ask user (3 questions)
- Playwright not available: STOP after Stage 1, output `design/aura-prompts.md` only, instruct user to run Aura manually
- Aura generation fails for a page: skip that page, note in report, continue with others
- GitHub Pages fails: skip Stage 4, continue to Stage 5, report manual steps

---

## Related

- Individual skills: `prd-to-design-prompts`, `prompts-to-aura`, `aura-to-git`, `set-html-routing`
- PRD normalization: `prd:` (run first if PRD is incomplete)
- After design: `fullstack:` auto-continues, or `html-to-react` manually
- QA: `design-qa:` (run after ui-builder implements the screens)
