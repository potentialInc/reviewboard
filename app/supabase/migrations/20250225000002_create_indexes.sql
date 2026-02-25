-- Migration: Create performance indexes

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
