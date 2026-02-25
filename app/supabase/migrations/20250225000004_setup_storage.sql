-- Migration: Create storage bucket for screenshots

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', true, 10485760, '{"image/png","image/jpeg","image/webp","image/gif"}');

create policy "Public read access" on storage.objects for select using (bucket_id = 'screenshots');
create policy "Service role upload" on storage.objects for insert to service_role with check (bucket_id = 'screenshots');
create policy "Service role update" on storage.objects for update to service_role using (bucket_id = 'screenshots') with check (bucket_id = 'screenshots');
create policy "Service role delete" on storage.objects for delete to service_role using (bucket_id = 'screenshots');
