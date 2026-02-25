# {PROJECT_NAME}

{PROJECT_DESCRIPTION}

## Directory Map
- `src/types/` — Type definitions (no imports from other layers)
- `src/config/` — Configuration, env vars (imports: types)
- `src/repo/` — Data access, API clients (imports: types, config)
- `src/service/` — Business logic (imports: types, config, repo)
- `src/runtime/` — App bootstrap, routes, middleware (imports: all above)
- `src/ui/` — UI components, pages (imports: all above)

## Commands
- Dev: `{DEV_COMMAND}`
- Test: `{TEST_COMMAND}`
- Lint: `{LINT_COMMAND}`
- Build: `{BUILD_COMMAND}`
- Architecture: `./architecture/enforce.sh`

## Magic Keywords
`build:` `fix:` `test:` `refactor:` `review:` `arch:` `parallel:` `pipeline:` `team:`

## Architecture
See `architecture/ARCHITECTURE.md`. Dependencies flow top-down only.

## Conventions
See `docs/CONVENTIONS.md`. Kebab-case files, max 300 lines, one concern per file.

## Memory
- Decisions: `memory/DECISIONS.md`
- Patterns: `memory/PATTERNS.md`
- Mistakes: `memory/MISTAKES.md`
- Progress: `memory/PROGRESS.md`
