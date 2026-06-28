import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Supplier, SupplierSite, CreateSupplierDto, UpdateSupplierDto } from '@/lib/qms/types';

export async function findSuppliers(
  orgId: string,
  filters?: { status?: string; search?: string }
): Promise<Supplier[]> {
  let query = supabaseAdmin
    .from('qms_suppliers')
    .select('*')
    .eq('org_id', orgId)
    .order('display_name', { ascending: true });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.search) {
    query = query.or(
      `display_name.ilike.%${filters.search}%,legal_name.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Supplier[];
}

export async function findSupplierById(id: string): Promise<Supplier | null> {
  const { data, error } = await supabaseAdmin
    .from('qms_suppliers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Supplier;
}

export async function createSupplier(
  orgId: string,
  dto: CreateSupplierDto
): Promise<Supplier> {
  const { data, error } = await supabaseAdmin
    .from('qms_suppliers')
    .insert({
      org_id: orgId,
      legal_name: dto.legal_name,
      display_name: dto.display_name,
      status: dto.status ?? 'prospect',
      risk_tier: dto.risk_tier ?? 'medium',
      categories: dto.categories ?? [],
      primary_contact: dto.primary_contact ?? {},
      notes: dto.notes ?? '',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Supplier;
}

export async function updateSupplier(
  id: string,
  updates: UpdateSupplierDto & { updated_at: string }
): Promise<Supplier> {
  const { data, error } = await supabaseAdmin
    .from('qms_suppliers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Supplier;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_suppliers')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function findSitesBySupplier(supplierId: string): Promise<SupplierSite[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_supplier_sites')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierSite[];
}

export async function createSite(
  supplierId: string,
  siteData: Omit<SupplierSite, 'id' | 'supplier_id' | 'created_at'>
): Promise<SupplierSite> {
  const { data, error } = await supabaseAdmin
    .from('qms_supplier_sites')
    .insert({
      supplier_id: supplierId,
      name: siteData.name,
      address: siteData.address ?? {},
      country: siteData.country ?? '',
      gfsi_certified: siteData.gfsi_certified ?? false,
      gfsi_scheme: siteData.gfsi_scheme ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SupplierSite;
}

export async function updateSite(
  id: string,
  siteData: Partial<Omit<SupplierSite, 'id' | 'supplier_id' | 'created_at'>>
): Promise<SupplierSite> {
  const { data, error } = await supabaseAdmin
    .from('qms_supplier_sites')
    .update(siteData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SupplierSite;
}

export async function deleteSite(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_supplier_sites')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
