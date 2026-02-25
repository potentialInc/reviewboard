-- Migration: Add missing indexes and audit_log constraint
-- Issues: Schema Analysis 2.4 (missing indexes), 2.7 (entity_type validation)

-- Missing indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments (author_id);
CREATE INDEX IF NOT EXISTS idx_replies_author_id ON replies (author_id);
CREATE INDEX IF NOT EXISTS idx_replies_created_at ON replies (created_at);
CREATE INDEX IF NOT EXISTS idx_screenshot_versions_version_desc
  ON screenshot_versions (screen_id, version DESC);

-- Validate entity_type in audit_log to prevent typos
ALTER TABLE audit_log
  ADD CONSTRAINT chk_audit_log_entity_type
  CHECK (entity_type IN ('comment', 'project', 'screen', 'client_account', 'reply', 'screenshot_version'));
