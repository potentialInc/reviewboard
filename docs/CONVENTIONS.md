# Coding Conventions

## Naming
- **Files/dirs**: `kebab-case` (e.g., `user-service.ts`, `auth-config.ts`)
- **Classes/Types**: `PascalCase` (e.g., `UserService`, `AuthConfig`)
- **Functions**: `camelCase` (TS/JS) or `snake_case` (Python/Go)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`, `API_BASE_URL`)
- **No abbreviations**: `getUserById` not `getUsrById`

## File Structure
- One concern per file
- Max 300 lines per file — split if larger
- Export public API through `index.ts` / `__init__.py`
- Colocate tests: `foo.ts` → `foo.test.ts` (same directory)

## Functions
- Max 50 lines per function
- One return type per function (avoid unions when possible)
- Document non-obvious parameters
- No side effects in functions named `get*` or `find*`

## Error Handling
- Throw errors at system boundaries (API routes, CLI entry points)
- Return Result/Option types in service/repo layers
- Never swallow errors silently
- Include context in error messages: "User not found: id=123"

## Imports
- Follow layer direction: types → config → repo → service → runtime → ui
- Import from module index, not internal files
- Group imports: external libs → internal modules → relative files

## Language-Specific Conventions

### TypeScript / JavaScript
- Use `const` over `let`; never use `var`
- Prefer `interface` over `type` for object shapes
- Use strict mode (`"strict": true` in tsconfig)
- Async/await over raw promises or callbacks

### Python
- Follow PEP 8 and PEP 257 (docstrings)
- Use type hints on all public functions
- Prefer `pathlib.Path` over `os.path`
- Use `dataclass` or Pydantic `BaseModel` for data structures
- Virtual environments required (`.venv/`)
- Format with `black`, lint with `ruff`

### Go
- Follow Effective Go and Go Code Review Comments
- Use `internal/` for private packages
- Return `error` as last value; wrap with `fmt.Errorf("context: %w", err)`
- Use `struct` embedding over inheritance
- Format with `gofmt`, lint with `golangci-lint`

### Rust
- Follow Rust API Guidelines
- Use `Result<T, E>` for fallible operations
- Prefer `&str` over `String` in function parameters
- Use `clippy` for linting, `rustfmt` for formatting
- Organize with `mod.rs` or inline modules

### Shell (Bash)
- Use `#!/usr/bin/env bash` shebang
- Always `set -euo pipefail` at the top
- Quote all variables: `"$VAR"` not `$VAR`
- Use `shellcheck` for linting

## Communication Language

- **Mirror the user's language**: If the user writes in Korean, respond in Korean. If in English, respond in English.
- All documentation files (`docs/`, `README.md`) are written in English as the base language.
- PRD files in `prd/` may be written in any language — agents must follow the PRD's language.
- Code comments should be in English regardless of the user's language.

## Design Assets

### Directory Structure
```
design/
├── screens/              # Figma screenshots, wireframes (PNG/JPEG)
├── mockups/              # HTML/CSS mockup files (from AURA or manual)
├── design-guide.md       # Design guide (from prd-to-design-guide)
├── aura-prompts.md       # AURA.build prompts (from prd-to-design-prompts)
├── html-analysis.md      # HTML analysis (from html-to-react --analyze)
├── html-mapping.json     # HTML→React mapping (from html-to-react --map)
└── conversion-prompts/   # Conversion prompts (from html-to-react --prompts)
```

### File Naming
- `{screen-name}-{variant}.{ext}` (e.g., `dashboard-mobile.png`, `login-dark.png`)
- Use kebab-case, same as all other files
- Variants: `mobile`, `tablet`, `desktop`, `dark`, `hover`, `error`, `empty`

### Design Pipeline (non-developer workflow)

Full pipeline from PRD to live code:

```
PRD → Design Guide → AURA Prompts → HTML Screens → GitHub Pages → Routing Fix → Code
```

| Step | Skill | Input | Output |
|------|-------|-------|--------|
| 1 | `prd-to-design-guide` | PRD | `design/design-guide.md` |
| 2a | `prd-to-design-prompts` | PRD (fast path) | `design/aura-prompts.md` |
| 2b | `design-guide-to-aura-prompts` | Design Guide (precise) | `design/aura-prompts.md` |
| 3 | `prompts-to-aura` | AURA prompts | `generated-screens/{project}/` |
| 4 | `aura-to-git` | HTML files | GitHub Pages live URL |
| 5 | `set-html-routing` | Live URL + HTML | Fixed navigation |
| 6 | `html-to-react` | HTML mockups | React components |
| 7 | `design:` | Design assets | Production UI |

Skills are in `skills/design-pipeline/` and `skills/html-to-react/`.

### Workflow (manual)
- Place design files in `design/` before running `design:` commands
- The `ui-builder` agent reads images directly (Claude is multimodal)
- For Figma: use `figma-extract-screens` to populate `SCREEN_STATUS.md`

## Production Templates

Templates for common production patterns. Agents reference these automatically.

### Directory Structure
```
templates/
├── auth/                     # Authentication boilerplates
│   ├── nextauth.md           # NextAuth.js (Next.js)
│   ├── supabase-auth.md      # Supabase Auth
│   └── jwt-manual.md         # Manual JWT (FastAPI, Express, Go)
├── seed/
│   └── seed-guide.md         # Tiered data seeding (base/demo/stress)
├── common-ui/
│   └── error-pages.md        # 404, 500, loading, empty states
├── monitoring/
│   └── observability.md      # Sentry, structured logging, health checks
├── deploy/
│   ├── staging-prod.md       # Multi-environment promotion flow
│   ├── domain-ssl.md         # Custom domain & SSL setup
│   └── backup-recovery.md    # Database backup & restore
├── integrations/
│   ├── payments.md           # Stripe, Toss Payments
│   └── email.md              # Resend, SendGrid, push notifications
├── i18n/
│   └── setup.md              # next-intl, react-i18next
├── cache/
│   └── strategy.md           # Multi-layer caching (client/CDN/server/DB)
└── docker/
    └── compose-dev.md        # Docker Compose local dev environment
```

### QA & Testing

```
skills/
├── visual-regression/        # Playwright screenshot baseline comparison
│   └── SKILL.md
├── flaky-test-detection/     # Detect, quarantine, track flaky tests
│   └── SKILL.md
└── load-testing/             # k6/Artillery load & stress testing
    └── SKILL.md

templates/qa/
├── preview-deploy-test.md    # CI workflow for PR preview URL testing
├── cross-browser.md          # Playwright multi-browser config
└── test-impact-analysis.md   # Run only tests affected by changes
```

### Agent → Template Mapping

| Agent | Templates Used |
|-------|---------------|
| `database-agent` | seed-guide, backup-recovery |
| `devops-agent` | compose-dev, staging-prod, domain-ssl, backup-recovery, observability, preview-deploy-test, cross-browser |
| `documentation-agent` | api-docs skill |
| `performance-agent` | cache strategy, load-testing skill |
| `test-writer` | e2e-gen skill, seed-guide, visual-regression, flaky-test-detection, cross-browser, test-impact-analysis |
| `ui-builder` | error-pages, i18n, visual-regression |
| `security-agent` | auth templates, payments |

## Git
- Commits: `type: description` (feat, fix, refactor, test, docs, chore)
- Branches: `agent/<task-name>` for automated work
- One logical change per commit
