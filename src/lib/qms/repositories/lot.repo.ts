import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Lot, LotDisposition, CreateLotDto } from '@/lib/qms/types';

export async function findLots(
  orgId: string,
  filters?: { supplierId?: string; status?: string; search?: string }
): Promise<Lot[]> {
  let query = supabaseAdmin
    .from('qms_lots')
    .select('*')
    .eq('org_id', orgId)
    .order('received_date', { ascending: false });

  if (filters?.supplierId) query = query.eq('supplier_id', filters.supplierId);
  if (filters?.status) query = query.eq('disposition', filters.status);
  if (filters?.search) {
    query = query.or(
      `lot_number.ilike.%${filters.search}%,po_number.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Lot[];
}

export async function findLotById(id: string): Promise<Lot | null> {
  const { data, error } = await supabaseAdmin
    .from('qms_lots')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Lot;
}

export async function createLot(
  orgId: string,
  userId: string,
  dto: CreateLotDto
): Promise<Lot> {
  const { data, error } = await supabaseAdmin
    .from('qms_lots')
    .insert({
      org_id: orgId,
      supplier_id: dto.supplier_id,
      spec_id: dto.spec_id ?? null,
      lot_number: dto.lot_number,
      po_number: dto.po_number ?? null,
      received_date: dto.received_date,
      quantity_value: dto.quantity_value ?? null,
      quantity_unit: dto.quantity_unit ?? null,
      disposition: 'pending',
      notes: dto.notes ?? '',
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Lot;
}

export async function updateLotDisposition(
  id: string,
  disposition: LotDisposition
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_lots')
    .update({ disposition, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function findLotsBySupplier(supplierId: string): Promise<Lot[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_lots')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('received_date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Lot[];
}
