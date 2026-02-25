# Skill System

Auto-detect relevant agents and modes based on what you type.

## How It Works

When you submit a prompt, the `skill-activation-prompt.sh` hook:
1. Checks for **magic keywords** (e.g., `fix:`, `build:`, `team:`)
2. Matches against **keyword triggers** in `skill-rules.json`
3. Outputs recommended agents/modes

## Magic Keywords

Type these at the start of your prompt for instant activation:

| Keyword | Activates | Description |
|---|---|---|
| `build:` | feature-builder | Implement new features |
| `fix:` | bug-fixer | Fix bugs and errors |
| `test:` | test-writer | Write tests |
| `refactor:` | refactorer | Improve code quality |
| `review:` | reviewer | Code review |
| `arch:` | architecture check | Validate architecture |
| `parallel:` | parallel mode | Run N tasks simultaneously |
| `pipeline:` | pipeline mode | Sequential phase execution |
| `team:` | team mode | PM→Dev→QA autonomous loop |

## Examples

```
fix: login button crashes when clicked twice
build: add user profile page with avatar upload
test: write tests for the auth service
team: build the dashboard feature from the PRD
parallel: auth module + payment integration + email service
```

## Customization

Edit `skills/skill-rules.json` to:
- Add new skills/agents
- Change trigger keywords
- Adjust priority levels
- Add intent patterns (regex)
