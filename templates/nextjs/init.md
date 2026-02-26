# Next.js Project Initialization

## Steps

1. **Create Next.js app**:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
```

2. **Add harness layer structure** inside `src/`:
```bash
mkdir -p src/{types,config,repo,service}
for dir in src/types src/config src/repo src/service; do
  touch "$dir/index.ts"
done
```

3. **Layer mapping for Next.js**:
| Harness Layer | Next.js Equivalent |
|---|---|
| types/ | `src/types/` — shared TypeScript types |
| config/ | `src/config/` — env vars, constants |
| repo/ | `src/repo/` — database queries, API clients |
| service/ | `src/service/` — business logic |
| runtime/ | `src/app/api/` — API routes (Next.js convention) |
| ui/ | `src/app/` + `src/components/` — pages and components |

4. **Install test runner**:
```bash
npm i -D vitest @testing-library/react @testing-library/jest-dom
```

5. **Copy harness files**:
```bash
# Set HARNESS_ROOT to your claude-harness location, or use harness-install.sh
cp -r "${HARNESS_ROOT:?Set HARNESS_ROOT to your claude-harness path}"/{CLAUDE.md,architecture,hooks,agents,memory,docs} .
```

6. **Update CLAUDE.md** with Next.js-specific commands:
```markdown
## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Test: `npx vitest run`
- Lint: `npm run lint`
```
