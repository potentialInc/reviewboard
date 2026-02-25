# PRD Directory — Source of Truth for Intent

All Product Requirement Documents live here. Agents reference these as the **Source of Truth (SoT)** during pipeline and team mode execution.

## Naming Convention

```
prd-<feature-name>.md
```

Examples:
- `prd-auth.md` — Authentication system
- `prd-dashboard.md` — User dashboard
- `prd-payment.md` — Payment integration

## SoT Selection Rules

When pipeline or team mode needs to determine which PRD is the current SoT:

1. **Single file** — If only one `prd-*.md` exists, it is automatically the SoT
2. **Multiple files** — The file with `status: active` in its YAML header is the SoT
3. **Explicit override** — User specifies directly in the prompt:
   ```
   pipeline: build auth system from prd-auth.md
   team: implement dashboard from prd-dashboard.md
   ```

If multiple files have `status: active`, the agent will ask the user to clarify.

## YAML Header (Required)

Every PRD must start with a YAML frontmatter block:

```yaml
---
name: feature-name
status: active | draft | completed
version: "1.0"
last_updated: YYYY-MM-DD
---
```

| Field | Purpose |
|-------|---------|
| `name` | Machine-readable feature identifier |
| `status` | SoT selection: only `active` is used as current intent |
| `version` | Track major revisions (bump on scope changes) |
| `last_updated` | Human reference for freshness |

## Templates

- `FEATURE_PRD.template.md` — Full 13-section feature PRD
- `SYSTEM_DECISION.template.md` — Architecture/system decision record

## Usage

```bash
# Copy template for a new feature
cp prd/FEATURE_PRD.template.md prd/prd-my-feature.md

# Start pipeline from PRD
# Type in Claude: pipeline: build my-feature from prd-my-feature.md

# Start team mode from PRD
# Type in Claude: team: implement my-feature from prd-my-feature.md
```

## Agent Mapping

Each PRD section maps to a specific agent's input:

| PRD Section | Agent | Magic Keyword |
|-------------|-------|---------------|
| DB Schema | database-agent | `db:` |
| API Endpoints | feature-builder | `build:` |
| UI Specifications | feature-builder | `build:` |
| Acceptance Criteria | test-writer | `test:` |
| NFRs (performance) | performance-agent | `perf:` |
| NFRs (security) | security-agent | `secure:` |
