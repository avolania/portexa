import { supabase } from '@/lib/supabase';
import { dbLoadAll } from '@/lib/db';
import { DEFAULT_ITSM_CONFIG } from '@/lib/itsm/types/config.types';
import type { ITSMConfig } from '@/lib/itsm/types/config.types';

const TABLE = 'itsm_config';

export async function loadITSMConfig(orgId: string): Promise<ITSMConfig> {
  const all = await dbLoadAll<ITSMConfig>(TABLE);
  return all[0] ?? { ...DEFAULT_ITSM_CONFIG };
}

export async function saveITSMConfig(config: ITSMConfig, orgId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert([{ id: orgId, data: config, org_id: orgId }], { defaultToNull: false });
  if (error) throw new Error(error.message);
}
