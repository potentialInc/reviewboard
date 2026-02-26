# Architecture Decision Records

Record important architectural decisions here so future agents don't repeat debates.

## Format

### ADR-NNN: <Title>
- **Date**: YYYY-MM-DD
- **Status**: accepted | superseded | deprecated
- **Context**: What prompted this decision?
- **Decision**: What did we decide?
- **Consequences**: What are the trade-offs?

---

### ADR-001: Top-down layer model
- **Date**: 2026-02-19
- **Status**: accepted
- **Context**: The project needed a dependency structure to prevent spaghetti imports and keep agent-generated code maintainable. Options considered: flat modules with no enforcement, a top-down layered architecture, or a hexagonal/ports-and-adapters model.
- **Decision**: Adopt a strict top-down layer model: types -> config -> repo -> service -> runtime -> ui. Each layer can only import from layers above it.
- **Consequences**: Simple to enforce with grep-based checks. Agents can reason about boundaries without understanding the full codebase. Trade-off: some legitimate cross-layer patterns (e.g., runtime importing from ui for SSR) require explicit exceptions.

---

### ADR-002: Git worktrees for parallel agents
- **Date**: 2026-02-19
- **Status**: accepted
- **Context**: Multiple agents need to work on independent tasks simultaneously without stepping on each other. Options considered: Docker containers per agent, separate git clones, or git worktrees.
- **Decision**: Use git worktrees to give each parallel agent its own working directory on a dedicated branch.
- **Consequences**: Lightweight and fast — no container overhead. Each agent gets full filesystem isolation on its own branch. Trade-off: agents must not modify overlapping files, and worktree cleanup must be automated to avoid stale branches.

---

### ADR-003: Magic keywords for skill activation
- **Date**: 2026-02-19
- **Status**: accepted
- **Context**: Agents need a fast way to invoke specialized skills (build, test, refactor, etc.). Options considered: pure NLP intent detection, explicit command syntax, or magic keyword prefixes.
- **Decision**: Use magic keyword prefixes (e.g., `build:`, `fix:`, `test:`) that trigger auto-activation of the corresponding skill. NLP intent matching is used as a fallback.
- **Consequences**: Deterministic activation for common tasks — agents always get the right skill. Easy to extend by adding new keywords. Trade-off: users must learn the keyword convention, though the fallback NLP path handles natural language gracefully.

---

### ADR-004: Markdown agent instructions
- **Date**: 2026-02-19
- **Status**: accepted
- **Context**: Agent behavior needs to be configurable per role (feature-builder, bug-fixer, etc.). Options considered: code-based config (JSON/YAML), Python plugin system, or markdown instruction files.
- **Decision**: Define agent roles and instructions in markdown (.md) files following a Workflow -> Rules -> Error Handling structure.
- **Consequences**: Human-readable and easy to iterate on without code changes. Agents can self-reference their own instructions. Trade-off: no type checking or validation of instruction content — relies on convention and the patterns documented in PATTERNS.md.

---

### ADR-005: L5 upgrade — Core protection, PRD SoT, Tests guard, Safe mode
- **Date**: 2026-02-19
- **Status**: accepted
- **Context**: Gap analysis (L4.7→L5) identified 3+1 critical gaps: agents could modify their own runtime (harness/hooks/architecture), PRD intent drifted in long sessions, auto-fix had no self-test validation, and non-dev users had no safety limits. Additionally, stack-rules were disconnected from enforce.sh and session intent was not tracked.
- **Decision**: (1) Add `protected_paths` to rules.json with pre-edit hook blocking (exit 2). jq fallback uses hardcoded list — degraded protection, never dead-end. (2) Create `prd/` directory with YAML-header templates and 3-tier SoT selection rule. (3) Create `tests/` with graded failure policy: P0 (protected paths) = hard-fail, P1 (layer) = warn, P2 (smoke) = warn with escalation after 3 consecutive. (4) Add `harness.config.json` with safeMode limiting parallel agents and retries. (5) No TTL/expiry on `allowed_core_edits` — the self-protecting structure (rules.json ∈ protected path → only human can edit) is sufficient.
- **Consequences**: L5 closed-loop achieved: Intent(prd/) → Execute(agents) → Validate(tests/guards) → Learn(PROGRESS.md with intent tracking). Non-dev users get safeMode=true by default on install. Trade-off: jq-less environments get degraded (hardcoded) protection instead of full dynamic rules. No TTL means forgotten exceptions persist until manually removed — acceptable because the gatekeeper is structural, not temporal.

---

<!-- Add new decisions below -->
