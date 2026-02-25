---
description: Extract Figma screen names and node IDs for implementation tracking
argument-hint: "<figma-url>"
---

# Figma Extract Screens

Extract screen names and node IDs from a Figma design file to populate SCREEN_STATUS.md.

## Prerequisites

1. **Figma API Token** stored in `.env` or `secrets/figma-token.env`
   - Create at: Figma → Settings → Account → Personal access tokens
   - Scope: `file_content:read`
   - Format: `FIGMA_TOKEN=figd_xxxxx...`
2. **Figma URL** with `node-id` parameter

## Usage

```
figma-extract-screens <figma-url>
figma-extract-screens https://www.figma.com/design/ABC123/My-Design?node-id=16297-54644
```

## Workflow

### Step 1: Parse Figma URL

Extract from URL:
- `fileKey` from path: `/design/:fileKey/:fileName`
- `nodeId` from query: `?node-id=:nodeId`
- Convert hyphen to colon for API: `16297-54644` → `16297:54644`

### Step 2: Fetch Figma Data

```bash
source secrets/figma-token.env  # or .env

curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/$FILE_KEY/nodes?ids=$NODE_ID&depth=1" \
  -o /tmp/figma_response.json
```

### Step 3: Parse Response

Extract children of type `SECTION` or `FRAME` (these are the screens):

```
Node: [Parent Name]
Type: [SECTION/FRAME]
Children: [count]

Screens found:
  16297:105461  [FRAME]  01-Landing Page
  16297:105462  [FRAME]  02-Login
  16297:105463  [FRAME]  03-Dashboard
  ...
```

### Step 4: Generate SCREEN_STATUS.md

Create or update `SCREEN_STATUS.md` from `templates/status/SCREEN_STATUS.template.md`:

| # | Screen | Source Ref | Status | Fidelity | Last Run | Notes |
|---|--------|-----------|--------|----------|----------|-------|
| 1 | Landing Page | `16297:105461` | PENDING | — | — | |
| 2 | Login | `16297:105462` | PENDING | — | — | |
| 3 | Dashboard | `16297:105463` | PENDING | — | — | |

### Step 5: Report

```
Figma file: [file name]
Section: [parent node name]
Screens found: [count]
SCREEN_STATUS.md: created/updated

Next steps:
1. Export screen screenshots to design/screens/
2. Run design: to start UI implementation
```

## Error Handling

- Invalid URL: ask user for valid Figma URL with `node-id`
- 401 Unauthorized: token expired, ask user to regenerate
- 404 Not Found: node ID incorrect or file access restricted
- 429 Rate Limited: wait and retry
- No FIGMA_TOKEN: show setup instructions

## Related

- Next step: `ui-builder` agent (with Figma screenshots in `design/screens/`)
- QA: `design-qa` agent (uses Figma node IDs for comparison)
