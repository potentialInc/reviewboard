# Schema Analysis Report

**Date:** 2026-02-25
**Source:** `app/supabase/migrations/20250225000000–20250225000005`
**Analyzer:** Manual analysis (schema-analyzer.sh requires bash execution)

---

## 1. Schema Overview

### Tables (8 total)

| Table | PK | Columns | Purpose |
|---|---|---|---|
| `projects` | uuid | `id, name, slack_channel, created_at, updated_at` | Top-level project container |
| `client_accounts` | uuid | `id, project_id, login_id, password, created_at` | Client login credentials |
| `client_account_projects` | composite | `client_account_id, project_id, created_at` | M:N join: clients to projects |
| `screens` | uuid | `id, project_id, name, created_at, updated_at` | Screens within a project |
| `screenshot_versions` | uuid | `id, screen_id, version, image_url, created_at` | Versioned screenshots per screen |
| `comments` | uuid | `id, screenshot_version_id, pin_number, x, y, text, author_id, status, created_at, updated_at` | Pin-based feedback on screenshots |
| `replies` | uuid | `id, comment_id, text, author_type, author_id, created_at` | Threaded replies on comments |
| `audit_log` | uuid | `id, entity_type, entity_id, action, old_value, new_value, actor, created_at` | Audit trail for changes |

### Relationships (Entity-Relationship)

```
projects ─────────┬──< screens ──< screenshot_versions ──< comments ──< replies
                   │
                   ├──< client_accounts (FK: project_id, ON DELETE SET NULL)
                   │
                   └──< client_account_projects >──── client_accounts
                         (M:N junction, ON DELETE CASCADE both sides)
```

**Foreign Key Summary:**

| Source Table | Column | Target Table | On Delete |
|---|---|---|---|
| `client_accounts` | `project_id` | `projects` | SET NULL |
| `client_account_projects` | `client_account_id` | `client_accounts` | CASCADE |
| `client_account_projects` | `project_id` | `projects` | CASCADE |
| `screens` | `project_id` | `projects` | CASCADE |
| `screenshot_versions` | `screen_id` | `screens` | CASCADE |
| `comments` | `screenshot_version_id` | `screenshot_versions` | CASCADE |
| `replies` | `comment_id` | `comments` | CASCADE |

---

## 2. Issues Found

### 2.1 FK Ambiguity: `projects` has two inbound FK paths (SEVERITY: HIGH)

**Problem:** Both `client_accounts.project_id` and `client_account_projects.project_id` reference `projects(id)`. This creates an ambiguous FK relationship that causes PostgREST/Supabase nested selects to fail when querying `projects` with a nested `client_accounts(...)` embed.

**Evidence from code:** The API routes already work around this manually:
- `app/src/app/api/projects/route.ts` line 26: `"// Fetch client accounts separately (avoids ambiguous FK with client_account_projects)"`
- `app/src/app/api/projects/[id]/route.ts` line 44: same workaround

**Impact:** Cannot use Supabase nested selects like `projects.select('*, client_accounts(*)')` -- forces separate queries, increasing latency.

**Recommendation:** The `client_accounts.project_id` column is a legacy "primary project" reference that duplicates the M:N junction table. Consider:
1. Migrating all project associations to `client_account_projects` exclusively
2. Dropping `client_accounts.project_id` in favor of a computed "primary_project" view
3. Or, if both are needed, use explicit FK hints in Supabase queries: `.select('*, client_accounts!client_accounts_project_id_fkey(*)')`

---

### 2.2 Plaintext Passwords (SEVERITY: CRITICAL)

**Problem:** `client_accounts.password` stores passwords in plaintext with a default value of `'Potential'`.

**Evidence:**
- Migration `20250225000001`: `password text not null default 'Potential'`
- Login route `app/src/app/api/auth/login/route.ts` line 39: `if (!account || account.password !== password)` -- direct string comparison
- Project creation `app/src/app/api/projects/route.ts` line 204: inserts `password: 'Potential'` as plaintext

**Impact:** Any database breach, backup leak, or log exposure reveals all client passwords immediately. Service role access (which all API routes use) returns raw passwords.

**Recommendation:**
1. Hash passwords with bcrypt or argon2 before storage
2. Compare using constant-time hash verification
3. Remove the `default 'Potential'` -- force explicit password generation
4. Add a migration to hash all existing passwords

---

### 2.3 Overly Permissive RLS Policies (SEVERITY: MEDIUM)

**Problem:** All RLS policies are identical: `using (true) with check (true)` for `service_role` only. No policies exist for `anon` or `authenticated` roles.

**Evidence:** `20250225000003_enable_rls.sql` -- every table has only:
```sql
create policy "Service role access" on <table> for all to service_role using (true) with check (true);
```

**Impact:**
- RLS is effectively a no-op since all queries use `service_role` (the service key)
- If the service key leaks, the attacker has unrestricted access to all data in all tables
- No defense-in-depth: there is no row-level isolation between clients
- The `anon` role is correctly blocked (no policies), but there are no `authenticated` role policies either

**Recommendation:**
1. Implement proper per-role policies:
   - `authenticated` clients should only see projects in their `client_account_projects` entries
   - `authenticated` clients should only see comments on their assigned screens
   - `anon` should have zero access (already correct by default)
2. Use Supabase Auth instead of custom cookie-based auth to enable JWT-based RLS
3. At minimum, add column-level security to prevent `client_accounts.password` from being readable in nested selects

---

### 2.4 Missing Indexes (SEVERITY: LOW-MEDIUM)

**Existing indexes are well-designed.** The following are present and appropriate:
- `idx_client_accounts_login_id` -- login lookups
- `idx_client_accounts_project_id` -- FK join
- `idx_client_account_projects_project` -- reverse lookup on junction
- `idx_screens_project_id` -- screens by project
- `idx_screenshot_versions_screen_id` -- versions by screen
- `idx_comments_screenshot_version_id` -- comments by version
- `idx_comments_status` -- status filtering
- `idx_comments_sv_status` -- composite: version + status
- `idx_comments_created_at` -- time-range queries
- `idx_replies_comment_id` -- replies by comment
- `idx_audit_log_entity` -- audit by entity

**Missing indexes to consider:**

| Table | Missing Index | Reason |
|---|---|---|
| `audit_log` | `idx_audit_log_created_at` | Time-range queries on audit log (common for admin dashboards) |
| `audit_log` | `idx_audit_log_actor` | Filtering audit entries by actor |
| `comments` | `idx_comments_author_id` | The DELETE route checks `author_id` for authorization; also useful for "my comments" views |
| `replies` | `idx_replies_author_id` | Filtering replies by author |
| `replies` | `idx_replies_created_at` | Sorting replies chronologically (done in JS currently) |
| `screenshot_versions` | `idx_screenshot_versions_version_desc` | `ORDER BY version DESC LIMIT 1` pattern used in screenshot upload |

---

### 2.5 Redundant `project_id` on `client_accounts` (SEVERITY: MEDIUM)

**Problem:** `client_accounts` has both:
- `project_id` (direct FK to projects, nullable, ON DELETE SET NULL)
- The `client_account_projects` junction table for M:N

This is a dual-path relationship that is semantically confusing and causes the FK ambiguity in issue 2.1.

**Evidence:**
- `client_accounts.project_id` is used in login as a "primary project" (`session.project_id`)
- `client_account_projects` is used for multi-project access checks
- The `hasProjectAccess` function in `auth.ts` (line 53) checks both: `user.project_id === projectId` OR `assignedProjectIds?.includes(projectId)`

**Impact:** Data inconsistency risk -- a client could have `project_id = X` but no entry in `client_account_projects` for project X (or vice versa). The project creation code inserts both, but there is no constraint enforcing consistency.

**Recommendation:**
1. Keep `client_account_projects` as the source of truth for project access
2. Add a `primary_project_id` to `client_account_projects` (boolean flag) if needed
3. Or add a DB trigger to keep `client_accounts.project_id` in sync with junction table

---

### 2.6 No `updated_at` Trigger on Some Tables (SEVERITY: LOW)

**Problem:** The `update_updated_at()` trigger is applied to `projects`, `screens`, and `comments`, but not to tables that also have `updated_at` columns or could benefit from tracking:

- `client_accounts` -- has no `updated_at` column at all
- `screenshot_versions` -- has no `updated_at` column
- `replies` -- has no `updated_at` column (not necessarily needed since replies are append-only)

**Recommendation:** Not critical, but adding `updated_at` to `client_accounts` would help track password changes and account modifications.

---

### 2.7 `audit_log.entity_id` Is Not a Foreign Key (SEVERITY: LOW)

**Problem:** `audit_log.entity_id` is a bare `uuid NOT NULL` with no FK constraint. When the referenced entity is deleted (e.g., a comment), the audit log entry becomes an orphan pointing to a non-existent record.

**Impact:** This is actually intentional for audit logs (you want to preserve history even after deletion). However, there is no `entity_type` validation -- any arbitrary string can be inserted.

**Recommendation:**
1. Add a CHECK constraint: `check (entity_type in ('comment', 'project', 'screen', 'client_account', 'reply'))`
2. This prevents typos and enforces a known set of entity types

---

### 2.8 Client-Side Filtering Instead of DB Filtering (SEVERITY: MEDIUM)

**Problem:** In `app/src/app/api/feedback/route.ts` (lines 52-64), filtering by `project_id` and `screen_id` is done in JavaScript after fetching all results, because these are nested relations:

```typescript
// Filter by project_id / screen_id in JS since they are nested relations
let filtered = comments || [];
if (projectId) {
  filtered = filtered.filter((c) => {
    const sv = c.screenshot_version as { screen?: { project?: { id: string } } };
    return sv?.screen?.project?.id === projectId;
  });
}
```

**Impact:**
- Pagination is broken: `count` and `range()` operate on the unfiltered result, but JS filters reduce the set afterward, so the client sees fewer items than expected per page
- Fetches more data than needed from the database
- Memory usage grows linearly with total comments when filtering by project

**Recommendation:**
1. Use a database view or function that joins comments to projects for direct filtering:
   ```sql
   CREATE VIEW comments_with_project AS
   SELECT c.*, s.project_id
   FROM comments c
   JOIN screenshot_versions sv ON sv.id = c.screenshot_version_id
   JOIN screens s ON s.id = sv.screen_id;
   ```
2. Or use Supabase's `!inner` join modifier: `.select('*, screenshot_version:screenshot_versions!inner(screen:screens!inner(project:projects!inner(...)))').eq('screenshot_version.screen.project.id', projectId)`

---

### 2.9 Race Condition in Pin Number Assignment (SEVERITY: LOW)

**Problem:** In `app/src/app/api/comments/route.ts` (lines 47-86), pin numbers are assigned by:
1. Querying the max `pin_number` for a screenshot version
2. Incrementing by 1
3. Inserting with retry on unique constraint violation

This is handled with 3 retries, which is reasonable for low concurrency. However, under high concurrent feedback submission, all 3 retries could exhaust.

**Recommendation:** Use a database sequence or `COALESCE(MAX(pin_number), 0) + 1` in a single INSERT ... SELECT statement to make it atomic:
```sql
INSERT INTO comments (screenshot_version_id, pin_number, ...)
SELECT $1, COALESCE(MAX(pin_number), 0) + 1, ...
FROM comments WHERE screenshot_version_id = $1;
```

---

### 2.10 N+1 Query Patterns (SEVERITY: MEDIUM)

**Mostly mitigated.** The codebase already uses batch queries to avoid classic N+1 patterns. Notable patterns:

**Well-handled:**
- `GET /api/projects` -- batch-fetches screenshot_versions and open comment counts across all projects in 3 queries (not N+1)
- `GET /api/projects/[id]` -- batch-fetches comment counts across all screens
- `GET /api/screens/[id]` -- uses deep nested select in a single query

**Remaining concern:**
- `GET /api/projects` admin path makes 4 sequential queries (projects, client_accounts, screenshot_versions, comments). While not N+1 (each is a single query), this could be reduced to 2 queries with a database view or RPC function.
- `POST /api/comments` makes 2 separate queries for authorization (screenshot_versions + client_account_projects), then 2 more for pin assignment + insert, then 1 more for Slack notification context. Total: 5-6 queries per comment creation.

---

### 2.11 Storage Bucket is Public (SEVERITY: MEDIUM)

**Problem:** The screenshots storage bucket is set to `public = true` in `20250225000004_setup_storage.sql`:
```sql
insert into storage.buckets (id, name, public, ...)
values ('screenshots', 'screenshots', true, ...);
```

And there is a blanket public read policy:
```sql
create policy "Public read access" on storage.objects for select using (bucket_id = 'screenshots');
```

**Impact:** Anyone with the URL can view any screenshot without authentication. This may be intentional for simplicity, but could expose confidential design work.

**Recommendation:** If screenshots contain sensitive client content:
1. Set `public = false`
2. Use signed URLs with expiration for authenticated access
3. Add RLS policies that check project membership

---

## 3. Summary

| # | Issue | Severity | Effort |
|---|---|---|---|
| 2.1 | FK ambiguity: dual path to projects | HIGH | Medium |
| 2.2 | Plaintext passwords | CRITICAL | Medium |
| 2.3 | Overly permissive RLS (service_role only) | MEDIUM | High |
| 2.4 | Missing indexes (audit_log, comments.author_id) | LOW-MEDIUM | Low |
| 2.5 | Redundant project_id on client_accounts | MEDIUM | Medium |
| 2.6 | Missing updated_at triggers | LOW | Low |
| 2.7 | No entity_type validation on audit_log | LOW | Low |
| 2.8 | Client-side filtering breaks pagination | MEDIUM | Medium |
| 2.9 | Race condition in pin number assignment | LOW | Low |
| 2.10 | Sequential queries (not N+1 but reducible) | MEDIUM | Medium |
| 2.11 | Public screenshot bucket | MEDIUM | Low |

### Priority Order

1. **Immediate (P0):** Issue 2.2 -- Hash passwords. This is a security vulnerability.
2. **Short-term (P1):** Issues 2.1, 2.5 -- Resolve FK ambiguity by consolidating project access to junction table only.
3. **Short-term (P1):** Issue 2.8 -- Fix pagination with DB-level filtering.
4. **Medium-term (P2):** Issues 2.3, 2.11 -- Improve RLS and storage security.
5. **Low priority (P3):** Issues 2.4, 2.6, 2.7, 2.9, 2.10 -- Incremental improvements.
