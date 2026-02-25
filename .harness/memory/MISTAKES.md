# Mistakes Log

Record mistakes here so agents don't repeat them. Check this file before fixing bugs.

## Format

### Mistake: <Short description>
- **Date**: YYYY-MM-DD
- **What happened**: Description of the bug/mistake
- **Root cause**: Why it happened
- **Fix**: How it was resolved
- **Prevention**: How to avoid it in the future

---

### Mistake: Full enforce.sh in post-edit hook causes slowness
- **Date**: 2026-02-19
- **What happened**: Running the complete `architecture/enforce.sh` script in the post-edit lifecycle hook caused noticeable delays after every file edit, making the development loop sluggish.
- **Root cause**: enforce.sh scans the entire `src/` directory tree with multiple grep passes and file-size checks. This is appropriate for CI or pre-commit, but too heavy for a hook that fires on every single edit.
- **Fix**: Changed the post-edit hook to run targeted single-file checks instead of the full enforcement suite. Full enforce.sh is reserved for pre-commit and CI.
- **Prevention**: Lifecycle hooks that run on every edit must complete in under 1 second. Use targeted checks (single file, single rule) in high-frequency hooks. Save comprehensive checks for batch operations.

---

### Mistake: Parallel tasks modifying same file causes merge conflicts
- **Date**: 2026-02-19
- **What happened**: Two parallel agents (running in separate worktrees) were assigned tasks that both required editing the same configuration file. When merging their branches, git reported merge conflicts that required manual resolution.
- **Root cause**: Task scoping did not account for file-level overlap. The orchestrator assigned tasks based on feature scope, not file scope.
- **Fix**: Added file-scope analysis to the orchestrator's task assignment logic. Before dispatching parallel tasks, the orchestrator now checks for overlapping file paths and serializes conflicting tasks.
- **Prevention**: Always define task scope boundaries at the file level, not just the feature level. Use `harness/worktree-manager.sh` scope checks before assigning parallel work. When overlap is unavoidable, serialize the tasks or designate one agent as the owner of the shared file.

---

### Mistake: Shell variable interpolation in heredocs can cause injection
- **Date**: 2026-02-19
- **What happened**: A shell script used an unquoted heredoc (`<<EOF`) to generate a configuration file. User-provided input contained shell metacharacters that were expanded during heredoc evaluation, producing corrupted output.
- **Root cause**: Unquoted heredoc delimiters (`<<EOF`) allow variable expansion and command substitution. If any variable contains special characters like `$`, backticks, or `$(...)`, they are interpreted as shell expressions.
- **Fix**: Changed to quoted heredoc (`<<'EOF'`) to prevent all interpolation. For cases where partial interpolation is needed, the data is written to a temp file first, then inserted using safe substitution.
- **Prevention**: Always use quoted heredocs (`<<'EOF'`) when writing file content that should be literal. If interpolation is needed, use temp files or base64-encode the content to avoid injection. Never pass untrusted input through unquoted heredocs.

---

<!-- Add new mistakes below -->
