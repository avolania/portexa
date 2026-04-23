-- Custom Reports tablosu
-- Her kullanıcının kendi rapor konfigürasyonlarını kaydetmesini sağlar

create table if not exists custom_reports (
  id         text primary key,
  org_id     text not null default '',
  created_by text not null default '',  -- auth.uid()
  data       jsonb not null default '{}'
);

create index if not exists idx_custom_reports_org    on custom_reports (org_id);
create index if not exists idx_custom_reports_user   on custom_reports (created_by);

-- RLS
alter table custom_reports enable row level security;

-- Kullanıcı kendi org'undaki tüm raporları görebilir
create policy "custom_reports_select"
  on custom_reports for select
  using (is_system_admin() OR org_id = get_my_org_id());

-- Ekleme ve güncelleme: sadece kendi oluşturduklarını
create policy "custom_reports_insert"
  on custom_reports for insert
  with check (is_system_admin() OR (org_id = get_my_org_id() AND created_by = auth.uid()::text));

create policy "custom_reports_update"
  on custom_reports for update
  using (is_system_admin() OR (org_id = get_my_org_id() AND created_by = auth.uid()::text));

create policy "custom_reports_delete"
  on custom_reports for delete
  using (is_system_admin() OR (org_id = get_my_org_id() AND created_by = auth.uid()::text));

-- Realtime
alter publication supabase_realtime add table custom_reports;
