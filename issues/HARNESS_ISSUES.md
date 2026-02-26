# Harness Process Issues

> 이번 빌드에서 하네스가 자동 처리하지 못했거나 수동 개입이 필요했던 사항들.
> 하네스 개선 시 참고.

---

## HARNESS-001: Supabase 프로젝트 자동 생성 불가
- **증상**: Supabase CLI 미인증 상태에서 `supabase projects list` 실패. 로컬 Supabase 시작 시 Docker Desktop이 꺼져있어 수동 실행 필요.
- **원인**: `supabase login` 미완료, Docker 데몬 미실행
- **해결**: Docker Desktop 수동 시작 후 `supabase start`로 로컬 인스턴스 사용
- **하네스 개선안**:
  - `fullstack` 파이프라인에 "인프라 준비" 단계 추가 (Docker 상태 체크 → 자동 시작)
  - Supabase access token을 `.env`에 미리 설정하는 가이드 또는 자동화

## HARNESS-002: 런타임 테스트가 빌드 후 자동 실행되지 않음
- **증상**: `npm run build` 성공 후 API 스모크 테스트를 수동으로 실행해야 했음
- **원인**: 파이프라인에 "런타임 검증" 단계가 없음
- **하네스 개선안**:
  - `phase-validator.sh`에 "runtime-smoke" 검증 타입 추가
  - dev 서버 시작 → curl 기반 E2E 테스트 → 결과 검증 → 서버 종료 자동화
  - 이 프로젝트의 스모크 테스트 스크립트를 `tests/smoke/` 템플릿으로 추출

## HARNESS-003: 리뷰 결과 자동 수정 파이프라인 부재
- **증상**: 리뷰 에이전트 3개가 80+ 이슈를 찾았지만, 수정은 수동으로 우선순위별 분류 후 하나씩 진행
- **원인**: 리뷰 → 수정 자동 연결 없음
- **하네스 개선안**:
  - 리뷰 에이전트 출력을 구조화된 JSON으로 (파일, 라인, 심각도, 수정코드)
  - `auto-fix-loop.sh`가 리뷰 결과 JSON을 입력받아 자동 수정 + 빌드 검증 루프
  - P0은 즉시 수정, P1/P2는 issues/ 폴더에 자동 기록

## HARNESS-004: Supabase Nested Select FK 모호성 사전 감지 불가
- **증상**: `client_accounts(login_id)` 쿼리가 ambiguous FK로 실패하지만 빌드 타임에 감지 불가. 런타임 404로만 나타남.
- **원인**: PostgREST의 FK 모호성은 타입 체크로 잡을 수 없음
- **하네스 개선안**:
  - Supabase 사용 프로젝트에서 `schema.sql` 기반 FK 관계 분석 도구 추가
  - 2개 이상 경로가 있는 테이블 join 사용 시 경고 생성

## HARNESS-005: 환경별 설정 자동화 부족
- **증상**: `.env.local` 수동 생성. Slack 토큰은 다른 프로젝트에서 수동 복사.
- **원인**: 하네스에 "시크릿 관리" 또는 "환경 설정" 단계 없음
- **하네스 개선안**:
  - PRD에 외부 서비스 목록 정의 → `.env.local.example` 자동 생성
  - 로컬 개발 시 필요한 시크릿을 기존 프로젝트에서 자동 탐색/복사
  - `harness.config.json`에 `shared_secrets` 경로 설정 지원

## HARNESS-006: 생성 파일 위치 규칙 미적용
- **증상**: `SCREEN_STATUS.md`가 프로젝트 루트에 생성됨. `docs/` 또는 적절한 하위 폴더에 위치해야 함.
- **원인**: 파일 생성 시 디렉토리 규칙이 없음. 에이전트가 편의상 루트에 생성.
- **해결**: 수동으로 `docs/SCREEN_STATUS.md`로 이동
- **하네스 개선안**:
  - `architecture/rules.json`에 파일 배치 규칙 추가 (status → `docs/`, reports → `docs/`, issues → `issues/`)
  - post-write 훅에서 루트 디렉토리에 `.md` 파일 생성 시 경고 + 적절한 폴더 제안
  - 템플릿 파일(`templates/status/`)에 output 경로 메타데이터 포함

## HARNESS-008: 배포 파이프라인 및 라이브 링크 부재
- **증상**: 코드가 GitHub 레포(`PotentialJayden/jayden-reviewboard`)에 푸시되었으나 라이브 URL이 없음. 빌드 성공해도 접근 가능한 환경이 존재하지 않음.
- **원인**: 배포 설정(Dockerfile, docker-compose, Dokploy 설정, CI/CD 워크플로우)이 프로젝트에 전혀 없음. `claude-base`의 deployment.md 스킬(Phase 9: ship)이 실행되지 않았음.
- **현재 상태** (해결 중):
  - ✅ `app/Dockerfile` — Node 20 Alpine, 3-stage multi-stage build (deps → build → runner), standalone output
  - ✅ `docker-compose.yml` — production용 (환경변수 주입)
  - ✅ `docker-compose.dev.yml` — development용 (Supabase 로컬 연동)
  - ✅ `.github/workflows/deploy.yml` — Build + Deploy (dev/staging/production 3환경)
  - ✅ `app/src/app/api/health/route.ts` — DB 연결 체크 포함 헬스체크 엔드포인트
  - ✅ `app/.env.local.example` — 환경변수 템플릿 (기존)
  - ⏳ Dokploy/AWS ECS 실제 연결 — 인프라 설정 후 워크플로우 주석 해제 필요
- **하네스 개선안**:
  - `fullstack` 파이프라인의 Phase 9(ship)가 빌드 성공 후 자동 트리거되도록 연결
  - `deployment.md` 스킬이 프로젝트 타입(Next.js/NestJS/Django) 감지 후 적절한 Dockerfile 자동 생성
  - 배포 전 체크리스트 자동 검증: Dockerfile 존재, 환경변수 설정, 헬스체크 엔드포인트 확인

## HARNESS-009: 에이전트가 스스로 확인 가능한 것을 사용자에게 질문
- **증상**: 배포 인프라 설정 후 "Dokploy나 AWS 어떤 방식으로 진행할까요?"라고 질문. 에이전트가 직접 `which dokploy`, `which aws`, `vercel whoami` 등으로 사용 가능한 도구를 확인할 수 있었음에도 불구하고 사용자에게 선택을 떠넘김.
- **원인**: 에이전트의 기본 행동이 "선택지 제시 → 사용자 확인 대기" 패턴. 환경 탐색 후 가능한 경로를 자동으로 판단하는 로직 없음.
- **하네스 개선안**:
  - **원칙**: 에이전트가 환경에서 확인 가능한 것(CLI 설치 여부, 로그인 상태, 설정 파일 존재 여부)은 반드시 먼저 확인한 후 진행
  - 질문 전 체크리스트: (1) 로컬 환경 탐색 완료? (2) 가능한 경로가 1개뿐인가? → 그렇다면 질문 없이 진행
  - `agents/` 공통 규칙에 "ask-last" 원칙 추가: 환경 탐색 → 가능 경로 판단 → 1개면 바로 실행, 2개 이상이면 추천과 함께 진행
  - 파괴적이지 않은 작업(빌드, 테스트, 탐색)은 절대 질문하지 않고 실행

## HARNESS-010: 하네스 기능 활용률 30% — 대부분 수동 진행
- **증상**: 하네스에 27개 스크립트, 13개 에이전트, 9개 스킬, 24개 테스트, CLI가 있었으나 약 70%를 사용하지 않고 수동으로 작업함.
- **미사용 항목**:
  - ❌ 테스트 24개 (smoke 15 + guard 9): `run-tests.sh` 한 번도 실행 안 함
  - ❌ CLI: TypeScript 소스 존재, 빌드/실행 안 함 (`harness audit`, `harness skill-detect` 등)
  - ❌ 에이전트 9개: security, performance, reviewer, refactorer, test-writer, documentation, feature-builder, bug-fixer (명시적 호출 없음)
  - ❌ 스킬 8개: e2e-gen, load-testing, visual-regression, playwright-cli, api-docs, flaky-test-detection, html-to-react, prd-normalize
  - ❌ 병렬 오케스트레이션: worktree 기반 병렬 에이전트 미사용, 전부 순차 처리
  - ❌ MCP 연동 3개: Playwright, PostgreSQL, GitHub MCP 설정만 되고 사용 안 함
  - ⚠️ 훅 11개: 설정됐으나 실행 여부 불명
- **원인**:
  - 에이전트가 "작업 진행"에 집중하면서 "하네스 도구 활용" 단계를 건너뜀
  - 하네스 기능 목록을 작업 시작 전에 체크하는 프로세스 없음
  - 수동 진행이 "더 빠르다"고 판단해 자동화 도구를 무시
- **하네스 개선안**:
  - **세션 시작 시 강제 체크리스트**: 사용 가능한 에이전트/스킬/테스트를 먼저 나열하고, 관련 도구를 활용 계획에 포함
  - `session-start.sh` 훅에서 "이번 작업에 적용 가능한 하네스 기능" 자동 추천
  - 빌드 성공 후 자동으로 `run-tests.sh smoke` 실행하는 post-build 훅 추가
  - CLI를 세션 시작 시 자동 빌드하는 bootstrap 단계 추가
  - 에이전트 매니페스트에서 현재 작업 키워드와 매칭되는 에이전트 자동 활성화

## HARNESS-011: `.harness/` 디렉토리 이동 후 테스트 경로 미조정
- **증상**: 하네스 파일을 루트 → `.harness/`로 이동한 후 테스트 24개 중 8개 실패. 경로 수정 후에도 guard 4개 실패 잔존.
- **수정 완료**:
  - ✅ Smoke 테스트 15/15 통과 — `$SCRIPT_DIR/harness/` → `$SCRIPT_DIR/` 일괄 치환
  - ✅ `protected-paths.txt`에 `.harness/` 추가
- **미수정 (guard 4개)**:
  - `test-protected-paths` [P0]: `harness/auto-fix-loop.sh` 경로가 `.harness/`로 이동했으나, 훅이 실제 파일 존재 여부로 판단하여 "위험 없음"으로 통과
  - `test-path-traversal` [P0]: symlink 테스트가 `.harness/` 경로 패턴 미매칭
  - `test-rules-json-fallback` [P0]: 동일한 보호 경로 매칭 문제
  - `test-prd-resolver` [P1]: `prd-resolver.sh`에서 `$SCRIPT_DIR` 미정의 변수 사용 (기존 버그)
- **근본 원인**: 하네스가 `harness/` 하드코딩 경로에 의존. 디렉토리 이동 시 자동 마이그레이션 없음.
- **하네스 개선안**:
  - 보호 경로를 하드코딩 대신 `harness.config.json`에서 동적으로 로드
  - 테스트 스크립트에서 `$HARNESS_ROOT` 환경변수 사용 (경로 독립적)
  - `prd-resolver.sh`의 `$SCRIPT_DIR` → `$PROJECT_ROOT` 변수 수정

## HARNESS-007: 변경 규모와 관계없이 한번에 실행 원칙
- **증상**: Design QA 결과 11개 화면의 이슈를 발견했지만, 분석만 수행하고 수정을 별도 단계로 분리함. 사용자가 "왜 한번에 안 하냐"고 지적.
- **원인**: 에이전트가 "분석 → 보고 → 승인 대기 → 수정" 순차 워크플로우를 따름. 대규모 변경에 대한 자동 실행 정책 부재.
- **하네스 개선안**:
  - **원칙**: 아무리 변경이 커도 QA/분석과 수정을 분리하지 않고, 발견된 이슈를 즉시 수정 진행
  - `agents/design-qa.md`에 `auto_fix: true` 플래그 추가 — QA 완료 후 자동으로 수정 에이전트 트리거
  - 병렬 에이전트 파이프라인: QA 결과 JSON → 자동 분류 → 병렬 수정 에이전트 실행 → 빌드 검증
  - `harness.config.json`에 `max_parallel_fix_agents` 설정 (기본값: 화면 수)
  - 사용자 확인이 필요한 경우는 파괴적 변경(삭제, 구조 변경)에만 한정

---

# Comprehensive Harness Feature Audit

> 전체 하네스 기능 감사: 사용/미사용 분류 및 개선 이슈.
> 감사일: 2026-02-25

## Feature Inventory & Usage Status

### Core Scripts (.harness/*.sh) — 16 scripts

| # | Script | Purpose | Used? | Notes |
|---|--------|---------|-------|-------|
| 1 | `auto-fix-loop.sh` | Run command, send failures to Claude for auto-fix, retry | NO | Never invoked during project |
| 2 | `orchestrator.sh` | Parallel agent dispatch via worktrees | NO | All work done sequentially |
| 3 | `worktree-manager.sh` | Create/list/cleanup git worktrees for parallel agents | NO | No worktrees created |
| 4 | `pipeline-runner.sh` | Sequential 10-phase pipeline (init→deploy) | NO | Phases run manually ad-hoc |
| 5 | `fullstack-runner.sh` | 5-superstage end-to-end (bootstrap→PRD→build→verify→ship) | NO | Not used; project built manually |
| 6 | `config-validator.sh` | Validate harness.config.json schema | NO | Config never validated |
| 7 | `deploy-manager.sh` | Detect/init/preview/promote deployments (Vercel, Fly, Docker, Railway) | NO | Docker/deploy setup done manually |
| 8 | `db-manager.sh` | ORM detection, migrations, seeds, reset | NO | Supabase migrations run manually |
| 9 | `env-manager.sh` | .env creation, validation, secret discovery | NO | .env.local created manually |
| 10 | `infra-prep.sh` | Pre-pipeline Docker/DB/service readiness check | NO | Docker checked manually |
| 11 | `stack-detector.sh` | Auto-detect tech stack (language, framework, ORM, etc.) | NO | Stack known upfront |
| 12 | `project-init.sh` | Bootstrap new project from template or detect existing | NO | Project scaffolded via create-next-app |
| 13 | `design-detector.sh` | Detect design assets for UI agent selection | NO | Mockups existed but detector not invoked |
| 14 | `phase-validator.sh` | Validate pipeline phase artifacts | NO | No pipeline phases executed |
| 15 | `prd-gate.sh` | PRD completeness validator (blocking/warning) | NO | No PRD created |
| 16 | `prd-resolver.sh` | Find active PRD via SoT selection rules | PARTIAL | Tested in hooks but no active PRD to resolve |
| 17 | `prompt-builder.sh` | Assemble Claude prompts for agent+phase+PRD | NO | No pipeline execution |
| 18 | `review-fixer.sh` | Read review JSON, auto-fix P0, log P1+ to issues/ | NO | Reviews done manually |
| 19 | `schema-analyzer.sh` | Detect FK ambiguity in SQL schemas (Supabase/PostgREST) | NO | FK issues discovered at runtime |

### Agents (.harness/agents/) — 12 agents

| # | Agent | Purpose | Used? |
|---|-------|---------|-------|
| 1 | `feature-builder.md` | Implement features from specs | NO (skill-activated in logs but 0 actual code changes) |
| 2 | `bug-fixer.md` | Diagnose and fix bugs | NO (activated but 0 changes) |
| 3 | `test-writer.md` | Write comprehensive tests | NO |
| 4 | `refactorer.md` | Improve code quality | NO |
| 5 | `reviewer.md` | Code review for quality/security | NO |
| 6 | `devops-agent.md` | Deployment pipelines, Docker, cloud | NO |
| 7 | `database-agent.md` | Schema design, migrations, data access | NO |
| 8 | `security-agent.md` | Vulnerability scan, auth review, hardening | NO |
| 9 | `performance-agent.md` | Analyze and optimize performance | NO |
| 10 | `documentation-agent.md` | Generate/maintain documentation | NO |
| 11 | `ui-builder.md` | Translate visual designs to production UI | NO |
| 12 | `design-qa.md` | Visual fidelity QA against design source | PARTIAL (design-qa report exists in docs/) |

### Skills (.harness/skills/) — 9 skills

| # | Skill | Purpose | Used? |
|---|-------|---------|-------|
| 1 | `design-pipeline/` (8 files) | Full PRD→Aura→HTML→Git pipeline | PARTIAL (mockups exist, but pipeline not run) |
| 2 | `prd-normalize/` | Convert any PRD to standard template | NO |
| 3 | `html-to-react/` | 3-phase HTML prototype→React conversion | NO (critical miss: mockups/ had HTML prototypes) |
| 4 | `e2e-gen/` | Generate E2E tests from routes | NO |
| 5 | `api-docs/` | Auto-generate OpenAPI spec | NO |
| 6 | `visual-regression/` | Visual regression testing | NO |
| 7 | `load-testing/` | Load/stress testing | NO |
| 8 | `flaky-test-detection/` | Detect and fix flaky tests | NO |
| 9 | `playwright-cli/` | Browser automation for E2E | NO |

### Hooks (.harness/hooks/) — 11 hooks

| # | Hook | Purpose | Active? |
|---|------|---------|---------|
| 1 | `session-start.sh` | Display status + magic keywords | YES (ran on session start) |
| 2 | `skill-activation-prompt.sh` | Detect magic keywords in prompts | YES (logged activations) |
| 3 | `pre-edit-arch-check.sh` | Architecture + protected path guard | YES (blocked .harness/ edits) |
| 4 | `pre-edit-security-check.sh` | Block secret leaks in edits | UNKNOWN |
| 5 | `pre-bash-guard.sh` | Block dangerous bash commands | UNKNOWN |
| 6 | `post-edit-format.sh` | Auto-format after edits | UNKNOWN |
| 7 | `post-edit-lint.sh` | Auto-lint after edits | UNKNOWN |
| 8 | `post-edit-test.sh` | Run relevant tests after edits | UNKNOWN |
| 9 | `auto-reflect.sh` | Auto-record patterns/mistakes | UNKNOWN |
| 10 | `on-stop-summary.sh` | Record session summary to PROGRESS.md | YES (PROGRESS.md has entries) |
| 11 | `build-check.sh` | Verify build passes | UNKNOWN |

### Orchestration Modes (.harness/orchestration/modes/) — 5 modes

| # | Mode | Purpose | Used? |
|---|------|---------|-------|
| 1 | `solo.md` | Single focused task | YES (de facto, all work was solo) |
| 2 | `parallel.md` | N agents simultaneously | NO |
| 3 | `pipeline.md` | Sequential phases with dependencies | NO |
| 4 | `team.md` | PM→Dev→QA autonomous loop | NO (attempted once, 0 changes) |
| 5 | `fullstack.md` | Idea→deployed project | NO |

### CI Workflows (.harness/ci/) — 5 workflows + 1 trigger script

| # | Workflow | Purpose | Used? |
|---|----------|---------|-------|
| 1 | `claude-auto-fix.yml` | Auto-fix failing CI via Claude | NO (not copied to .github/) |
| 2 | `claude-deploy.yml` | Claude-assisted deployment | NO |
| 3 | `claude-issue-solver.yml` | Auto-solve GitHub issues | NO |
| 4 | `claude-pr-review.yml` | Auto-review PRs with Claude | NO |
| 5 | `claude-security-scan.yml` | Security scan via Claude in CI | NO |
| 6 | `trigger-claude.sh` | CI wrapper for Claude invocation | NO |

### Tests (.harness/tests/) — 24 tests

| Category | Count | Used? |
|----------|-------|-------|
| Smoke (P2) | 15 | NO (run-tests.sh never executed) |
| Guards (P0/P1) | 9 | NO (never executed) |

### Memory (.harness/memory/) — 6 files

| # | File | Purpose | Used? |
|---|------|---------|-------|
| 1 | `DECISIONS.md` | Architecture decision records | YES (has 5 ADRs, but all pre-existing) |
| 2 | `PATTERNS.md` | Discovered patterns | YES (has 3 patterns, but all pre-existing) |
| 3 | `MISTAKES.md` | Bug patterns to avoid | YES (has 3 entries, but all pre-existing) |
| 4 | `PROGRESS.md` | Session summaries | YES (auto-recorded, but all "No git changes") |
| 5 | `PROGRESS.archive.md` | Archived sessions | YES |
| 6 | `memory-manager.sh` | Memory CRUD operations | UNKNOWN |

### Other Features

| # | Feature | Purpose | Used? |
|---|---------|---------|-------|
| 1 | CLI (`cli/`) | TypeScript CLI: audit, skill-detect, etc. | NO |
| 2 | MCP integrations (`mcp.json`) | Playwright, PostgreSQL, GitHub MCP | NO |
| 3 | Templates (`templates/`) | 20+ project/status templates | NO |
| 4 | Scripts: `autopilot.sh` | Persistent tmux-based autonomous execution | NO |
| 5 | Scripts: `doctor.sh` | Pre-flight diagnostic | NO |
| 6 | Scripts: `status-dashboard.sh` | Project health at a glance | NO |
| 7 | Scripts: `generate-report.sh` | Client-facing project report | NO |
| 8 | Scripts: `welcome-wizard.sh` | Interactive first-run guide | NO |
| 9 | Scripts: `first-task-guide.sh` | "What to type next" suggestions | NO |
| 10 | `lib/common.sh` | Shared shell utilities | NO (each script duplicates colors/logging) |
| 11 | PRD templates (`prd/`) | Feature PRD + System Decision templates | NO (no PRD created for ReviewBoard) |

## Summary

**Total features available**: ~85 (16 core scripts, 12 agents, 9 skills, 11 hooks, 5 modes, 6 CI workflows, 24 tests, misc)
**Features actually used**: ~6 (session-start hook, skill-activation hook, pre-edit-arch-check hook, on-stop-summary hook, solo mode by default, memory PROGRESS.md)
**Usage rate**: ~7%

---

## New Issues

### HARNESS-012: html-to-react 스킬 미사용 — HTML 프로토타입이 있었는데 수동 변환
- **Status**: Open
- **Priority**: P1
- **Description**: `mockups/` 디렉토리에 11개의 HTML 프로토타입(login, admin-dashboard, client-dashboard 등)이 존재했음. `.harness/skills/html-to-react/SKILL.md`는 3단계 자동 변환 파이프라인(analyze→map→prompts)을 제공했으나 전혀 사용되지 않음. 대신 모든 페이지를 수동으로 Next.js 컴포넌트로 재구현.
- **Action**:
  1. `design-detector.sh`가 `mockups/` 경로도 탐지하도록 개선 (현재 `design/screens/`, `design/mockups/`만 탐색)
  2. session-start 훅에서 HTML 프로토타입 존재 시 `html-to-react:` 스킬 자동 추천
  3. `html-to-react` 스킬의 Phase 1(analyze)을 프로젝트 시작 시 자동 실행하여 변환 계획 생성
  4. 향후 프로젝트에서 mockups/ 감지 시 "HTML→React 자동 변환 가능" 메시지 표시

### HARNESS-013: schema-analyzer.sh 미사용 — Supabase FK 모호성 런타임에서 발견
- **Status**: Open
- **Priority**: P1
- **Description**: `schema-analyzer.sh`는 SQL 스키마의 FK 모호성을 사전에 감지하는 도구. ReviewBoard에서 `client_accounts(login_id)` PostgREST nested select가 ambiguous FK로 실패했지만(HARNESS-004), 이 도구를 실행했다면 빌드 타임에 발견 가능했음. `app/src/lib/supabase/schema.sql`과 `app/supabase/migrations/` 파일이 존재했으므로 분석 대상이 있었음.
- **Action**:
  1. `schema-analyzer.sh`를 pipeline-runner.sh의 phase 4(database) 완료 후 자동 실행하도록 연결
  2. Supabase 프로젝트 감지 시(supabase/ 디렉토리 존재) `infra-prep.sh`에서 자동 스키마 분석 실행
  3. migration 파일 변경 시 post-edit 훅에서 schema-analyzer 트리거
  4. 결과를 issues/ 폴더에 자동 기록

### HARNESS-014: auto-fix-loop.sh 미사용 — 빌드 오류를 수동으로 반복 수정
- **Status**: Open
- **Priority**: P1
- **Description**: 프로젝트 빌드 중 TypeScript 타입 오류, 누락된 import, 환경변수 문제 등이 발생했으나 모두 수동으로 수정. `auto-fix-loop.sh`는 실패한 명령어를 Claude에게 보내 자동 수정 후 재시도하는 기능을 제공하지만 한 번도 실행되지 않음. `npm run build` 실패 → 자동 수정 → 재빌드 루프가 가능했음.
- **Action**:
  1. `npm run build` 또는 `npx tsc --noEmit` 실패 시 자동으로 `auto-fix-loop.sh` 트리거하는 post-build 훅 추가
  2. session-start에서 빌드 실패 이력이 있으면 auto-fix-loop 사용 안내 메시지 출력
  3. `.claude/settings.local.json`에 auto-fix 명령어 사전 허용 등록
  4. auto-fix-loop 실행 결과를 memory/PROGRESS.md에 자동 기록

### HARNESS-015: pipeline-runner.sh / fullstack-runner.sh 미사용 — 전체 개발을 순차적으로 수동 진행
- **Status**: Open
- **Priority**: P1
- **Description**: ReviewBoard는 types→database→backend→frontend→integrate→test→deploy 순서로 개발되었으나, 이 순서를 `pipeline-runner.sh`의 10단계 파이프라인이 정확히 정의하고 있었음. `fullstack-runner.sh`는 BOOTSTRAP→PRD→BUILD→VERIFY→SHIP 5단계를 자동 실행. 둘 다 사용하지 않고 사람이 직접 단계를 관리.
- **Action**:
  1. PRD 없이도 pipeline-runner를 실행할 수 있는 `--no-prd` 모드 추가 (CLAUDE.md 기반 동작)
  2. fullstack-runner에 "기존 프로젝트 편입" 모드 추가 (이미 코드가 있는 상태에서 verify→ship만 실행)
  3. session-start 훅에서 프로젝트 상태 분석 후 "pipeline:" 또는 "fullstack:" 명령어 추천
  4. 파이프라인 실행 없이 개발이 진행되면 경고 메시지 출력

### HARNESS-016: PRD 미작성 — prd/ 디렉토리 비어있음
- **Status**: Open
- **Priority**: P1
- **Description**: `.harness/prd/`에 `FEATURE_PRD.template.md`와 `SYSTEM_DECISION.template.md` 템플릿이 존재했으나, ReviewBoard용 PRD(`prd-reviewboard.md`)를 작성하지 않음. PRD가 없어서 `prd-gate.sh`, `prd-resolver.sh`, `pipeline-runner.sh`, `fullstack-runner.sh`, `prompt-builder.sh` 등 5개 이상의 도구가 비활성화 상태였음. PRD는 모든 파이프라인의 SoT(Source of Truth).
- **Action**:
  1. 프로젝트 시작 시 PRD 작성을 강제하는 게이트 추가 — PRD 없으면 파이프라인 시작 불가 경고
  2. `prd:` 스킬로 기존 CLAUDE.md + 코드에서 PRD 역생성 기능 추가
  3. session-start에서 prd/ 비어있으면 "PRD를 먼저 작성하세요" 안내 + 템플릿 경로 표시
  4. CLAUDE.md에 PRD 필수 여부를 명시하는 섹션 추가

### HARNESS-017: env-manager.sh 미사용 — .env 수동 생성, 시크릿 수동 복사
- **Status**: Open
- **Priority**: P2
- **Description**: `env-manager.sh`는 스택별 .env 템플릿 생성, 필수 환경변수 검증, 시블링 프로젝트에서 시크릿 자동 탐색 기능을 제공. ReviewBoard에서 `.env.local`을 수동으로 생성하고, Supabase URL/키, Slack 토큰 등을 다른 프로젝트에서 수동 복사했음. `env-manager.sh discover`를 실행했다면 자동으로 기존 프로젝트의 시크릿을 찾아 제안했을 것.
- **Action**:
  1. `infra-prep.sh`에서 `.env.local` 미존재 시 자동으로 `env-manager.sh init` 실행
  2. `env-manager.sh check`를 빌드 전 자동 실행 — 필수 변수 누락 시 빌드 차단
  3. Supabase 프로젝트 감지 시 필요한 환경변수 목록을 자동 생성하는 스택 규칙 추가
  4. session-start에서 .env 파일 상태 요약 표시

### HARNESS-018: deploy-manager.sh 미사용 — Docker/배포 설정 수동 생성
- **Status**: Open
- **Priority**: P2
- **Description**: `deploy-manager.sh`는 프로젝트 타입 감지 후 Dockerfile, docker-compose, Vercel/Fly/Railway 설정을 자동 생성. ReviewBoard의 `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`을 모두 수동으로 작성했으나, `deploy-manager.sh init docker`를 실행했다면 Next.js standalone 모드 감지 후 적절한 Dockerfile 자동 생성이 가능했음.
- **Action**:
  1. pipeline-runner의 phase 10(deploy) 실행 시 `deploy-manager.sh detect` 자동 호출
  2. `deploy:` 키워드 사용 시 deploy-manager를 먼저 실행하는 스킬 규칙 추가
  3. templates/deploy/ 의 기존 템플릿과 프로젝트 감지 결과를 결합하는 로직 강화
  4. deploy-manager가 생성한 파일을 `harness.config.json`에 기록하여 추적

### HARNESS-019: db-manager.sh 미사용 — Supabase 마이그레이션 수동 관리
- **Status**: Open
- **Priority**: P2
- **Description**: `db-manager.sh`는 Prisma, Drizzle, Supabase 등의 ORM을 자동 감지하고 마이그레이션 실행, 시드 데이터 삽입, 상태 확인 기능 제공. ReviewBoard는 `app/supabase/migrations/`에 6개 마이그레이션 파일과 `seed.sql`이 있었으나, 이를 `supabase db push`로 수동 실행. `db-manager.sh migrate`로 자동화 가능했음.
- **Action**:
  1. `supabase/` 디렉토리 존재 감지 시 db-manager에 Supabase CLI 연동 추가
  2. pipeline-runner의 phase 4(database) 실행 시 `db-manager.sh detect` + `migrate` 자동 호출
  3. 스키마 변경(migration 파일 수정) 감지 시 post-edit 훅에서 `db-manager.sh status` 실행
  4. seed.sql 존재 시 개발 환경 시작 시 자동 시드 옵션 제공

### HARNESS-020: test-writer 에이전트 미사용 — 테스트 코드 0줄
- **Status**: Open
- **Priority**: P1
- **Description**: ReviewBoard에는 API 라우트 17개, 서비스 로직(auth, slack, rate-limit), UI 컴포넌트 12개가 있으나 테스트 코드가 단 하나도 없음. `test-writer` 에이전트는 공개 함수 스캔 → 우선순위 분류 → 유닛/통합/E2E 테스트 작성 파이프라인을 제공. `test:` 키워드로 즉시 활성화 가능했음.
- **Action**:
  1. pipeline-runner의 phase 8(test) + 9(qa) 완료를 빌드 성공 조건에 포함
  2. `build:` 또는 `fullstack:` 키워드 실행 시 테스트 작성을 자동 포함하는 규칙 추가
  3. post-build 훅에서 테스트 커버리지가 0%이면 강제 경고 + `test:` 명령어 안내
  4. e2e-gen 스킬과 연동하여 라우트 기반 E2E 테스트 자동 생성

### HARNESS-021: security-agent 미사용 — 보안 감사 미실시
- **Status**: Open
- **Priority**: P1
- **Description**: ReviewBoard는 인증(세션 기반), 관리자/클라이언트 분리, Supabase RLS, API 라우트 보호 등 보안이 중요한 기능을 다수 포함. `security-agent`는 의존성 취약점 스캔, 시크릿 하드코딩 감지, 인증 흐름 감사, 입력 검증 확인, 보안 헤더 검증을 자동 수행하나 사용되지 않음. `secure:` 키워드로 실행 가능했음.
- **Action**:
  1. `fullstack-runner`의 VERIFY 단계에 security-agent 실행 추가
  2. `deploy:` 키워드 실행 전 security-agent를 자동 게이트로 추가
  3. CI workflow `claude-security-scan.yml`을 `.github/workflows/`에 복사하는 자동화 추가
  4. 인증 관련 코드 변경 시 post-edit 훅에서 security-agent 트리거

### HARNESS-022: reviewer 에이전트 미사용 — 코드 리뷰 수동 진행
- **Status**: Open
- **Priority**: P2
- **Description**: `reviewer` 에이전트는 코드 품질, 보안, 아키텍처 준수를 자동 리뷰. design-qa 리포트가 수동으로 생성되었듯이, 코드 리뷰도 수동이었음. `review:` 키워드로 전체 코드베이스 리뷰가 가능했고, `review-fixer.sh`로 결과를 자동 수정할 수 있었음.
- **Action**:
  1. 주요 기능 완성 후 자동으로 `review:` 에이전트 실행하는 post-phase 훅 추가
  2. `review-fixer.sh`가 reviewer 출력을 직접 소비할 수 있도록 출력 포맷 통일
  3. CI에서 `claude-pr-review.yml` 워크플로우를 활성화하여 PR마다 자동 리뷰
  4. 리뷰 결과를 issues/ 폴더에 구조화된 형태로 자동 기록

### HARNESS-023: CI 워크플로우 5개 전부 미활성화
- **Status**: Open
- **Priority**: P2
- **Description**: `.harness/ci/.github/workflows/`에 5개의 Claude 기반 CI 워크플로우(auto-fix, deploy, issue-solver, pr-review, security-scan)가 준비되어 있었으나, 프로젝트의 `.github/workflows/`에 복사되지 않아 전혀 실행되지 않음. 특히 `claude-auto-fix.yml`(CI 실패 시 자동 수정)과 `claude-pr-review.yml`(PR 자동 리뷰)은 즉시 가치를 제공할 수 있었음.
- **Action**:
  1. `project-init.sh` 또는 `fullstack-runner` BOOTSTRAP 단계에서 CI 워크플로우 자동 복사
  2. session-start에서 `.github/workflows/`에 Claude 워크플로우가 없으면 안내 메시지 출력
  3. `deploy:` 키워드 실행 시 `claude-deploy.yml` 자동 설치 제안
  4. CI 워크플로우 설치 상태를 `status-dashboard.sh`에 표시

### HARNESS-024: orchestrator.sh / worktree-manager.sh 미사용 — 병렬 실행 기회 놓침
- **Status**: Open
- **Priority**: P2
- **Description**: ReviewBoard 개발에서 독립적인 작업들(admin 대시보드 vs client 대시보드, API 라우트 vs UI 컴포넌트)을 순차적으로 처리했으나, `parallel:` 모드로 동시 실행이 가능했음. `orchestrator.sh`는 tasks.json 기반으로 여러 에이전트를 별도 worktree에서 동시 실행하고 결과를 자동 머지.
- **Action**:
  1. `build:` 키워드에 복수 모듈이 감지되면 자동으로 `parallel:` 모드 제안
  2. tasks.json 자동 생성 기능 추가 — PRD 또는 CLAUDE.md에서 독립 작업 추출
  3. orchestrator 실행 결과를 PROGRESS.md에 자동 기록
  4. session-start에서 이전 세션의 TODO가 2개 이상 독립 작업이면 병렬 모드 추천

### HARNESS-025: 테스트 스위트 24개 전부 미실행 — 하네스 무결성 미검증
- **Status**: Open
- **Priority**: P1
- **Description**: `.harness/tests/`에 smoke 15개 + guard 9개 = 총 24개 테스트가 있었으나 `run-tests.sh`가 한 번도 실행되지 않음. Guard 테스트는 보호 경로 무결성, 레이어 위반, 경로 순회 공격 방어 등 P0 보안 테스트를 포함. `.harness/` 디렉토리 이동 후 경로 불일치 문제(HARNESS-011)도 테스트 실행으로 조기 발견 가능했음.
- **Action**:
  1. session-start 훅에서 마지막 테스트 실행 시간 확인 → 24시간 초과 시 자동 실행 또는 강제 안내
  2. auto-fix-loop 성공 후 자동으로 guard 테스트 실행 (이미 코드에 있지만 루프 자체가 미실행)
  3. `.harness/` 구조 변경 감지 시 자동으로 `run-tests.sh all` 트리거
  4. CI 파이프라인에 guard 테스트를 필수 게이트로 추가

### HARNESS-026: scripts/ 유틸리티 7개 전부 미사용
- **Status**: Open
- **Priority**: P2
- **Description**: `scripts/` 디렉토리의 7개 유틸리티가 모두 미사용:
  - `doctor.sh`: 사전 진단 — Docker, jq, claude CLI 등 필수 도구 존재 확인. Docker Desktop 미실행 문제(HARNESS-001)를 자동 감지했을 것
  - `status-dashboard.sh`: 프로젝트 건강 상태 한눈에 보기 — 빌드/테스트 상태, 워크트리, 메모리 요약
  - `generate-report.sh`: 고객용 PROJECT_REPORT.md 자동 생성
  - `welcome-wizard.sh`: 첫 실행 대화형 가이드
  - `first-task-guide.sh`: 현재 상태 분석 후 다음 작업 추천
  - `autopilot.sh`: tmux 기반 지속 자율 실행
  - `harness-install.sh` / `quick-install.sh`: 하네스 설치 자동화
- **Action**:
  1. session-start 훅에 `doctor.sh` 결과 요약을 포함 (현재는 jq/git/claude만 체크)
  2. `first-task-guide.sh`를 session-start의 마지막 섹션으로 자동 실행
  3. 프로젝트 완료 시(SHIP 단계) `generate-report.sh` 자동 실행
  4. `status-dashboard.sh`를 `harness status` CLI 명령어에 연결

### HARNESS-027: MCP 통합 3개 미사용 — Playwright, PostgreSQL, GitHub
- **Status**: Open
- **Priority**: P2
- **Description**: `.harness/mcp.json`에 Playwright(브라우저 자동화), PostgreSQL(직접 DB 접근), GitHub(이슈/PR 관리) MCP 서버가 설정되어 있었으나 프로젝트에서 활성화되지 않음. Playwright MCP로 E2E 테스트를 실행하고, PostgreSQL MCP로 Supabase 직접 쿼리하고, GitHub MCP로 이슈를 자동 생성할 수 있었음.
- **Action**:
  1. `mcp.json`을 프로젝트 루트의 `.claude/` 설정에 자동 연결하는 설치 스크립트 추가
  2. `infra-prep.sh`에서 MCP 서버 가용성 체크 추가
  3. `test:` 키워드 실행 시 Playwright MCP 자동 연결
  4. `db:` 키워드 실행 시 PostgreSQL MCP 자동 연결 (DATABASE_URL 필요)

### HARNESS-028: CLI (harness-cli.mjs) 미사용 — TypeScript CLI 빌드/실행 안 됨
- **Status**: Open
- **Priority**: P2
- **Description**: `.harness/cli/`에 TypeScript 기반 CLI가 있으며 `config validate`, `skill-detect`, `audit` 등의 명령어를 제공. 빌드된 `dist/harness-cli.mjs`도 존재하나 한 번도 실행되지 않음. `config-validator.sh`가 CLI를 우선 사용하도록 설계되어 있었으나, CLI 자체가 실행된 적이 없음.
- **Action**:
  1. session-start 훅에서 CLI 가용 여부 확인 + 미빌드 시 자동 빌드 시도
  2. `harness` CLI 명령어를 magic keyword로 등록 (`harness:` 키워드)
  3. `npm run build`가 성공한 후 CLI 자동 빌드하는 post-build 훅 추가
  4. CLI 명령어를 shell 스크립트의 Tier 1 실행 경로로 활용 (config-validator.sh 패턴 확산)

### HARNESS-029: templates/ 20+ 템플릿 미활용 — 프로젝트 구조 직접 생성
- **Status**: Open
- **Priority**: P2
- **Description**: `.harness/templates/`에 nextjs, auth, deploy, qa, status 등 20개 이상의 프로젝트 템플릿이 있었으나 전혀 참조되지 않음. 특히:
  - `templates/auth/supabase-auth.md`: Supabase 인증 패턴 — ReviewBoard의 auth 구현에 직접 활용 가능했음
  - `templates/deploy/`: Docker + CI 설정 템플릿
  - `templates/status/PIPELINE_STATUS.template.md`: 파이프라인 상태 추적
  - `templates/qa/`: QA 체크리스트
  - `templates/seed/`: 시드 데이터 가이드
- **Action**:
  1. `project-init.sh --detect`에서 감지된 스택에 맞는 템플릿 자동 적용
  2. 에이전트 프롬프트에 관련 템플릿 경로를 자동 주입 (`prompt-builder.sh` 개선)
  3. `stack-map.json`과 템플릿 디렉토리를 연결하는 자동 매핑 로직 추가
  4. session-start에서 미사용 템플릿 중 현재 작업에 관련된 것 추천

### HARNESS-030: design-detector.sh + ui-builder 에이전트 미사용 — UI 구현 수동 진행
- **Status**: Open
- **Priority**: P2
- **Description**: `design-detector.sh`는 `design/screens/`, `design/mockups/`, `design/figma/` 경로에서 디자인 자산을 탐지하여 적절한 에이전트(ui-builder vs feature-builder)를 선택. `mockups/` 디렉토리에 HTML 프로토타입이 11개 존재했으나, `design/mockups/`가 아닌 프로젝트 루트의 `mockups/`에 있어서 탐지 실패. ui-builder 에이전트는 시각적 디자인을 프로덕션 UI 컴포넌트로 변환하는 전문 에이전트였으나 활성화되지 않음.
- **Action**:
  1. `design-detector.sh`에 프로젝트 루트의 `mockups/` 경로 추가 탐색
  2. design-detector가 0 결과일 때도 프로젝트 전체에서 HTML/이미지 파일 검색하는 폴백 추가
  3. `pipeline-runner.sh` phase 6(frontend)에서 design-detector 결과에 따라 ui-builder 자동 선택 확인
  4. SCREEN_STATUS.md를 ui-builder 출력으로 자동 생성하는 파이프라인 연결

### HARNESS-031: documentation-agent + api-docs 스킬 미사용 — API 문서화 없음
- **Status**: Open
- **Priority**: P2
- **Description**: ReviewBoard에 17개의 API 라우트가 있으나 API 문서가 전혀 없음. `documentation-agent`는 코드에서 엔드포인트를 자동 스캔하여 OpenAPI 3.1 스펙을 생성하고, `api-docs` 스킬은 라우트 파일에서 요청/응답 스키마를 추출. `docs:` 키워드로 즉시 실행 가능했음.
- **Action**:
  1. pipeline-runner의 phase 9(qa) 완료 후 documentation-agent 자동 실행 옵션 추가
  2. `docs:` 키워드 실행 시 api-docs 스킬을 우선 활성화
  3. API 라우트 파일 변경 시 post-edit 훅에서 OpenAPI 스펙 갱신 알림
  4. `generate-report.sh`에 API 문서 포함 여부 체크 추가

### HARNESS-032: memory/ 시스템 사전 데이터만 존재 — 프로젝트 고유 학습 기록 없음
- **Status**: Open
- **Priority**: P2
- **Description**: `memory/DECISIONS.md`에 5개 ADR, `PATTERNS.md`에 3개 패턴, `MISTAKES.md`에 3개 실수가 기록되어 있으나 모두 하네스 초기 설정 시 작성된 것. ReviewBoard 개발 중 발견된 패턴(Supabase RLS 설정, PostgREST FK 모호성, Next.js standalone Docker 빌드 등)이 기록되지 않음. `PROGRESS.md`는 40개 이상의 세션을 기록했으나 모두 "No git changes detected".
- **Action**:
  1. `auto-reflect.sh` 훅이 실제 코드 변경 시에만 패턴/실수를 기록하도록 개선
  2. 에이전트가 새로운 패턴을 발견하면 명시적으로 `memory-manager.sh add-pattern` 호출하도록 프롬프트에 포함
  3. PROGRESS.md에 "No git changes" 세션이 연속 3회 이상이면 경고 + 원인 분석
  4. 이슈 해결 시(issues/ 파일 수정 시) 자동으로 MISTAKES.md에 학습 기록 추가

### HARNESS-033: infra-prep.sh 미사용 — Docker/Supabase 준비 상태 수동 확인
- **Status**: Open
- **Priority**: P2
- **Description**: `infra-prep.sh`는 Docker 데몬 상태, 로컬 DB 연결, 필요 서비스 가동 여부를 사전 확인하고 자동 시작을 시도. HARNESS-001에서 Docker Desktop 미실행으로 Supabase 시작 실패한 문제는 `infra-prep.sh`를 실행했다면 자동 감지 + 안내가 가능했음.
- **Action**:
  1. `fullstack-runner.sh`의 Stage 0(INFRA PREP)이 이미 호출하지만, fullstack-runner 자체가 미사용이므로 독립 실행 경로 필요
  2. session-start 훅에서 `infra-prep.sh --check-only` 자동 실행 (경량 모드)
  3. `docker-compose.yml` 존재 감지 시 Docker 상태 자동 확인
  4. Supabase 프로젝트에서 `supabase status` 결과를 infra-prep에 통합

### HARNESS-035: 이슈 발견 후 즉시 수정 파이프라인 부재
- **Status**: Open
- **Priority**: P0
- **Description**: 보안 감사, 코드 리뷰, 스키마 분석 에이전트 3개가 총 80+ 이슈를 발견했으나, 에이전트가 "분석 → 보고 → 사용자 확인 대기" 패턴을 따라 즉시 수정하지 않음. 사용자가 "이슈가 있는것들은 그대로 바로 고치면서 진행해야되는데 도대체 왜 안한거지?"라고 지적. HARNESS-003(리뷰 결과 자동 수정 파이프라인 부재)과 HARNESS-007(변경 규모와 관계없이 한번에 실행 원칙)의 동일 패턴 반복.
- **근본 원인**: 에이전트의 기본 행동이 "보고 우선, 수정은 별도"로 설정되어 있음. 리뷰 에이전트 출력이 사람 읽기용 텍스트로만 생성되어 자동 수정 파이프라인에 입력할 수 없는 형태.
- **Action**:
  1. 리뷰 에이전트 출력을 JSON 구조화: `{ file, line, severity, fix_code, description }`
  2. `review-fixer.sh`가 리뷰 JSON을 소비하여 P0/P1은 즉시 수정, P2+는 issues/ 기록
  3. 에이전트 공통 규칙에 "발견 즉시 수정" 원칙 추가 — 분석과 수정을 절대 분리하지 않음
  4. `parallel:` 모드에서 리뷰 에이전트 + 수정 에이전트를 파이프라인으로 연결
  5. 수정 불가능한 이슈(외부 서비스, 인프라 변경)만 issues/에 기록하고 나머지는 즉시 코드 수정

### HARNESS-034: performance-agent / load-testing 스킬 미사용 — 성능 최적화 미실시
- **Status**: Open
- **Priority**: P3
- **Description**: ReviewBoard는 이미지 업로드(스크린샷), 실시간 댓글, 핀 기반 피드백 등 성능에 민감한 기능을 포함. `performance-agent`는 번들 크기 분석, API 응답 시간 벤치마크, 이미지 최적화 검토를 자동 수행. `load-testing` 스킬은 부하 테스트 시나리오를 생성. 두 가지 모두 미사용.
- **Action**:
  1. VERIFY 단계에 performance-agent를 선택적 실행 옵션으로 추가
  2. `perf:` 키워드 실행 시 bundle-analyzer + lighthouse 자동 실행
  3. Docker 이미지 빌드 후 크기 체크 자동화 (현재 수동으로 `docker images` 확인)
  4. 이미지 업로드 API에 대한 부하 테스트 시나리오 자동 생성

### HARNESS-036: design-qa/ui-builder가 dev 서버 없으면 동작 불가 — 자동 시작해야 함
- **Status**: Open
- **Priority**: P1
- **Description**: design-qa 에이전트와 ui-builder 에이전트가 시각적 검증을 위해 dev 서버가 필요하지만, 서버가 안 떠있으면 "dev 서버를 먼저 시작하세요"라고 보고하고 중단. 에이전트가 직접 `npm run dev`를 실행하고, 포트가 열릴 때까지 대기한 후 작업을 진행해야 함. "서버가 없어서 못 합니다"는 에이전트로서 실격.
- **근본 원인**: 에이전트가 환경 준비를 자기 책임으로 인식하지 않음. `infra-prep.sh`와의 연동도 없음.
- **Action**:
  1. design-qa/ui-builder 에이전트 워크플로우 첫 단계에 "dev 서버 자동 시작" 추가
  2. `npm run dev &` → `curl --retry 10 --retry-delay 2 http://localhost:3000` 패턴으로 서버 대기
  3. 작업 완료 후 자동으로 서버 프로세스 종료
  4. `infra-prep.sh`에 "dev 서버 상태 체크 + 자동 시작" 기능 추가
  5. 포트 충돌 시 자동으로 다른 포트(3001, 3002...) 시도

### HARNESS-037: 배포 계정/시크릿이 코드/대화에 노출 — .env 기반 관리 필수
- **Status**: Open
- **Priority**: P0
- **Description**: Dokploy, Supabase, Slack 등 외부 서비스 계정 정보가 대화 내에서 전달되거나 코드에 하드코딩될 위험. 모든 인증 정보는 .env 파일로 관리하고, 에이전트가 직접 접근해야 함. 대화에서 받은 계정 정보는 즉시 .env에 저장하고 이후 .env에서만 참조.
- **원칙**:
  1. 모든 외부 서비스 계정은 `.env` 또는 `.env.local`에 저장
  2. 에이전트는 코드에 계정 정보를 절대 하드코딩하지 않음
  3. CI/CD 시크릿은 GitHub Secrets 또는 Dokploy 환경변수로 관리
  4. 대화에서 전달된 시크릿은 1회 사용 후 .env에 저장, 이후 .env에서만 읽음
- **Action**:
  1. `.env.deploy` 파일 생성 — 배포 관련 시크릿 (Dokploy URL, 계정 등)
  2. `.gitignore`에 `.env.deploy` 추가 (이미 `.env*` 패턴으로 포함되어 있어야 함)
  3. 배포 스크립트가 `.env.deploy`에서 읽어서 사용하도록 구현
  4. `env-manager.sh`에 배포 시크릿 카테고리 추가

### HARNESS-038: Dokploy 배포 502 디버깅에 6회 빌드+배포 반복 — 원인 진단 체계 부재
- **Status**: Open
- **Priority**: P0
- **Description**: Dokploy에 Docker 이미지 배포 후 502 Bad Gateway 발생. 근본 원인(validateEnv throw, standalone 경로 문제, Docker HEALTHCHECK 충돌)을 찾기까지 6회의 빌드→배포→확인 루프를 반복. 매 빌드에 ~3분 소요, 컨테이너 로그를 API로 확인할 수 없어 블라인드 디버깅. 총 ~30분 낭비.
- **근본 원인 3가지** (모두 사전 예방 가능했음):
  1. **`validateEnv()` 프로덕션 throw**: `layout.tsx` 모듈 스코프에서 환경변수 누락 시 `throw new Error()`. Next.js `preloadEntriesOnStart`로 서버 시작 시 layout이 로드되어 포트 바인딩 전에 서버 크래시
  2. **Next.js standalone 빌드 경로 불일치**: 로컬 빌드의 `outputFileTracingRoot: "/Users/jis"` → standalone 출력이 `.next/standalone/Documents/Potentialai/...` 중첩 경로에 생성. Docker 내부에서는 다른 경로가 되지만, 안전하게 `next start` 방식이 더 안정적
  3. **Docker HEALTHCHECK ↔ health endpoint 503 루프**: health endpoint가 DB 미연결 시 503 → Docker가 컨테이너를 unhealthy로 판정 → 재시작 → 무한 루프
- **시행착오 타임라인**:
  1. 첫 배포: 502 → standalone `server.js` 문제 의심
  2. health endpoint 200 고정: 여전히 502 → validateEnv throw가 진짜 원인
  3. validateEnv throw 제거: 여전히 502 → standalone 경로 문제 의심
  4. nixpacks 전환: 빌드 실패 → dockerfile로 복원
  5. `next start` 방식 변경: 여전히 502 → HEALTHCHECK이 재시작 루프 유발
  6. HEALTHCHECK NONE: **성공** — 서버 정상 작동 확인
- **하네스 개선안**:
  1. **배포 전 로컬 Docker 테스트 필수화**: `docker build && docker run` → `curl health` 자동화 스크립트 추가. Dokploy에 올리기 전에 로컬에서 먼저 검증
  2. **Dockerfile 린터**: `validateEnv()` 같은 모듈 스코프 throw 패턴 감지. 프로덕션 Docker 빌드에서 `throw new Error`가 startup path에 있으면 경고
  3. **health endpoint 규칙**: Docker HEALTHCHECK용 health endpoint는 반드시 200 반환. 의존성 상태는 body에 포함 (degraded 패턴)
  4. **standalone vs next start 가이드**: `deploy-manager.sh`에서 Next.js 프로젝트 감지 시 standalone 대신 `next start` 방식 기본 생성 (standalone은 `outputFileTracingRoot` 이슈 있음)
  5. **배포 디버깅 runbook**: 502/503 → 체크리스트 (1) 로컬 Docker 테스트 (2) HEALTHCHECK 비활성화 테스트 (3) CMD에 디버그 로그 추가 (4) env var 존재 확인

### HARNESS-039: Dokploy API 엔드포인트 탐색에 과도한 시간 소비 — PaaS 통합 가이드 필요
- **Status**: Open
- **Priority**: P1
- **Description**: Dokploy API 로그인 방식(better-auth), tRPC 프로시저 이름(`gitProvider.getAll`, `github.getGithubRepositories`), 쿼리 파라미터 포맷(`?input=` URL-encoded JSON) 등을 알아내기 위해 10회 이상의 시행착오 API 호출 필요. Dokploy 소스 코드를 GitHub에서 직접 읽어야 했음.
- **근본 원인**: PaaS 플랫폼별 API 규격 지식이 하네스에 없음. `deploy-manager.sh`가 Dokploy를 지원하지 않음.
- **하네스 개선안**:
  1. `deploy-manager.sh`에 Dokploy 지원 추가: 로그인, 프로젝트 생성, 앱 생성, 환경변수 설정, 배포 트리거, 헬스체크까지 원스톱
  2. `.harness/integrations/dokploy.sh` — Dokploy API wrapper 스크립트 (login, create-project, create-app, set-env, deploy, status, logs)
  3. PaaS 통합 가이드 문서: Dokploy, Vercel, Railway, Fly.io 각각의 API 인증 방식, 필수 엔드포인트 목록
  4. `.env.deploy`에서 PaaS 타입 자동 감지하여 적절한 통합 스크립트 선택

### HARNESS-040: Docker 컨테이너 로그를 API로 확인 불가 — 블라인드 디버깅 강제
- **Status**: Open
- **Priority**: P1
- **Description**: Dokploy tRPC API에 컨테이너 런타임 로그 조회 엔드포인트가 없음 (빌드 로그는 logPath로 존재하지만 런타임 stdout/stderr는 API로 접근 불가). 502 디버깅 시 "왜 서버가 안 뜨는지" 로그를 볼 수 없어서, CMD에 `echo`로 디버그 출력을 추가하고 매번 재빌드+배포해야 했음 (~3분/회).
- **하네스 개선안**:
  1. 배포 후 자동으로 30초간 헬스체크 폴링. 실패 시 즉시 "Dokploy 웹 UI에서 컨테이너 로그 확인" 안내 + URL 제공
  2. `deploy-manager.sh`에 `--wait-healthy` 옵션: 배포 후 health endpoint 응답까지 대기, 타임아웃 시 디버그 가이드 출력
  3. Dockerfile CMD에 기본 startup 로그를 항상 포함 (env var 존재 여부, 파일 구조 확인). 프로덕션에서도 초기 1회 출력은 유지
  4. SSH/Docker exec 기반 원격 로그 조회 자동화 (서버 SSH 키가 `.env.deploy`에 있는 경우)

### HARNESS-041: `NEXT_PUBLIC_*` 빌드타임 인라인 vs 런타임 주입 혼동 — Next.js 배포 체크리스트 필요
- **Status**: Open
- **Priority**: P1
- **Description**: Next.js의 `NEXT_PUBLIC_*` 환경변수는 빌드타임에 클라이언트 코드에 인라인됨. Dockerfile에서 빌드 ARG로 전달하지 않으면 클라이언트에서 `undefined`. 런타임 env로만 설정하면 서버사이드에서는 동작하지만 클라이언트에서는 누락. 이 차이를 모르고 런타임 env만 설정하여 디버깅 시간 소모.
- **하네스 개선안**:
  1. `deploy-manager.sh`가 Next.js 감지 시 `NEXT_PUBLIC_*` 변수를 자동으로 Dockerfile ARG + ENV 양쪽에 설정
  2. Dockerfile 생성 시 `NEXT_PUBLIC_*` 빌드타임 주입 주석 자동 추가
  3. `.env.local`에서 `NEXT_PUBLIC_*` 변수를 파싱하여 Docker build args 자동 생성하는 스크립트
  4. 배포 전 체크: "NEXT_PUBLIC_ 변수 N개가 빌드 ARG로 전달되어야 합니다" 안내

### HARNESS-042: GitHub Push Protection 시크릿 노출 — 보안 감사 리포트에 실제 토큰 포함
- **Status**: Open
- **Priority**: P0
- **Description**: security-agent가 `issues/SECURITY_AUDIT.md`에 실제 Slack API 토큰(`xoxb-...`)을 그대로 기록. GitHub Push Protection이 push를 차단하여 발견됨. 시크릿이 git history에 남아서 `git reset --soft HEAD~2 && git commit`으로 히스토리를 squash해야 했음.
- **근본 원인**: security-agent가 "발견한 시크릿을 리포트에 기록"하면서 시크릿 자체를 마스킹하지 않음. 리포트가 git에 커밋되면 시크릿 유출.
- **하네스 개선안**:
  1. security-agent 프롬프트에 "발견한 시크릿은 반드시 마스킹(`xoxb-***REDACTED***`)하여 기록" 규칙 추가
  2. `pre-edit-security-check.sh` 훅이 시크릿 패턴(`xoxb-`, `sk-`, `ghp_`, `-----BEGIN`) 감지 시 편집 차단
  3. `git add` 전 자동 시크릿 스캔 — pre-commit 훅에 `grep -rn 'xoxb-\|sk-live\|ghp_\|PRIVATE KEY' --include='*.md'` 추가
  4. security-agent 출력 포맷에 `redacted: true` 필드 추가, 리포트 생성 시 자동 마스킹 적용

### HARNESS-043: PRD Audit Agent 부재 — PRD ↔ 구현 갭을 수동 분석해야 함
- **Status**: Open
- **Priority**: P1
- **Description**: PRD에 정의된 기능이 구현되지 않았거나, 구현에 있지만 PRD에 없는 기능을 자동 감지할 에이전트가 없음. `/admin/team` 페이지처럼 사이드바에 링크는 있지만 실제 페이지가 없는 케이스를 수동으로 발견해야 했음. 기존 에이전트(reviewer, design-qa, test-writer) 어느 것도 이 역할을 수행하지 않음.
- **필요 기능** (`agents/prd-audit.md`):
  1. PRD Section 9 (UI Specs) ↔ 실제 라우트(`page.tsx`) 매칭
  2. PRD Section 8 (API Endpoints) ↔ 실제 API 라우트(`route.ts`) 매칭
  3. PRD Section 10 (Acceptance Criteria) ↔ 구현 상태 검증
  4. **역방향 감지**: 코드에 있지만 PRD에 정의되지 않은 기능 탐지
  5. 네비게이션 링크 ↔ 실제 페이지 존재 여부 크로스체크
- **Output**: `gap-report.md` (갭 목록 + 심각도 + 권장 조치)
- **Trigger**: `audit:` 키워드 또는 pipeline qa 단계에서 자동 실행
- **Action**:
  1. `agents/prd-audit.md` 에이전트 정의 파일 작성
  2. `agent-manifest.json`에 등록 (domain: qa, roles: prd-auditor)
  3. `pipeline-runner.sh` phase 9(qa)에서 자동 실행하도록 연결
  4. `fullstack-runner.sh` VERIFY 단계에 포함
  5. PRD 변경 또는 라우트 파일 변경 시 post-edit 훅에서 트리거

### HARNESS-044b: Docker Swarm HEALTHCHECK 롤백 — 환경변수 변경이 반영 안 되는 사일런트 실패
- **Status**: Resolved
- **Priority**: P0
- **Description**: Dokploy(Docker Swarm) 배포 시 Dockerfile에 `HEALTHCHECK CMD wget ...`을 추가하면, 새 컨테이너의 health check가 start-period(15초) 내에 통과하지 못해 Swarm이 **자동으로 이전 컨테이너로 롤백**. 이 과정이 완전히 사일런트 — 빌드 status는 "done", 앱은 응답하지만 **이전 환경변수(로컬 Supabase URL)를 가진 이전 컨테이너가 서비스됨**. Supabase Cloud URL로 env를 변경하고 3번 배포했지만 매번 이전 컨테이너로 롤백되어 `database: error`가 지속. uptime이 계속 증가하는 것으로 롤백을 감지.
- **근본 원인**:
  1. Next.js 16 cold start가 15초 이상 소요 → HEALTHCHECK start-period=15s 부족
  2. Alpine `wget -qO-`가 응답 본문을 출력하려다 실패하는 경우 있음
  3. Docker Swarm 롤백이 deployment status에 반영되지 않음 (status=done인데 실제론 롤백)
- **해결**: `HEALTHCHECK NONE`으로 되돌려서 새 컨테이너 채택 → Cloud Supabase 연결 성공
- **하네스 개선안**:
  1. `deploy-manager.sh`에 배포 후 uptime 체크: 배포 전 uptime 기록 → 배포 후 uptime이 리셋되지 않으면 "롤백 감지" 경고
  2. Dockerfile HEALTHCHECK 설정 시 Next.js 앱은 `start-period=60s` 이상 권장
  3. HEALTHCHECK CMD는 `wget --spider` (HEAD 요청) 또는 `node -e "http.get(...)"`처럼 확실한 방법 사용
  4. Swarm 배포 후 `docker service ls`로 replicas 상태 확인 자동화
  5. 환경변수 변경 배포 시 반드시 uptime 리셋 확인 → 안 되면 즉시 "HEALTHCHECK 롤백 의심" 안내

### HARNESS-045: Supabase Cloud DB 직접 연결 불가 — CLI 마이그레이션 차단
- **Status**: Resolved (우회)
- **Priority**: P1
- **Description**: Supabase Cloud 프로젝트(`dkilhzlubhojbgrexzvv`)에 `supabase db push`로 마이그레이션을 시도했으나, 직접 연결(`db.*.supabase.co:5432`)은 IPv6 only로 "no route to host", 풀러(`aws-0-*.pooler.supabase.com:6543`)는 모든 리전에서 "Tenant or user not found". Supabase CLI 로그인도 non-TTY 환경에서 불가.
- **해결**: 마이그레이션 SQL 11개 파일을 합쳐서 클립보드에 복사 → 사용자가 Supabase SQL Editor에 붙여넣기 실행
- **하네스 개선안**:
  1. `deploy-manager.sh`에 Supabase Cloud 마이그레이션 자동화: `supabase login --token` 방식 지원
  2. CLI 로그인 불가 시 자동으로 SQL 합치기 → 클립보드 복사 → SQL Editor 안내 폴백
  3. `.env.deploy`에 `SUPABASE_ACCESS_TOKEN` 저장하여 CLI 인증 자동화
  4. IPv6 연결 실패 시 자동으로 풀러 → 직접 연결 → SQL Editor 순서로 폴백

### HARNESS-044: PRD ↔ 목업 불일치 미감지 — "Add Screen" 스크린샷 첨부 누락
- **Status**: Open
- **Priority**: P0
- **Description**: 목업(`mockups/admin-project-details.page.html:161-189`)은 "Add New Screen" 모달에 Screen Name + File Upload를 **하나의 폼**으로 통합. 그러나 PRD(`prd-reviewboard.md:105-108`)는 이름 입력(Step 7-8)과 파일 업로드(Step 9-10)를 **별도 단계**로 명세. API도 `POST /screens`(name only) + `POST /screenshots`(file only) 2개로 분리. 구현은 PRD를 충실히 따라 `AddScreenModal`(이름만) + `UploadScreenshotModal`(파일만) 2개 모달로 분리. 사용자는 목업 기준의 통합 UX를 기대.
- **근본 원인 체인**:
  1. 목업 → 통합 모달 / PRD → 분리 흐름 (불일치 발생 지점)
  2. feature-builder → PRD만 읽음 → 분리 흐름 구현
  3. test-writer → PRD AC-010(이름 생성) + AC-011(파일 업로드) 별도 → 각각 유효한 테스트 작성
  4. design-qa → 시각적 충실도만 채점 (Layout/Colors/Typography), 모달 내 폼 필드 비교 없음
  5. 어떤 에이전트도 PRD ↔ 목업 일관성을 검증하지 않음
- **왜 test-writer가 못 잡았나**:
  - `agent-manifest.json`에서 PRD Section 10(AC)만 읽음. 목업은 입력 범위 밖
  - AC-010, AC-011이 이미 분리 → 각각 유효한 테스트 생성
  - "코드가 PRD를 만족하는가"만 검증. "PRD가 디자인을 반영하는가"는 범위 밖
- **왜 design-qa가 못 잡았나**:
  - Interactions 카테고리(10%) = hover/focus/transition만 체크
  - 모달은 기본 상태에서 숨겨져 있어 스크린샷 비교 대상 아님
  - "Functional Completeness" 카테고리 자체가 없음
- **하네스 개선안**:
  1. **Reconciliation Phase 신설**: 파이프라인 Phase 2(prd) 이후 PRD ↔ 디자인 교차 검증 단계 삽입. 목업 모달/폼 인벤토리 vs PRD 인터랙션 명세 diff
  2. **design-qa에 Functional Completeness(20%) 추가**: 목업 모달 트리거 → 구현 모달 트리거 → 내부 폼 필드 비교
  3. **PRD 템플릿에 Design-to-PRD Cross Reference 테이블 필수화**: 각 인터랙션이 디자인의 어떤 요소에 대응하는지 명시적 기록
  4. **prd-gate.sh에 디자인 교차 참조 검사 추가**: 디자인 자료 존재 시 Cross Reference 테이블 없으면 WARNING
  5. **reconciler 에이전트 신설**: `agents/reconciler.md` — PRD Section 6,8,9 + 디자인 자료를 동시에 읽고 불일치 보고

### HARNESS-047: Supabase Storage 버킷 private 전환으로 이미지 깨짐 — 인프라 통합 테스트 부재
- **Status**: Open
- **Priority**: P0
- **Description**: Migration 000008 PART 4가 `screenshots` 버킷을 `public = false`로 변경. 앱은 iron-session 인증을 사용하며 Supabase JWT가 없어서, 브라우저가 `getPublicUrl()`로 생성된 이미지 URL에 직접 접근 시 인증 실패. 프로덕션에서 모든 스크린샷 이미지가 깨져 보임.
- **왜 test-writer가 못 잡았나**:
  - `screenshots-route.test.ts`에서 `supabase.storage.from().upload()`, `.getPublicUrl()` 모두 mock 처리
  - 테스트는 UUID 검증, 인증, rate limiting, magic bytes, 버전 증가, 에러 핸들링만 검증
  - **버킷 public/private 설정이 URL 접근성에 미치는 영향**은 테스트 범위 밖
  - Unit test가 infrastructure 레벨 설정(RLS policy, bucket visibility)을 검증할 수 없는 구조적 한계
- **하네스 개선안**:
  1. **배포 후 스모크 테스트에 이미지 URL 접근성 검증 추가**: 업로드 후 `getPublicUrl()` 결과를 실제 HTTP GET으로 200 확인
  2. **Storage integration test 카테고리 신설**: mock 없이 로컬 Supabase에서 실제 버킷 접근성 테스트
  3. **migration 검증 규칙**: `storage.buckets` 테이블 변경하는 migration 감지 시 "인증 방식과 호환되는지" 경고
  4. **security-agent가 버킷 변경 시 인증 흐름 크로스체크**: iron-session 프로젝트에서 버킷 private 전환 → "브라우저 직접 접근 불가" 자동 경고
  5. **post-migration 훅**: migration 적용 후 자동으로 주요 기능(이미지 표시, 파일 다운로드) 스모크 테스트

### HARNESS-048: createServiceSupabase 매 요청마다 새 인스턴스 생성 — DB Latency 752ms
- **Status**: Resolved
- **Priority**: P1
- **Description**: Health endpoint에서 DB latency가 752ms로 측정됨. 실제 쿼리 시간은 ~100-200ms이지만, `createServiceSupabase()`가 매 호출마다 새 Supabase 클라이언트를 생성하여 DNS 조회(~50ms) + TCP 연결(~60ms) + TLS 핸드셰이크(~150ms) + SDK 초기화(~50ms)가 매번 반복.
- **근본 원인**: `createServerSupabase()`는 매 요청마다 쿠키를 읽어야 해서 per-request 생성이 필수. `createServiceSupabase()`는 쿠키/세션이 없는 stateless 클라이언트인데, 같은 파일에 있다 보니 동일한 per-request 패턴을 **cargo-cult**로 복사. `async function` + `return createClient()`로 매번 새 인스턴스 반환.
- **영향 범위**: 전체 API 라우트 9개 파일, 14개 호출 지점 + api-helpers.ts 2개 = 총 16곳에서 매 요청마다 불필요한 클라이언트 재생성
- **해결**: `createServiceSupabase()`를 모듈 레벨 싱글턴으로 변경. 첫 호출에서만 인스턴스 생성, 이후 캐시된 인스턴스 반환.
- **기대 효과**: 첫 요청 이후 DB latency ~100-200ms로 감소 (TLS 핸드셰이크 + TCP 재연결 비용 제거)
- **하네스 개선안**:
  1. Supabase 프로젝트에서 service role 클라이언트가 per-request 생성되면 경고하는 린트 규칙 추가
  2. `performance-agent`가 HTTP 클라이언트/DB 클라이언트 인스턴스화 패턴을 자동 분석하는 규칙 추가
  3. `templates/auth/supabase-auth.md`에 "service role client는 반드시 싱글턴" 패턴 명시
  4. `config.toml`의 `[db.pooler] enabled = false`를 로컬 개발용임을 명시하는 주석 추가 (Cloud Supabase는 자체 pooler 사용)

### HARNESS-049: QA 테스트 자동화 — 빌드 완료 후 자동 실행 필요
- **Status**: Open
- **Priority**: P1
- **Description**: 현재 QA 테스트(admin-user-flow, client-user-flow 등 350개 테스트)가 수동 프롬프트로만 실행됨. 빌드가 끝날 때마다 자동으로 QA 테스트를 실행하는 파이프라인이 없어, 회귀 버그가 감지되지 않고 배포될 위험이 있음.
- **근본 원인**: `.harness/` 파이프라인에 빌드 후 테스트 자동 실행 단계가 미정의. `fullstack-runner.sh`와 `pipeline-runner.sh` 모두 빌드 성공만 확인하고 `vitest run`을 트리거하지 않음.
- **영향 범위**: 전체 프로젝트 — 소스 코드 변경 시 기존 테스트가 깨져도 수동 실행 전까지 발견 불가. 실제로 env.test.ts, health-route.test.ts, supabase-server.test.ts에서 4건의 회귀 실패가 수동 실행 전까지 미발견됨.
- **해결안**:
  1. `.harness/hooks/post-build.sh`에 `cd app && npx vitest run` 단계 추가
  2. `pipeline-runner.sh`의 빌드 완료 후 단계에 테스트 실행 게이트 추가 (실패 시 파이프라인 중단)
  3. `fullstack-runner.sh`에서 프론트엔드 빌드 성공 후 자동 테스트 실행
  4. 테스트 실패 시 자동 알림 (Slack 연동 or 콘솔 하이라이트)
- **하네스 개선안**:
  1. `harness.config.json`에 `"postBuildTest": true` 플래그 추가 — 빌드 후 테스트 자동 실행 여부 제어
  2. `auto-fix-loop.sh`가 코드 수정 후 관련 테스트만 선별 실행하는 `--affected` 모드 추가
  3. `.harness/orchestration/` 모든 모드에 테스트 게이트 단계를 표준 포함
  4. 테스트 커버리지 리포트를 `.harness/memory/`에 저장하여 회귀 추적 가능하게
  5. pre-commit 훅에 변경된 파일 관련 테스트 자동 실행 (`vitest related`)

### HARNESS-046: CSRF rejected — 리버스 프록시 뒤에서 Origin 불일치
- **Status**: Resolved
- **Priority**: P0
- **Description**: 프로덕션 배포 후 모든 POST/PUT/DELETE API 요청이 `403 CSRF rejected`로 차단됨. 프로젝트 생성, 스크린 업로드 등 모든 변경 작업 불가. 원인: `middleware.ts`의 CSRF 체크에서 `new URL(request.url).origin`이 리버스 프록시(Traefik) 뒤에서 `http://localhost:3000`을 반환. 브라우저 Origin 헤더 `https://reviewboard.potentialai.dev`와 불일치 → 정상 요청도 CSRF로 차단.
- **근본 원인**: 로컬 개발에서는 `request.url`과 브라우저 Origin이 동일(`http://localhost:3000`)하므로 문제 없음. 리버스 프록시 배포 시에만 발생하는 환경 의존적 버그. 기존 테스트(`middleware.test.ts`)도 로컬 환경만 테스트.
- **해결**: `X-Forwarded-Proto` + `X-Forwarded-Host` 헤더로 실제 origin 재구성
- **하네스 개선안**:
  1. security-agent가 CSRF/CORS 미들웨어 작성 시 "리버스 프록시 환경 체크리스트" 자동 적용
  2. `request.url` 직접 사용 금지 규칙 → `X-Forwarded-*` 헤더 우선 사용 패턴 강제
  3. 배포 후 자동 스모크 테스트에 POST 요청 포함 (GET 200만으로 "정상" 판단하지 않기)
  4. middleware 테스트에 `X-Forwarded-Proto: https` + `X-Forwarded-Host: domain.com` 시나리오 필수 포함

### HARNESS-050: `.harness/` 내부 폴더가 프로젝트 루트에 중복 생성 — 루트 디렉토리 오염
- **Status**: Open
- **Priority**: P1
- **Description**: `.harness/` 내부에 있어야 할 13개 디렉토리와 2개 파일이 프로젝트 루트에 동일하게 중복 존재. `diff`로 확인한 결과 내용이 100% 동일. 루트에 34개 항목이 나열되어 프로젝트 구조가 지저분하고, 실제 프로젝트 코드(`app/`, `mockups/`, `issues/`)와 하네스 도구 파일이 혼재되어 구분 불가.
- **중복 목록**:
  - 디렉토리 (13개): `agents/`, `architecture/`, `ci/`, `cli/`, `hooks/`, `mcp/`, `memory/`, `orchestration/`, `prd/`, `scripts/`, `skills/`, `templates/`, `tests/`
  - 파일 (2개): `harness.config.json`, `mcp.json`
  - 부분 중복: `harness/` (`.harness/`의 셸 스크립트만 포함된 구버전 디렉토리)
  - 기타: `SCREEN_STATUS.md` (HARNESS-006에서 이미 지적된 루트 생성 파일)
- **근본 원인**: 3단계에 걸쳐 발생.
  1. `c258d33`(초기 풀스택 셋업): 하네스 파일이 루트에 직접 생성됨 (`.harness/` 미존재)
  2. `3884096`(인프라 추가): `agents/ → .harness/agents/` 등 rename으로 `.harness/`로 정상 이동. 루트 원본 삭제됨
  3. `27d2b85`(하네스 업데이트): "harness improvements" 커밋에서 `.harness/` 내부 파일 203개가 **루트에 다시 복사 생성**. 265개 파일 변경의 대규모 커밋이라 중복 생성이 리뷰에서 걸러지지 않음. 하네스 업데이트 스크립트가 `.harness/` 대신 루트 경로에 파일을 풀어놓은 것이 직접 원인.
- **영향**:
  - 루트 `ls`에 34개 항목 → 실제 프로젝트 폴더(`app/`, `mockups/`) 식별 어려움
  - 에이전트가 루트 `agents/`와 `.harness/agents/` 중 어느 것을 참조해야 하는지 모호
  - git 저장소 크기 불필요 증가 (중복 파일 추적)
  - 새 팀원 합류 시 프로젝트 구조 파악 혼란
- **해결안**:
  1. 루트의 중복 13개 디렉토리 + 2개 파일 + `harness/` 디렉토리 삭제
  2. `SCREEN_STATUS.md`를 `docs/`로 이동하거나 삭제
  3. 삭제 후 `.harness/` 참조 경로가 모두 정상 동작하는지 검증 (`run-tests.sh all`)
- **하네스 개선안**:
  1. `project-init.sh`가 하네스 파일을 반드시 `.harness/` 안에만 생성하도록 경로 강제
  2. session-start 훅에서 루트에 하네스 디렉토리(`agents/`, `hooks/` 등)가 존재하면 경고 + 자동 정리 제안
  3. `.harness/tests/guards/`에 "루트 디렉토리 청결도" 테스트 추가 — 프로젝트 코드가 아닌 파일이 루트에 존재하면 실패
  4. `architecture/rules.json`에 루트 허용 파일 화이트리스트 정의 (`app/`, `mockups/`, `issues/`, `docs/`, `CLAUDE.md`, `docker-compose*.yml`)
