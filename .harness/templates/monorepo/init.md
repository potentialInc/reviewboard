# Turborepo Monorepo Project Initialization

## Steps

1. **Create Turborepo project**:
```bash
npx create-turbo@latest {PROJECT_NAME}
cd {PROJECT_NAME}
```

2. **Set up workspace structure**:
```bash
# Shared packages
mkdir -p packages/types/src
mkdir -p packages/config

# App-specific layer directories
mkdir -p apps/api/src/{repo,service,routes}
mkdir -p apps/web/src/{components,pages}

# Initialize shared types package
cat > packages/types/package.json << 'EOF'
{
  "name": "@{PROJECT_NAME}/types",
  "version": "0.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
EOF
touch packages/types/src/index.ts
```

3. **Layer mapping for Turborepo** (distributed across workspace):
| Harness Layer | Monorepo Equivalent |
|---|---|
| types/ | `packages/types/` — shared TypeScript types across all apps |
| config/ | `packages/config/` — shared ESLint, TypeScript, and app config |
| repo/ | `apps/api/src/repo/` — data access, database queries |
| service/ | `apps/api/src/service/` — business logic, shared services |
| runtime/ | `apps/api/src/routes/` — API routes, server entry point |
| ui/ | `apps/web/src/components/` — frontend React components, pages |

4. **Install workspace dependencies**:
```bash
npm install
```

Verify workspace links:
```bash
npx turbo build
```

5. **Copy harness files** to monorepo root:
```bash
# Set HARNESS_ROOT to your claude-harness location, or use harness-install.sh
cp -r "${HARNESS_ROOT:?Set HARNESS_ROOT to your claude-harness path}"/{CLAUDE.md,architecture,hooks,agents,memory,docs} .
```

6. **Update CLAUDE.md** with Turborepo-specific commands:
```markdown
## Commands
- Dev (all): `npx turbo dev`
- Build (all): `npx turbo build`
- Test (all): `npx turbo test`
- Lint (all): `npx turbo lint`
- Dev (api only): `npx turbo dev --filter=api`
- Dev (web only): `npx turbo dev --filter=web`
- Add dep to app: `npm install <pkg> --workspace=apps/web`
- Add dep to package: `npm install <pkg> --workspace=packages/types`
```
