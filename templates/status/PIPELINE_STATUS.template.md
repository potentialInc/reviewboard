# Pipeline Status: {PROJECT_NAME}

> Created: {DATE}
> Mode: pipeline

## Progress

| # | Phase | Domain | Status | Prerequisites | Output | Notes |
|---|---|---|---|---|---|---|
| 1 | init | base | PENDING | — | Project scaffold | |
| 2 | prd | base | PENDING | init | Requirements doc | |
| 3 | types | base | PENDING | prd | src/types/ | |
| 4 | database | backend | PENDING | types | Schema, migrations | |
| 5 | backend | backend | PENDING | types, database | Services, APIs | |
| 6 | frontend | frontend | PENDING | types | UI components | |
| 7 | integrate | frontend | PENDING | backend, frontend | API integration | |
| 8 | test | qa | PENDING | integrate | Unit + integration tests | |
| 9 | qa | qa | PENDING | test | E2E tests, QA report | |
| 10 | deploy | base | PENDING | qa | Deployment config | |

**Status**: `PENDING` → `IN_PROGRESS` → `COMPLETE` | `FAILED` | `SKIPPED`

**Parallel eligible**: Phases 4+6 (both depend only on types)

## Execution Log

| Date | Phase | Duration | Result | Notes |
|---|---|---|---|---|
| | | | | |

## Configuration

- **Project**: {PROJECT_NAME}
- **Tech Stack**: {TECH_STACK}
- **PRD**: {PRD_PATH}
