# Pipeline Mode — Sequential Phases with Dependency Gates

Execute project phases in order, with checkpointing and parallel where dependencies allow.

## How It Works

1. **Define phases** from PRD analysis or existing PIPELINE_STATUS.md
2. **Create/load status file** — `PIPELINE_STATUS.md` tracks each phase
3. **Execute phases** sequentially (or parallel when no dependencies)
4. **Checkpoint** — mark COMPLETE/FAILED after each phase
5. **Resume** — read status file to continue from where we left off

## Standard Phases

| # | Phase | Domain | Prerequisites | Output |
|---|---|---|---|---|
| 1 | init | base | none | Project scaffold, CLAUDE.md |
| 2 | prd | base | init | Requirements, user stories |
| 3 | types | base | prd | Type definitions in src/types/ |
| 4 | database | backend | types | Schema, migrations, repos |
| 5 | backend | backend | types, database | Services, API routes |
| 6 | frontend | frontend | types | UI components, pages (uses ui-builder if design assets exist) |
| 7 | integrate | frontend | backend, frontend | API integration |
| 8 | test | qa | integrate | Unit + integration tests |
| 9 | qa | qa | test | E2E tests, QA report, design fidelity |
| 10 | deploy | base | qa | Deployment config |

**Phases 4+6 can run in parallel** (both only depend on types).

### Phase 6 — Agent Selection

Phase 6 (frontend) selects its agent based on available design inputs:

| Condition | Agent | Input Source |
|-----------|-------|-------------|
| `design/screens/` has images (PNG/JPEG) | `ui-builder` | Screenshots (multimodal) |
| `design/mockups/` has HTML/CSS files | `ui-builder` | HTML mockups |
| Neither exists | `feature-builder` | PRD Section 9 text only |

When `ui-builder` is used, it also performs visual verification via playwright-cli (preferred) or Playwright MCP after implementation.

### Phase 9 — QA Dispatch

Phase 9 runs two QA tracks (parallel when possible):

| Track | Agent | Condition |
|-------|-------|-----------|
| Design QA | `design-qa` | Design assets exist (`design/` or `SCREEN_STATUS.md`) |
| E2E Tests | `test-writer` | Acceptance criteria in PRD Section 10 |

Design QA auto-detects the source (Figma node IDs, HTML prototypes, or screenshots) and produces per-screen fidelity scores in `SCREEN_STATUS.md`.

## PRD Location (Source of Truth)

Pipeline reads its requirements from `prd/` directory:

**SoT Selection Rule:**
1. Single `prd-*.md` file → auto-selected
2. Multiple files → use the one with `status: active` in YAML header
3. Explicit in prompt → `pipeline: build X from prd-auth.md`

**PRD Gate — run immediately after selecting the PRD, before Phase 3:**
```bash
./harness/prd-gate.sh <prd-path> --mode all
```
- Exit 0: proceed
- Exit 1 (BLOCKING): **STOP** — show issues, do NOT start phases
- Exit 2 (WARNINGS): show warnings, require explicit user confirmation per item

**Phase-to-PRD Section Mapping:**

| Phase | PRD Section |
|-------|-------------|
| types | Terminology + DB Schema |
| database | DB Schema + API Endpoints |
| backend | API Endpoints + NFRs |
| frontend | UI Specifications + User Flows + Design Inputs |
| test | Acceptance Criteria |
| qa | Acceptance Criteria + NFRs |

## Status File

Use `templates/status/PIPELINE_STATUS.template.md` to create the tracking file.

Status values: `PENDING` → `IN_PROGRESS` → `COMPLETE` | `FAILED` | `SKIPPED`

## Execution Rules

1. Check prerequisites before starting any phase
2. Mark IN_PROGRESS immediately when starting
3. On completion, mark COMPLETE and record output
4. On failure, mark FAILED with error details
5. If prerequisites met for multiple phases, dispatch in parallel
6. Never skip prerequisite checks

## Resume Protocol

1. Read PIPELINE_STATUS.md
2. Find phases with status IN_PROGRESS or PENDING
3. For IN_PROGRESS: check if work is partially done, continue from there
4. For PENDING: check prerequisites, start if met
5. Skip COMPLETE and SKIPPED phases

## Stopping Gracefully

1. Complete current phase (don't interrupt mid-phase)
2. Update status file with current state
3. Record notes for next session
