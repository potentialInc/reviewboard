# API Documentation Auto-Generation Skill

## Purpose

Automatically extract API endpoints from code and generate OpenAPI/Swagger documentation without requiring manual annotations.

## Trigger

- Magic keyword: `docs:api` or `docs:openapi`
- Intent: "generate API docs", "create swagger", "document endpoints"

## Workflow

### Phase 1: Endpoint Discovery

Scan the codebase to find all API routes:

**Next.js (App Router)**
```bash
# Find all route handlers
find src/app/api -name "route.ts" -o -name "route.js"
```

**FastAPI**
```bash
# Find all router files
grep -rn "@router\.\(get\|post\|put\|delete\|patch\)" src/runtime/routes/
```

**Express**
```bash
# Find all route definitions
grep -rn "router\.\(get\|post\|put\|delete\|patch\)" src/
```

### Phase 2: Schema Extraction

For each endpoint, extract:

| Field | Source |
|-------|--------|
| Path | File path (Next.js) or decorator (FastAPI/Express) |
| Method | HTTP method from handler |
| Request body | TypeScript interface / Pydantic model / Zod schema |
| Response body | Return type / response_model |
| Path params | Dynamic route segments `[id]` or `{id}` |
| Query params | `searchParams` / `Query()` / `req.query` |
| Auth required | Middleware / dependency check |
| Status codes | Response constructors / raise HTTPException |

### Phase 3: OpenAPI Generation

Generate `docs/openapi.yaml`:

```yaml
openapi: 3.1.0
info:
  title: MyApp API
  version: 1.0.0
  description: Auto-generated API documentation

servers:
  - url: http://localhost:3000/api
    description: Development
  - url: https://staging.myapp.com/api
    description: Staging
  - url: https://myapp.com/api
    description: Production

paths:
  /users:
    get:
      summary: List users
      tags: [Users]
      security: [{ bearerAuth: [] }]
      parameters:
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, default: 20 }
      responses:
        "200":
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: "#/components/schemas/User" }
                  total: { type: integer }

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    User:
      type: object
      properties:
        id: { type: string }
        email: { type: string, format: email }
        name: { type: string }
        role: { type: string, enum: [admin, member, viewer] }
        createdAt: { type: string, format: date-time }
```

### Phase 4: Serve Documentation

**Option A: Swagger UI (recommended)**
```bash
npm install swagger-ui-react
```

```typescript
// app/docs/page.tsx
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import spec from "@/docs/openapi.yaml";

export default function ApiDocs() {
  return <SwaggerUI spec={spec} />;
}
```

**Option B: Scalar (modern alternative)**
```bash
npm install @scalar/nextjs-api-reference
```

**Option C: Static HTML**
```bash
npx @redocly/cli build-docs docs/openapi.yaml -o docs/api.html
```

## Output Files

| File | Description |
|------|-------------|
| `docs/openapi.yaml` | OpenAPI 3.1 specification |
| `docs/api.html` | Static HTML documentation (optional) |

## Stack-Specific Shortcuts

### FastAPI (Built-in)

FastAPI auto-generates OpenAPI at `/docs` (Swagger UI) and `/redoc`. Extract:

```bash
curl http://localhost:8000/openapi.json > docs/openapi.json
```

### Express + swagger-jsdoc

```bash
npm install swagger-jsdoc swagger-ui-express
```

## Validation

```bash
# Validate OpenAPI spec
npx @redocly/cli lint docs/openapi.yaml

# Preview
npx @redocly/cli preview-docs docs/openapi.yaml
```

## Rules

- Generated docs go in `docs/` directory (never in `src/`)
- Re-generate on every API change (add to CI pipeline)
- Include request/response examples where possible
- Group endpoints by resource tag (Users, Products, Auth)
- Document error responses (400, 401, 403, 404, 500)
- Include authentication requirements per endpoint
