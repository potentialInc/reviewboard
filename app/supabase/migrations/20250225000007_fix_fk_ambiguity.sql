-- Migration: Fix FK ambiguity and remove redundant project_id from client_accounts
-- Issues: Schema Analysis 2.1 (FK ambiguity), 2.5 (redundant project_id)
--
-- Problem:
--   client_accounts has both a direct project_id FK to projects AND a many-to-many
--   relationship via client_account_projects. This creates ambiguous FK paths that
--   break PostgREST nested selects (e.g. projects.select('*, client_accounts(*)'))
--   and forces workaround code with separate queries.
--
-- Solution:
--   1. Preserve all existing project_id associations into client_account_projects
--   2. Drop the redundant project_id column from client_accounts
--   3. Drop the now-orphaned index on client_accounts.project_id

-- Step 1: Preserve existing direct project_id relationships into the junction table.
-- Uses ON CONFLICT DO NOTHING so rows that already exist in client_account_projects
-- are silently skipped, making this migration idempotent for the data portion.
INSERT INTO client_account_projects (client_account_id, project_id)
SELECT id, project_id
FROM client_accounts
WHERE project_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 2: Drop the index on client_accounts.project_id (created in migration 000002).
-- The index must be dropped before the column, otherwise DROP COLUMN would remove it
-- implicitly, but being explicit is cleaner and avoids dependency issues.
DROP INDEX IF EXISTS idx_client_accounts_project_id;

-- Step 3: Drop the FK constraint and then the column itself.
-- ALTER TABLE ... DROP COLUMN cascades to dependent constraints (the FK) automatically,
-- but we use IF EXISTS for idempotency in case this migration is re-run.
ALTER TABLE client_accounts DROP COLUMN IF EXISTS project_id;
