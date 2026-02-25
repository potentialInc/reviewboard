-- Migration: Add NOT NULL constraints to timestamp columns + text search index
-- Issues found during schema analysis:
--   1. All created_at / updated_at columns allow NULL despite having DEFAULT now().
--      This means a manual INSERT that explicitly passes NULL bypasses the default.
--      Adding NOT NULL + DEFAULT now() ensures every row has a valid timestamp.
--   2. The feedback listing API uses .ilike('text', '%...%') for full-text search.
--      Without a trigram index, this is a sequential scan on the comments table.
--      We enable pg_trgm and create a GIN index on comments.text.

-- =============================================================================
-- PART 1: Enable pg_trgm extension for ILIKE optimization
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- PART 2: GIN trigram index on comments.text for ILIKE '%...%' searches
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_comments_text_trgm
  ON comments USING gin (text gin_trgm_ops);

-- =============================================================================
-- PART 3: Add NOT NULL constraints to timestamp columns
-- =============================================================================
-- Strategy: First backfill any NULLs with now(), then set NOT NULL.
-- Uses DO blocks so each ALTER is independent and the migration is partially
-- idempotent (NOT NULL is idempotent if already set).

-- projects.created_at
UPDATE projects SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE projects ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE projects ALTER COLUMN created_at SET DEFAULT now();

-- projects.updated_at
UPDATE projects SET updated_at = now() WHERE updated_at IS NULL;
ALTER TABLE projects ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE projects ALTER COLUMN updated_at SET DEFAULT now();

-- client_accounts.created_at
UPDATE client_accounts SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE client_accounts ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE client_accounts ALTER COLUMN created_at SET DEFAULT now();

-- client_account_projects.created_at
UPDATE client_account_projects SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE client_account_projects ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE client_account_projects ALTER COLUMN created_at SET DEFAULT now();

-- screens.created_at
UPDATE screens SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE screens ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE screens ALTER COLUMN created_at SET DEFAULT now();

-- screens.updated_at
UPDATE screens SET updated_at = now() WHERE updated_at IS NULL;
ALTER TABLE screens ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE screens ALTER COLUMN updated_at SET DEFAULT now();

-- screenshot_versions.created_at
UPDATE screenshot_versions SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE screenshot_versions ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE screenshot_versions ALTER COLUMN created_at SET DEFAULT now();

-- comments.created_at
UPDATE comments SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE comments ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE comments ALTER COLUMN created_at SET DEFAULT now();

-- comments.updated_at
UPDATE comments SET updated_at = now() WHERE updated_at IS NULL;
ALTER TABLE comments ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE comments ALTER COLUMN updated_at SET DEFAULT now();

-- replies.created_at
UPDATE replies SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE replies ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE replies ALTER COLUMN created_at SET DEFAULT now();

-- audit_log.created_at
UPDATE audit_log SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE audit_log ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE audit_log ALTER COLUMN created_at SET DEFAULT now();
