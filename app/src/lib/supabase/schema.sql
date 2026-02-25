-- ReviewBoard Database Schema for Supabase
-- Updated: cascade delete fix, unique constraints, indexes, RLS, storage

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- PROJECTS
-- ============================================
create table projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) <= 255),
  slack_channel text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- CLIENT ACCOUNTS (auto-provisioned per project)
-- Changed: project_id uses SET NULL instead of CASCADE to prevent
-- deleting a project from nuking client accounts that have access
-- to other projects.
-- ============================================
create table client_accounts (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete set null,
  login_id text unique not null,
  password text not null default 'Potential',
  created_at timestamptz default now()
);

-- Many-to-many: one client_account can access multiple projects
create table client_account_projects (
  client_account_id uuid references client_accounts(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (client_account_id, project_id)
);

-- ============================================
-- SCREENS (within a project)
-- ============================================
create table screens (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null check (char_length(name) <= 255),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- SCREENSHOT VERSIONS (per screen)
-- ============================================
create table screenshot_versions (
  id uuid primary key default uuid_generate_v4(),
  screen_id uuid references screens(id) on delete cascade not null,
  version integer not null default 1,
  image_url text not null,
  created_at timestamptz default now(),
  unique(screen_id, version)
);

-- ============================================
-- COMMENTS (pin feedback on a screenshot version)
-- Added: unique constraint on (screenshot_version_id, pin_number)
-- Added: coordinate range check
-- ============================================
create table comments (
  id uuid primary key default uuid_generate_v4(),
  screenshot_version_id uuid references screenshot_versions(id) on delete cascade not null,
  pin_number integer not null,
  x float not null check (x >= 0 and x <= 100),
  y float not null check (y >= 0 and y <= 100),
  text text not null check (char_length(text) <= 5000),
  author_id text not null,
  status text not null default 'open' check (status in ('open', 'in-progress', 'resolved')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(screenshot_version_id, pin_number)
);

-- ============================================
-- REPLIES (admin/client replies on a comment)
-- Added: author_id to identify who replied
-- ============================================
create table replies (
  id uuid primary key default uuid_generate_v4(),
  comment_id uuid references comments(id) on delete cascade not null,
  text text not null check (char_length(text) <= 5000),
  author_type text not null check (author_type in ('admin', 'client')),
  author_id text not null default '',
  created_at timestamptz default now()
);

-- ============================================
-- AUDIT LOG
-- ============================================
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  old_value text,
  new_value text,
  actor text not null,
  created_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_client_accounts_login_id on client_accounts(login_id);
create index idx_client_accounts_project_id on client_accounts(project_id);
create index idx_client_account_projects_project on client_account_projects(project_id);
create index idx_screens_project_id on screens(project_id);
create index idx_screenshot_versions_screen_id on screenshot_versions(screen_id);
create index idx_comments_screenshot_version_id on comments(screenshot_version_id);
create index idx_comments_status on comments(status);
create index idx_comments_sv_status on comments(screenshot_version_id, status);
create index idx_comments_created_at on comments(created_at);
create index idx_replies_comment_id on replies(comment_id);
create index idx_audit_log_entity on audit_log(entity_type, entity_id);

-- ============================================
-- RLS (Row Level Security) — restricted to service_role only
-- ============================================
alter table projects enable row level security;
alter table client_accounts enable row level security;
alter table client_account_projects enable row level security;
alter table screens enable row level security;
alter table screenshot_versions enable row level security;
alter table comments enable row level security;
alter table replies enable row level security;
alter table audit_log enable row level security;

-- Service role policies (only service_role can access, not anon)
create policy "Service role access" on projects for all to service_role using (true) with check (true);
create policy "Service role access" on client_accounts for all to service_role using (true) with check (true);
create policy "Service role access" on client_account_projects for all to service_role using (true) with check (true);
create policy "Service role access" on screens for all to service_role using (true) with check (true);
create policy "Service role access" on screenshot_versions for all to service_role using (true) with check (true);
create policy "Service role access" on comments for all to service_role using (true) with check (true);
create policy "Service role access" on replies for all to service_role using (true) with check (true);
create policy "Service role access" on audit_log for all to service_role using (true) with check (true);

-- ============================================
-- STORAGE BUCKET for screenshots
-- ============================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', true, 10485760, '{"image/png","image/jpeg","image/webp","image/gif"}');

create policy "Public read access" on storage.objects for select using (bucket_id = 'screenshots');
create policy "Service role upload" on storage.objects for insert to service_role with check (bucket_id = 'screenshots');
create policy "Service role update" on storage.objects for update to service_role using (bucket_id = 'screenshots') with check (bucket_id = 'screenshots');
create policy "Service role delete" on storage.objects for delete to service_role using (bucket_id = 'screenshots');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at before update on projects
  for each row execute function update_updated_at();
create trigger screens_updated_at before update on screens
  for each row execute function update_updated_at();
create trigger comments_updated_at before update on comments
  for each row execute function update_updated_at();
