# Quick Start Guide

Get your first AI-built feature in 5 minutes. No coding required.

> **Language**: Claude responds in the language you use. English → English. Korean → Korean.

## 3 Steps to Start

### Step 1: Open Terminal

- **macOS**: Press `Cmd + Space`, type "Terminal", press Enter
- **Windows**: Press `Win` key, type "Terminal", press Enter
- **Linux**: Press `Ctrl + Alt + T`

### Step 2: Run the Welcome Wizard

Copy and paste this into your terminal:

```bash
./scripts/welcome-wizard.sh
```

The wizard will:
1. Check that all required tools are installed
2. Ask what you want to build
3. Set up everything automatically
4. Tell you exactly what to type next

### Step 3: Start Building

After the wizard finishes, it will tell you to run:

```bash
cd my-app && claude
```

Then type:

```
team: build my project from PRD
```

That's it. The AI takes over from here:
- A **PM agent** reads your requirements and makes a plan
- A **Dev agent** writes the code
- A **QA agent** tests everything
- You review the result

---

## FAQ

### What are magic keywords?

Magic keywords are shortcuts that tell Claude which specialist to use. Start your message with a keyword:

| You type... | What happens |
|---|---|
| `build: add a login page` | AI builds the feature |
| `fix: button doesn't work` | AI finds and fixes the bug |
| `test: check if login works` | AI writes tests |
| `review: check my code` | AI reviews code quality |
| `team: build from PRD` | AI runs a full team (PM + Dev + QA) |

More keywords: `refactor:` `deploy:` `db:` `secure:` `perf:` `docs:` `design:` `arch:` `parallel:` `pipeline:` `fullstack:` `design-qa:`

### What is a PRD?

A PRD (Product Requirements Document) is your wish list — what you want built, described in plain words. The wizard creates one for you. You can edit it anytime at `prd/prd-my-project.md`.

There are 3 examples to start from:
- `prd/examples/prd-todo-app.md` — Todo list app
- `prd/examples/prd-blog-api.md` — Blog API server
- `prd/examples/prd-landing-page.md` — Landing page

### How do I change what gets built?

Edit your PRD file (`prd/prd-my-project.md`) with any text editor. Change the requirements, save, and run `team: build my project from PRD` again.

### Not sure what to do next?

Run this in your terminal:

```bash
./scripts/first-task-guide.sh
```

It looks at your project and suggests the most useful command.

### Something went wrong?

1. Run the health check: `./scripts/doctor.sh`
2. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
3. If tests are failing: type `fix: make all tests pass`

---

## Advanced Setup (for developers)

### New Project (manual)

```bash
git clone https://github.com/your-org/claude-harness.git
cd claude-harness
./harness/project-init.sh --template nextjs --name my-app
cd ../my-app && claude
```

Templates: `nextjs`, `fastapi`, `django`, `go-api`, `react-vite`, `expo`, `monorepo`, `rust-axum`, `generic`

### Existing Project (manual)

```bash
git clone https://github.com/your-org/claude-harness.git
./claude-harness/scripts/harness-install.sh /path/to/your-project
cd /path/to/your-project && claude
```

### Prerequisites

| Tool | Check | Install |
|------|-------|---------|
| Claude Code CLI | `claude --version` | [Download](https://claude.ai/download) |
| Git | `git --version` | macOS: pre-installed / Linux: `apt install git` |
| Node.js (v18+) | `node --version` | [Download](https://nodejs.org/) |
| jq | `jq --version` | `brew install jq` (macOS) / `apt install jq` (Linux) |

Check all at once: `./scripts/doctor.sh`

### Parallel Development

```bash
cat > tasks.json << 'EOF'
{
  "tasks": [
    { "name": "auth", "prompt": "Implement JWT authentication" },
    { "name": "payments", "prompt": "Add Stripe payment integration" }
  ]
}
EOF

./harness/orchestrator.sh tasks.json
```

### Auto-Fix Loop

```bash
./harness/auto-fix-loop.sh "npm test" 3        # Fix tests, max 3 attempts
./harness/auto-fix-loop.sh "npm run build" 5    # Fix build errors
```

### Autopilot Mode

```bash
./scripts/autopilot.sh "team: build user dashboard from PRD"

# Monitor: tmux attach -t claude-autopilot
# Stop:    ./scripts/autopilot.sh --stop
```

### All Magic Keywords

| Keyword | Agent | What it does |
|---|---|---|
| `build:` | Feature Builder | Builds new features |
| `fix:` | Bug Fixer | Diagnoses and fixes bugs |
| `test:` | Test Writer | Writes tests |
| `refactor:` | Refactorer | Cleans up code |
| `review:` | Reviewer | Audits code quality |
| `deploy:` | DevOps | Infrastructure and deployment |
| `db:` | Database | Schemas and migrations |
| `secure:` | Security | Vulnerability scanning |
| `perf:` | Performance | Speed optimization |
| `docs:` | Documentation | Docs and changelogs |
| `design:` | UI Builder | Design to code |
| `design-qa:` | Design QA | Pixel-perfect comparison |
| `arch:` | Architecture | Layer rule validation |
| `parallel:` | Parallel Mode | Multiple tasks at once |
| `pipeline:` | Pipeline Mode | Sequential phases |
| `team:` | Team Mode | PM + Dev + QA loop |
| `fullstack:` | Fullstack Mode | End-to-end build |

## Next Steps

- [WORKFLOW.md](WORKFLOW.md) — Detailed workflow guides
- [CONVENTIONS.md](CONVENTIONS.md) — Coding standards
- [AGENT-GUIDE.md](AGENT-GUIDE.md) — Create custom agents
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Common issues
