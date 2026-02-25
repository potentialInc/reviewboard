# Fullstack Status: {PROJECT_NAME}

> Created: {DATE}
> Mode: fullstack (BOOTSTRAP → PRD → BUILD → VERIFY → SHIP)

## Superstages

| # | Stage | Status | Gate Passed | Notes |
|---|-------|--------|-------------|-------|
| 1 | BOOTSTRAP | PENDING | — | |
| 2 | PRD | PENDING | — | |
| 3 | BUILD | PENDING | — | |
| 4 | VERIFY | PENDING | — | |
| 5 | SHIP | PENDING | — | |

**Status**: `PENDING` → `IN_PROGRESS` → `COMPLETE` | `FAILED` | `SKIPPED`

## Gate Checklists

### BOOTSTRAP → PRD
- [ ] Project directory has identifiable tech stack
- [ ] CLAUDE.md exists
- [ ] harness.config.json exists

### PRD → BUILD
- [ ] `prd-*.md` file exists
- [ ] PRD has `status: active` in YAML frontmatter
- [ ] PRD sections filled: System Modules, DB Schema, API Endpoints, UI Specs

### BUILD → VERIFY
- [ ] PIPELINE_STATUS.md phase 3 (types) COMPLETE
- [ ] PIPELINE_STATUS.md phase 4 (database) COMPLETE
- [ ] PIPELINE_STATUS.md phase 5 (backend) COMPLETE
- [ ] PIPELINE_STATUS.md phase 6 (frontend) COMPLETE
- [ ] PIPELINE_STATUS.md phase 7 (integrate) COMPLETE

### VERIFY → SHIP
- [ ] PIPELINE_STATUS.md phase 8 (test) COMPLETE
- [ ] PIPELINE_STATUS.md phase 9 (qa) COMPLETE
- [ ] `./architecture/enforce.sh` passes all checks

### SHIP → DONE
- [ ] PIPELINE_STATUS.md phase 10 (deploy) COMPLETE
- [ ] `./tests/run-tests.sh guards` P0 tests pass
- [ ] Deploy config exists (Dockerfile, CI/CD, or platform config)

## Pipeline Detail (BUILD/VERIFY/SHIP)

| # | Phase | Domain | Status | Prerequisites | Output | Notes |
|---|---|---|---|---|---|---|
| 1 | init | base | SKIPPED | — | (handled by BOOTSTRAP) | |
| 2 | prd | base | SKIPPED | — | (handled by PRD stage) | |
| 3 | types | base | PENDING | prd | src/types/ | |
| 4 | database | backend | PENDING | types | Schema, migrations | |
| 5 | backend | backend | PENDING | types, database | Services, APIs | |
| 6 | frontend | frontend | PENDING | types | UI components | |
| 7 | integrate | frontend | PENDING | backend, frontend | API integration | |
| 8 | test | qa | PENDING | integrate | Unit + integration tests | |
| 9 | qa | qa | PENDING | test | E2E tests, QA report | |
| 10 | deploy | base | PENDING | qa | Deployment config | |

**Parallel eligible**: Phases 4+6 (both depend only on types)

## Execution Log

| Date | Stage/Phase | Duration | Result | Notes |
|---|---|---|---|---|
| | | | | |

## Configuration

- **Project**: {PROJECT_NAME}
- **Tech Stack**: {TECH_STACK}
- **PRD**: {PRD_PATH}
- **Started**: {DATE}
- **Safe Mode**: true
