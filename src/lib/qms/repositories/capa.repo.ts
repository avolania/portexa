import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { CAPA, CAPAAction, CapaState, CreateCapaDto } from '@/lib/qms/types';

export async function findCapas(
  orgId: string,
  filters?: { ncrId?: string; state?: string; search?: string }
): Promise<CAPA[]> {
  let query = supabaseAdmin
    .from('qms_capas')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (filters?.ncrId) query = query.eq('ncr_id', filters.ncrId);
  if (filters?.state) query = query.eq('state', filters.state);
  if (filters?.search) {
    query = query.or(
      `capa_number.ilike.%${filters.search}%,root_cause.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CAPA[];
}

export async function findCapaById(id: string): Promise<CAPA | null> {
  const { data, error } = await supabaseAdmin
    .from('qms_capas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as CAPA;
}

export async function createCapa(
  orgId: string,
  userId: string,
  dto: CreateCapaDto
): Promise<CAPA> {
  const year = new Date().getFullYear();
  const { count } = await supabaseAdmin
    .from('qms_capas')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);
  const num = String((count ?? 0) + 1).padStart(4, '0');
  const capa_number = `CAPA-${year}-${num}`;

  const { data, error } = await supabaseAdmin
    .from('qms_capas')
    .insert({
      org_id: orgId,
      ncr_id: dto.ncr_id ?? null,
      capa_number,
      type: dto.type,
      root_cause: dto.root_cause ?? null,
      root_cause_method: dto.root_cause_method ?? null,
      state: 'draft',
      owner_id: dto.owner_id,
      due_date: dto.due_date,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  const capa = data as CAPA;

  // Create actions if provided
  if (dto.actions && dto.actions.length > 0) {
    const actionRows = dto.actions.map((a) => ({
      capa_id: capa.id,
      description: a.description,
      owner_id: a.owner_id,
      due_date: a.due_date,
      status: 'open',
    }));
    await supabaseAdmin.from('qms_capa_actions').insert(actionRows);
  }

  return capa;
}

export async function transitionCapa(
  id: string,
  state: CapaState,
  updates?: Partial<CAPA>
): Promise<CAPA> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('qms_capas')
    .update({ state, ...updates, updated_at: now })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CAPA;
}

export async function getCapaActions(capaId: string): Promise<CAPAAction[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_capa_actions')
    .select('*')
    .eq('capa_id', capaId)
    .order('due_date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CAPAAction[];
}

export async function createCapaAction(
  capaId: string,
  actionData: Omit<CAPAAction, 'id' | 'capa_id'>
): Promise<CAPAAction> {
  const { data, error } = await supabaseAdmin
    .from('qms_capa_actions')
    .insert({
      capa_id: capaId,
      description: actionData.description,
      owner_id: actionData.owner_id,
      due_date: actionData.due_date,
      status: actionData.status ?? 'open',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CAPAAction;
}

export async function updateCapaAction(
  id: string,
  status: 'open' | 'done' | 'verified'
): Promise<CAPAAction> {
  const { data, error } = await supabaseAdmin
    .from('qms_capa_actions')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CAPAAction;
}

export async function deleteCapaAction(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_capa_actions')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function updateCapa(
  id: string,
  updates: Partial<CAPA>
): Promise<CAPA> {
  const { data, error } = await supabaseAdmin
    .from('qms_capas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CAPA;
}
