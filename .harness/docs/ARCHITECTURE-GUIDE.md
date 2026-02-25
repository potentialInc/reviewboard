# Architecture Customization Guide

How to customize architecture rules for your specific project and tech stack.

## Default Layer Model

```
types → config → repo → service → runtime → ui
```

Dependencies flow **top-down only**. Each layer can only import from layers above it.

## Stack-Specific Overrides

The harness supports per-stack architecture rules in `architecture/stack-rules/`:

| Stack | File | Key Differences |
|-------|------|----------------|
| Next.js | `stack-rules/nextjs.json` | `src/app/` maps to runtime, server/client components |
| FastAPI | `stack-rules/fastapi.json` | `app/schemas/` maps to types, `__init__.py` required |
| Go | `stack-rules/go.json` | `internal/` convention, `cmd/` as runtime entry |

### How Overrides Work

Stack rules extend (not replace) the base `rules.json`. They add:

- **Layer mappings**: Which directories map to which layers
- **Additional exceptions**: Stack-specific patterns that are allowed
- **Naming overrides**: Framework-specific naming conventions

## Customizing Rules

### Adding Exceptions

Edit `architecture/rules.json` and add to the `exceptions` field:

```json
"exceptions": {
  "allowed_cross_layer": [
    "src/shared/utils.ts"
  ],
  "allowed_large_files": [
    "src/types/generated.ts"
  ],
  "allowed_naming_exceptions": [
    "src/app/[slug]/page.tsx"
  ]
}
```

### Changing File Size Limits

```json
"file_rules": {
  "max_lines": 500,
  "one_concern_per_file": true
}
```

### Adding Custom Layer Mappings

For projects that don't use the standard `src/` structure:

```json
"layer_mappings": {
  "types": ["models/", "schemas/", "interfaces/"],
  "config": ["settings/", "env/"],
  "repo": ["data/", "repositories/", "dal/"],
  "service": ["business/", "domain/", "services/"],
  "runtime": ["api/", "routes/", "handlers/", "cmd/"],
  "ui": ["views/", "components/", "pages/", "templates/"]
}
```

## Enforcement

### Run Manually

```bash
./architecture/enforce.sh                    # Default: checks ./src
./architecture/enforce.sh ./app              # Custom source directory
./architecture/enforce.sh ./internal         # Go projects
```

### What Gets Checked

1. **Layer dependencies**: No upward imports (service can't import from ui)
2. **File sizes**: Max 300 lines per file (configurable)
3. **Naming conventions**: kebab-case files, PascalCase types
4. **Circular dependencies**: A→B→A detection
5. **Module boundaries**: Public entry points (index.ts, __init__.py) required

### Understanding Violations

Violations produce educational messages:

```
[VIOLATION] Layer 'types' imports from 'service'
[LEARN] Dependencies must flow top-down: types → config → repo → service → runtime → ui.
        'types' cannot import from 'service'. Move shared logic to a higher layer
        or use dependency injection.
```

### Fixing Common Violations

| Violation | Fix |
|-----------|-----|
| Layer X imports from layer Y | Move shared code to a higher layer, or use DI |
| File exceeds 300 lines | Split into smaller files with single responsibility |
| Circular dependency A↔B | Extract shared logic into a new module |
| Missing public entry point | Add `index.ts`, `__init__.py`, or `mod.rs` |
| Non-kebab-case filename | Rename: `MyFile.ts` → `my-file.ts` |

## Creating Stack-Specific Rules

Create `architecture/stack-rules/<stack>.json`:

```json
{
  "stack": "my-framework",
  "extends": "rules.json",
  "layer_mappings": {
    "types": "src/models/",
    "config": "src/config/",
    "repo": "src/data/",
    "service": "src/logic/",
    "runtime": "src/server/",
    "ui": "src/views/"
  },
  "exceptions": {
    "description": "Framework-specific allowances",
    "allowed_patterns": [
      "src/server/ can import from src/views/ for SSR"
    ]
  },
  "naming_overrides": {
    "files": "PascalCase for React components in ui/"
  }
}
```

## Integration with Hooks

Architecture is enforced at two points:

1. **Pre-edit hook** (`hooks/pre-edit-arch-check.sh`): Shows layer context before edits
2. **Build check** (`hooks/build-check.sh`): Full validation on session stop

The pre-edit hook **hard-blocks** edits to protected paths (exit 2) and shows layer context for other files. Build-check runs full validation on session stop.

## Disabling Checks

To skip a specific check temporarily (not recommended):

```bash
# Skip in enforce.sh by checking an env var
SKIP_SIZE_CHECK=1 ./architecture/enforce.sh
```

For permanent exceptions, use the `exceptions` field in `rules.json` instead.
