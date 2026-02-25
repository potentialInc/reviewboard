---
name: reviewboard
status: active
version: "1.0"
last_updated: 2026-02-25
---

# ReviewBoard — Product Requirements Document

## 1. Overview

| Field | Value |
|-------|-------|
| Feature Name | ReviewBoard |
| Purpose | Design review platform where admins upload screens and clients leave pin-based visual feedback |
| Target Users | Design agencies (admins) and their clients (reviewers) |
| Target Release | 2025-02-25 (initial release) |
| Owner | Potential AI |

## 2. Terminology

| Term | Definition |
|------|-----------|
| Project | A named container grouping related design screens for a single client engagement |
| Screen | A named slot within a project that holds versioned screenshots (e.g. "Login Page", "Dashboard") |
| Screenshot Version | A specific uploaded image file for a screen, auto-incrementing version number (v1, v2, ...) |
| Pin | A positional marker placed on a screenshot at (x%, y%) coordinates where a comment is attached |
| Comment | A text feedback item tied to a pin on a specific screenshot version, with status tracking |
| Reply | A threaded response to a comment, tagged with author type (admin or client) |
| Client Account | Auto-provisioned login credentials tied to one or more projects, with a shared password |
| Feedback Status | One of: `open`, `in-progress`, `resolved` -- lifecycle states for a comment |
| Audit Log | Immutable record of status changes, edits, and deletions on comments |

## 3. Goals

- [x] Goal 1: Admin can create projects, upload design screens with versioning, and manage client access
- [x] Goal 2: Clients can view assigned project screens and leave pin-based positional feedback
- [x] Goal 3: Admin can triage all feedback across projects with status management, bulk actions, and reply threads
- [x] Goal 4: Slack notifications are sent when new feedback is submitted on a project with a configured channel
- [x] Goal 5: Session-based auth with role separation (admin vs client) using iron-session sealed cookies

## 4. MVP Scope

### In Scope
- Single admin account (env-based credentials)
- Auto-provisioned client accounts per project (login_id + default password)
- Multi-project support with per-project Slack channel configuration
- Screen management with versioned screenshot uploads to Supabase Storage
- Pin-based feedback: click on screenshot to place pin at (x%, y%), attach comment
- Comment status lifecycle: open -> in-progress -> resolved
- Reply threads on comments (both admin and client)
- Admin dashboard with stats (total projects, open feedback, today, this week) and recent activity
- Admin feedback manager with filtering, search, pagination, bulk status updates, and detail modal
- Client project list, screen list, and feedback viewer with version switching
- Audit log for comment status changes, edits, and deletions
- Rate limiting on login endpoint (5 attempts per IP per minute)
- Row Level Security on all tables (service_role only)
- Docker deployment with health checks
- Responsive layout (mobile sidebar + desktop sidebar for admin, sticky navbar for client)

### Out of Scope
- Multi-admin support (only one admin via env vars)
- User registration / self-service sign-up
- Email notifications
- Real-time / WebSocket updates (currently uses fetch-on-action)
- Comment @mentions or tagging
- File attachments on comments (text only)
- Project archiving or soft deletes
- Client password change UI
- Analytics or reporting dashboards beyond basic stats

### Future Phases
- Multi-admin with role-based permissions
- Real-time updates via Supabase Realtime subscriptions
- Email notification digests
- Comment resolution workflows with approval chains
- Export feedback as PDF report
- Figma plugin integration for direct screen sync

## 5. System Modules

| Module | Description | Pipeline Phase | Dependencies |
|--------|-------------|----------------|-------------|
| Auth | iron-session login/logout, admin env check, client DB lookup, rate limiting | Phase 1 | Supabase |
| Projects | CRUD operations, auto-provision client accounts, Slack channel config | Phase 2 | Auth |
| Screens | Create screens within projects, manage screen metadata | Phase 3 | Projects |
| Screenshots | Upload images to Supabase Storage, version management, magic-byte validation | Phase 3 | Screens, Supabase Storage |
| Comments | Pin-based feedback creation, status updates, text edits, deletion with audit | Phase 4 | Screenshots, Auth |
| Replies | Threaded replies on comments with author type tracking | Phase 4 | Comments |
| Feedback Manager | Admin-only listing with filters, search, pagination, bulk status, detail modal | Phase 5 | Comments, Replies |
| Dashboard | Admin stats aggregation and recent activity feed | Phase 5 | Projects, Comments |
| Slack Integration | Webhook or Bot Token notifications on new feedback | Phase 4 | Comments |
| Audit | Immutable logging of comment mutations (status_change, edit, delete) | Phase 4 | Comments |
| UI Components | Shared: Modal, Badge, Breadcrumb, Skeleton, Toast, Drawer | Phase 1 | None |

## 6. User Flows

### Flow 1: Admin — Create Project and Upload Screens
1. Admin logs in with env-configured ADMIN_ID / ADMIN_PASSWORD
2. System sets iron-session cookie with type=admin, redirects to /admin
3. Admin navigates to Projects page, clicks "New Project"
4. System shows modal: admin enters project name and optional Slack channel
5. System creates project, auto-provisions client account (random login_id, password "Potential"), returns credentials
6. Admin copies client credentials to share with client
7. Admin opens project detail, clicks "Add Screen", enters screen name
8. System creates screen record
9. Admin clicks upload on screen card, selects or drags image file
10. System validates file magic bytes (PNG/JPEG/WebP/GIF), uploads to Supabase Storage, creates screenshot_version record with auto-incremented version number

### Flow 2: Client — View Screens and Leave Pin Feedback
1. Client logs in with provisioned login_id and password
2. System validates credentials against client_accounts table, sets iron-session cookie with type=client
3. System redirects to /client/projects showing only assigned projects
4. Client selects a project, sees screen grid with thumbnails and open feedback counts
5. Client selects a screen, enters feedback viewer with screenshot and comment panel
6. Client clicks on screenshot at desired position
7. System shows comment form popup at click position
8. Client types feedback text and submits
9. System creates comment with auto-assigned pin_number (with retry for uniqueness conflicts), sends Slack notification if configured
10. Pin appears on screenshot with status color, comment appears in side panel

### Flow 3: Client — Reply to Existing Feedback
1. Client clicks on an existing pin or selects comment in side panel
2. Comment expands showing thread with replies
3. Client clicks "Reply", types response, presses Enter or Send
4. System creates reply with author_type=client

### Flow 4: Admin — Triage Feedback
1. Admin navigates to Feedback Manager page
2. System loads paginated feedback list with project/screen context
3. Admin filters by status (open/in-progress/resolved) or searches by text
4. Admin changes individual comment status via dropdown (triggers audit log)
5. Admin selects multiple comments via checkboxes, uses bulk action to update status
6. Admin clicks "View & Reply" to open detail modal with screenshot + pin position + conversation thread
7. Admin writes reply and/or changes status, clicks "Update & Reply"

### Flow 5: Admin — View Dashboard
1. Admin visits /admin (dashboard)
2. System aggregates: total projects, total open feedback, feedback today, feedback this week
3. System shows 10 most recent comments with project/screen context and status badges
4. Admin clicks on activity item to navigate to feedback manager

## 7. DB Schema

### projects
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID | PK, default uuid_generate_v4() | Primary key |
| name | TEXT | NOT NULL, max 255 chars | Project name |
| slack_channel | TEXT | nullable | Slack channel name/ID or webhook URL |
| created_at | TIMESTAMPTZ | default now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | default now(), auto-trigger | Last update timestamp |

### client_accounts
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID | PK, default uuid_generate_v4() | Primary key |
| project_id | UUID | FK -> projects(id) ON DELETE SET NULL | Legacy primary project reference |
| login_id | TEXT | UNIQUE, NOT NULL | Client login identifier |
| password | TEXT | NOT NULL, default 'Potential' | Plaintext shared password |
| created_at | TIMESTAMPTZ | default now() | Creation timestamp |

### client_account_projects
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| client_account_id | UUID | FK -> client_accounts(id) ON DELETE CASCADE, PK part | Client account reference |
| project_id | UUID | FK -> projects(id) ON DELETE CASCADE, PK part | Project reference |
| created_at | TIMESTAMPTZ | default now() | Link creation timestamp |

### screens
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID | PK, default uuid_generate_v4() | Primary key |
| project_id | UUID | FK -> projects(id) ON DELETE CASCADE, NOT NULL | Parent project |
| name | TEXT | NOT NULL, max 255 chars | Screen name |
| created_at | TIMESTAMPTZ | default now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | default now(), auto-trigger | Last update timestamp |

### screenshot_versions
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID | PK, default uuid_generate_v4() | Primary key |
| screen_id | UUID | FK -> screens(id) ON DELETE CASCADE, NOT NULL | Parent screen |
| version | INTEGER | NOT NULL, default 1, UNIQUE(screen_id, version) | Version number |
| image_url | TEXT | NOT NULL | Public URL from Supabase Storage |
| created_at | TIMESTAMPTZ | default now() | Upload timestamp |

### comments
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID | PK, default uuid_generate_v4() | Primary key |
| screenshot_version_id | UUID | FK -> screenshot_versions(id) ON DELETE CASCADE, NOT NULL | Target screenshot |
| pin_number | INTEGER | NOT NULL, UNIQUE(screenshot_version_id, pin_number) | Sequential pin label |
| x | FLOAT | NOT NULL, CHECK 0-100 | Horizontal position (%) |
| y | FLOAT | NOT NULL, CHECK 0-100 | Vertical position (%) |
| text | TEXT | NOT NULL, max 5000 chars | Feedback content |
| author_id | TEXT | NOT NULL | login_id of the comment author |
| status | TEXT | NOT NULL, default 'open', CHECK in (open, in-progress, resolved) | Feedback lifecycle status |
| created_at | TIMESTAMPTZ | default now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | default now(), auto-trigger | Last update timestamp |

### replies
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID | PK, default uuid_generate_v4() | Primary key |
| comment_id | UUID | FK -> comments(id) ON DELETE CASCADE, NOT NULL | Parent comment |
| text | TEXT | NOT NULL, max 5000 chars | Reply content |
| author_type | TEXT | NOT NULL, CHECK in (admin, client) | Role of the replier |
| author_id | TEXT | NOT NULL, default '' | login_id of the replier |
| created_at | TIMESTAMPTZ | default now() | Reply timestamp |

### audit_log
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID | PK, default uuid_generate_v4() | Primary key |
| entity_type | TEXT | NOT NULL | Type of entity (e.g. 'comment') |
| entity_id | UUID | NOT NULL | ID of the affected entity |
| action | TEXT | NOT NULL | Action type (status_change, edit, delete) |
| old_value | TEXT | nullable | Previous value |
| new_value | TEXT | nullable | New value |
| actor | TEXT | NOT NULL | login_id of the actor |
| created_at | TIMESTAMPTZ | default now() | Action timestamp |

### Relationships
- projects -> screens: one-to-many (cascade delete)
- projects -> client_accounts: one-to-many (set null on delete)
- client_accounts <-> projects via client_account_projects: many-to-many (cascade delete)
- screens -> screenshot_versions: one-to-many (cascade delete)
- screenshot_versions -> comments: one-to-many (cascade delete)
- comments -> replies: one-to-many (cascade delete)

### Indexes
- `idx_client_accounts_login_id` on client_accounts(login_id)
- `idx_client_accounts_project_id` on client_accounts(project_id)
- `idx_client_account_projects_project` on client_account_projects(project_id)
- `idx_screens_project_id` on screens(project_id)
- `idx_screenshot_versions_screen_id` on screenshot_versions(screen_id)
- `idx_comments_screenshot_version_id` on comments(screenshot_version_id)
- `idx_comments_status` on comments(status)
- `idx_comments_sv_status` on comments(screenshot_version_id, status)
- `idx_comments_created_at` on comments(created_at)
- `idx_replies_comment_id` on replies(comment_id)
- `idx_audit_log_entity` on audit_log(entity_type, entity_id)

### Storage
- Supabase Storage bucket: `screenshots` (public read, service_role write)
- File size limit: 10 MB
- Allowed MIME types: image/png, image/jpeg, image/webp, image/gif
- Path pattern: `{screen_id}/v{version}.{ext}`

## 8. API Endpoints

### Auth
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| POST | /api/auth/login | `{ id: string, password: string }` | `{ type: 'admin'|'client', redirect: string }` | None (rate-limited: 5/min/IP) |
| POST | /api/auth/logout | None | `{ ok: true }` | Required |

### Projects
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| GET | /api/projects | None | `Project[]` (admin: all with enrichment; client: assigned only) | Required |
| POST | /api/projects | `{ name: string, slack_channel?: string }` | `{ project: Project, client_account: { login_id, password } }` | Admin |
| GET | /api/projects/[id] | None | `Project` with screens, versions, client creds, open counts | Required (client: access check) |
| PATCH | /api/projects/[id] | `{ name?: string, slack_channel?: string }` | `Project` | Admin |
| DELETE | /api/projects/[id] | None | `{ ok: true }` | Admin |

### Screens
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| POST | /api/projects/[id]/screens | `{ name: string }` | `Screen` | Admin |
| GET | /api/screens/[id] | None | `Screen` with versions, comments, replies (sorted) | Required (client: access check) |
| DELETE | /api/screens/[id] | None | `{ ok: true }` | Admin |

### Screenshots
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| POST | /api/projects/[id]/screens/[screenId]/screenshots | `FormData { file: File }` | `ScreenshotVersion` | Admin |

### Comments
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| POST | /api/comments | `{ screenshot_version_id, x, y, text }` | `Comment` (auto pin_number, Slack notify) | Required (client: access check) |
| PATCH | /api/comments/[id] | `{ status?: FeedbackStatus, text?: string }` | `Comment` (audit logged) | Required (status: admin only; text: author or admin) |
| DELETE | /api/comments/[id] | None | `{ ok: true }` (audit logged) | Required (author or admin) |

### Replies
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| POST | /api/comments/[id]/replies | `{ text: string }` | `Reply` | Required |

### Feedback (Admin)
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| GET | /api/feedback | Query: `status, project_id, screen_id, search, page, per_page` | `{ data: Comment[], total, page, per_page }` | Admin |
| GET | /api/feedback/[id] | None | `Comment` with screenshot_version, replies | Admin |
| PATCH | /api/feedback/bulk | `{ ids: string[], status: FeedbackStatus }` | `{ ok: true, updated: number }` | Admin |

### Dashboard
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| GET | /api/dashboard | None | `{ stats: DashboardStats, recent_activity: Activity[] }` | Admin |

### Health
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| GET | /api/health | None | `{ status, database, timestamp }` | None |

## 9. UI Specifications

### Design Inputs

| Source | Path / Link | Notes |
|--------|-------------|-------|
| HTML Mockups | `mockups/` | Static HTML prototypes for all pages |
| Screenshots | N/A | No Figma exports |

### Design Tokens

| Token | Value | Notes |
|-------|-------|-------|
| App Type | Web App | Responsive SPA (Next.js App Router) |
| Design Style | Modern SaaS | Clean, professional, card-based layout |
| Icon Library | Lucide Icons | Used throughout via lucide-react |
| Primary Color | #6366F1 | Indigo-500 |
| Primary Hover | #4F46E5 | Indigo-600 |
| Primary Light | #EEF2FF | Indigo-50 (badge/highlight backgrounds) |
| Background | #F8FAFC | Slate-50 |
| Foreground | #0F172A | Slate-900 |
| Sidebar | #0F172A | Dark slate sidebar (admin) |
| Card | #FFFFFF | White card surfaces |
| Border | #E2E8F0 | Slate-200 |
| Muted Text | #64748B | Slate-500 |
| Status Open | #EF4444 | Red-500 |
| Status In-Progress | #F59E0B | Amber-500 |
| Status Resolved | #22C55E | Green-500 |
| Font Family | Inter | Body text, weights 300-700 |
| Heading Font | Plus Jakarta Sans | Headings, weights 500-700 |
| Base Spacing | 4px | Tailwind default spacing scale |
| Border Radius | 12px (xl), 16px (2xl) | Rounded cards and buttons |

### Screen: Login (/login)
- **Layout**: Centered card on background, max-w-md
- **Components**: Logo, form inputs (Access ID, Password) with icons, submit button, error display, admin login link
- **Interactions**: Form submit -> POST /api/auth/login -> redirect based on role; auto-redirect if already authenticated
- **States**: Default, loading (spinner in button), error (red alert), redirect
- **Responsive**: Single column centered, works on all sizes
- **Accessibility**: Form labels, required attributes, role="alert" on error

### Screen: Admin Dashboard (/admin)
- **Layout**: Sidebar (fixed 64 left) + main content with 4-column stat cards grid + recent activity list
- **Components**: Breadcrumb, stat cards (Total Projects, Open Feedback, Today, This Week) with icons, recent activity table with pin badges and status
- **Interactions**: Click stat card -> no action; click activity item -> link to feedback page; "New Project" button -> link
- **States**: Loading (skeleton placeholders), empty (no activity message), error (red alert banner), data
- **Responsive**: 1 col mobile, 2 col tablet, 4 col desktop for stats; sidebar hidden on mobile with hamburger

### Screen: Admin Projects (/admin/projects)
- **Layout**: Table view with search bar, bulk delete button, and create modal
- **Components**: Breadcrumb, search input, project table (checkbox, name, slack channel, client ID, created date, screens count, open feedback count, actions), create modal with credential display, delete confirmation modal
- **Interactions**: Search filters locally; checkbox selection enables bulk delete; create shows form then credentials with copy buttons; delete shows confirmation
- **States**: Loading (table skeleton), empty (illustration + message), data (table rows), modals (create, delete, bulk delete)
- **Responsive**: Table scrolls horizontally on mobile

### Screen: Admin Project Detail (/admin/projects/[id])
- **Layout**: Header with back button + project info + "Add Screen" button, search toolbar, 4-column card grid of screens
- **Components**: Breadcrumb, project name with client ID and Slack badges, screen cards with 9:16 aspect ratio thumbnails showing version badge and open feedback count, hover overlay with actions (Update Version, History, Delete), "Add Screen" placeholder card
- **Interactions**: Hover screen card -> show action overlay; upload modal with drag-and-drop; version history modal with grid of versions; add screen modal; delete screen confirmation
- **States**: Loading (skeleton), empty screens (illustration), data (grid), modals (add, upload with drag state, delete, history)
- **Responsive**: 1 col mobile, 2 col tablet, 4 col desktop for screen grid

### Screen: Admin Feedback Manager (/admin/feedback)
- **Layout**: Filter bar + table + pagination + detail modal (split 50/50)
- **Components**: Breadcrumb, search input with debounce, status filter dropdown, project filter dropdown, feedback table (checkbox, pin circle, comment text, context, status dropdown, date, action link), pagination controls with per-page selector, bulk action bar, detail modal with image viewer (left) and conversation thread (right)
- **Interactions**: Filter/search triggers fetch; status dropdown inline edit with audit; bulk checkbox + status buttons; "View & Reply" opens detail modal; detail modal shows pin on image, conversation thread, reply textarea with Cmd+Enter, status selector
- **States**: Loading (table skeleton), empty (illustration), data, bulk selection bar, detail modal (loading, data), sending reply
- **Responsive**: Table scrolls horizontally on mobile; modal full-width on mobile

### Screen: Client Projects (/client/projects)
- **Layout**: Header + 3-column card grid
- **Components**: Breadcrumb, project cards with folder icon, name, screen count, open feedback count, updated date, accent bar on hover
- **Interactions**: Click card -> navigate to screen list
- **States**: Loading (card skeletons), empty (icon + message), error (retry button), data
- **Responsive**: 1 col mobile, 2 col tablet, 3 col desktop

### Screen: Client Screen List (/client/projects/[id]/screens)
- **Layout**: Back button + project header + 4-column card grid
- **Components**: Breadcrumb, back link, project name with screen count and open feedback total, screen cards with 9:16 thumbnails showing open count badge, hover overlay "View Design"
- **Interactions**: Click card -> navigate to feedback viewer
- **States**: Loading (card skeletons), empty (icon + message), error (retry), data
- **Responsive**: 1 col mobile, 2 col tablet/small desktop, 4 col large desktop

### Screen: Client Feedback Viewer (/client/projects/[id]/screens/[screenId])
- **Layout**: Full-height split: screenshot viewer (left, flexible) + comment panel (right, 384px fixed)
- **Components**: Breadcrumb, back link, screen name, version picker dropdown, PinOverlay (screenshot image with colored pin circles), CommentForm (positioned popup at click location), CommentPanel (list of comments with pin numbers, status badges, author, time, reply threads, reply input)
- **Interactions**: Click on image -> place new pin + show comment form; click pin -> highlight + scroll to comment; click comment in panel -> highlight pin; submit form -> create comment + refresh; reply inline with Enter key; version picker switches displayed version and comments
- **States**: Loading (spinner), error (retry), no screenshot (message), data, new pin placement, comment expanded with replies, replying
- **Responsive**: Stacks vertically on mobile (image above, panel below)
- **Accessibility**: Pin buttons have aria-labels with pin number and truncated text; keyboard navigation for version picker

## 10. Acceptance Criteria

### Auth
- [x] **AC-001**: Given valid admin env credentials, when POST /api/auth/login, then session cookie set with type=admin and redirect to /admin
- [x] **AC-002**: Given valid client DB credentials, when POST /api/auth/login, then session cookie set with type=client and redirect to /client/projects
- [x] **AC-003**: Given invalid credentials, when POST /api/auth/login, then 401 error with message
- [x] **AC-004**: Given 6 rapid login attempts from same IP, when POST /api/auth/login, then 429 rate limit response
- [x] **AC-005**: Given authenticated session, when POST /api/auth/logout, then session cookie cleared

### Projects
- [x] **AC-006**: Given admin session, when POST /api/projects with name, then project created + client account auto-provisioned with login_id and password "Potential"
- [x] **AC-007**: Given admin session, when GET /api/projects, then all projects returned with screen_count and open_feedback_count
- [x] **AC-008**: Given client session, when GET /api/projects, then only assigned projects returned
- [x] **AC-009**: Given admin session, when DELETE /api/projects/[id], then project and all child data cascade deleted

### Screens & Screenshots
- [x] **AC-010**: Given admin session, when POST screen name to /api/projects/[id]/screens, then screen created under project
- [x] **AC-011**: Given admin session and valid image file, when POST to screenshots endpoint, then file uploaded to Supabase Storage with auto-incremented version
- [x] **AC-012**: Given non-image file (wrong magic bytes), when POST to screenshots endpoint, then 400 error
- [x] **AC-013**: Given admin session, when DELETE /api/screens/[id], then screen and all versions/comments cascade deleted

### Comments & Feedback
- [x] **AC-014**: Given authenticated user on assigned project, when POST /api/comments with coordinates and text, then comment created with auto-assigned pin_number
- [x] **AC-015**: Given concurrent pin creation race condition, when unique constraint conflict, then system retries up to 3 times with fresh pin_number
- [x] **AC-016**: Given project with Slack channel configured, when new comment created, then Slack notification sent with project/screen/author/comment details
- [x] **AC-017**: Given admin session, when PATCH comment status, then status updated and audit_log entry created
- [x] **AC-018**: Given comment author, when PATCH comment text, then text updated and audit_log entry created
- [x] **AC-019**: Given non-author non-admin, when PATCH comment text, then 403 Forbidden
- [x] **AC-020**: Given admin session, when PATCH /api/feedback/bulk with ids and status, then all specified comments updated

### Replies
- [x] **AC-021**: Given authenticated user, when POST reply to comment, then reply created with correct author_type

### Authorization
- [x] **AC-022**: Given client session, when accessing screen from unassigned project, then 403 Forbidden
- [x] **AC-023**: Given no session, when accessing any protected endpoint, then 401 Unauthorized
- [x] **AC-024**: Given client session, when accessing admin-only endpoints (dashboard, feedback list, project create/delete), then 401 Unauthorized

### Edge Cases
- [x] **EC-001**: Comment x/y coordinates must be between 0 and 100 (DB CHECK constraint enforces percentage range)
- [x] **EC-002**: Comment text limited to 5000 characters (DB CHECK constraint)
- [x] **EC-003**: Project name limited to 255 characters (DB CHECK constraint)
- [x] **EC-004**: Screenshot file must pass magic byte validation (PNG/JPEG/WebP/GIF headers checked server-side)
- [x] **EC-005**: Deleting a project sets client_account.project_id to NULL (SET NULL) rather than deleting the account
- [x] **EC-006**: Pin numbers are unique per screenshot_version with retry logic for race conditions

### Performance Criteria
- [ ] Page load under 2000ms for all routes
- [ ] API response under 500ms for list endpoints
- [ ] Screenshot upload under 5000ms for 10MB file

## 11. Non-Functional Requirements

### Performance
- Target response time: 500ms for API endpoints
- Target throughput: Suitable for agency-scale usage (tens of concurrent users)
- Bundle size limit: Standard Next.js optimized build

### Security
- Authentication: iron-session with sealed cookies (AES-256-GCM via iron webcrypto)
- Session TTL: 7 days, httpOnly, secure (production), sameSite strict
- Authorization: Role-based (admin/client) checked per endpoint; client project access via client_account_projects join table
- Data encryption: In transit (HTTPS); at rest (Supabase managed)
- Rate limiting: In-memory sliding window on login (5 attempts/min/IP)
- Row Level Security: All tables restricted to service_role only (no anonymous access)
- File validation: Server-side magic byte checking on uploaded images
- Passwords: Stored as plaintext shared secrets (design decision for simplicity -- not hashed)

### Scalability
- Expected users: Small teams (1 admin + multiple clients per project)
- Data growth: Linear with number of projects and feedback volume
- Scaling strategy: Vertical (single Next.js instance); Supabase handles DB/Storage scaling
- Deployment: Docker Compose with health check on /api/health

## 12. Open Questions

| # | Question | Impact | Status |
|---|----------|--------|--------|
| Q1 | Should client passwords be hashed instead of stored as plaintext? | Security module | Open |
| Q2 | Should there be a multi-admin system with user management? | Auth, all admin pages | Open |
| Q3 | Should real-time updates (Supabase Realtime) be added for live feedback? | Comments, UI | Open |
| Q4 | Should the /admin/team page have actual functionality? (Currently listed in sidebar but no implementation) | Admin UI | Open |
| Q5 | Should there be a notification system beyond Slack (email, in-app)? | Notification module | Open |
| Q6 | Should screenshot versions support rollback or deletion of specific versions? | Screenshots module | Open |

## 13. References

- Tech stack: Next.js 16.1.6, React 19.2.3, Supabase (SSR client), Tailwind CSS 4, iron-session 8, date-fns, lucide-react
- Supabase migrations: `app/supabase/migrations/`
- Schema reference: `app/src/lib/supabase/schema.sql`
- Type definitions: `app/src/lib/types.ts`
- Docker deployment: `docker-compose.yml`
- Environment template: `app/.env.local.example`
- Static mockups: `mockups/`
