# claude-harness

Agent-first development harness. Humans design, agents code.

## Directory Map
- `harness/` — Core: parallel agents, auto-fix loops, worktree management
- `orchestration/` — 5 modes: solo, parallel, pipeline, team, fullstack
- `architecture/` — Layer rules & enforcement scripts (protected)
- `hooks/` — Lifecycle hooks (edit, stop, prompt, session-start) (protected)
- `agents/` — Agent roles + manifest (feature-builder, bug-fixer, etc.)
- `skills/` — Auto-activation triggers (magic keywords, intent matching)
- `scripts/` — Autopilot (tmux persistent execution)
- `ci/` — GitHub Actions for autonomous CI/CD
- `memory/` — Persistent: decisions, patterns, mistakes, progress
- `prd/` — PRD templates and active requirements (Source of Truth)
- `tests/` — Harness self-tests: smoke/ (P2) + guards/ (P0/P1)
- `templates/` — Bootstrap templates + status tracking
- `docs/` — Conventions, workflow, troubleshooting

## Magic Keywords
`build:` `fix:` `test:` `refactor:` `review:` `arch:` `deploy:` `db:` `secure:` `perf:` `docs:` `design:` `ui:` `design-qa:` `prd:` `parallel:` `pipeline:` `team:` `fullstack:`

| Keyword | Triggers | Purpose |
|---------|----------|---------|
| `prd:` | prd-normalize skill | Convert any PRD → standard template (no hallucination) |
| `design:` | design-pipeline run.md | Full pipeline: PRD → Aura → HTML → GitHub Pages → mockups/ |
| `ui:` | ui-builder agent | Implement UI from existing design assets (mockups, screenshots) |
| `design-qa:` | design-qa agent | Visual fidelity QA against design source |

## Commands
- Enforce: `./architecture/enforce.sh`
- Parallel: `./harness/orchestrator.sh tasks.json`
- Worktree: `./harness/worktree-manager.sh create <name> "<task>"`
- Auto-fix: `./harness/auto-fix-loop.sh "<cmd>" <max_retries>`
- Autopilot: `./scripts/autopilot.sh "<prompt>"`
- Tests: `./tests/run-tests.sh [smoke|guards|all]`
- PRD: `prd: <any-prd-file>` or copy `prd/FEATURE_PRD.template.md` to `prd/prd-<name>.md`

## Protected Paths (에이전트 편집 불가)
`harness/`, `hooks/`, `architecture/`, `.claude/`, `CLAUDE.md`는 pre-edit 훅이 자동 차단합니다.
예외가 필요하면 사람이 `architecture/rules.json`의 `exceptions.allowed_core_edits`에 추가해야 합니다.

## Safety Policy
- `harness.config.json`의 `safeMode: true`가 기본. 병렬 에이전트 수, 재시도 횟수 제한.
- `deploy:`, `db:`, `secure:` 키워드는 사용자 확인 전까지 차단됩니다.
- 가드 테스트(P0)가 실패하면 모든 자동 작업이 즉시 중단됩니다.

## Architecture
See `architecture/ARCHITECTURE.md`. Top-down only: types → config → repo → service → runtime → ui.

## Conventions
See `docs/CONVENTIONS.md`. Kebab-case files, max 300 lines, one concern per file.

## Memory
- `memory/DECISIONS.md` — Architecture decisions
- `memory/PATTERNS.md` — Discovered patterns (auto-recorded)
- `memory/MISTAKES.md` — Bug patterns to avoid
- `memory/PROGRESS.md` — Session summaries (auto-recorded)
