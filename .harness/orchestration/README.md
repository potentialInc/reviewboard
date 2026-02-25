# Agent Orchestration System

Compose agents into coordinated systems using 5 execution modes.

## Mode Selection

| Mode | When to use | Agents | Coordination |
|---|---|---|---|
| **solo** | Single focused task | 1 | None — just smart agent selection |
| **parallel** | Multiple independent tasks | N | Scope boundaries, no shared state |
| **pipeline** | Sequential phases with dependencies | 1 per phase | PIPELINE_STATUS.md checkpoints |
| **team** | Full feature (PRD → production) | PM + Dev + QA | TEAM_STATUS.md + CYCLE_LOG.md |
| **fullstack** | Idea → deployed project (cold start OK) | Pipeline agents + setup | FULLSTACK_STATUS.md superstages |

## Agent Registry

Agents are selected from `agents/agent-manifest.json` by domain and role:

```
Task keywords → Domain detection → Registry lookup → Best agent
```

**Domain signals**: backend, frontend, qa, debugging, review, docs, refactoring, research

## Quick Start

```
solo mode:      "fix: login button crash"        → bug-fixer agent auto-selected
parallel mode:  "parallel: auth + payments + ui"  → 3 agents dispatched simultaneously
pipeline mode:  "pipeline: start from prd"        → sequential phases with checkpoints
team mode:      "team: build user dashboard"      → PM→Dev→QA autonomous loop
fullstack mode: "fullstack: build a SaaS app"     → bootstrap → PRD → build → verify → ship
```

## Mode Files

- [solo.md](modes/solo.md) — Single agent dispatch with smart selection
- [parallel.md](modes/parallel.md) — N agents simultaneously
- [pipeline.md](modes/pipeline.md) — Sequential phases with dependency gates
- [team.md](modes/team.md) — Autonomous PM→Dev→QA cycle
- [fullstack.md](modes/fullstack.md) — Idea to production in one command
