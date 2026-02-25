# ReviewBoard Architecture

## Overview

ReviewBoard is a design feedback platform that allows admin users to manage projects and screens, while clients can view their assigned projects and leave pin-based feedback comments on screenshot versions. Built with Next.js 16 (App Router), Supabase (PostgreSQL + Storage), and iron-session for authentication.

---

## Project Structure

```
app/
  src/
    app/
      api/
        auth/
          login/route.ts        # POST - authenticate admin/client
          logout/route.ts       # POST - destroy session
          me/route.ts           # GET  - session check
        projects/
          route.ts              # GET (list) / POST (create)
          [id]/
            route.ts            # GET / PATCH / DELETE single project
            screens/
              route.ts          # POST - create screen
              [screenId]/
                screenshots/
                  route.ts      # POST - upload screenshot (multipart)
          bulk/
            route.ts            # DELETE - batch delete projects
        feedback/
          route.ts              # GET  - list all feedback (admin)
          [id]/route.ts         # GET  - single feedback detail
          bulk/route.ts         # PATCH - bulk status update
        comments/
          route.ts              # POST - create pin comment
          [id]/
            route.ts            # PATCH / DELETE single comment
            replies/
              route.ts          # POST - add reply
        screens/
          [id]/route.ts         # GET / DELETE single screen
        dashboard/
          route.ts              # GET  - aggregate stats
        health/
          route.ts              # GET  - health check
    lib/
      auth.ts                   # iron-session helpers (get/set/clear session)
      types.ts                  # TypeScript interfaces
      validation.ts             # UUID & coordinate validators
      rate-limit.ts             # In-memory rate limiter
      slack.ts                  # Slack notification (Bot Token + Webhook)
      feedback-count.ts         # Open feedback count aggregators
      env.ts                    # Environment variable validation
      supabase/
        server.ts               # Server-side Supabase clients (SSR + Service Role)
        client.ts               # Browser-side Supabase client
    middleware.ts               # Auth guard, CSRF check, security headers
  supabase/
    migrations/                 # Ordered SQL migration files
    seed.sql                    # Development seed data
```

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph Client["Browser"]
        UI["Next.js Frontend<br/>(React 19 + Tailwind CSS 4)"]
    end

    subgraph Middleware["Edge Middleware"]
        MW["middleware.ts"]
        MW --> SessionCheck["Session Validation<br/>(iron-session unseal)"]
        MW --> CSRF["CSRF Check<br/>(Origin header)"]
        MW --> SecHeaders["Security Headers<br/>(HSTS, CSP, X-Frame)"]
    end

    subgraph API["Next.js API Routes"]
        Auth["Auth Routes<br/>/api/auth/*"]
        Projects["Project Routes<br/>/api/projects/*"]
        Screens["Screen Routes<br/>/api/screens/*"]
        Comments["Comment Routes<br/>/api/comments/*"]
        Feedback["Feedback Routes<br/>/api/feedback/*"]
        Dashboard["Dashboard Route<br/>/api/dashboard"]
        Health["Health Route<br/>/api/health"]
    end

    subgraph Lib["Shared Libraries"]
        AuthLib["auth.ts<br/>(iron-session)"]
        Validation["validation.ts"]
        RateLimit["rate-limit.ts"]
        SlackLib["slack.ts"]
        FeedbackCount["feedback-count.ts"]
    end

    subgraph External["External Services"]
        Supabase["Supabase<br/>(PostgreSQL + Storage)"]
        Slack["Slack API"]
    end

    UI -->|"HTTP + Cookie"| MW
    MW -->|"Pass-through"| API
    API --> Lib
    AuthLib -->|"seal/unseal"| Cookie["rb_session cookie"]
    Projects --> Supabase
    Screens --> Supabase
    Comments --> Supabase
    Feedback --> Supabase
    Dashboard --> Supabase
    Health --> Supabase
    Comments -->|"Notification"| SlackLib
    SlackLib --> Slack
```

---

## Data Flow

### Request Lifecycle

```mermaid
sequenceDiagram
    participant B as Browser
    participant MW as Middleware
    participant API as API Route
    participant Auth as auth.ts
    participant SB as Supabase

    B->>MW: HTTP Request + rb_session cookie
    MW->>MW: Check public path?
    alt Public path (/login, /api/auth/*, /api/health)
        MW->>MW: Apply security headers
        MW->>API: Pass through
    else Protected path
        MW->>MW: Validate CSRF (Origin header)
        MW->>MW: Unseal session cookie
        alt No valid session
            MW->>B: 401 JSON or redirect to /login
        else Valid session
            MW->>MW: Check role-based access
            MW->>API: Pass through
        end
    end
    API->>Auth: getSession()
    Auth->>Auth: Unseal rb_session cookie
    Auth-->>API: SessionUser | null
    API->>API: Authorize (isAdmin / hasProjectAccess)
    API->>SB: Query via Service Role client
    SB-->>API: Data / Error
    API->>B: JSON Response
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant Login as /api/auth/login
    participant Auth as auth.ts
    participant SB as Supabase
    participant Bcrypt as bcryptjs

    B->>Login: POST { id, password }
    Login->>Login: Rate limit check (5/min per IP)
    alt Rate limited
        Login->>B: 429 Too many attempts
    end

    alt Admin credentials
        Login->>Login: Compare with ADMIN_ID + ADMIN_PASSWORD env vars
        Login->>Auth: setSession({ type: "admin", id: "admin", login_id })
    else Client credentials
        Login->>SB: Query client_accounts WHERE login_id = id
        SB-->>Login: Account record (id, login_id, password hash)
        Login->>Bcrypt: Compare password with stored hash
        alt Password mismatch
            Login->>B: 401 Invalid credentials
        end
        alt Legacy plaintext password
            Login->>Bcrypt: Hash password (cost 12)
            Login->>SB: UPDATE client_accounts SET password = hash
        end
        Login->>Auth: setSession({ type: "client", id, login_id })
    end

    Auth->>Auth: sealData(session, SESSION_SECRET, ttl=7d)
    Auth->>B: Set-Cookie: rb_session=<sealed> + JSON response
```

### Comment Creation Flow (with Slack)

```mermaid
sequenceDiagram
    participant B as Browser
    participant API as /api/comments
    participant SB as Supabase
    participant Slack as Slack API

    B->>API: POST { screenshot_version_id, x, y, text }
    API->>API: Validate UUID, coordinates (0-100)
    API->>SB: Check screenshot_version exists
    alt Client user
        API->>SB: Verify project access via client_account_projects
    end
    API->>SB: Get max pin_number for screenshot_version
    API->>SB: INSERT comment (with retry on unique violation)
    SB-->>API: Comment record

    API->>SB: Get project.slack_channel via screenshot_version > screen > project
    alt Slack channel configured
        alt Webhook URL
            API->>Slack: POST webhook payload
        else Channel name/ID
            API->>Slack: chat.postMessage via Bot Token
        end
    end

    API->>B: 201 Comment JSON
```

---

## Database Schema

```mermaid
erDiagram
    projects {
        uuid id PK
        text name
        text slack_channel
        timestamptz created_at
        timestamptz updated_at
    }

    client_accounts {
        uuid id PK
        text login_id UK
        text password
        timestamptz created_at
    }

    client_account_projects {
        uuid client_account_id FK
        uuid project_id FK
        timestamptz created_at
    }

    screens {
        uuid id PK
        uuid project_id FK
        text name
        timestamptz created_at
        timestamptz updated_at
    }

    screenshot_versions {
        uuid id PK
        uuid screen_id FK
        integer version
        text image_url
        timestamptz created_at
    }

    comments {
        uuid id PK
        uuid screenshot_version_id FK
        integer pin_number
        float x
        float y
        text text
        text author_id
        text status
        timestamptz created_at
        timestamptz updated_at
    }

    replies {
        uuid id PK
        uuid comment_id FK
        text text
        text author_type
        text author_id
        timestamptz created_at
    }

    audit_log {
        uuid id PK
        text entity_type
        uuid entity_id
        text action
        text old_value
        text new_value
        text actor
        timestamptz created_at
    }

    projects ||--o{ screens : "has"
    projects ||--o{ client_account_projects : "assigned to"
    client_accounts ||--o{ client_account_projects : "has access to"
    screens ||--o{ screenshot_versions : "has versions"
    screenshot_versions ||--o{ comments : "has feedback"
    comments ||--o{ replies : "has replies"
```

### Key Relationships

- **projects <-> client_accounts**: Many-to-many via `client_account_projects` junction table.
- **projects -> screens**: One-to-many. Cascade delete.
- **screens -> screenshot_versions**: One-to-many. Unique constraint on `(screen_id, version)`. Cascade delete.
- **screenshot_versions -> comments**: One-to-many. Unique constraint on `(screenshot_version_id, pin_number)`. Cascade delete.
- **comments -> replies**: One-to-many. Cascade delete.
- **audit_log**: Independent table tracking status changes, edits, and deletes for comments.

### Constraints

| Table | Constraint | Description |
|-------|-----------|-------------|
| `projects.name` | `char_length(name) <= 255` | Max name length |
| `screens.name` | `char_length(name) <= 255` | Max name length |
| `comments.x` | `x >= 0 AND x <= 100` | Percentage coordinate |
| `comments.y` | `y >= 0 AND y <= 100` | Percentage coordinate |
| `comments.text` | `char_length(text) <= 5000` | Max comment length |
| `comments.status` | `IN ('open', 'in-progress', 'resolved')` | Valid statuses |
| `replies.text` | `char_length(text) <= 5000` | Max reply length |
| `replies.author_type` | `IN ('admin', 'client')` | Valid author types |
| `audit_log.entity_type` | `IN ('comment', 'project', 'screen', ...)` | Valid entity types |

---

## Security Architecture

### Defense Layers

```mermaid
graph LR
    A["1. Rate Limiting<br/>(In-memory, login only)"] --> B["2. CSRF Protection<br/>(Origin header check)"]
    B --> C["3. Session Auth<br/>(iron-session encrypted cookie)"]
    C --> D["4. Role-Based Access<br/>(admin vs client)"]
    D --> E["5. Resource-Level Auth<br/>(project assignment check)"]
    E --> F["6. Input Validation<br/>(UUID, coordinates, file type)"]
    F --> G["7. Security Headers<br/>(HSTS, CSP, X-Frame)"]
```

### Security Headers

Applied by both middleware and `next.config.ts`:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS |
| `Content-Security-Policy` | Restrictive policy | Mitigate XSS |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-DNS-Prefetch-Control` | `off` | Prevent DNS prefetch leaks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer exposure |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable device APIs |

### File Upload Security

Screenshot uploads are validated server-side by reading magic bytes:
- **PNG**: `89 50 4E 47`
- **JPEG**: `FF D8 FF`
- **WebP**: `52 49 46 46`
- **GIF**: `47 49 46`

Maximum file size: **10 MB**.

---

## Supabase Integration

### Client Types

| Client | Usage | RLS |
|--------|-------|-----|
| `createServerSupabase()` | SSR with user cookies (not currently used by API routes) | Respects RLS |
| `createServiceSupabase()` | All API routes (service role key) | **Bypasses RLS** |
| `createClient()` | Browser-side (anon key) | Respects RLS |

### Storage

Screenshots are stored in a Supabase Storage bucket named `screenshots`.

Path format: `{screen_id}/v{version}.{extension}`

---

## Slack Integration

Comments trigger Slack notifications when the project has `slack_channel` configured.

Two modes are supported:

1. **Webhook URL**: If `slack_channel` starts with `https://hooks.slack.com/`, the system sends directly to the webhook.
2. **Bot Token**: Otherwise, `slack_channel` is treated as a channel name/ID and `SLACK_BOT_TOKEN` env var is used with `chat.postMessage`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (client-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `SESSION_SECRET` | Yes | iron-session encryption key (min 32 chars) |
| `ADMIN_ID` | Yes | Admin login ID |
| `ADMIN_PASSWORD` | Yes | Admin login password |
| `SLACK_BOT_TOKEN` | No | Slack Bot User OAuth Token |
