# Fullstack Mode — Idea to Production in One Command

From cold start (empty directory) to deployed project. Composes existing harness tools into 5 superstages.

## When to Use

- Starting a new project from scratch
- Have an idea but no code, no PRD, no scaffolding yet
- Want one command to handle everything: setup → requirements → code → test → deploy

**If project and PRD already exist** → use `pipeline:` or `team:` instead.

## Superstages

```
BOOTSTRAP → PRD → BUILD → VERIFY → SHIP
```

| # | Stage | What Happens | Gate to Next |
|---|-------|-------------|--------------|
| 1 | BOOTSTRAP | Detect/scaffold stack, init project | Project dir exists, stack detected |
| 2 | PRD | Write PRD from user description, activate it | `prd-*.md` exists with `status: active` |
| 3 | BUILD | Pipeline phases 3-7 (types→DB→backend→frontend→integrate) | PIPELINE_STATUS phases 3-7 COMPLETE |
| 4 | VERIFY | Pipeline phases 8-9 (test→QA) + `enforce.sh` | Tests pass, architecture valid |
| 5 | SHIP | Pipeline phase 10 (deploy config) + guard tests | Deploy config exists, P0 guards pass |

## Execution Flow

### Stage 1: BOOTSTRAP

1. Check if project already exists (has `package.json`, `pyproject.toml`, `go.mod`, etc.)
   - **Existing project**: Run `./harness/stack-detector.sh` to detect stack → skip scaffolding
   - **Empty project**: Ask user for tech stack preference, then run `./harness/project-init.sh`
2. Verify CLAUDE.md exists (project-init creates it)
3. Verify `harness.config.json` exists with safeMode enabled
4. Update FULLSTACK_STATUS.md: BOOTSTRAP → COMPLETE

**Gate**: Project directory has identifiable tech stack + CLAUDE.md exists

### Stage 2: PRD

1. Check if active PRD already exists via `./harness/prd-resolver.sh`
   - **PRD exists + active**: Read it, validate sections, skip to BUILD
   - **PRD exists + draft**: Review and set `status: active`
   - **No PRD**: Create from `prd/FEATURE_PRD.template.md`
2. When creating PRD:
   - Extract requirements from user's fullstack: prompt
   - Fill all 13 sections (Overview through References)
   - Focus on: System Modules, DB Schema, API Endpoints, UI Specifications
   - Set `status: active` in YAML frontmatter
3. **Run PRD Gate** — validate before proceeding to BUILD:
   ```bash
   ./harness/prd-gate.sh <prd-path> --mode fullstack
   ```
   - Exit 0: proceed to BUILD
   - Exit 1 (BLOCKING): **STOP immediately** — show blocking issues to user, do NOT proceed
   - Exit 2 (WARNINGS): show warnings, ask user to explicitly confirm each one before proceeding
4. Update FULLSTACK_STATUS.md: PRD → COMPLETE

**Gate**: `prd-gate.sh` exits 0 (or user has confirmed all warnings)

### Stage 3: BUILD

Delegate to Pipeline mode phases 3-7. Follow `orchestration/modes/pipeline.md` exactly.

1. Initialize PIPELINE_STATUS.md from `templates/status/PIPELINE_STATUS.template.md`
2. Mark pipeline phases 1-2 as SKIPPED (handled by BOOTSTRAP + PRD superstages)
3. Execute phases sequentially (phases 4+6 can run in parallel):
   - **Phase 3 — types**: Type definitions from PRD Terminology + DB Schema
   - **Phase 4 — database**: Schema, migrations, repos from PRD DB Schema
   - **Phase 5 — backend**: Services, API routes from PRD API Endpoints
   - **Phase 6 — frontend**: UI components (parallel with phase 4)
     - If `design/mockups/` has HTML files → **auto-run `html-to-react`** (analyze → map → prompts), then `ui-builder` with generated conversion prompts
     - Else if `design/screens/` has images → `ui-builder` agent (screenshot input)
     - Otherwise → `feature-builder` with PRD UI Specifications
     - `html-to-react` triggers automatically — never ask user to run it manually
   - **Phase 7 — integrate**: Connect frontend to backend APIs
4. Update FULLSTACK_STATUS.md: BUILD → COMPLETE

**Gate**: PIPELINE_STATUS.md shows phases 3-7 as COMPLETE

### Stage 4: VERIFY

Delegate to Pipeline mode phases 8-9, then run architecture enforcement.

1. **Phase 8 — test**: Unit + integration tests from PRD Acceptance Criteria
2. **Phase 9 — qa**: E2E tests, QA report
3. Run `./architecture/enforce.sh` — must pass all 6 checks
4. If tests fail:
   - Use `./harness/auto-fix-loop.sh` for automated fixes (max retries from safeMode)
   - Re-run failed tests after each fix
   - If still failing after max retries: mark VERIFY as FAILED, stop
5. Update FULLSTACK_STATUS.md: VERIFY → COMPLETE

**Gate**: All tests pass + `enforce.sh` exits 0

### Stage 5: SHIP

Delegate to Pipeline mode phase 10, then run final guard tests.

1. **Phase 10 — deploy**: Generate deployment config (Dockerfile, CI/CD, env templates)
2. Run `./tests/run-tests.sh guards` — P0 tests must pass
3. Generate final summary:
   - Files created/modified count
   - Test coverage summary
   - Architecture check results
   - Deployment readiness checklist
4. Update FULLSTACK_STATUS.md: SHIP → COMPLETE
5. Commit all changes with message: `feat: fullstack project setup complete`

**Gate**: Guard tests P0 pass + deploy config exists

## PRD Location (Source of Truth)

Same rules as pipeline/team modes:
1. Single `prd-*.md` → auto-selected
2. Multiple → use `status: active` in YAML header
3. Explicit → `fullstack: build X from prd-auth.md`

## Status Tracking

Use `FULLSTACK_STATUS.md` (from `templates/status/FULLSTACK_STATUS.template.md`):
- Superstage-level progress (5 rows)
- Pipeline-level detail (10 rows, within BUILD/VERIFY/SHIP)
- Gate checklists per superstage

## Auto-Skip Rules

| Condition | Action |
|-----------|--------|
| Project already initialized | Skip BOOTSTRAP, start at PRD |
| Active PRD exists | Skip PRD, start at BUILD |
| PIPELINE_STATUS.md has phases 3-7 COMPLETE | Skip BUILD, start at VERIFY |
| All tests passing + enforce.sh clean | Skip VERIFY, start at SHIP |

On resume: read FULLSTACK_STATUS.md and continue from first non-COMPLETE superstage.

## Resume Protocol

1. Read FULLSTACK_STATUS.md
2. Find first superstage with status != COMPLETE
3. If IN_PROGRESS: check partial work, continue from there
4. If PENDING: check gate of previous stage, start if passed
5. For BUILD/VERIFY/SHIP: also read PIPELINE_STATUS.md for phase-level resume

## Example

```
fullstack: SaaS 대시보드 앱 만들어줘. Next.js + Prisma + PostgreSQL.
사용자 인증, 실시간 데이터 차트, 관리자 페이지 필요.
```

This triggers:
1. BOOTSTRAP: Detect Next.js stack, scaffold with `project-init.sh --template nextjs`
2. PRD: Create `prd/prd-saas-dashboard.md` with auth, charts, admin modules
3. BUILD: Pipeline phases 3-7 (types → prisma schema → API routes → React components → integration)
4. VERIFY: Unit tests + E2E tests + architecture enforcement
5. SHIP: Dockerfile + Vercel config + CI/CD pipeline
