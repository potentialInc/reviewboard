-- ReviewBoard Database Schema for Supabase
-- Reference file — reflects the final schema after all migrations.
-- Updated: 2026-02-25 — removed client_accounts.project_id,
--          added NOT NULL timestamps, pg_trgm text search, audit constraints.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- PROJECTS
-- ============================================
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL CHECK (char_length(name) <= 255),
  slack_channel text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- CLIENT ACCOUNTS
-- NOTE: project_id column was removed in migration 000007.
-- All project associations go through client_account_projects.
-- ============================================
CREATE TABLE client_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  login_id text UNIQUE NOT NULL,
  -- SECURITY: No default password. Accounts must be provisioned with a bcrypt hash.
  password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Many-to-many: one client_account can access multiple projects
CREATE TABLE client_account_projects (
  client_account_id uuid REFERENCES client_accounts(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_account_id, project_id)
);

-- ============================================
-- SCREENS (within a project)
-- ============================================
CREATE TABLE screens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL CHECK (char_length(name) <= 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- SCREENSHOT VERSIONS (per screen)
-- ============================================
CREATE TABLE screenshot_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  screen_id uuid REFERENCES screens(id) ON DELETE CASCADE NOT NULL,
  version integer NOT NULL DEFAULT 1,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(screen_id, version)
);

-- ============================================
-- COMMENTS (pin feedback on a screenshot version)
-- ============================================
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  screenshot_version_id uuid REFERENCES screenshot_versions(id) ON DELETE CASCADE NOT NULL,
  pin_number integer NOT NULL,
  x float NOT NULL CHECK (x >= 0 AND x <= 100),
  y float NOT NULL CHECK (y >= 0 AND y <= 100),
  text text NOT NULL CHECK (char_length(text) <= 5000),
  author_id text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(screenshot_version_id, pin_number)
);

-- ============================================
-- REPLIES (admin/client replies on a comment)
-- ============================================
CREATE TABLE replies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL CHECK (char_length(text) <= 5000),
  author_type text NOT NULL CHECK (author_type IN ('admin', 'client')),
  author_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type text NOT NULL CHECK (entity_type IN ('comment', 'project', 'screen', 'client_account', 'reply', 'screenshot_version')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'edit', 'delete', 'status_change')),
  old_value text,
  new_value text,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
-- Primary query-path indexes
CREATE INDEX idx_client_accounts_login_id ON client_accounts(login_id);
CREATE INDEX idx_client_account_projects_project ON client_account_projects(project_id);
CREATE INDEX idx_screens_project_id ON screens(project_id);
CREATE INDEX idx_screenshot_versions_screen_id ON screenshot_versions(screen_id);
CREATE INDEX idx_comments_screenshot_version_id ON comments(screenshot_version_id);
CREATE INDEX idx_comments_status ON comments(status);
CREATE INDEX idx_comments_sv_status ON comments(screenshot_version_id, status);
CREATE INDEX idx_comments_created_at ON comments(created_at);
CREATE INDEX idx_replies_comment_id ON replies(comment_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Added in migration 000006
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor);
CREATE INDEX idx_comments_author_id ON comments(author_id);
CREATE INDEX idx_replies_author_id ON replies(author_id);
CREATE INDEX idx_replies_created_at ON replies(created_at);
CREATE INDEX idx_screenshot_versions_version_desc ON screenshot_versions(screen_id, version DESC);

-- Added in optimization migration
CREATE INDEX idx_comments_text_trgm ON comments USING gin (text gin_trgm_ops);
CREATE INDEX idx_comments_status_created_at ON comments(status, created_at DESC);
CREATE INDEX idx_comments_open ON comments(screenshot_version_id) WHERE status = 'open';
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_account_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshot_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Service role policies (service_role bypasses RLS, but explicit policies document intent)
CREATE POLICY "Service role access" ON projects FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON client_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON client_account_projects FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON screens FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON screenshot_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON comments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON replies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Deny anon access (defense-in-depth, added in migration 000008)
-- Authenticated role policies (defense-in-depth, added in migration 000008)
-- See migration 000008 for full RLS policy details.

-- ============================================
-- STORAGE BUCKET for screenshots (private, set in migration 000008)
-- ============================================
-- Bucket is private. Use service_role or signed URLs for access.

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER screens_updated_at BEFORE UPDATE ON screens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
