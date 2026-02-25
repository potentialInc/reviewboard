-- Migration: Tighten RLS policies and make screenshots bucket private
-- Issues: Schema Analysis 2.3 (overly permissive RLS), 2.11 (public bucket)
--
-- Context:
--   This app uses iron-session (cookie-based auth), NOT Supabase Auth.
--   All application queries go through createServiceSupabase() which uses the
--   service_role key. The service_role key bypasses RLS entirely, so existing
--   service_role policies remain the primary access path for the application.
--
--   The policies added here are DEFENSE-IN-DEPTH measures that:
--   - Block the anon key from accessing any data (already blocked by default
--     when RLS is enabled with no anon policies, but we add explicit denies)
--   - Restrict the authenticated role to only data within their assigned projects
--     (useful if the app ever migrates to Supabase Auth or JWT-based access)
--   - Protect against accidental exposure of the anon key
--
-- All policy creation uses DO blocks with EXCEPTION handlers for idempotency.

-- =============================================================================
-- PART 1: Ensure RLS is enabled on all tables (idempotent -- no-op if already on)
-- =============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_account_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshot_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 2: Explicit DENY policies for the anon role
-- =============================================================================
-- When RLS is enabled and no policy grants access, the anon role is already
-- blocked. These explicit policies document the intent and guard against
-- future accidental grants.

DO $$ BEGIN
  CREATE POLICY "Deny anon access"
    ON projects FOR ALL TO anon
    USING (false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Deny anon access"
    ON client_accounts FOR ALL TO anon
    USING (false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Deny anon access"
    ON client_account_projects FOR ALL TO anon
    USING (false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Deny anon access"
    ON screens FOR ALL TO anon
    USING (false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Deny anon access"
    ON screenshot_versions FOR ALL TO anon
    USING (false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Deny anon access"
    ON comments FOR ALL TO anon
    USING (false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Deny anon access"
    ON replies FOR ALL TO anon
    USING (false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Deny anon access"
    ON audit_log FOR ALL TO anon
    USING (false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PART 3: Authenticated-role policies (defense-in-depth for future JWT usage)
-- =============================================================================
-- These policies use auth.uid() which maps to the JWT sub claim.
-- They are inactive when queries use service_role (which bypasses RLS),
-- but provide row-level isolation if the app migrates to Supabase Auth.

-- ---------------------------------------------------------------------------
-- projects: authenticated users can only SELECT projects they are assigned to
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view assigned projects"
    ON projects FOR SELECT TO authenticated
    USING (
      id IN (
        SELECT cap.project_id
        FROM client_account_projects cap
        JOIN client_accounts ca ON ca.id = cap.client_account_id
        WHERE ca.login_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- screens: authenticated users can only SELECT screens in assigned projects
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view screens in assigned projects"
    ON screens FOR SELECT TO authenticated
    USING (
      project_id IN (
        SELECT cap.project_id
        FROM client_account_projects cap
        JOIN client_accounts ca ON ca.id = cap.client_account_id
        WHERE ca.login_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- screenshot_versions: authenticated users can SELECT versions for assigned projects
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view versions in assigned projects"
    ON screenshot_versions FOR SELECT TO authenticated
    USING (
      screen_id IN (
        SELECT s.id
        FROM screens s
        JOIN client_account_projects cap ON cap.project_id = s.project_id
        JOIN client_accounts ca ON ca.id = cap.client_account_id
        WHERE ca.login_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- comments: authenticated users can SELECT comments on their assigned projects
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view comments in assigned projects"
    ON comments FOR SELECT TO authenticated
    USING (
      screenshot_version_id IN (
        SELECT sv.id
        FROM screenshot_versions sv
        JOIN screens s ON s.id = sv.screen_id
        JOIN client_account_projects cap ON cap.project_id = s.project_id
        JOIN client_accounts ca ON ca.id = cap.client_account_id
        WHERE ca.login_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- comments: authenticated users can INSERT comments on their assigned projects
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert comments in assigned projects"
    ON comments FOR INSERT TO authenticated
    WITH CHECK (
      screenshot_version_id IN (
        SELECT sv.id
        FROM screenshot_versions sv
        JOIN screens s ON s.id = sv.screen_id
        JOIN client_account_projects cap ON cap.project_id = s.project_id
        JOIN client_accounts ca ON ca.id = cap.client_account_id
        WHERE ca.login_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- replies: authenticated users can SELECT replies on comments in assigned projects
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view replies in assigned projects"
    ON replies FOR SELECT TO authenticated
    USING (
      comment_id IN (
        SELECT c.id
        FROM comments c
        JOIN screenshot_versions sv ON sv.id = c.screenshot_version_id
        JOIN screens s ON s.id = sv.screen_id
        JOIN client_account_projects cap ON cap.project_id = s.project_id
        JOIN client_accounts ca ON ca.id = cap.client_account_id
        WHERE ca.login_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- replies: authenticated users can INSERT replies on comments in assigned projects
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert replies in assigned projects"
    ON replies FOR INSERT TO authenticated
    WITH CHECK (
      comment_id IN (
        SELECT c.id
        FROM comments c
        JOIN screenshot_versions sv ON sv.id = c.screenshot_version_id
        JOIN screens s ON s.id = sv.screen_id
        JOIN client_account_projects cap ON cap.project_id = s.project_id
        JOIN client_accounts ca ON ca.id = cap.client_account_id
        WHERE ca.login_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- client_accounts: authenticated users can only view their own account
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view own account"
    ON client_accounts FOR SELECT TO authenticated
    USING (login_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- client_account_projects: authenticated users can view their own assignments
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view own project assignments"
    ON client_account_projects FOR SELECT TO authenticated
    USING (
      client_account_id IN (
        SELECT id FROM client_accounts
        WHERE login_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- audit_log: no authenticated access (admin-only via service_role)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Deny authenticated access to audit log"
    ON audit_log FOR ALL TO authenticated
    USING (false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PART 4: Make screenshots storage bucket private (Issue 2.11)
-- =============================================================================
-- The bucket was created as public in migration 000004. Setting it to private
-- means direct URL access is blocked; the app must use signed URLs or
-- service_role requests to serve images.

UPDATE storage.buckets
SET public = false
WHERE id = 'screenshots';

-- Drop the blanket public read policy on storage.objects.
-- Use DO block for idempotency since DROP POLICY has no IF EXISTS in older PG.
DO $$ BEGIN
  DROP POLICY "Public read access" ON storage.objects;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Replace with an authenticated-only read policy scoped to the screenshots bucket.
-- This allows authenticated users (with a valid JWT) to read screenshots.
-- service_role already bypasses RLS, so admin access is unaffected.
DO $$ BEGIN
  CREATE POLICY "Authenticated read access for screenshots"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'screenshots');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Deny anon access to storage objects in the screenshots bucket.
DO $$ BEGIN
  CREATE POLICY "Deny anon access to screenshots"
    ON storage.objects FOR SELECT TO anon
    USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
