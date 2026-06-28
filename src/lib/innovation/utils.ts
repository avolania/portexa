import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationRole } from './types';
import {
  resolveInnovPermissions,
  INNOV_ROLE_PERM_DEFAULTS,
  type InnovationPermission,
} from './permissions';

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

export async function getInnovContext(
  userId: string,
  orgId: string
): Promise<{ roles: string[]; permissions: Set<InnovationPermission> }> {
  // Run both queries in parallel — second no longer depends on first
  const [rolesResult, defsResult] = await Promise.all([
    supabaseAdmin.from('innovation_user_roles').select('role').eq('user_id', userId),
    supabaseAdmin.from('innovation_role_definitions').select('role_key, permissions').eq('org_id', orgId),
  ]);

  const roles = (rolesResult.data ?? []).map((r) => (r as { role: string }).role);
  const roleSet = new Set(roles);

  const rolePermsMap = new Map<string, InnovationPermission[]>();
  for (const row of defsResult.data ?? []) {
    if (!roleSet.has(row.role_key as string)) continue;
    const perms = row.permissions as InnovationPermission[] | null;
    if (Array.isArray(perms) && perms.length > 0) {
      rolePermsMap.set(row.role_key as string, perms);
    }
  }

  const permissions = resolveInnovPermissions(roles, rolePermsMap);
  return { roles, permissions };
}

// Convenience: resolve permissions without a DB call (uses defaults only).
// Used in services that already have roles but no orgId available.
export function resolveDefaultPermissions(roles: string[]): Set<InnovationPermission> {
  const map = new Map<string, InnovationPermission[]>();
  for (const role of roles) {
    if (INNOV_ROLE_PERM_DEFAULTS[role]) {
      map.set(role, INNOV_ROLE_PERM_DEFAULTS[role]);
    }
  }
  return resolveInnovPermissions(roles, map);
}
