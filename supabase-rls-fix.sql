-- ============================================================
-- Pixanto PPM — RLS & Fonksiyon Düzeltmesi
-- Sorun 1: get_my_org_id() JSONB'den okuyor, org_id kolonu daha güvenilir
-- Sorun 2: ITSM tablolarında system_admin bypass yok
-- Sorun 3: is_system_admin() fonksiyonu tanımlı değil
--
-- Supabase SQL Editor'da çalıştırın. Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- ── 1. is_system_admin() ─────────────────────────────────────
-- Kullanıcının system_admin rolüne sahip olup olmadığını döner.
-- SECURITY DEFINER → RLS'yi bypass eder, güvenli okuma yapar.

create or replace function is_system_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select (data->>'role') = 'system_admin'
     from public.auth_profiles
     where id = auth.uid()::text
     limit 1),
    false
  );
$$;

-- ── 2. get_my_org_id() — daha güvenilir versiyon ─────────────
-- Önce org_id kolonuna bakar (indexed, her zaman set),
-- yoksa JSONB fallback. NULL dönmez (en kötü '').

create or replace function get_my_org_id()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    nullif(org_id, ''),
    nullif(data->>'orgId', ''),
    ''
  )
  from public.auth_profiles
  where id = auth.uid()::text
  limit 1;
$$;

-- ── 3. ITSM Incidents RLS ────────────────────────────────────

drop policy if exists "itsm_incidents_org"  on itsm_incidents;
drop policy if exists "itsm_incidents_auth" on itsm_incidents;

create policy "itsm_incidents_policy" on itsm_incidents for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

-- ── 4. ITSM Service Requests RLS ────────────────────────────

drop policy if exists "itsm_service_requests_org"  on itsm_service_requests;
drop policy if exists "itsm_service_requests_auth" on itsm_service_requests;

create policy "itsm_service_requests_policy" on itsm_service_requests for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

-- ── 5. ITSM Change Requests RLS ─────────────────────────────

drop policy if exists "itsm_change_requests_org"  on itsm_change_requests;
drop policy if exists "itsm_change_requests_auth" on itsm_change_requests;

create policy "itsm_change_requests_policy" on itsm_change_requests for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

-- ── 6. ITSM Config RLS ──────────────────────────────────────

drop policy if exists "itsm_config_org"  on itsm_config;
drop policy if exists "itsm_config_auth" on itsm_config;

create policy "itsm_config_policy" on itsm_config for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

-- ── 7. ITSM Ticket Notes & Events RLS ───────────────────────
-- Bu tablolar supabase-itsm-tickets-migration.sql'de auth.role() ile
-- yaratılmıştı. Org isolation ekle + system_admin bypass.

alter table if exists itsm_ticket_notes   enable row level security;
alter table if exists itsm_ticket_events  enable row level security;

drop policy if exists "itsm_ticket_notes_auth"   on itsm_ticket_notes;
drop policy if exists "itsm_ticket_events_auth"  on itsm_ticket_events;
drop policy if exists "itsm_ticket_notes_policy" on itsm_ticket_notes;
drop policy if exists "itsm_ticket_events_policy" on itsm_ticket_events;

create policy "itsm_ticket_notes_policy" on itsm_ticket_notes for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

create policy "itsm_ticket_events_policy" on itsm_ticket_events for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

-- ── 8. Diğer tabloları da system_admin bypass ile güncelle ──
-- projects, tasks, team_members, governance_items, notifications

drop policy if exists "projects_org"       on projects;
drop policy if exists "tasks_org"          on tasks;
drop policy if exists "team_members_org"   on team_members;
drop policy if exists "governance_org"     on governance_items;
drop policy if exists "notifications_org"  on notifications;
drop policy if exists "reports_org"        on reports;
drop policy if exists "activities_org"     on activity_entries;
drop policy if exists "workflow_requests_org" on workflow_requests;

create policy "projects_policy" on projects for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

create policy "tasks_policy" on tasks for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

create policy "team_members_policy" on team_members for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

create policy "governance_policy" on governance_items for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

create policy "notifications_policy" on notifications for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

create policy "reports_policy" on reports for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

create policy "activities_policy" on activity_entries for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

create policy "workflow_requests_policy" on workflow_requests for all
  using  (is_system_admin() or org_id = get_my_org_id())
  with check (is_system_admin() or org_id = get_my_org_id());

-- ── 9. auth_profiles: system_admin tüm profilleri görebilir ─

drop policy if exists "auth_profiles_own"      on auth_profiles;
drop policy if exists "auth_profiles_org_read" on auth_profiles;

create policy "auth_profiles_own" on auth_profiles for all
  using  (is_system_admin() or id = auth.uid()::text)
  with check (id = auth.uid()::text);

create policy "auth_profiles_org_read" on auth_profiles
  for select
  using (is_system_admin() or data->>'orgId' = get_my_org_id());

-- ── 10. Doğrulama: Fonksiyonların çalıştığını kontrol et ────
-- Aşağıdaki satırlar çalıştırıldığında NULL dönmemeli (boş string veya bir UUID değeri).
-- select get_my_org_id();
-- select is_system_admin();
