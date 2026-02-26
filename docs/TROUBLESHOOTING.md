# Troubleshooting

## Common Issues

### "claude: command not found"
Claude CLI is not installed or not in PATH.
```bash
# Install: https://claude.ai/download
# Or check PATH:
which claude
```

### "jq: command not found"
The orchestrator requires jq for JSON parsing.
```bash
brew install jq        # macOS
apt install jq         # Ubuntu
```

### Worktree creation fails
```bash
# Check existing worktrees
git worktree list

# Prune stale worktrees
git worktree prune

# Force remove a broken worktree
git worktree remove --force /path/to/worktree
```

### Architecture enforcement false positives
If `enforce.sh` flags a valid import:
1. Check if the import truly crosses layers
2. If it's a valid exception, add it to `architecture/rules.json` under `exceptions`
3. Document why in `memory/DECISIONS.md`

### Hooks not running
```bash
# Check hook permissions
ls -la hooks/
chmod +x hooks/*.sh

# Verify settings.json
cat .claude/settings.json

# Test a hook manually
./hooks/pre-edit-arch-check.sh "src/service/test.ts"
```

### Auto-fix loop runs forever
- Check that `max_retries` is set (default: 3)
- Check logs: `ls .worktree-logs/`
- The issue might need human judgment — not all bugs are auto-fixable

### Parallel agents modifying same file
This is a task design problem, not a tool problem.
- Ensure each task targets different files
- Follow the task-splitter guide: `harness/task-splitter.md`
- Types should be defined in a separate, prior task

### Architecture exceptions
If `enforce.sh` flags an import you know is valid:
```bash
# Add to architecture/rules.json under "exceptions"
{
  "exceptions": {
    "allowed_cross_layer": ["src/shared/utils.ts"],
    "allowed_large_files": ["src/types/generated.ts"],
    "allowed_naming_exceptions": ["src/app/[slug]/page.tsx"]
  }
}
```
See `docs/ARCHITECTURE-GUIDE.md` for full customization options.

### CI workflow fails with "Author identity unknown"
GitHub Actions needs git config before committing:
```yaml
- name: Configure git
  run: |
    git config user.name "Claude Agent"
    git config user.email "claude@agent.local"
```
All harness CI workflows include this step. If you add custom workflows, remember to include it.

### Deploy fails
```bash
# Check deployment configuration
./harness/deploy-manager.sh detect

# Preview deployment (staging)
./harness/deploy-manager.sh preview --confirm

# Check deployment status
./harness/deploy-manager.sh status
```

### Database migration issues
```bash
# Check detected ORM/migration tool
./harness/db-manager.sh detect

# Reset development database
./harness/db-manager.sh reset --confirm

# Check migration status
./harness/db-manager.sh status
```

### Stack detection incorrect
```bash
# Run stack detector manually
./harness/stack-detector.sh detect

# Override in CLAUDE.md or memory/STACK-CONTEXT.md
# Detector uses file heuristics — override when ambiguous
```

### Environment variables missing
```bash
# Check all required variables
./harness/env-manager.sh check

# Initialize .env from template
./harness/env-manager.sh init

# See docs/SECURITY.md for secret management practices
```
