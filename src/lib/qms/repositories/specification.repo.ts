import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  Specification,
  SpecChange,
  ImpactReview,
  CreateSpecDto,
  UpdateSpecDto,
} from '../types';

export async function findSpecifications(
  orgId: string,
  filters?: { type?: string; status?: string; supplierId?: string; search?: string }
): Promise<Specification[]> {
  let query = supabaseAdmin
    .from('qms_specifications')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  if (filters?.type) query = query.eq('type', filters.type);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.supplierId) query = query.eq('supplier_id', filters.supplierId);
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Specification[];
}

export async function findSpecificationById(id: string): Promise<Specification | null> {
  const { data, error } = await supabaseAdmin
    .from('qms_specifications')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Specification;
}

export async function createSpecification(
  orgId: string,
  userId: string,
  dto: CreateSpecDto
): Promise<Specification> {
  const { data, error } = await supabaseAdmin
    .from('qms_specifications')
    .insert({
      org_id: orgId,
      type: dto.type,
      name: dto.name,
      code: dto.code,
      status: 'draft',
      version: 1,
      supplier_id: dto.supplier_id ?? null,
      co_authored_with_supplier: dto.co_authored_with_supplier ?? false,
      organoleptic: dto.organoleptic ?? {},
      physical_chemical: dto.physical_chemical ?? {},
      microbiological: dto.microbiological ?? [],
      nutritional: dto.nutritional ?? null,
      allergens: dto.allergens ?? {},
      shelf_life: dto.shelf_life ?? null,
      storage_conditions: dto.storage_conditions ?? null,
      labeling_regulatory: dto.labeling_regulatory ?? {},
      linked_finished_good_ids: dto.linked_finished_good_ids ?? [],
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Specification;
}

export async function updateSpecification(
  id: string,
  userId: string,
  dto: UpdateSpecDto
): Promise<Specification> {
  const existing = await findSpecificationById(id);
  if (!existing) throw new Error('Spesifikasyon bulunamadı');

  // Build diff
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const trackFields: (keyof UpdateSpecDto)[] = [
    'name', 'code', 'supplier_id', 'co_authored_with_supplier',
    'organoleptic', 'physical_chemical', 'microbiological', 'nutritional',
    'allergens', 'shelf_life', 'storage_conditions', 'labeling_regulatory',
    'linked_finished_good_ids',
  ];

  for (const field of trackFields) {
    if (field in dto && field !== 'change_summary') {
      const oldVal = existing[field as keyof Specification];
      const newVal = dto[field];
      const oldStr = JSON.stringify(oldVal);
      const newStr = JSON.stringify(newVal);
      if (oldStr !== newStr) {
        diff[field] = { from: oldVal, to: newVal };
      }
    }
  }

  const newVersion = existing.version + 1;
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { change_summary, ...updateFields } = dto;

  const { data, error } = await supabaseAdmin
    .from('qms_specifications')
    .update({
      ...updateFields,
      version: newVersion,
      updated_at: now,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Record the change
  await supabaseAdmin.from('qms_spec_changes').insert({
    spec_id: id,
    version: newVersion,
    changed_by: userId,
    changed_at: now,
    summary: dto.change_summary ?? '',
    diff,
  });

  return data as Specification;
}

export async function transitionSpecStatus(
  id: string,
  userId: string,
  action: 'submit' | 'approve' | 'publish' | 'archive' | 'supersede'
): Promise<Specification> {
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = { updated_at: now };

  switch (action) {
    case 'submit':
      updates.status = 'in_review';
      updates.submitted_by = userId;
      updates.submitted_at = now;
      break;
    case 'approve':
      updates.status = 'approved';
      updates.approved_by = userId;
      updates.approved_at = now;
      break;
    case 'publish':
      updates.status = 'published';
      updates.published_by = userId;
      updates.published_at = now;
      break;
    case 'archive':
      updates.status = 'archived';
      break;
    case 'supersede':
      updates.status = 'superseded';
      break;
  }

  const { data, error } = await supabaseAdmin
    .from('qms_specifications')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Specification;
}

export async function getSpecChanges(specId: string): Promise<SpecChange[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_spec_changes')
    .select('*')
    .eq('spec_id', specId)
    .order('version', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SpecChange[];
}

export async function createImpactReviews(
  triggerSpecId: string,
  affectedSpecIds: string[],
  userId: string
): Promise<void> {
  if (affectedSpecIds.length === 0) return;

  const rows = affectedSpecIds.map((affectedId) => ({
    trigger_spec_id: triggerSpecId,
    affected_spec_id: affectedId,
    triggered_by: userId,
    status: 'open',
  }));

  const { error } = await supabaseAdmin.from('qms_impact_reviews').insert(rows);
  if (error) throw new Error(error.message);
}

export async function getImpactReviews(specId: string): Promise<ImpactReview[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_impact_reviews')
    .select('*')
    .eq('trigger_spec_id', specId)
    .eq('status', 'open')
    .order('triggered_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ImpactReview[];
}

export async function resolveImpactReview(
  reviewId: string,
  userId: string,
  status: 'reviewed' | 'dismissed',
  notes?: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_impact_reviews')
    .update({
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      notes: notes ?? '',
    })
    .eq('id', reviewId);

  if (error) throw new Error(error.message);
}

export async function getPendingApprovals(orgId: string): Promise<Specification[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_specifications')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'in_review')
    .order('submitted_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Specification[];
}

export async function deleteSpecification(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_specifications')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
