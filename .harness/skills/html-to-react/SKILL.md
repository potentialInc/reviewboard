---
skill_name: html-to-react
applies_to_local_project_only: false
auto_trigger_regex: [html-to-react, html to react, convert html, html conversion, prototype to code]
tags: [conversion, html, react, frontend, design-to-code]
related_skills: [ui-builder, design-qa, design-pipeline]
description: Structured 3-phase HTML-to-React conversion pipeline. Analyze HTML prototypes, map to frontend targets, generate conversion prompts.
---

# HTML to React Conversion

Structured pipeline to convert HTML prototypes into production React components.

**3 phases**: `--analyze` → `--map` → `--prompts`

---

## Phase 1: Analyze (`--analyze`)

Analyze HTML prototype files to understand structure, patterns, and shared components.

### Input
- HTML files directory (e.g., `design/mockups/` or `generated-screens/{project}/`)

### Actions

1. **Inventory all HTML files**: Count, categorize by filename patterns
2. **Parse each file**: Extract structure, CSS classes, JS functions, forms
3. **Identify shared components**: Navigation, sidebar, footer, cards used across files
4. **Detect patterns**: Auth forms, dashboards, CRUD pages, settings

### Output: `design/html-analysis.md`

```markdown
# HTML Prototype Analysis

## File Inventory
| # | File | Category | Key Components |
|---|------|----------|---------------|

## Shared Components (reuse across screens)
| Component | Usage Count | Files |
|-----------|-------------|-------|

## JavaScript Functions
| File | Function | React Equivalent |
|------|----------|-----------------|
| login.html | handleLogin() | useForm() + onSubmit |
| dashboard.html | toggleSidebar() | useState<boolean> |

## Patterns Detected
- Auth pattern: [files]
- Dashboard pattern: [files]
- CRUD pattern: [files]
```

---

## Phase 2: Map (`--map`)

Map each HTML file to its target frontend component and route.

### Input
- `design/html-analysis.md` (from Phase 1)
- Project's frontend structure (`package.json`, route config, existing components)

### Actions

1. **Detect frontend stack**: React version, router, state management, UI library
2. **Map HTML files → routes**: Match filenames to URL paths
3. **Map HTML files → components**: Determine component file paths
4. **Identify API endpoints**: Match screens to backend APIs (if available)

### Output: `design/html-mapping.json`

```json
{
  "version": "1.0",
  "html_source": "design/mockups",
  "stack": {
    "framework": "React 19",
    "router": "React Router v7",
    "ui": "Tailwind CSS",
    "state": "Zustand"
  },
  "mappings": [
    {
      "html_path": "01-landing.html",
      "target_route": "/",
      "page_component": "src/pages/Landing.tsx",
      "category": "public",
      "shared_components": ["Header", "Footer"],
      "new_components": ["HeroSection", "FeatureGrid"],
      "api_endpoints": [],
      "priority": "high",
      "status": "pending"
    }
  ]
}
```

---

## Phase 3: Prompts (`--prompts`)

Generate token-optimized conversion prompts for each screen category.

### Input
- `design/html-analysis.md` (from Phase 1)
- `design/html-mapping.json` (from Phase 2)

### Actions

1. **Group by category**: auth, dashboard, settings, etc.
2. **Generate shared components prompt** (always first, P0 priority)
3. **Generate per-category prompts** with:
   - Screen list with component paths
   - API integration points
   - Event handler conversion table (HTML → React)
   - Anti-pattern checklist

### Output: `design/conversion-prompts/`

```
design/conversion-prompts/
├── 00-shared-components.md    # P0: Create shared components first
├── 01-auth-screens.md         # P1: Login, signup, forgot-password
├── 02-dashboard-screens.md    # P1: Main dashboard, analytics
├── 03-settings-screens.md     # P2: Profile, preferences
└── 04-feature-screens.md      # P2: Feature-specific pages
```

### Event Handler Conversion Pattern

| HTML Pattern | React Implementation |
|-------------|---------------------|
| `handleLogin(event)` | `useForm()` + `onSubmit` handler |
| `togglePassword()` | `useState<boolean>` for visibility |
| `showError(msg)` | Toast notification or error state |
| `document.getElementById` | `useRef()` or controlled components |
| `window.location.href` | `useNavigate()` hook |
| `classList.toggle` | `useState` + conditional className |

### Post-Conversion Validation

```bash
# Anti-pattern detection (should return 0 results)
rg "document\.(getElementById|querySelector)" src/pages/
rg "window\.location\.(href|replace)" src/pages/
rg "classList\.(add|remove|toggle)" src/pages/
rg "innerHTML\s*=" src/pages/
```

---

## Status (`--status`)

Show conversion progress from `design/html-mapping.json`.

```
Overall Progress: 60% (6/10)

Auth screens:     3/3 complete
Dashboard:        2/3 in progress
Settings:         1/4 pending
```

---

## Rules

- Always run phases in order: analyze → map → prompts
- Create shared components before converting screens
- Use the project's existing component patterns and conventions
- Validate with anti-pattern detection after each conversion
- Run design QA (`design-qa:`) to verify visual fidelity

## Error Handling

- No HTML files found: **STOP** and suggest running `prompts-to-aura` first
- Frontend stack not detected: **ASK** user for framework details
- Analysis incomplete: proceed with available data, note gaps

## Related

- Previous step: `prompts-to-aura` → `aura-to-git` → `set-html-routing`
- Implementation: `ui-builder` agent
- Verification: `design-qa` agent
