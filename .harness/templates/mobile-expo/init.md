# Expo / React Native Project Initialization

## Steps

1. **Create Expo app**:
```bash
npx create-expo-app {PROJECT_NAME} --template blank-typescript
cd {PROJECT_NAME}
```

2. **Add harness layer structure** inside `src/`:
```bash
mkdir -p src/{types,config,api,services,components}
for dir in src/types src/config src/api src/services; do
  touch "$dir/index.ts"
done
```

3. **Layer mapping for Expo / React Native**:
| Harness Layer | Expo Equivalent |
|---|---|
| types/ | `src/types/` — shared TypeScript types, navigation param types |
| config/ | `src/config/` — API URLs, feature flags, app constants |
| repo/ | `src/api/` — API client, REST/GraphQL hooks, data fetching |
| service/ | `src/services/` — business logic, auth service, storage |
| runtime/ | `app/` — Expo Router navigation, layouts, screens |
| ui/ | `src/components/` — React Native components, reusable UI |

4. **Install additional dependencies**:
```bash
npx expo install expo-router expo-constants expo-linking
npm install -D jest @testing-library/react-native @types/jest
```

Add test config to `package.json`:
```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
    ]
  }
}
```

5. **Copy harness files**:
```bash
# Set HARNESS_ROOT to your claude-harness location, or use harness-install.sh
cp -r "${HARNESS_ROOT:?Set HARNESS_ROOT to your claude-harness path}"/{CLAUDE.md,architecture,hooks,agents,memory,docs} .
```

6. **Update CLAUDE.md** with Expo-specific commands:
```markdown
## Commands
- Dev: `npx expo start`
- iOS: `npx expo run:ios`
- Android: `npx expo run:android`
- Test: `npm test`
- Lint: `npx eslint src/`
- Build (preview): `eas build --profile preview`
- Build (production): `eas build --profile production`
```
