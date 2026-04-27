-- Budget Expenses tablosu
create table if not exists budget_expenses (
  id         text primary key,
  org_id     text not null default '',
  data       jsonb not null default '{}'
);

create index if not exists idx_budget_expenses_org on budget_expenses (org_id);

alter table budget_expenses enable row level security;

create policy "budget_expenses_select"
  on budget_expenses for select
  using (is_system_admin() OR org_id = get_my_org_id());

create policy "budget_expenses_insert"
  on budget_expenses for insert
  with check (is_system_admin() OR org_id = get_my_org_id());

create policy "budget_expenses_update"
  on budget_expenses for update
  using (is_system_admin() OR org_id = get_my_org_id());

create policy "budget_expenses_delete"
  on budget_expenses for delete
  using (is_system_admin() OR org_id = get_my_org_id());

alter publication supabase_realtime add table budget_expenses;
