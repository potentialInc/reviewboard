# Solo Mode — Single Agent Dispatch

Dispatch the best-fit agent for a single, focused task.

## How It Works

1. **Detect domain** from task keywords
2. **Select agent** from `agents/agent-manifest.json` by domain match
3. **Dispatch** via Task tool with agent's `.md` instructions

## Domain Signal Detection

Scan the task for these keywords to determine domain:

| Domain | Keywords |
|---|---|
| development | implement, create, add, build, feature, module, endpoint |
| debugging | bug, fix, error, broken, crash, fail, issue |
| qa | test, coverage, spec, assert, verify, validate |
| review | review, check, audit, inspect, code review |
| refactoring | refactor, clean, split, extract, reorganize, simplify |
| infrastructure | deploy, devops, docker, ci, cd, kubernetes, terraform, infra, hosting |
| database | database, schema, migration, seed, sql, orm, prisma, alembic, gorm |
| security | security, vulnerability, scan, audit, owasp, secret, auth hardening |
| performance | performance, optimize, speed, bundle, lazy, cache, profiling, lighthouse |
| documentation | docs, document, readme, explain, comment, changelog, api docs |
| research | research, investigate, explore, find out, look into |

## Agent Selection Priority

1. **Exact domain match** with highest tier → use that agent
2. **Domain match** with relevant roles → use best role match
3. **No match** → use feature-builder as general-purpose fallback

## Dispatch Template

```
Read the agent instructions from [agents/{agent-name}.md].
Read CLAUDE.md for project context.

Task: {user's task description}

Follow architecture rules. Write tests for public functions.
Run ./architecture/enforce.sh when done.
Commit changes with a descriptive message.
```

## Override

User can specify an agent explicitly:
```
solo: --agent reviewer "Check the auth module for security issues"
```
