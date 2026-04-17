-- ============================================================
-- Portexa PPM — Supabase Schema + RLS Policies (Multi-tenant)
-- Supabase SQL Editor'da çalıştırın.
-- Birden fazla çalıştırmak güvenlidir (IF NOT EXISTS + DROP IF EXISTS).
-- ============================================================

-- ── 1. TABLOLAR ─────────────────────────────────────────────

-- auth_profiles: eski şema (email primary key) varsa yeniden oluştur
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'auth_profiles'
      and column_name = 'id'
  ) then
    drop table if exists public.auth_profiles;
  end if;
end $$;

create table if not exists auth_profiles (
  id   text primary key,
  data jsonb not null default '{}'
);

create table if not exists projects (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists tasks (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists team_members (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists governance_items (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists notifications (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists reports (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists activity_entries (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists file_folders (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists project_files (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists workflow_requests (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists workflow_templates (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

-- org_settings: id = orgId (org başına bir satır)
create table if not exists org_settings (
  id   text primary key,
  data jsonb not null default '{}'
);

-- Davet tablosu: service_role ile yönetilir
create table if not exists org_invitations (
  id          text primary key,
  org_id      text not null,
  email       text not null,
  token       text not null unique,
  invited_by  text not null,
  org_name    text not null default '',
  expires_at  timestamptz not null,
  accepted    boolean not null default false
);

-- ── 2. org_id KOLON EKLEMESİ (varsa atla) ───────────────────

do $$
declare
  tbl text;
  tbls text[] := array[
    'projects','tasks','team_members','governance_items',
    'notifications','reports','activity_entries',
    'file_folders','project_files',
    'workflow_requests','workflow_templates'
  ];
begin
  foreach tbl in array tbls loop
    if not exists (
      select 1 from information_schema.columns
      where table_name = tbl and column_name = 'org_id'
    ) then
      execute format('alter table %I add column org_id text not null default ''''', tbl);
    end if;
  end loop;
end $$;

-- ── 3. RLS ETKİNLEŞTİR ──────────────────────────────────────

alter table auth_profiles      enable row level security;
alter table projects           enable row level security;
alter table tasks              enable row level security;
alter table team_members       enable row level security;
alter table governance_items   enable row level security;
alter table notifications      enable row level security;
alter table reports            enable row level security;
alter table activity_entries   enable row level security;
alter table file_folders       enable row level security;
alter table project_files      enable row level security;
alter table workflow_requests  enable row level security;
alter table workflow_templates enable row level security;
alter table org_settings       enable row level security;
alter table org_invitations    enable row level security;

-- ── 4. HELPER FONKSİYON ─────────────────────────────────────
-- Security definer: RLS'yi bypass ederek orgId okur (sonsuz döngüyü önler)

create or replace function get_my_org_id()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select data->>'orgId' from public.auth_profiles where id = auth.uid()::text limit 1;
$$;

-- ── 5. POLİTİKALAR ──────────────────────────────────────────

-- 5a. auth_profiles
drop policy if exists "auth_profiles_own"      on auth_profiles;
drop policy if exists "auth_profiles_org_read" on auth_profiles;

create policy "auth_profiles_own" on auth_profiles
  for all
  using  (auth_profiles.id = auth.uid()::text)
  with check (auth_profiles.id = auth.uid()::text);

create policy "auth_profiles_org_read" on auth_profiles
  for select
  using (auth_profiles.data->>'orgId' = get_my_org_id());

-- 5b. org_settings
drop policy if exists "org_settings_all" on org_settings;
create policy "org_settings_all" on org_settings for all
  using  (org_settings.id = get_my_org_id())
  with check (org_settings.id = get_my_org_id());

-- 5c. org_invitations
drop policy if exists "org_invitations_admin" on org_invitations;
create policy "org_invitations_admin" on org_invitations
  for select
  using (org_invitations.org_id = get_my_org_id());

-- 5d. Diğer tüm tablolar
drop policy if exists "projects_org"           on projects;
drop policy if exists "projects_all"           on projects;
drop policy if exists "tasks_org"              on tasks;
drop policy if exists "tasks_all"              on tasks;
drop policy if exists "team_members_org"       on team_members;
drop policy if exists "team_members_all"       on team_members;
drop policy if exists "governance_items_org"   on governance_items;
drop policy if exists "governance_items_all"   on governance_items;
drop policy if exists "notifications_org"      on notifications;
drop policy if exists "notifications_all"      on notifications;
drop policy if exists "reports_org"            on reports;
drop policy if exists "reports_all"            on reports;
drop policy if exists "activity_entries_org"   on activity_entries;
drop policy if exists "activity_entries_all"   on activity_entries;
drop policy if exists "file_folders_org"       on file_folders;
drop policy if exists "file_folders_all"       on file_folders;
drop policy if exists "project_files_org"      on project_files;
drop policy if exists "project_files_all"      on project_files;
drop policy if exists "workflow_requests_org"  on workflow_requests;
drop policy if exists "workflow_requests_all"  on workflow_requests;
drop policy if exists "workflow_templates_org" on workflow_templates;
drop policy if exists "workflow_templates_all" on workflow_templates;

create policy "projects_org" on projects for all
  using  (projects.org_id = get_my_org_id())
  with check (projects.org_id = get_my_org_id());

create policy "tasks_org" on tasks for all
  using  (tasks.org_id = get_my_org_id())
  with check (tasks.org_id = get_my_org_id());

create policy "team_members_org" on team_members for all
  using  (team_members.org_id = get_my_org_id())
  with check (team_members.org_id = get_my_org_id());

create policy "governance_items_org" on governance_items for all
  using  (governance_items.org_id = get_my_org_id())
  with check (governance_items.org_id = get_my_org_id());

create policy "notifications_org" on notifications for all
  using  (notifications.org_id = get_my_org_id())
  with check (notifications.org_id = get_my_org_id());

create policy "reports_org" on reports for all
  using  (reports.org_id = get_my_org_id())
  with check (reports.org_id = get_my_org_id());

create policy "activity_entries_org" on activity_entries for all
  using  (activity_entries.org_id = get_my_org_id())
  with check (activity_entries.org_id = get_my_org_id());

create policy "file_folders_org" on file_folders for all
  using  (file_folders.org_id = get_my_org_id())
  with check (file_folders.org_id = get_my_org_id());

create policy "project_files_org" on project_files for all
  using  (project_files.org_id = get_my_org_id())
  with check (project_files.org_id = get_my_org_id());

create policy "workflow_requests_org" on workflow_requests for all
  using  (workflow_requests.org_id = get_my_org_id())
  with check (workflow_requests.org_id = get_my_org_id());

create policy "workflow_templates_org" on workflow_templates for all
  using  (workflow_templates.org_id = get_my_org_id())
  with check (workflow_templates.org_id = get_my_org_id());

-- ── 5. STORAGE RLS ──────────────────────────────────────────
-- project-files bucket önce Storage sekmesinden oluşturun:
--   Name: project-files  |  Public: true

-- Bucket'ı Supabase Dashboard → Storage → project-files → Edit → Public: OFF yapın.

drop policy if exists "storage_select" on storage.objects;
drop policy if exists "storage_insert" on storage.objects;
drop policy if exists "storage_update" on storage.objects;
drop policy if exists "storage_delete" on storage.objects;

create policy "storage_select" on storage.objects
  for select using (
    bucket_id = 'project-files'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = get_my_org_id()
  );

create policy "storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = get_my_org_id()
  );

create policy "storage_update" on storage.objects
  for update using (
    bucket_id = 'project-files'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = get_my_org_id()
  );

create policy "storage_delete" on storage.objects
  for delete using (
    bucket_id = 'project-files'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = get_my_org_id()
  );

-- ── 6. ORG_ID INDEXES ────────────────────────────────────────────────────────
-- Her tablonun org_id kolonuna index — full table scan yerine index scan.

create index if not exists idx_auth_profiles_org      on auth_profiles      (org_id);
create index if not exists idx_projects_org            on projects            (org_id);
create index if not exists idx_tasks_org               on tasks               (org_id);
create index if not exists idx_team_members_org        on team_members        (org_id);
create index if not exists idx_governance_items_org    on governance_items    (org_id);
create index if not exists idx_notifications_org       on notifications       (org_id);
create index if not exists idx_reports_org             on reports             (org_id);
create index if not exists idx_activity_entries_org    on activity_entries    (org_id);
create index if not exists idx_file_folders_org        on file_folders        (org_id);
create index if not exists idx_project_files_org       on project_files       (org_id);
create index if not exists idx_workflow_requests_org   on workflow_requests   (org_id);
create index if not exists idx_workflow_templates_org  on workflow_templates  (org_id);
create index if not exists idx_org_invitations_org     on org_invitations     (org_id);
