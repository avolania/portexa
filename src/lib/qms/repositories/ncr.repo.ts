import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { NCR, NcrState, NcrDisposition, CreateNcrDto } from '@/lib/qms/types';

export async function findNcrs(
  orgId: string,
  filters?: { supplierId?: string; state?: string; severity?: string; search?: string }
): Promise<NCR[]> {
  let query = supabaseAdmin
    .from('qms_ncrs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (filters?.supplierId) query = query.eq('supplier_id', filters.supplierId);
  if (filters?.state) query = query.eq('state', filters.state);
  if (filters?.severity) query = query.eq('severity', filters.severity);
  if (filters?.search) {
    query = query.or(
      `ncr_number.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as NCR[];
}

export async function findNcrById(id: string): Promise<NCR | null> {
  const { data, error } = await supabaseAdmin
    .from('qms_ncrs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as NCR;
}

export async function createNcr(
  orgId: string,
  userId: string,
  dto: CreateNcrDto
): Promise<NCR> {
  const year = new Date().getFullYear();
  const { count } = await supabaseAdmin
    .from('qms_ncrs')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);
  const num = String((count ?? 0) + 1).padStart(4, '0');
  const ncr_number = `NCR-${year}-${num}`;

  const { data, error } = await supabaseAdmin
    .from('qms_ncrs')
    .insert({
      org_id: orgId,
      source: dto.source,
      supplier_id: dto.supplier_id,
      lot_id: dto.lot_id ?? null,
      coa_id: dto.coa_id ?? null,
      spec_id: dto.spec_id ?? null,
      ncr_number,
      category: dto.category ?? 'quality',
      severity: dto.severity,
      description: dto.description,
      state: 'open',
      assignee_id: dto.assignee_id ?? null,
      cost_recovery_currency: 'USD',
      cost_recovery_status: 'pending',
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as NCR;
}

export async function transitionNcr(
  id: string,
  state: NcrState,
  updates?: Partial<NCR>
): Promise<NCR> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('qms_ncrs')
    .update({ state, ...updates, updated_at: now })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as NCR;
}

export async function updateNcrDisposition(
  id: string,
  disposition: NcrDisposition
): Promise<NCR> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('qms_ncrs')
    .update({ disposition, state: 'disposition_pending', updated_at: now })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as NCR;
}

export async function linkCapaToNcr(ncrId: string, capaId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('qms_ncrs')
    .update({ state: 'capa_linked', updated_at: now })
    .eq('id', ncrId);

  if (error) throw new Error(error.message);

  // Also update the capa's ncr_id if not already set
  await supabaseAdmin
    .from('qms_capas')
    .update({ ncr_id: ncrId, updated_at: now })
    .eq('id', capaId)
    .is('ncr_id', null);
}

export async function findNcrsByCapa(capaId: string): Promise<NCR[]> {
  // Find the capa first to get its ncr_id
  const { data: capa } = await supabaseAdmin
    .from('qms_capas')
    .select('ncr_id')
    .eq('id', capaId)
    .single();

  if (!capa?.ncr_id) return [];

  const { data, error } = await supabaseAdmin
    .from('qms_ncrs')
    .select('*')
    .eq('id', capa.ncr_id);

  if (error) throw new Error(error.message);
  return (data ?? []) as NCR[];
}

export async function updateNcr(
  id: string,
  updates: Partial<NCR>
): Promise<NCR> {
  const { data, error } = await supabaseAdmin
    .from('qms_ncrs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as NCR;
}
