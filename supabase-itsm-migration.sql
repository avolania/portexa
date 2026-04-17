-- ============================================================
-- Portexa PPM — ITSM Module Migration
-- Supabase SQL Editor'da çalıştırın.
-- Birden fazla çalıştırmak güvenlidir (IF NOT EXISTS + DROP IF EXISTS).
-- Önce: supabase-setup.sql çalıştırılmış olmalı (get_my_org_id fonksiyonu gerekli).
-- ============================================================

-- ── 1. TABLOLAR ─────────────────────────────────────────────

create table if not exists itsm_incidents (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists itsm_service_requests (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

create table if not exists itsm_change_requests (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

-- ── 2. org_id KOLON EKLEMESİ (varsa atla) ───────────────────

do $$
declare
  tbl text;
  tbls text[] := array[
    'itsm_incidents',
    'itsm_service_requests',
    'itsm_change_requests'
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

-- ── 3. PERFORMANS İNDEKSLERİ ────────────────────────────────

create index if not exists idx_itsm_incidents_org_id
  on itsm_incidents (org_id);

create index if not exists idx_itsm_incidents_state
  on itsm_incidents ((data->>'state'));

create index if not exists idx_itsm_incidents_priority
  on itsm_incidents ((data->>'priority'));

create index if not exists idx_itsm_incidents_assigned_to
  on itsm_incidents ((data->>'assignedToId'));

create index if not exists idx_itsm_service_requests_org_id
  on itsm_service_requests (org_id);

create index if not exists idx_itsm_service_requests_state
  on itsm_service_requests ((data->>'state'));

create index if not exists idx_itsm_service_requests_assigned_to
  on itsm_service_requests ((data->>'assignedToId'));

create index if not exists idx_itsm_change_requests_org_id
  on itsm_change_requests (org_id);

create index if not exists idx_itsm_change_requests_state
  on itsm_change_requests ((data->>'state'));

create index if not exists idx_itsm_change_requests_change_manager
  on itsm_change_requests ((data->>'changeManagerId'));

-- ── 4. RLS ETKİNLEŞTİR ──────────────────────────────────────

alter table itsm_incidents        enable row level security;
alter table itsm_service_requests enable row level security;
alter table itsm_change_requests  enable row level security;

-- ── 5. POLİTİKALAR ──────────────────────────────────────────
-- get_my_org_id() fonksiyonu supabase-setup.sql'den geliyor.

drop policy if exists "itsm_incidents_org"        on itsm_incidents;
drop policy if exists "itsm_service_requests_org" on itsm_service_requests;
drop policy if exists "itsm_change_requests_org"  on itsm_change_requests;

create policy "itsm_incidents_org" on itsm_incidents for all
  using  (itsm_incidents.org_id = get_my_org_id())
  with check (itsm_incidents.org_id = get_my_org_id());

create policy "itsm_service_requests_org" on itsm_service_requests for all
  using  (itsm_service_requests.org_id = get_my_org_id())
  with check (itsm_service_requests.org_id = get_my_org_id());

create policy "itsm_change_requests_org" on itsm_change_requests for all
  using  (itsm_change_requests.org_id = get_my_org_id())
  with check (itsm_change_requests.org_id = get_my_org_id());

-- ── 6. ITSM CONFIG TABLOSU ───────────────────────────────────

create table if not exists itsm_config (
  id     text primary key,   -- org_id ile aynı
  org_id text not null default '',
  data   jsonb not null default '{}'
);

alter table itsm_config enable row level security;

drop policy if exists "itsm_config_org" on itsm_config;

create policy "itsm_config_org" on itsm_config for all
  using  (itsm_config.org_id = get_my_org_id())
  with check (itsm_config.org_id = get_my_org_id());

-- ── 7. MEVCUT VERİ DÜZELTMESİ (org_id backfill) ────────────────────────────
-- Eğer tablolarda org_id = '' olan mevcut kayıtlar varsa (migration öncesi
-- eklenenler), bunları kullanıcının auth profili üzerinden düzeltir.
-- NOT: Bu işlem yalnızca tek org'lu kurulumlar için güvenlidir.
--      Birden fazla org varsa her org için ayrıca çalıştırın.

do $$
declare
  target_org_id text;
begin
  -- Auth profiles'daki ilk org_id'yi al
  select data->>'orgId' into target_org_id
  from public.auth_profiles
  where data->>'orgId' is not null and data->>'orgId' != ''
  limit 1;

  if target_org_id is not null then
    update itsm_incidents        set org_id = target_org_id where org_id = '';
    update itsm_service_requests set org_id = target_org_id where org_id = '';
    update itsm_change_requests  set org_id = target_org_id where org_id = '';
    update itsm_config           set org_id = target_org_id where org_id = '';
    raise notice 'org_id backfill tamamlandı: %', target_org_id;
  else
    raise notice 'Uyarı: auth_profiles içinde org_id bulunamadı, backfill atlandı.';
  end if;
end $$;

-- ── 8. ORG_ID INDEXES ────────────────────────────────────────────────────────

create index if not exists idx_itsm_incidents_org         on itsm_incidents        (org_id);
create index if not exists idx_itsm_service_requests_org  on itsm_service_requests (org_id);
create index if not exists idx_itsm_change_requests_org   on itsm_change_requests  (org_id);
create index if not exists idx_itsm_config_org            on itsm_config           (org_id);

-- ── 9. DOĞRULAMA ─────────────────────────────────────────────
-- Aşağıdaki sorgu tablolar ve politikaların doğru oluşturulduğunu gösterir:
--
-- select tablename, rowsecurity
-- from pg_tables
-- where tablename in ('itsm_incidents','itsm_service_requests','itsm_change_requests','itsm_config');
--
-- select tablename, policyname
-- from pg_policies
-- where tablename in ('itsm_incidents','itsm_service_requests','itsm_change_requests','itsm_config');
--
-- Mevcut kayıtların org_id kontrolü:
-- select id, org_id from itsm_incidents limit 10;
-- select id, org_id from itsm_service_requests limit 10;
-- select id, org_id from itsm_change_requests limit 10;
