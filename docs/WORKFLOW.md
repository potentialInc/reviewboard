# Agent-First Development Workflow

## How to work with this harness

### Solo Mode (1 human + 1 Claude session)
```
You ←→ Claude (interactive)
```
1. Open Claude in the project root
2. Describe what you want
3. Claude reads CLAUDE.md, follows architecture rules, writes code
4. Hooks auto-validate on every edit
5. Review and commit

### Parallel Mode (1 human + N Claude sessions)
```
You → orchestrator.sh → Claude 1 (worktree A)
                       → Claude 2 (worktree B)
                       → Claude 3 (worktree C)
```
1. Write `tasks.json` (see `harness/task-splitter.md` for guidance)
2. Run `./harness/orchestrator.sh tasks.json`
3. Agents work in parallel on separate branches
4. Review each branch, merge PRs
5. Clean up: `./harness/worktree-manager.sh cleanup-all`

### Auto-Fix Mode (autonomous error correction)
```
Run command → fails → Claude fixes → retry → succeeds
```
1. Run `./harness/auto-fix-loop.sh "npm test" 3`
2. If tests fail, Claude reads the error and fixes the code
3. Retries up to N times
4. Escalates to human if it can't fix

### CI Mode (GitHub-triggered)
```
Push → CI fails → Claude auto-fixes → Push again
```
1. Set up GitHub Actions (workflows planned in `ci/.github/workflows/` — create from CI templates)
2. Add `ANTHROPIC_API_KEY` to repo secrets
3. Label issues with `claude` for auto-solving
4. PRs get auto-reviewed on open

### Pipeline Mode (sequential phases with checkpoints)
```
You → pipeline: build user dashboard from PRD
     → Phase 1: init (scaffold, types)
     → Phase 2: database + frontend (parallel)
     → Phase 3: backend (API endpoints)
     → Phase 4: integration
     → Phase 5: test + deploy
```
1. Describe the feature or full system to build
2. Claude breaks it into sequential phases using `orchestration/modes/pipeline.md`
3. Each phase produces a checkpoint in `PIPELINE_STATUS.md`
4. Parallel sub-phases run via worktrees where possible
5. If a phase fails, Claude retries before escalating

### Team Mode (autonomous PM → Dev → QA loop)
```
You → team: build the full authentication system
     → PM: breaks PRD into backlog items
     → Dev: implements each item (uses feature-builder)
     → QA: tests each item (uses test-writer)
     → Loop until all items pass QA
```
1. Provide a high-level requirement or PRD
2. PM agent creates a backlog in `TEAM_STATUS.md`
3. Dev agent implements items one by one
4. QA agent writes and runs tests
5. Failed items cycle back to Dev
6. Human reviews only at the end

### Mode Selection Flowchart

```
Is this a single, focused task?
├─ Yes → Solo Mode
│        (magic keywords auto-select the right agent)
└─ No
   ├─ Are the subtasks independent (different files)?
   │  ├─ Yes → Parallel Mode
   │  │        (orchestrator.sh + worktrees)
   │  └─ No
   │     ├─ Do tasks have a clear sequential order?
   │     │  ├─ Yes → Pipeline Mode
   │     │  │        (phases with checkpoints)
   │     │  └─ No → Team Mode
   │     │           (autonomous PM→Dev→QA loop)
   └─ Should it run unattended for hours?
      └─ Yes → Autopilot Mode
               (autopilot.sh in tmux)
```

## Task Design Principles

1. **Be specific**: "Add JWT auth to POST /api/login" > "Add auth"
2. **Specify files**: "Create src/service/auth-service.ts" > "Add auth service somewhere"
3. **Specify interfaces**: "Function login(email: string, password: string): Promise<Token>" > "Add login function"
4. **One layer per task**: Don't mix UI and backend in one task
5. **Types first**: Always define types before implementation tasks
