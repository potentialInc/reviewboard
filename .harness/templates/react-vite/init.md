# React + Vite + TypeScript Project Initialization

## Steps

1. **Create React + Vite app**:
```bash
npm create vite@latest {PROJECT_NAME} -- --template react-ts
cd {PROJECT_NAME}
npm install
```

2. **Add harness layer structure** inside `src/`:
```bash
mkdir -p src/{types,config,api,services,components}
for dir in src/types src/config src/api src/services; do
  touch "$dir/index.ts"
done
```

3. **Layer mapping for React + Vite**:
| Harness Layer | React + Vite Equivalent |
|---|---|
| types/ | `src/types/` — shared TypeScript types, interfaces |
| config/ | `src/config/` — env vars, constants, feature flags |
| repo/ | `src/api/` — API client, fetch hooks, data fetching |
| service/ | `src/services/` — business logic, state management |
| runtime/ | `src/main.tsx`, `src/App.tsx` — app entry point, routing |
| ui/ | `src/components/` — React components, pages, layouts |

4. **Install dev dependencies**:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add test config to `vite.config.ts`:
```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

5. **Copy harness files**:
```bash
# Set HARNESS_ROOT to your claude-harness location, or use harness-install.sh
cp -r "${HARNESS_ROOT:?Set HARNESS_ROOT to your claude-harness path}"/{CLAUDE.md,architecture,hooks,agents,memory,docs} .
```

6. **Update CLAUDE.md** with React-specific commands:
```markdown
## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
- Test: `npx vitest run`
- Lint: `npx eslint src/`
```
