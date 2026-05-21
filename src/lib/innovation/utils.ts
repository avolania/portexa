import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationRole } from './types';

export function hasRole(
  roles: InnovationRole[] | undefined,
  role: InnovationRole
): boolean {
  return roles?.includes(role) ?? false;
}

export async function getInnovationRoles(userId: string): Promise<InnovationRole[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_user_roles')
    .select('role')
    .eq('user_id', userId);
  if (error) console.error('[getInnovationRoles]', error.message);
  return (data ?? []).map((r) => (r as { role: InnovationRole }).role);
}
