# Task Splitter Guide

This guide helps humans and agents break down large features into parallelizable tasks.

## Splitting Rules

1. **Each task = one module or layer**. Don't mix layers in a single task.
2. **Types first**. Always create types/interfaces as a separate task. Other tasks depend on it.
3. **No cross-task dependencies**. If task B needs task A's output, they can't run in parallel.
4. **Each task must be independently testable**.

## Example: "Build User Authentication"

### Bad split (dependencies everywhere):
```json
{
  "tasks": [
    { "name": "auth-frontend", "prompt": "Build login form" },
    { "name": "auth-backend", "prompt": "Build auth API" }
  ]
}
```
Problem: Frontend needs backend types, backend needs database — implicit dependencies.

### Good split (by layer, types first):
```json
{
  "tasks": [
    { "name": "auth-types", "prompt": "Define User, Session, AuthToken types in src/types/auth.ts. Export from src/types/index.ts" }
  ]
}
```
Run types first, then in parallel:
```json
{
  "tasks": [
    { "name": "auth-repo", "prompt": "Implement UserRepository in src/repo/user-repo.ts. Use types from src/types/auth.ts. Include CRUD operations." },
    { "name": "auth-config", "prompt": "Add JWT config to src/config/auth-config.ts. Define JWT_SECRET, TOKEN_EXPIRY, REFRESH_EXPIRY." }
  ]
}
```
Then:
```json
{
  "tasks": [
    { "name": "auth-service", "prompt": "Implement AuthService in src/service/auth-service.ts. Use UserRepository and auth config. Methods: login, register, refreshToken, logout." },
    { "name": "auth-middleware", "prompt": "Create auth middleware in src/runtime/middleware/auth.ts. Validate JWT tokens. Attach user to request context." }
  ]
}
```

## Template: tasks.json

```json
{
  "tasks": [
    {
      "name": "short-kebab-name",
      "prompt": "Clear, specific instruction. Include: target file paths, which types/modules to use, expected function signatures."
    }
  ]
}
```

## Checklist before running orchestrator

- [ ] Types/interfaces defined (or in a separate prior task)
- [ ] Each task targets specific files in specific layers
- [ ] No two tasks modify the same file
- [ ] Each task includes enough context to work independently
- [ ] Expected function signatures are specified
