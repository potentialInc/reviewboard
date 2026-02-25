-- Migration: Create all application tables
-- Order: projects → client_accounts → screens → screenshot_versions → comments → replies → audit_log

-- Projects
create table projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) <= 255),
  slack_channel text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Client accounts (auto-provisioned per project)
-- project_id uses SET NULL to prevent deleting a project from nuking client accounts
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

-- Screens (within a project)
create table screens (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null check (char_length(name) <= 255),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Screenshot versions (per screen)
create table screenshot_versions (
  id uuid primary key default uuid_generate_v4(),
  screen_id uuid references screens(id) on delete cascade not null,
  version integer not null default 1,
  image_url text not null,
  created_at timestamptz default now(),
  unique(screen_id, version)
);

-- Comments (pin feedback on a screenshot version)
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

-- Replies (admin/client replies on a comment)
create table replies (
  id uuid primary key default uuid_generate_v4(),
  comment_id uuid references comments(id) on delete cascade not null,
  text text not null check (char_length(text) <= 5000),
  author_type text not null check (author_type in ('admin', 'client')),
  author_id text not null default '',
  created_at timestamptz default now()
);

-- Audit log
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
