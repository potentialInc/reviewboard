# Architecture Map

## Layer Model

```
┌─────────────────────────────────────────┐
│  ui/          — UI components, pages    │  ← Can import from ALL layers above
├─────────────────────────────────────────┤
│  runtime/     — App bootstrap, DI       │  ← Can import service, repo, config, types
├─────────────────────────────────────────┤
│  service/     — Business logic          │  ← Can import repo, config, types
├─────────────────────────────────────────┤
│  repo/        — Data access, API calls  │  ← Can import config, types
├─────────────────────────────────────────┤
│  config/      — Configuration, env      │  ← Can import types
├─────────────────────────────────────────┤
│  types/       — Type definitions only   │  ← Cannot import anything
└─────────────────────────────────────────┘
```

## Rules

1. **Top-down only**: A layer can only import from layers above it in the diagram
2. **No circular deps**: If A imports B, B cannot import A
3. **Public interfaces**: Cross-module imports go through `index.ts` / `__init__.py`
4. **One concern per file**: Max 300 lines. Split when it grows.
5. **Colocated tests**: Tests live next to source or in `__tests__/`

## Enforcement

All rules are validated by `architecture/enforce.sh`, which runs:
- Automatically on every Edit/Write via Claude Code hooks
- In CI before merge
- Manually via `./architecture/enforce.sh [src_dir]`

Violations produce educational messages explaining WHY the rule exists and HOW to fix it.
