# Team Mode — Autonomous PM→Dev→QA Loop

Continuous development loop with PM, Dev, and QA agents. Supports autopilot execution.

## Agents

| Role | Model | Responsibility |
|---|---|---|
| PM | opus | Analyze PRD, manage backlog, write specs, review QA results |
| Dev | opus | Implement features, fix bugs, write code |
| QA | opus | Test implementations, report issues, verify fixes |

## Setup

1. **Load PRD from `prd/` directory** using SoT selection rule:
   - Single `prd-*.md` → auto-selected
   - Multiple files → use `status: active` in YAML header
   - Explicit → `team: implement X from prd-auth.md`
2. PM analyzes PRD and builds numbered backlog
3. Initialize TEAM_STATUS.md from template
4. Initialize CYCLE_LOG.md from template

## Cycle Loop (for each backlog item)

```
┌─────────────────────────────────────────┐
│  PM: Write spec for current item        │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Dev: Implement spec                    │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  QA: Test implementation                │
└────────────────┬────────────────────────┘
                 ↓
         ┌──────┴──────┐
         │  QA PASS?   │
         └──────┬──────┘
           YES  │  NO
           ↓    ↓
      COMPLETE  ESCALATE
```

## Escalation Tiers

| Rounds | Action |
|---|---|
| 1-3 | Dev fixes the issues reported by QA |
| 4-6 | PM rewrites spec with more detail and constraints |
| 7+ | PM splits item into smaller sub-items |
| Same error 3x, no progress | Mark BLOCKED, move to next item |

## Discovery Phase

After each completed item:
1. PM reviews changed files, QA report, dev notes
2. PM identifies follow-up tasks (tech debt, integration gaps, new features)
3. Append new items to backlog as PENDING, source: DISCOVERED
4. **Max 5 new items per completed item**
5. **Total backlog cap: 3× original PRD item count**

## Safety Limits

| Limit | Value | Behavior when exceeded |
|---|---|---|
| Max total cycles | 30 | PM logs summary, mark remaining items DEFERRED, stop loop |
| Max time per cycle | 30 min | QA flags timeout, PM splits item into smaller pieces |
| Max total time | 4 hours | Stop regardless of backlog state, generate partial report |
| Max consecutive failures | 5 | Mark current item BLOCKED, move to next |
| Max BLOCKED items | 50% of backlog | PM logs risk assessment, stop loop |

When any limit is reached:
1. Current agent completes its in-progress step (no mid-step interruption)
2. PM writes summary of completed work vs remaining work
3. Output `TEAM_LIMIT_REACHED` marker (distinct from `TEAM_COMPLETE`)
4. Generate partial summary report
5. Update memory/PROGRESS.md with results and reason for stop

## Persistence Rule

> Continue executing the cycle loop until ALL items are COMPLETED, BLOCKED, or DEFERRED,
> **or until a Safety Limit is reached** (see above).
> Never pause to ask. Never yield control between items. Never stop because "enough progress."
> Only stop if: (1) all items resolved, (2) user sends --stop, (3) unrecoverable system error, (4) Safety Limit exceeded.

## Status Tracking

- **TEAM_STATUS.md**: Current cycle, backlog, blockers, agent health
- **CYCLE_LOG.md**: Append-only log of every cycle's discussion, implementation, QA, outcome

## Autopilot Integration

Run with `scripts/autopilot.sh` for persistent execution:
- Survives rate limits (exponential backoff)
- Runs in tmux (detachable)
- Auto-resumes from TEAM_STATUS.md checkpoint

## Completion

When ALL backlog items are COMPLETED/BLOCKED/DEFERRED:
1. Output `TEAM_COMPLETE` marker
2. Generate summary report
3. Update memory/PROGRESS.md with results
