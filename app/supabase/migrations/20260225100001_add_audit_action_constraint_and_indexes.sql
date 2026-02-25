-- Migration: Add audit_log.action CHECK constraint + missing composite indexes
-- Issues found during schema analysis:
--   1. audit_log.action has no validation — any string is accepted, risking typos.
--   2. The dashboard API queries comments with .gte('created_at', ...) combined with
--      .eq('status', 'open'). A composite index (status, created_at) would serve
--      the dashboard's "open feedback today/week" counts more efficiently than
--      separate single-column indexes.
--   3. comments.author_id is queried for authorization checks — already indexed in
--      migration 000006, but adding a partial index for open comments helps the
--      common "open feedback by author" pattern.

-- =============================================================================
-- PART 1: Validate audit_log.action values
-- =============================================================================
-- The application code uses: 'status_change', 'edit', 'delete'.
-- Future actions like 'create' are plausible, so we include it.

ALTER TABLE audit_log
  ADD CONSTRAINT chk_audit_log_action
  CHECK (action IN ('create', 'edit', 'delete', 'status_change'));

-- =============================================================================
-- PART 2: Composite index for dashboard "open feedback by date range" queries
-- =============================================================================
-- The dashboard does:
--   .eq('status', 'open').gte('created_at', todayStart)
--   .eq('status', 'open').gte('created_at', weekStart)
-- This composite index avoids scanning all open comments just to filter by date.

CREATE INDEX IF NOT EXISTS idx_comments_status_created_at
  ON comments (status, created_at DESC);

-- =============================================================================
-- PART 3: Partial index for open comments (most-queried status)
-- =============================================================================
-- Many queries filter for status = 'open' specifically. A partial index
-- is smaller and faster than scanning the full status index.

CREATE INDEX IF NOT EXISTS idx_comments_open
  ON comments (screenshot_version_id)
  WHERE status = 'open';

-- =============================================================================
-- PART 4: Index on client_account_projects for client_account_id lookups
-- =============================================================================
-- The PK is (client_account_id, project_id), which covers queries starting with
-- client_account_id. However, explicit index documentation is useful, and PG
-- already uses the composite PK for leading-column lookups. No additional index
-- needed — this comment documents the analysis conclusion.
-- (Skipped: redundant with composite PK)

-- =============================================================================
-- PART 5: Index on audit_log.action for filtered queries
-- =============================================================================
-- If the admin dashboard ever filters audit logs by action type, this helps.

CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON audit_log (action);
