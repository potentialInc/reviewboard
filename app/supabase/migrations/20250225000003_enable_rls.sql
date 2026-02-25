-- Migration: Enable Row Level Security
-- All tables restricted to service_role only (no anon access).

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
