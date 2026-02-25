# ReviewBoard

A design feedback platform built with Next.js, Supabase, and Tailwind CSS. Admins manage projects and upload screen designs; clients review them and leave pin-based feedback comments directly on screenshots.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Runtime | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Database | Supabase (PostgreSQL) | - |
| File Storage | Supabase Storage | - |
| Styling | Tailwind CSS | 4.x |
| Auth | iron-session (encrypted cookies) | 8.x |
| Password Hashing | bcryptjs | 3.x |
| Icons | lucide-react | 0.575.x |
| Date Utils | date-fns | 4.x |
| Testing | Vitest | 4.x |
| Linting | ESLint | 9.x |
| Container | Docker (multi-stage, node:20-alpine) | - |

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **Supabase** project (cloud or local via `supabase start`)

## Environment Setup

Create a `.env.local` file in the `app/` directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Session (must be at least 32 characters)
SESSION_SECRET=your-very-long-random-secret-at-least-32-chars

# Admin credentials
ADMIN_ID=admin
ADMIN_PASSWORD=your-admin-password

# Optional: Slack notifications
SLACK_BOT_TOKEN=xoxb-your-bot-token
```

## Quick Start

```bash
# Install dependencies
npm install

# Run database migrations (requires Supabase CLI)
cd supabase && supabase db push && cd ..

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create production build (standalone output) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest test suite (single run) |
| `npm run test:watch` | Run Vitest in watch mode |

## Project Structure

```
src/
  app/
    api/              # 17 API route handlers
      auth/           # Login, logout, session check
      projects/       # CRUD, bulk delete, screens, screenshots
      feedback/       # Admin feedback list, detail, bulk update
      comments/       # Create, update, delete comments + replies
      screens/        # Screen detail, delete
      dashboard/      # Aggregate stats
      health/         # Health check
  lib/
    auth.ts           # iron-session helpers
    types.ts          # TypeScript interfaces
    validation.ts     # UUID & coordinate validation
    rate-limit.ts     # In-memory rate limiter
    slack.ts          # Slack notification integration
    feedback-count.ts # Open feedback count helpers
    env.ts            # Environment variable validation
    supabase/         # Supabase client factories (server + browser)
  middleware.ts       # Auth guard, CSRF protection, security headers
supabase/
  migrations/         # SQL migration files (ordered)
  seed.sql            # Development seed data
```

## User Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access: create/manage projects, upload screenshots, manage feedback status, view dashboard |
| **Client** | View assigned projects, leave feedback comments, add replies |

## Key Features

- **Pin-based feedback**: Click on screenshots to leave positioned comments
- **Screenshot versioning**: Upload new versions while preserving feedback history
- **Slack notifications**: Automatic notifications when new feedback is posted
- **Audit logging**: Track status changes, edits, and deletions
- **Auto-provisioned client accounts**: Creating a project generates client credentials
- **Rate limiting**: Login endpoint protected against brute force
- **Security headers**: HSTS, CSP, X-Frame-Options, and more

## Docker

```bash
# Build
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -t reviewboard .

# Run
docker run -p 3000:3000 \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  -e SESSION_SECRET=your-secret \
  -e ADMIN_ID=admin \
  -e ADMIN_PASSWORD=your-password \
  reviewboard
```

The container includes a health check at `/api/health`.

## Documentation

- [API Reference](../docs/API.md) -- Complete endpoint documentation with request/response examples
- [Architecture](../docs/ARCHITECTURE.md) -- System diagrams, data flow, database schema, security model
