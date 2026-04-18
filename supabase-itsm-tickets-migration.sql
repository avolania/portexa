-- ============================================================
-- Pixanto ITSM — Ticket Notes, Events & Workflow Instances
-- Supabase SQL Editor'da çalıştırın.
-- Birden fazla çalıştırmak güvenlidir (IF NOT EXISTS).
-- ============================================================

-- ── 1. TICKET NOTES (çalışma notları + müşteri yorumları) ────

create table if not exists itsm_ticket_notes (
  id          text primary key,
  ticket_id   text not null,
  ticket_type text not null,
  note_type   text not null,
  org_id      text not null default '',
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists idx_itsm_ticket_notes_ticket     on itsm_ticket_notes (ticket_id);
create index if not exists idx_itsm_ticket_notes_org        on itsm_ticket_notes (org_id);
create index if not exists idx_itsm_ticket_notes_org_ticket on itsm_ticket_notes (org_id, ticket_id);

alter table itsm_ticket_notes enable row level security;

drop policy if exists "itsm_ticket_notes_auth" on itsm_ticket_notes;
create policy "itsm_ticket_notes_auth" on itsm_ticket_notes
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── 2. TICKET EVENTS (zaman çizelgesi) ───────────────────────

create table if not exists itsm_ticket_events (
  id          text primary key,
  ticket_id   text not null,
  ticket_type text not null,
  org_id      text not null default '',
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists idx_itsm_ticket_events_ticket     on itsm_ticket_events (ticket_id);
create index if not exists idx_itsm_ticket_events_org        on itsm_ticket_events (org_id);
create index if not exists idx_itsm_ticket_events_org_ticket on itsm_ticket_events (org_id, ticket_id);

alter table itsm_ticket_events enable row level security;

drop policy if exists "itsm_ticket_events_auth" on itsm_ticket_events;
create policy "itsm_ticket_events_auth" on itsm_ticket_events
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── 3. WORKFLOW INSTANCES ─────────────────────────────────────

create table if not exists workflow_instances (
  id     text primary key,
  org_id text not null default '',
  data   jsonb not null default '{}'
);

-- Varolan tabloya org_id eksikse ekle
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'workflow_instances'
      and column_name  = 'org_id'
  ) then
    alter table workflow_instances add column org_id text not null default '';
  end if;
end $$;

create index if not exists idx_workflow_instances_org on workflow_instances (org_id);

alter table workflow_instances enable row level security;

drop policy if exists "authenticated"          on workflow_instances;
drop policy if exists "workflow_instances_org"  on workflow_instances;
drop policy if exists "workflow_instances_auth" on workflow_instances;

create policy "workflow_instances_auth" on workflow_instances
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── 4. DOĞRULAMA ─────────────────────────────────────────────
-- select tablename, rowsecurity from pg_tables
-- where tablename in ('itsm_ticket_notes','itsm_ticket_events','workflow_instances');
--
-- select tablename, policyname from pg_policies
-- where tablename in ('itsm_ticket_notes','itsm_ticket_events','workflow_instances');
