import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationPoc, PocUpdate, CreatePocDto, UpdatePocDto, PocStatus } from '../types';

const mapProfile = (p: Record<string, unknown> | null | undefined) =>
  p ? ((p.data as Record<string, unknown>)?.name ?? 'Bilinmiyor') as string : undefined;

export async function findPocs(params: {
  orgId: string;
  status?: string;
  ideaId?: string;
}): Promise<InnovationPoc[]> {
  let query = supabaseAdmin
    .from('innovation_pocs')
    .select(`
      *,
      owner:auth_profiles!innovation_pocs_owner_id_fkey(id, data),
      sponsor:auth_profiles!innovation_pocs_sponsor_id_fkey(id, data),
      idea:innovation_ideas!innovation_pocs_idea_id_fkey(id, title)
    `)
    .eq('org_id', params.orgId)
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.ideaId) query = query.eq('idea_id', params.ideaId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...row,
    owner_name: mapProfile(row.owner as Record<string, unknown>),
    sponsor_name: mapProfile(row.sponsor as Record<string, unknown>),
    idea_title: (row.idea as Record<string, unknown> | null)?.title as string | undefined,
  })) as unknown as InnovationPoc[];
}

export async function findPocById(id: string): Promise<InnovationPoc | null> {
  const { data, error } = await supabaseAdmin
    .from('innovation_pocs')
    .select(`
      *,
      owner:auth_profiles!innovation_pocs_owner_id_fkey(id, data),
      sponsor:auth_profiles!innovation_pocs_sponsor_id_fkey(id, data),
      idea:innovation_ideas!innovation_pocs_idea_id_fkey(id, title),
      innovation_poc_updates(
        *,
        author:auth_profiles!innovation_poc_updates_author_id_fkey(id, data)
      )
    `)
    .eq('id', id)
    .single();

  if (error) return null;

  const row = data as Record<string, unknown>;
  return {
    ...row,
    owner_name: mapProfile(row.owner as Record<string, unknown>),
    sponsor_name: mapProfile(row.sponsor as Record<string, unknown>),
    idea_title: (row.idea as Record<string, unknown> | null)?.title as string | undefined,
    updates: ((row.innovation_poc_updates ?? []) as Record<string, unknown>[]).map((u) => ({
      ...u,
      author_name: mapProfile(u.author as Record<string, unknown>),
    })),
  } as unknown as InnovationPoc;
}

export async function findActivePocByIdeaId(ideaId: string): Promise<InnovationPoc | null> {
  const { data } = await supabaseAdmin
    .from('innovation_pocs')
    .select('id, status')
    .eq('idea_id', ideaId)
    .not('status', 'in', '("completed","cancelled")')
    .maybeSingle();
  return data as InnovationPoc | null;
}

export async function createPoc(params: {
  orgId: string;
  dto: CreatePocDto;
}): Promise<InnovationPoc> {
  const { data, error } = await supabaseAdmin
    .from('innovation_pocs')
    .insert({
      id: crypto.randomUUID(),
      org_id: params.orgId,
      idea_id: params.dto.idea_id,
      title: params.dto.title,
      owner_id: params.dto.owner_id,
      sponsor_id: params.dto.sponsor_id ?? null,
      status: 'draft' as PocStatus,
      budget: params.dto.budget ?? null,
      goals: params.dto.goals ?? null,
      success_criteria: params.dto.success_criteria ?? null,
      notes: params.dto.notes ?? null,
      start_date: params.dto.start_date ?? null,
      end_date: params.dto.end_date ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as InnovationPoc;
}

export async function updatePoc(id: string, dto: UpdatePocDto): Promise<void> {
  const ALLOWED = new Set([
    'title', 'owner_id', 'sponsor_id', 'budget',
    'goals', 'success_criteria', 'notes', 'start_date', 'end_date',
  ]);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(dto)) {
    if (ALLOWED.has(k)) patch[k] = v;
  }
  const { error } = await supabaseAdmin
    .from('innovation_pocs')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updatePocStatus(id: string, status: PocStatus): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_pocs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function addPocUpdate(params: {
  pocId: string;
  authorId: string;
  content: string;
}): Promise<PocUpdate> {
  const { data, error } = await supabaseAdmin
    .from('innovation_poc_updates')
    .insert({
      id: crypto.randomUUID(),
      poc_id: params.pocId,
      author_id: params.authorId,
      content: params.content,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as PocUpdate;
}
