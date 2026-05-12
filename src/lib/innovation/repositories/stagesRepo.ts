import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationStage } from '../types';

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
