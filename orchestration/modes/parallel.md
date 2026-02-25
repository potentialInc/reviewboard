# Parallel Mode — N Agents Simultaneously

Dispatch multiple independent agents to work on unrelated tasks at the same time.

## How It Works

1. **Parse task** to identify independent domains (separated by `+`, `and`, commas, or bullet list)
2. **Detect domain** for each sub-task
3. **Select agents** from registry by domain
4. **Dispatch ALL agents in a SINGLE message** — multiple Task tool calls in one turn
5. **Collect results** — review for conflicts, run tests

## Critical Rule

> All agents MUST be dispatched in a SINGLE message with multiple Task tool calls.
> This enables true parallelism. Sequential dispatch loses the speed benefit.

## Scope Boundaries

Each agent gets an explicit file/module scope to prevent conflicts:
- No two agents should modify the same file
- Types/interfaces should be defined in a prior task (not parallel)
- Each agent works in its own layer when possible

## Integration with Harness Tools

For **external parallelism** (separate processes):
```bash
./harness/orchestrator.sh tasks.json          # Git worktrees + claude --print
```

For **internal parallelism** (within one Claude session):
```
Use Task tool with subagent_type for each sub-task in a single message.
```

## Example

Task: "parallel: auth module + payment integration + admin dashboard"

Decomposition:
1. `auth` → domain: development → agent: feature-builder → scope: src/service/auth*, src/types/auth*
2. `payment` → domain: development → agent: feature-builder → scope: src/service/payment*, src/types/payment*
3. `admin` → domain: development → agent: feature-builder → scope: src/ui/admin*

All three dispatched simultaneously in one message.

## Conflict Prevention

Before dispatching, verify:
- [ ] No overlapping file paths between tasks
- [ ] Shared types defined before parallel execution
- [ ] Each task has clear scope boundaries
- [ ] No cross-task dependencies
