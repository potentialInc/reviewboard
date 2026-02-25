# ReviewBoard Issues Tracker

> Auto-generated from harness review. Fix priority: P0 > P1 > P2 > P3

## Status Legend
- [ ] Open
- [x] Fixed

---

## P1 — Performance & Data Integrity

### [x] ISSUE-001: N+1 Query in Project Listing
- **File**: `app/src/app/api/projects/route.ts`
- **Problem**: Admin project list fetches feedback count per project in a loop (N+1). With 100+ projects, this becomes very slow.
- **Fix**: Replaced N+1 `Promise.all` loop with 2 batch queries: one for screenshot_versions, one for open comments. Maps counts back to projects via screen→project mapping.

### [x] ISSUE-002: Pin Number Race Condition
- **File**: `app/src/app/api/comments/route.ts:47-54`
- **Problem**: `SELECT max(pin_number) + 1` is not atomic. Two concurrent POST requests can produce duplicate pin numbers.
- **Fix**: Added retry loop (max 3) that catches unique constraint violation (23505) and retries with fresh pin number. DB `unique(screenshot_version_id, pin_number)` enforces correctness.

### [x] ISSUE-003: N+1 Query in Project Detail
- **File**: `app/src/app/api/projects/[id]/route.ts:46-64`
- **Problem**: Feedback count per screen fetched in a loop. With many screens, this is slow.
- **Fix**: Batch query collecting all svIds across screens, single open comments query, map counts back per screen.

---

## P2 — Security Hardening

### [x] ISSUE-004: Login Rate Limiting
- **File**: `app/src/app/api/auth/login/route.ts`
- **Problem**: No rate limiting on login endpoint. Vulnerable to brute-force attacks.
- **Fix**: Added in-memory sliding window rate limiter (`app/src/lib/rate-limit.ts`). 5 attempts per IP per 60s window. Returns 429 when exceeded.

### [x] ISSUE-005: File Upload Validation
- **File**: `app/src/app/api/projects/[id]/screens/[screenId]/screenshots/route.ts`
- **Problem**: Only checks file extension via MIME type from form data, which can be spoofed. No server-side magic byte validation.
- **Fix**: Added magic byte validation for PNG (89 50 4E 47), JPEG (FF D8 FF), WebP (52 49 46 46), and GIF (47 49 46). Returns 400 for invalid files.

### [x] ISSUE-006: CSRF Protection
- **File**: `app/src/lib/auth.ts`
- **Problem**: Cookie-based auth without CSRF tokens. POST/PATCH/DELETE endpoints are vulnerable to cross-site request forgery.
- **Fix**: Changed `SameSite` from `lax` to `strict` on session cookie. Prevents cross-site cookie submission.

---

## P2 — Missing PRD Features

### [x] ISSUE-007: Feedback Filter by Screen
- **File**: `app/src/app/api/feedback/route.ts`
- **Problem**: PRD specifies filtering feedback by screen. Currently only filters by project, status, date range.
- **Fix**: Added `screen_id` query parameter support. Filters in JS alongside project_id filter.

### [x] ISSUE-008: Bulk Status Update
- **File**: `app/src/app/admin/feedback/page.tsx`, `app/src/app/api/feedback/bulk/route.ts`
- **Problem**: PRD mentions bulk actions on feedback (select multiple → change status). Not implemented.
- **Fix**: Created `/api/feedback/bulk` PATCH endpoint. Added checkbox column to feedback table + bulk action bar with Open/In Progress/Resolved buttons.

### [x] ISSUE-009: Screenshot Drag-and-Drop Upload
- **File**: `app/src/app/admin/projects/[id]/page.tsx`
- **Problem**: Upload modal says "Drag & drop" but no actual DnD handler is wired. Only file input works.
- **Fix**: Added `onDragOver`, `onDragLeave`, `onDrop` handlers to the drop zone div. Visual feedback (border color change) on drag hover.

---

## P3 — UX & Polish

### [x] ISSUE-010: next/image Instead of img Tags
- **Files**: Multiple components
  - `app/src/components/feedback/pin-overlay.tsx`
  - `app/src/app/admin/projects/[id]/page.tsx`
  - `app/src/app/admin/feedback/page.tsx`
- **Problem**: Raw `<img>` tags don't get Next.js image optimization (lazy loading, responsive sizes, WebP).
- **Fix**: Replaced with `next/image` `Image` component. Added `remotePatterns` to `next.config.ts` for Supabase storage URLs (*.supabase.co, localhost, 127.0.0.1).

### [x] ISSUE-011: Search Debounce on Admin Feedback Page
- **File**: `app/src/app/admin/feedback/page.tsx`
- **Problem**: Search input triggers API call on every keystroke. Should debounce.
- **Fix**: Added 300ms debounce via `useRef` timer. Separate `searchInput` (instant UI) and `search` (debounced API trigger) state.

### [x] ISSUE-012: Focus Trap in Modal
- **File**: `app/src/components/ui/modal.tsx`
- **Problem**: Tab key can escape the modal to background elements. Violates WCAG 2.1.
- **Fix**: Implemented focus trap cycling between first/last focusable elements. Auto-focuses first focusable element on open.

### [x] ISSUE-013: Responsive Sidebar for Mobile
- **File**: `app/src/components/admin/sidebar.tsx`, `app/src/app/admin/layout.tsx`
- **Problem**: Admin sidebar is always visible. No hamburger menu for mobile viewports.
- **Fix**: Added hamburger menu button (visible on mobile, hidden on lg+). Sidebar slides in/out with overlay on mobile. Layout uses `lg:ml-64` with mobile-safe padding.

### [x] ISSUE-014: Empty State Illustrations
- **Files**: Multiple pages
  - `app/src/app/admin/projects/page.tsx`
  - `app/src/app/admin/projects/[id]/page.tsx`
  - `app/src/app/admin/feedback/page.tsx`
- **Problem**: Plain text empty states. PRD mockups show illustrated empty states.
- **Fix**: Added inline SVG illustrations for empty states (no projects, no screens, no feedback) with descriptive sub-text.

---

## P3 — DevOps & Infrastructure

### ISSUE-015: Supabase Migration Files
- **File**: `app/supabase/migrations/` (missing)
- **Problem**: Schema managed as single SQL file. No migration history for incremental changes.
- **Fix**: Move to Supabase migration system (`supabase db diff` → versioned migration files).
- **Note**: Deferred — requires Supabase CLI and active project. Not a code issue.

### [x] ISSUE-016: Environment Validation
- **File**: `app/src/lib/env.ts` (new)
- **Problem**: No startup validation of required env vars. App crashes with cryptic errors if SUPABASE_URL is missing.
- **Fix**: Created `app/src/lib/env.ts` with `validateEnv()`. Checks SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY. Throws in production, logs warning in development. Called from root layout.

### ISSUE-017: Next.js Middleware Deprecation Warning
- **File**: `app/src/middleware.ts`
- **Problem**: Next.js 16 warns "middleware file convention is deprecated, use proxy instead".
- **Fix**: Suppress for now. The `proxy` convention is not yet stable. Will migrate when Next.js proxy API is finalized.
- **Note**: Deferred — waiting for stable Next.js proxy API.

---

## Resolved Issues (from previous session)

- [x] **Session cookie forgery** — Fixed with iron-session encryption
- [x] **RLS too permissive** — Fixed with service_role restriction
- [x] **CASCADE delete data loss** — Fixed with SET NULL
- [x] **Pin animation CSS conflict** — Fixed with inline transform
- [x] **Feedback viewer stale closure** — Fixed with functional state update
- [x] **Toast memory leak** — Fixed with useRef timer cleanup
- [x] **Missing Drawer component** — Added for feedback detail
- [x] **Missing Breadcrumb navigation** — Added to all pages
- [x] **Missing error states** — Added to all pages
- [x] **Modal ESC handler** — Added
- [x] **Ambiguous FK in project queries** — Fixed by separating client_accounts query
