import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { COA, COAResult, COAFlag, CoaStatus } from '@/lib/qms/types';

export async function findCoasByLot(lotId: string): Promise<COA[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_coas')
    .select('*')
    .eq('lot_id', lotId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as COA[];
}

export async function findCoaById(id: string): Promise<COA | null> {
  const { data, error } = await supabaseAdmin
    .from('qms_coas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as COA;
}

export async function createCoa(
  orgId: string,
  dto: {
    lotId: string;
    supplierId: string;
    specId?: string;
    fileRef?: string;
    fileName?: string;
    submittedBy?: { type: 'internal' | 'supplier'; userId: string };
  }
): Promise<COA> {
  const { data, error } = await supabaseAdmin
    .from('qms_coas')
    .insert({
      org_id: orgId,
      lot_id: dto.lotId,
      supplier_id: dto.supplierId,
      spec_id: dto.specId ?? null,
      file_ref: dto.fileRef ?? null,
      file_name: dto.fileName ?? null,
      submitted_by: dto.submittedBy ?? null,
      status: 'submitted',
      comparison_flags: [],
      ai_extracted: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as COA;
}

export async function saveCoaResults(
  coaId: string,
  results: Array<{ attributeKey: string; reportedValue: string; unit?: string }>
): Promise<void> {
  // Delete existing results first
  await supabaseAdmin.from('qms_coa_results').delete().eq('coa_id', coaId);

  if (results.length === 0) return;

  const rows = results.map((r) => ({
    coa_id: coaId,
    attribute_key: r.attributeKey,
    reported_value: r.reportedValue,
    unit: r.unit ?? null,
  }));

  const { error } = await supabaseAdmin.from('qms_coa_results').insert(rows);
  if (error) throw new Error(error.message);
}

export async function getCoaResults(coaId: string): Promise<COAResult[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_coa_results')
    .select('*')
    .eq('coa_id', coaId);

  if (error) throw new Error(error.message);
  return (data ?? []) as COAResult[];
}

export async function updateCoaComparison(
  coaId: string,
  overall: 'pass' | 'fail' | 'partial',
  flags: COAFlag[]
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_coas')
    .update({
      comparison_overall: overall,
      comparison_flags: flags,
      updated_at: new Date().toISOString(),
    })
    .eq('id', coaId);

  if (error) throw new Error(error.message);
}

export async function updateCoaStatus(coaId: string, status: CoaStatus): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_coas')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', coaId);

  if (error) throw new Error(error.message);
}

export async function linkNcrToCoa(coaId: string, ncrId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_coas')
    .update({ generated_ncr_id: ncrId, updated_at: new Date().toISOString() })
    .eq('id', coaId);

  if (error) throw new Error(error.message);
}

export async function findCoasByOrg(
  orgId: string,
  filters?: { supplierId?: string; status?: string }
): Promise<COA[]> {
  let query = supabaseAdmin
    .from('qms_coas')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (filters?.supplierId) query = query.eq('supplier_id', filters.supplierId);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as COA[];
}

export async function updateCoaFileRef(
  coaId: string,
  fileRef: string,
  fileName: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_coas')
    .update({ file_ref: fileRef, file_name: fileName, updated_at: new Date().toISOString() })
    .eq('id', coaId);

  if (error) throw new Error(error.message);
}
