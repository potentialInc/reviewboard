-- Seed data for local development
-- Run with: supabase db reset
--
-- NOTE: client_accounts.project_id was removed in migration 000007.
--       All project associations go through the client_account_projects junction table.
--
-- Credentials (LOCAL DEV ONLY — never deploy seed data to production):
--   Admin:  configured via ADMIN_ID / ADMIN_PASSWORD env vars
--   Client: demo / Potential  (plaintext — auto-upgraded to bcrypt on first login)
--   Client: acme-client / Potential

-- ============================================
-- PROJECTS
-- ============================================
INSERT INTO projects (id, name, slack_channel) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Demo Project', '#demo-feedback'),
  ('a0000000-0000-0000-0000-000000000002', 'Acme Corp Redesign', '#acme-feedback'),
  ('a0000000-0000-0000-0000-000000000003', 'Internal Dashboard', NULL);

-- ============================================
-- CLIENT ACCOUNTS
-- SECURITY WARNING: These passwords are plaintext for LOCAL DEVELOPMENT ONLY.
-- They are auto-upgraded to bcrypt on first login via the login route.
-- NEVER deploy seed data to production. Use the admin UI to create accounts.
-- ============================================
INSERT INTO client_accounts (id, login_id, password) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'demo', 'Potential'),
  ('b0000000-0000-0000-0000-000000000002', 'acme-client', 'Potential');

-- ============================================
-- CLIENT ↔ PROJECT ASSIGNMENTS (junction table)
-- ============================================
INSERT INTO client_account_projects (client_account_id, project_id) VALUES
  -- demo user has access to Demo Project and Internal Dashboard
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003'),
  -- acme-client has access to Acme Corp Redesign
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002');

-- ============================================
-- SCREENS
-- ============================================
INSERT INTO screens (id, project_id, name) VALUES
  -- Demo Project screens
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Homepage'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Login Page'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Settings'),
  -- Acme Corp Redesign screens
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Landing Page'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Product Page'),
  -- Internal Dashboard screens
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'Analytics');

-- ============================================
-- SCREENSHOT VERSIONS (placeholder URLs — replace with real uploads in dev)
-- ============================================
INSERT INTO screenshot_versions (id, screen_id, version, image_url) VALUES
  -- Homepage: 2 versions
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, 'https://placehold.co/1440x900/e2e8f0/475569?text=Homepage+v1'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 2, 'https://placehold.co/1440x900/e2e8f0/475569?text=Homepage+v2'),
  -- Login Page: 1 version
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 1, 'https://placehold.co/1440x900/e2e8f0/475569?text=Login+v1'),
  -- Settings: 1 version
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 1, 'https://placehold.co/1440x900/e2e8f0/475569?text=Settings+v1'),
  -- Landing Page: 1 version
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000004', 1, 'https://placehold.co/1440x900/e2e8f0/475569?text=Landing+v1'),
  -- Product Page: 1 version
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000005', 1, 'https://placehold.co/1440x900/e2e8f0/475569?text=Product+v1'),
  -- Analytics: 1 version
  ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000006', 1, 'https://placehold.co/1440x900/e2e8f0/475569?text=Analytics+v1');

-- ============================================
-- COMMENTS (sample feedback pins)
-- ============================================
INSERT INTO comments (id, screenshot_version_id, pin_number, x, y, text, author_id, status) VALUES
  -- Homepage v2 — 3 comments (mix of statuses)
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 1, 25.5, 15.0, 'The hero headline font size looks too small on mobile. Can we bump it up to 32px?', 'demo', 'open'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 2, 72.0, 48.3, 'Love the new CTA button color! Approved.', 'demo', 'resolved'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 3, 50.0, 85.0, 'Footer links are misaligned. Check the padding on the second column.', 'demo', 'in-progress'),
  -- Homepage v1 — 1 old comment
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 1, 10.0, 10.0, 'This version has a typo in the navigation — "Abuot" should be "About".', 'demo', 'resolved'),
  -- Login Page v1
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000003', 1, 50.0, 60.0, 'The password field should have a show/hide toggle icon.', 'demo', 'open'),
  -- Landing Page v1 (Acme project)
  ('e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000005', 1, 30.0, 25.0, 'Logo needs to be updated to the new brand version.', 'acme-client', 'open'),
  ('e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000005', 2, 60.0, 70.0, 'The testimonial section overlaps with the pricing table on tablet.', 'acme-client', 'open');

-- ============================================
-- REPLIES (sample conversations)
-- ============================================
INSERT INTO replies (id, comment_id, text, author_type, author_id) VALUES
  -- Reply from admin on the hero headline comment
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Good catch! We''ll increase it to 32px in the next revision.', 'admin', 'admin'),
  -- Client follow-up
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Thanks! Also consider increasing line-height for readability.', 'client', 'demo'),
  -- Reply on footer alignment
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'Working on this now. Should be fixed in v3.', 'admin', 'admin'),
  -- Reply on Acme logo comment
  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000006', 'Updated logo has been sent to the design team.', 'admin', 'admin');

-- ============================================
-- AUDIT LOG (sample entries)
-- ============================================
INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, actor) VALUES
  ('comment', 'e0000000-0000-0000-0000-000000000002', 'status_change', 'open', 'resolved', 'admin'),
  ('comment', 'e0000000-0000-0000-0000-000000000003', 'status_change', 'open', 'in-progress', 'admin'),
  ('comment', 'e0000000-0000-0000-0000-000000000004', 'status_change', 'open', 'resolved', 'admin');
