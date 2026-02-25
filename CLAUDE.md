# ReviewBoard

디자인 리뷰 플랫폼. 핀 기반 피드백 + Slack 연동.

## Project Structure
- `app/` — Next.js 16 앱 (TypeScript, Tailwind, Supabase)
- `mockups/` — HTML 프로토타입 (디자인 레퍼런스)
- `issues/` — 이슈 트래킹

## Harness (`.harness/`)
모든 하네스 도구는 `.harness/` 안에 위치. 프로젝트 코드와 분리됨.

### Directory Map
- `.harness/*.sh` — Core: pipeline-runner, fullstack-runner, auto-fix, infra-prep 등
- `.harness/agents/` — Agent roles + manifest
- `.harness/architecture/` — Layer rules & enforcement (protected)
- `.harness/hooks/` — Lifecycle hooks (protected)
- `.harness/orchestration/` — 5 modes: solo, parallel, pipeline, team, fullstack
- `.harness/prd/` — PRD templates and active requirements
- `.harness/memory/` — Persistent: decisions, patterns, mistakes
- `.harness/tests/` — Harness self-tests: smoke/ + guards/
- `.harness/skills/` — Auto-activation triggers
- `.harness/templates/` — Bootstrap templates + status tracking

### Commands
- Enforce: `./.harness/architecture/enforce.sh`
- Fullstack: `./.harness/fullstack-runner.sh "<description>"`
- Pipeline: `./.harness/pipeline-runner.sh <prd-path>`
- Auto-fix: `./.harness/auto-fix-loop.sh "<cmd>" <max_retries>`
- Infra prep: `./.harness/infra-prep.sh`
- Schema check: `./.harness/schema-analyzer.sh`
- Review fix: `./.harness/review-fixer.sh <review.json>`
- Env discover: `./.harness/env-manager.sh discover`
- Tests: `./.harness/tests/run-tests.sh [smoke|guards|all]`

### Protected Paths (에이전트 편집 불가)
`.harness/`, `.claude/`, `CLAUDE.md`는 pre-edit 훅이 자동 차단합니다.

### Safety Policy
- `.harness/harness.config.json`의 `safeMode: true`가 기본.
- `deploy:`, `db:`, `secure:` 키워드는 사용자 확인 전까지 차단.
- 가드 테스트(P0) 실패 시 자동 작업 즉시 중단.

## Architecture
See `.harness/architecture/ARCHITECTURE.md`. Top-down only: types → config → repo → service → runtime → ui.

## Conventions
See `.harness/docs/CONVENTIONS.md`. Kebab-case files, max 300 lines, one concern per file.
