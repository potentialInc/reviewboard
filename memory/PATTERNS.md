# Discovered Patterns

Patterns and conventions discovered during development. Agents should check this before making decisions.

## Format

### Pattern: <Name>
- **Where**: Which files/modules
- **Rule**: What to do
- **Why**: Why this pattern exists

---

### Pattern: Agent instruction file structure
- **Where**: `agents/*.md` (all agent role files)
- **Rule**: Every agent .md file must follow the structure: Workflow -> Rules -> Error Handling. The Workflow section describes the step-by-step process. The Rules section lists constraints. The Error Handling section defines what to do when things fail.
- **Why**: Consistent structure allows agents to parse their own instructions reliably and ensures no role definition is missing critical failure-recovery guidance.

---

### Pattern: Shell script boilerplate
- **Where**: All shell scripts (`harness/*.sh`, `scripts/*.sh`, `architecture/*.sh`, `memory/*.sh`)
- **Rule**: Every shell script must start with `set -euo pipefail` and include `PROJECT_ROOT` detection using: `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"` followed by `PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"` (or equivalent for nested scripts).
- **Why**: `set -euo pipefail` catches errors early and prevents silent failures. `PROJECT_ROOT` detection ensures scripts work regardless of the directory they are invoked from.

---

### Pattern: Status tracking via markdown tables
- **Where**: `templates/status.md`, `memory/PROGRESS.md`, task tracking files
- **Rule**: Use markdown tables with columns for Task, Status, and Notes. Status values are: `PENDING`, `IN_PROGRESS`, `COMPLETE`, `BLOCKED`. Agents must update status in real time as they work.
- **Why**: Markdown tables are parseable by both humans and agents. Consistent status values enable automated progress reporting and orchestration decisions (e.g., unblocking dependent tasks).

---

<!-- Add new patterns below -->
