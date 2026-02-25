# Agent Creation Guide

How to create custom agents for claude-harness.

## Agent Architecture

An agent consists of three parts:

1. **Agent definition** (`.md` file in `agents/`) — Instructions Claude follows
2. **Manifest entry** (`agents/agent-manifest.json`) — Registry metadata
3. **Skill trigger** (`skills/skill-rules.json`) — Auto-activation rules

## Step 1: Create the Agent Definition

Create `agents/my-agent.md` following this structure:

```markdown
# My Agent — Short Description

One-sentence summary of what this agent does.

## Workflow

1. Read CLAUDE.md and architecture rules
2. [Specific step for this agent's domain]
3. [Another step]
4. Write tests for all changes
5. Run ./architecture/enforce.sh
6. Commit changes

## Rules

1. [Most important rule for this domain]
2. [Second rule]
3. Follow architecture layer model (types → config → repo → service → runtime → ui)
4. One concern per file, max 300 lines
5. [Domain-specific rule]

## Error Handling

- If [specific error]: [what to do]
- If architecture check fails: fix violations, re-run
- If tests fail: fix code, not tests
```

### Key Principles

- **Be specific**: "Write tests for all public functions" > "Write tests"
- **Be opinionated**: Make decisions so Claude doesn't have to
- **Include error recovery**: What to do when things go wrong
- **Reference architecture**: Always mention `enforce.sh` and layer rules

## Step 2: Register in Agent Manifest

Add to `agents/agent-manifest.json`:

```json
{
  "my-agent": {
    "file": "agents/my-agent.md",
    "model": "sonnet",
    "tier": "medium",
    "domain": "my-domain",
    "roles": ["role1", "role2"],
    "description": "Short description of what this agent does"
  }
}
```

### Fields

| Field | Description | Values |
|-------|-------------|--------|
| `file` | Path to agent .md file | `agents/*.md` |
| `model` | Preferred Claude model | `opus` (complex), `sonnet` (standard) |
| `tier` | Agent priority | `high`, `medium`, `low` |
| `domain` | Task domain for auto-selection | Any string (see domains below) |
| `roles` | Agent capabilities | Array of role strings |
| `description` | One-line summary | Short text |

### Standard Domains

| Domain | Use Case |
|--------|----------|
| `development` | Building new features |
| `debugging` | Fixing bugs |
| `qa` | Writing tests |
| `review` | Code review and auditing |
| `refactoring` | Improving code quality |
| `infrastructure` | DevOps, deployment, CI/CD |
| `database` | Schema, migrations, queries |
| `security` | Vulnerability scanning, auth |
| `performance` | Optimization, profiling |
| `documentation` | Docs, READMEs, changelogs |

## Step 3: Add Skill Triggers

Add to `skills/skill-rules.json`:

```json
{
  "my-agent": {
    "type": "agent",
    "enforcement": "suggest",
    "priority": "medium",
    "file": "agents/my-agent.md",
    "magicKeyword": "mycommand:",
    "promptTriggers": {
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "intentPatterns": ["(action1|action2).*(target1|target2)"]
    }
  }
}
```

### Fields

| Field | Description |
|-------|-------------|
| `type` | `agent` (loads .md), `mode` (loads orchestration), `skill` (loads reference) |
| `enforcement` | `suggest` (hint) or `enforce` (mandatory) |
| `priority` | `high`, `medium`, `low` — used for conflict resolution |
| `magicKeyword` | Prefix trigger (e.g., `fix:`) |
| `promptTriggers.keywords` | Words that suggest this agent |
| `promptTriggers.intentPatterns` | Regex patterns for intent matching |

## Step 4: Update Solo Mode (Optional)

If your agent introduces a new domain, add it to `orchestration/modes/solo.md`:

```markdown
| my-domain | keyword1, keyword2, keyword3 |
```

## Example: Creating a "Monitoring Agent"

### 1. agents/monitoring-agent.md

```markdown
# Monitoring Agent — Observability Setup

Set up monitoring, logging, and alerting for production applications.

## Workflow

1. Read CLAUDE.md for project context
2. Detect tech stack (Node/Python/Go)
3. Choose monitoring stack (Sentry, DataDog, or open-source)
4. Add error tracking SDK
5. Configure structured logging
6. Set up health check endpoints
7. Create alerting rules template
8. Write integration tests
9. Run ./architecture/enforce.sh
10. Commit changes

## Rules

1. Error tracking must capture: stack traces, user context, environment
2. Logs must be structured (JSON) with consistent fields
3. Health check endpoint at GET /health or GET /api/health
4. Never log sensitive data (passwords, tokens, PII)
5. Alert on: error rate spike, response time degradation, health check failure
```

### 2. agent-manifest.json entry

```json
"monitoring": {
  "file": "agents/monitoring-agent.md",
  "model": "sonnet",
  "tier": "medium",
  "domain": "observability",
  "roles": ["monitor", "alerter"],
  "description": "Set up monitoring, logging, and alerting"
}
```

### 3. skill-rules.json entry

```json
"monitoring": {
  "type": "agent",
  "enforcement": "suggest",
  "priority": "medium",
  "file": "agents/monitoring-agent.md",
  "magicKeyword": "monitor:",
  "promptTriggers": {
    "keywords": ["monitor", "logging", "alert", "sentry", "observability", "health check"],
    "intentPatterns": ["(set up|add|configure).*(monitoring|logging|alerting|observability)"]
  }
}
```

## Testing Your Agent

1. Start Claude in a project with the harness installed
2. Try the magic keyword: `mycommand: do something`
3. Verify the skill activation hook detects it
4. Check that the agent follows its defined workflow
5. Verify architecture rules are respected

## Tips

- **Start narrow, expand later**: Begin with a focused agent, add capabilities over time
- **Reuse existing agents**: Check if feature-builder or refactorer can handle the task before creating a new agent
- **Model selection**: Use `opus` for complex reasoning (architecture, security), `sonnet` for routine tasks
- **Test with dry-run**: Use `parallel: --dry-run` to verify agent selection without execution
