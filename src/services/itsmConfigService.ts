import { supabase } from '@/lib/supabase';
import { DEFAULT_ITSM_CONFIG } from '@/lib/itsm/types/config.types';
import type { ITSMConfig } from '@/lib/itsm/types/config.types';

const TABLE = 'itsm_config';

export async function loadITSMConfig(orgId: string): Promise<ITSMConfig> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('id', orgId)
    .single();
  if (error || !data) return { ...DEFAULT_ITSM_CONFIG };
  return data.data as ITSMConfig;
}

export async function saveITSMConfig(config: ITSMConfig, orgId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert([{ id: orgId, data: config, org_id: orgId }], { defaultToNull: false });
  if (error) throw new Error(error.message);
}
