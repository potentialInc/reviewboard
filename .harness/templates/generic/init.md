# Generic Project Initialization

Use this template to bootstrap any project with the harness.

## Steps

1. **Create project directory with src layers**:
```bash
mkdir -p src/{types,config,repo,service,runtime,ui}
```

2. **Add entry points for each layer**:
```bash
# TypeScript
for dir in src/*/; do touch "$dir/index.ts"; done

# Python
for dir in src/*/; do touch "$dir/__init__.py"; done
```

3. **Initialize package manager** (pick one):
```bash
# Node.js
npm init -y && npm i -D typescript vitest eslint

# Python
python -m venv .venv && source .venv/bin/activate && pip install pytest ruff

# Go
go mod init your-module-name
```

4. **Copy harness files** (if not using as submodule):
```bash
# Set HARNESS_ROOT to your claude-harness location, or use harness-install.sh
cp -r "${HARNESS_ROOT:?Set HARNESS_ROOT to your claude-harness path}"/{CLAUDE.md,architecture,hooks,agents,memory,docs} .
```

5. **Customize CLAUDE.md**: Update project description, tech stack, commands

6. **First commit**:
```bash
git add -A && git commit -m "feat: initialize project with agent harness"
```

7. **Start building**:
```bash
claude  # Interactive mode
# or
./harness/orchestrator.sh tasks.json  # Parallel mode
```
