-- Seed data for local development
-- Run with: supabase db reset

-- Sample project
insert into projects (id, name, slack_channel) values
  ('a0000000-0000-0000-0000-000000000001', 'Demo Project', '#demo-feedback');

-- Sample client account (login: demo / password: Potential)
insert into client_accounts (id, project_id, login_id, password) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'demo', 'Potential');

-- Link client to project
insert into client_account_projects (client_account_id, project_id) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');

-- Sample screen
insert into screens (id, project_id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Homepage');
