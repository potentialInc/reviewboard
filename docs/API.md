# ReviewBoard API Reference

> Auto-generated from source code. 17 API route handlers across 13 route files.

## Table of Contents

- [Authentication](#authentication)
  - [POST /api/auth/login](#post-apiauthorlogin)
  - [POST /api/auth/logout](#post-apiauthorlogout)
  - [GET /api/auth/me](#get-apiauthorme)
- [Projects](#projects)
  - [GET /api/projects](#get-apiprojects)
  - [POST /api/projects](#post-apiprojects)
  - [GET /api/projects/:id](#get-apiprojectsid)
  - [PATCH /api/projects/:id](#patch-apiprojectsid)
  - [DELETE /api/projects/:id](#delete-apiprojectsid)
  - [DELETE /api/projects/bulk](#delete-apiprojectsbulk)
- [Screens](#screens)
  - [POST /api/projects/:id/screens](#post-apiprojectsidscreens)
  - [GET /api/screens/:id](#get-apiscreensid)
  - [DELETE /api/screens/:id](#delete-apiscreensid)
- [Screenshots](#screenshots)
  - [POST /api/projects/:id/screens/:screenId/screenshots](#post-apiprojectsidscreensscreenidscreenshots)
- [Feedback (Admin View)](#feedback-admin-view)
  - [GET /api/feedback](#get-apifeedback)
  - [GET /api/feedback/:id](#get-apifeedbackid)
  - [PATCH /api/feedback/bulk](#patch-apifeedbackbulk)
- [Comments](#comments)
  - [POST /api/comments](#post-apicomments)
  - [PATCH /api/comments/:id](#patch-apicommentsid)
  - [DELETE /api/comments/:id](#delete-apicommentsid)
- [Replies](#replies)
  - [POST /api/comments/:id/replies](#post-apicommentsidreplies)
- [Dashboard](#dashboard)
  - [GET /api/dashboard](#get-apidashboard)
- [Health](#health)
  - [GET /api/health](#get-apihealth)
- [Common Error Responses](#common-error-responses)
- [Data Types](#data-types)

---

## Authentication

ReviewBoard uses **iron-session** for stateless, encrypted cookie-based sessions.

### How It Works

1. Client sends `POST /api/auth/login` with `id` and `password`.
2. Server validates credentials (admin via env vars, client via Supabase `client_accounts` table with bcrypt).
3. On success, server encrypts session data using `iron-session`'s `sealData()` with the `SESSION_SECRET` env var and sets an `rb_session` cookie.
4. All subsequent requests include this cookie automatically. The middleware decrypts it to verify the session.
5. Session expires after **7 days** (TTL configured in code).

### Cookie Details

| Property   | Value                                     |
|------------|-------------------------------------------|
| Name       | `rb_session`                              |
| HttpOnly   | `true`                                    |
| Secure     | `true` in production, `false` in dev      |
| SameSite   | `strict`                                  |
| Path       | `/`                                       |
| Max-Age    | `604800` (7 days)                         |

### Session Payload

```json
{
  "type": "admin" | "client",
  "id": "string (uuid for client, 'admin' for admin)",
  "login_id": "string"
}
```

### CSRF Protection

The middleware enforces Origin header matching for all state-changing (non-GET/HEAD) API requests. Requests with a missing or mismatched `Origin` header are rejected with `403 CSRF rejected`.

### Middleware Route Protection

| Path Pattern      | Behavior                                          |
|-------------------|---------------------------------------------------|
| `/login`          | Public (no session required)                      |
| `/api/auth/*`     | Public (no session required)                      |
| `/api/health`     | Public (no session required)                      |
| `/admin/*`        | Requires admin session; redirects client to `/client/projects` |
| `/client/*`       | Requires client session; redirects admin to `/admin` |
| `/api/*`          | Requires valid session; returns 401 JSON if missing |

### Rate Limiting

Login endpoint is rate-limited to **5 attempts per IP per minute** using an in-memory sliding window. Returns `429` when exceeded.

---

### POST /api/auth/login

Authenticate as admin or client.

**Auth Required:** None

**Request Body:**

```json
{
  "id": "string",
  "password": "string"
}
```

**Success Response (Admin) -- 200:**

```json
{
  "type": "admin",
  "redirect": "/admin"
}
```

**Success Response (Client) -- 200:**

```json
{
  "type": "client",
  "redirect": "/client/projects"
}
```

**Error Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Invalid JSON body" }` | Malformed JSON |
| 400 | `{ "error": "ID and password are required" }` | Missing `id` or `password` |
| 401 | `{ "error": "Invalid credentials. Please try again." }` | Wrong id/password |
| 429 | `{ "error": "Too many login attempts. Please try again in a minute." }` | Rate limited (5/min per IP) |

**Notes:**
- Admin credentials are checked against `ADMIN_ID` and `ADMIN_PASSWORD` env vars.
- Client passwords are stored as bcrypt hashes. Legacy plaintext passwords are auto-upgraded to bcrypt on successful login.

---

### POST /api/auth/logout

Destroy the current session.

**Auth Required:** None (cookie is simply deleted)

**Request Body:** None

**Success Response -- 200:**

```json
{
  "ok": true
}
```

---

### GET /api/auth/me

Lightweight session check. Returns the current user's type and login_id.

**Auth Required:** Any authenticated user

**Success Response -- 200:**

```json
{
  "type": "admin" | "client",
  "login_id": "string"
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 401 | `{ "error": "Unauthorized" }` |

---

## Projects

### GET /api/projects

List projects. Admin sees all projects with client account info. Client sees only their assigned projects.

**Auth Required:** Any authenticated user

**Success Response (Admin) -- 200:**

```json
[
  {
    "id": "uuid",
    "name": "string",
    "slack_channel": "string | null",
    "created_at": "ISO 8601",
    "updated_at": "ISO 8601",
    "screens": [{ "id": "uuid" }],
    "client_id": "string | null",
    "screen_count": 3,
    "open_feedback_count": 5
  }
]
```

**Success Response (Client) -- 200:**

```json
[
  {
    "id": "uuid",
    "name": "string",
    "slack_channel": "string | null",
    "created_at": "ISO 8601",
    "updated_at": "ISO 8601",
    "screens": [{ "id": "uuid" }],
    "screen_count": 3,
    "open_feedback_count": 5
  }
]
```

**Error Responses:**

| Status | Body |
|--------|------|
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Failed to load projects" }` |

**Notes:**
- Admin response includes `client_id` (the login_id of the assigned client account).
- Both admin and client responses include `screen_count` and `open_feedback_count`.
- Admin results sorted by `created_at` descending. Client results sorted by `updated_at` descending.

---

### POST /api/projects

Create a new project. Automatically provisions a client account with a random password.

**Auth Required:** Admin only

**Request Body:**

```json
{
  "name": "string (required)",
  "slack_channel": "string (optional)"
}
```

**Success Response -- 201:**

```json
{
  "project": {
    "id": "uuid",
    "name": "string",
    "slack_channel": "string | null",
    "created_at": "ISO 8601",
    "updated_at": "ISO 8601"
  },
  "client_account": {
    "login_id": "ProjectName1234",
    "initial_password": "a1b2c3d4e5f6g7h8"
  }
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid JSON body" }` |
| 400 | `{ "error": "Project name is required" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Failed to create project" }` |

**Notes:**
- The `client_account.initial_password` is returned **only once**. Admin must share it securely with the client.
- `login_id` is auto-generated as `{project_name_no_spaces}{random_4_digits}`.
- Password is stored as a bcrypt hash (cost factor 12).

---

### GET /api/projects/:id

Get project details with screens, screenshot versions, and open feedback counts.

**Auth Required:** Admin or assigned client

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Project ID |

**Success Response -- 200:**

```json
{
  "id": "uuid",
  "name": "string",
  "slack_channel": "string | null",
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601",
  "client_id": "string | null",
  "screens": [
    {
      "id": "uuid",
      "name": "string",
      "created_at": "ISO 8601",
      "updated_at": "ISO 8601",
      "screenshot_versions": [
        {
          "id": "uuid",
          "version": 1,
          "image_url": "string",
          "created_at": "ISO 8601"
        }
      ],
      "latest_version": {
        "id": "uuid",
        "version": 2,
        "image_url": "string",
        "created_at": "ISO 8601"
      },
      "open_feedback_count": 3
    }
  ]
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid ID format" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 404 | `{ "error": "Project not found" }` |

**Notes:**
- Client users can only access projects they are assigned to via the `client_account_projects` junction table.
- `latest_version` is the screenshot version with the highest version number.

---

### PATCH /api/projects/:id

Update project name or Slack channel.

**Auth Required:** Admin only

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Project ID |

**Request Body (all fields optional):**

```json
{
  "name": "string",
  "slack_channel": "string"
}
```

**Success Response -- 200:**

```json
{
  "id": "uuid",
  "name": "string",
  "slack_channel": "string | null",
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601"
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid ID format" }` |
| 400 | `{ "error": "Invalid JSON body" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Failed to update project" }` |

---

### DELETE /api/projects/:id

Delete a single project.

**Auth Required:** Admin only

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Project ID |

**Success Response -- 200:**

```json
{
  "ok": true
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid ID format" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Failed to delete project" }` |

**Notes:**
- Cascade deletes all associated screens, screenshot versions, comments, and replies (via DB foreign keys with `ON DELETE CASCADE`).

---

### DELETE /api/projects/bulk

Batch delete multiple projects.

**Auth Required:** Admin only

**Request Body:**

```json
{
  "ids": ["uuid", "uuid", "uuid"]
}
```

**Success Response -- 200:**

```json
{
  "ok": true,
  "deleted": 3
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid JSON body" }` |
| 400 | `{ "error": "ids array is required" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Failed to delete projects" }` |

---

## Screens

### POST /api/projects/:id/screens

Create a new screen within a project.

**Auth Required:** Admin only

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Project ID |

**Request Body:**

```json
{
  "name": "string (required)"
}
```

**Success Response -- 201:**

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "string",
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601"
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid Project ID format" }` |
| 400 | `{ "error": "Invalid JSON body" }` |
| 400 | `{ "error": "Screen name is required" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Operation failed" }` |

---

### GET /api/screens/:id

Get screen details with all screenshot versions and their comments/replies.

**Auth Required:** Admin or assigned client

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Screen ID |

**Success Response -- 200:**

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "string",
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601",
  "project": {
    "id": "uuid",
    "name": "string",
    "slack_channel": "string | null"
  },
  "screenshot_versions": [
    {
      "id": "uuid",
      "version": 2,
      "image_url": "string",
      "created_at": "ISO 8601",
      "comments": [
        {
          "id": "uuid",
          "pin_number": 1,
          "x": 45.5,
          "y": 22.3,
          "text": "string",
          "author_id": "string",
          "status": "open",
          "created_at": "ISO 8601",
          "updated_at": "ISO 8601",
          "replies": [
            {
              "id": "uuid",
              "text": "string",
              "author_type": "admin",
              "created_at": "ISO 8601"
            }
          ]
        }
      ]
    }
  ],
  "latest_version": { "..." }
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid ID format" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 404 | `{ "error": "Screen not found" }` |

**Notes:**
- Screenshot versions are sorted by version descending (newest first).
- Comments within each version are sorted by `pin_number` ascending.
- Replies within each comment are sorted by `created_at` ascending.
- `latest_version` is a shortcut to the first (newest) version.

---

### DELETE /api/screens/:id

Delete a screen and all its screenshot versions, comments, and replies.

**Auth Required:** Admin only

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Screen ID |

**Success Response -- 200:**

```json
{
  "ok": true
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid ID format" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Operation failed" }` |

---

## Screenshots

### POST /api/projects/:id/screens/:screenId/screenshots

Upload a new screenshot version for a screen.

**Auth Required:** Admin only

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Project ID |
| `screenId` | UUID | Screen ID |

**Request Body:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Image file (PNG, JPEG, WebP, or GIF). Max 10MB. |

**Success Response -- 201:**

```json
{
  "id": "uuid",
  "screen_id": "uuid",
  "version": 2,
  "image_url": "https://your-project.supabase.co/storage/v1/object/public/screenshots/screen-id/v2.png",
  "created_at": "ISO 8601"
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid Project ID format" }` |
| 400 | `{ "error": "Invalid Screen ID format" }` |
| 400 | `{ "error": "File is required" }` |
| 400 | `{ "error": "File too large. Maximum size is 10MB." }` |
| 400 | `{ "error": "Invalid image file. Only PNG, JPEG, WebP, and GIF are allowed." }` |
| 401 | `{ "error": "Unauthorized" }` |
| 404 | `{ "error": "Screen not found in this project" }` |
| 500 | `{ "error": "Operation failed" }` |

**Notes:**
- File type is validated by magic bytes (not MIME type), preventing file extension spoofing.
- Version numbers auto-increment from the current max version for the screen.
- Files are stored in Supabase Storage under the `screenshots` bucket at path `{screenId}/v{version}.{ext}`.
- The screen's `updated_at` timestamp is updated on successful upload.

---

## Feedback (Admin View)

These endpoints provide an admin-centric view across all feedback (comments). Internally, feedback items are stored in the `comments` table.

### GET /api/feedback

List all feedback with pagination, filtering, and search.

**Auth Required:** Admin only

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `all` | Filter by status: `open`, `in-progress`, `resolved`, or `all` |
| `project_id` | UUID | - | Filter by project |
| `screen_id` | UUID | - | Filter by screen |
| `search` | string | - | Full-text search in comment text (case-insensitive ILIKE) |
| `page` | integer | `1` | Page number |
| `per_page` | integer | `25` | Items per page |

**Success Response -- 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "screenshot_version_id": "uuid",
      "pin_number": 1,
      "x": 45.5,
      "y": 22.3,
      "text": "The button color should be darker",
      "author_id": "client_login",
      "status": "open",
      "created_at": "ISO 8601",
      "updated_at": "ISO 8601",
      "screenshot_version": {
        "id": "uuid",
        "version": 1,
        "image_url": "string",
        "screen": {
          "id": "uuid",
          "name": "Homepage",
          "project": {
            "id": "uuid",
            "name": "Acme Redesign"
          }
        }
      },
      "replies": [{ "id": "uuid" }],
      "screen_name": "Homepage",
      "project_name": "Acme Redesign",
      "reply_count": 2
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 25
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Failed to load feedback" }` |

---

### GET /api/feedback/:id

Get a single feedback item with full reply details.

**Auth Required:** Admin only

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Comment ID |

**Success Response -- 200:**

```json
{
  "id": "uuid",
  "screenshot_version_id": "uuid",
  "pin_number": 1,
  "x": 45.5,
  "y": 22.3,
  "text": "string",
  "author_id": "string",
  "status": "open",
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601",
  "screenshot_version": {
    "id": "uuid",
    "version": 1,
    "image_url": "string",
    "screen": {
      "id": "uuid",
      "name": "string",
      "project": {
        "id": "uuid",
        "name": "string"
      }
    }
  },
  "replies": [
    {
      "id": "uuid",
      "text": "string",
      "author_type": "admin",
      "created_at": "ISO 8601"
    }
  ]
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 401 | `{ "error": "Unauthorized" }` |
| 404 | `{ "error": "Not found" }` |

---

### PATCH /api/feedback/bulk

Bulk update feedback status.

**Auth Required:** Admin only

**Request Body:**

```json
{
  "ids": ["uuid", "uuid"],
  "status": "resolved"
}
```

**Valid status values:** `open`, `in-progress`, `resolved`

**Success Response -- 200:**

```json
{
  "ok": true,
  "updated": 2
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid JSON body" }` |
| 400 | `{ "error": "ids and status are required" }` |
| 400 | `{ "error": "Invalid status" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Operation failed" }` |

---

## Comments

### POST /api/comments

Create a pin comment on a screenshot version.

**Auth Required:** Any authenticated user (admin or assigned client)

**Request Body:**

```json
{
  "screenshot_version_id": "uuid (required)",
  "x": 45.5,
  "y": 22.3,
  "text": "The button color needs to be darker (required)"
}
```

**Validation:**
- `x` and `y` must be numbers between 0 and 100 (percentage-based coordinates).
- `screenshot_version_id` must be a valid UUID.
- Client users can only comment on screenshots belonging to their assigned projects.

**Success Response -- 201:**

```json
{
  "id": "uuid",
  "screenshot_version_id": "uuid",
  "pin_number": 3,
  "x": 45.5,
  "y": 22.3,
  "text": "The button color needs to be darker",
  "author_id": "client_login",
  "status": "open",
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601"
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid JSON body" }` |
| 400 | `{ "error": "Missing required fields" }` |
| 400 | `{ "error": "Invalid screenshot_version_id format" }` |
| 400 | `{ "error": "Coordinates must be numbers between 0 and 100" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 404 | `{ "error": "Screenshot version not found" }` |
| 500 | `{ "error": "Operation failed" }` |
| 500 | `{ "error": "Failed to assign pin number after retries" }` |

**Notes:**
- `pin_number` is auto-assigned as an incrementing integer per screenshot version, with retry logic to handle race conditions (unique constraint on `screenshot_version_id + pin_number`).
- New comments always start with `status: "open"`.
- If the project has a `slack_channel` configured, a Slack notification is sent automatically.

---

### PATCH /api/comments/:id

Update a comment's status or text.

**Auth Required:** Any authenticated user (with restrictions)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Comment ID |

**Request Body (all fields optional):**

```json
{
  "status": "in-progress",
  "text": "Updated comment text"
}
```

**Authorization Rules:**
- `status` can only be changed by **admin** users.
- `text` can be changed by the original **author** or any **admin**.

**Success Response -- 200:**

```json
{
  "id": "uuid",
  "screenshot_version_id": "uuid",
  "pin_number": 1,
  "x": 45.5,
  "y": 22.3,
  "text": "Updated comment text",
  "author_id": "string",
  "status": "in-progress",
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601"
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid ID format" }` |
| 400 | `{ "error": "Invalid JSON body" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 404 | `{ "error": "Comment not found" }` |
| 500 | `{ "error": "Operation failed" }` |

**Notes:**
- Changes to `status` and `text` are recorded in the `audit_log` table with before/after values.
- If no fields are provided to update, the existing comment is returned unchanged.

---

### DELETE /api/comments/:id

Delete a comment and all its replies.

**Auth Required:** Comment author or admin

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Comment ID |

**Success Response -- 200:**

```json
{
  "ok": true
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid ID format" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 404 | `{ "error": "Comment not found" }` |
| 500 | `{ "error": "Operation failed" }` |

**Notes:**
- Deletion is recorded in the `audit_log` table.
- Replies are cascade-deleted via the database foreign key.

---

## Replies

### POST /api/comments/:id/replies

Add a reply to a comment.

**Auth Required:** Any authenticated user

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Comment ID |

**Request Body:**

```json
{
  "text": "string (required)"
}
```

**Success Response -- 201:**

```json
{
  "id": "uuid",
  "comment_id": "uuid",
  "text": "string",
  "author_type": "admin" | "client",
  "author_id": "string",
  "created_at": "ISO 8601"
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid Comment ID format" }` |
| 400 | `{ "error": "Invalid JSON body" }` |
| 400 | `{ "error": "Reply text is required" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 500 | `{ "error": "Operation failed" }` |

**Notes:**
- `author_type` is automatically set from the session (`admin` or `client`).
- `author_id` is automatically set from `session.login_id`.

---

## Dashboard

### GET /api/dashboard

Get aggregate statistics for the admin dashboard.

**Auth Required:** Admin only

**Success Response -- 200:**

```json
{
  "stats": {
    "total_projects": 12,
    "total_open_feedback": 45,
    "feedback_today": 8,
    "feedback_this_week": 23
  },
  "recent_activity": [
    {
      "id": "uuid",
      "comment": "This needs more padding",
      "pin_number": 3,
      "status": "open",
      "created_at": "ISO 8601",
      "screen_name": "Homepage",
      "project_name": "Acme Redesign"
    }
  ]
}
```

**Error Responses:**

| Status | Body |
|--------|------|
| 401 | `{ "error": "Unauthorized" }` |

**Notes:**
- `feedback_today` counts comments created since midnight (server local time).
- `feedback_this_week` counts comments created since Sunday midnight (server local time).
- `recent_activity` returns the 10 most recent comments across all projects.

---

## Health

### GET /api/health

Health check endpoint. Verifies database connectivity.

**Auth Required:** None

**Success Response -- 200:**

```json
{
  "status": "ok",
  "database": "ok",
  "timestamp": "ISO 8601"
}
```

**Unhealthy Response -- 503:**

```json
{
  "status": "ok",
  "database": "error" | "unreachable",
  "timestamp": "ISO 8601"
}
```

---

## Common Error Responses

These errors can be returned by any protected endpoint:

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ "error": "Unauthorized" }` | Missing or invalid session cookie |
| 403 | `{ "error": "CSRF rejected" }` | Missing or mismatched Origin header on mutating request |

---

## Data Types

### FeedbackStatus

```
"open" | "in-progress" | "resolved"
```

### UUID Format

All IDs use UUID v4 format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

Invalid UUIDs return:

```json
{ "error": "Invalid ID format" }
```

with status `400`.

### Coordinates

Pin coordinates (`x`, `y`) are percentage-based (0-100), representing position on the screenshot image.

### Timestamps

All timestamps are ISO 8601 format with timezone: `2026-02-25T12:34:56.789Z`
