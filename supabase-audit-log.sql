-- ============================================================
-- Portexa PPM — Audit Log Migration
-- Supabase SQL Editor'da çalıştırın.
-- Birden fazla çalıştırmak güvenlidir (IF NOT EXISTS).
-- ============================================================

-- ── 1. TABLO ─────────────────────────────────────────────────

create table if not exists audit_logs (
  id            text        primary key,
  org_id        text        not null default '',
  user_id       text        not null default '',
  user_email    text        not null default '',
  action        text        not null,  -- 'user.login', 'project.create', 'team.role_change' ...
  resource_type text        not null default '',  -- 'project', 'task', 'user', 'incident' ...
  resource_id   text        not null default '',
  resource_name text        not null default '',
  changes       jsonb       not null default '{}',  -- { before: {}, after: {} }
  metadata      jsonb       not null default '{}',  -- { ip, userAgent, ... }
  created_at    timestamptz not null default now()
);

-- ── 2. İNDEKSLER ─────────────────────────────────────────────

create index if not exists idx_audit_logs_org_id
  on audit_logs (org_id);

create index if not exists idx_audit_logs_created_at
  on audit_logs (org_id, created_at desc);

create index if not exists idx_audit_logs_user_id
  on audit_logs (org_id, user_id);

create index if not exists idx_audit_logs_action
  on audit_logs (org_id, action);

create index if not exists idx_audit_logs_resource
  on audit_logs (org_id, resource_type, resource_id);

-- ── 3. RLS — APPEND-ONLY ─────────────────────────────────────
-- SELECT: admin ve system_admin okuyabilir
-- INSERT: kimlik doğrulanmış kullanıcılar kendi org'una yazabilir
-- UPDATE: YOK — kimse değiştiremez
-- DELETE: YOK — kimse silemez

alter table audit_logs enable row level security;

drop policy if exists "audit_logs_select" on audit_logs;
drop policy if exists "audit_logs_insert" on audit_logs;

-- Okuma: org üyesi ve admin
create policy "audit_logs_select" on audit_logs for select
  using (audit_logs.org_id = get_my_org_id());

-- Yazma: sadece kendi org_id'sine
create policy "audit_logs_insert" on audit_logs for insert
  with check (audit_logs.org_id = get_my_org_id());

-- ── 4. TTL — 1 YIL SONRA OTOMATİK SİLME ─────────────────────
-- Kurumsal zorunluluk: loglar 1 yıl saklanır, sonra silinir.
-- pg_cron gerektirir (Supabase Pro/Team plan).

-- select cron.schedule(
--   'cleanup-audit-logs',
--   '0 4 * * 0',  -- her Pazar 04:00
--   $$delete from audit_logs where created_at < now() - interval '1 year'$$
-- );

-- ── 5. DOĞRULAMA ─────────────────────────────────────────────
-- select tablename, rowsecurity from pg_tables where tablename = 'audit_logs';
-- select tablename, policyname, cmd from pg_policies where tablename = 'audit_logs';
