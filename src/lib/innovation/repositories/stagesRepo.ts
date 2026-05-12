import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationStage, CreateStageDto, UpdateStageDto } from '../types';

export async function findAllStages(): Promise<InnovationStage[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_stages')
    .select('*')
    .eq('is_active', true)
    .order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []) as InnovationStage[];
}

export async function findStageById(id: string): Promise<InnovationStage | null> {
  const { data, error } = await supabaseAdmin
    .from('innovation_stages')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as InnovationStage;
}

export async function findAllStagesAdmin(): Promise<InnovationStage[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_stages')
    .select('*')
    .order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []) as InnovationStage[];
}

export async function createStage(dto: CreateStageDto): Promise<InnovationStage> {
  const { data: maxRow } = await supabaseAdmin
    .from('innovation_stages')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single();
  const nextOrder = ((maxRow as { order_index: number } | null)?.order_index ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from('innovation_stages')
    .insert({
      id: crypto.randomUUID(),
      order_index: nextOrder,
      name: dto.name,
      color: dto.color,
      min_score_to_advance: dto.min_score_to_advance,
      required_evaluations: dto.required_evaluations,
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as InnovationStage;
}

export async function updateStage(id: string, dto: UpdateStageDto): Promise<InnovationStage> {
  const { data, error } = await supabaseAdmin
    .from('innovation_stages')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as InnovationStage;
}

export async function deleteStage(id: string): Promise<void> {
  const { count } = await supabaseAdmin
    .from('innovation_ideas')
    .select('id', { count: 'exact', head: true })
    .eq('stage_id', id);
  if (count && count > 0) throw new Error('Bu aşamada fikir var, silinemez');
  const { error } = await supabaseAdmin
    .from('innovation_stages')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
