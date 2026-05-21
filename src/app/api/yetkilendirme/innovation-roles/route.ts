import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectivePermissions } from '@/lib/permissions';
import type { UserRole, Permission } from '@/types';
import type { InnovationRole } from '@/lib/innovation/types';

async function getSettingsCtx(req: NextRequest): Promise<
  | { ok: true; orgId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('auth_profiles')
    .select('data, org_id')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) return { ok: false, status: 403 };

  const role = (profile?.data as Record<string, unknown> | null)?.role as UserRole | undefined;
  if (!role) return { ok: false, status: 403 };
  if (!profile?.org_id) return { ok: false, status: 403 };

  const { data: orgPermsRow } = await supabaseAdmin
    .from('org_role_permissions')
    .select('data')
    .eq('org_id', profile.org_id)
    .maybeSingle();

  const overrides = (orgPermsRow?.data ?? null) as Record<UserRole, Permission[]> | null;
  const effectivePerms = resolveEffectivePermissions(role, overrides);
  if (!effectivePerms.includes('settings.manage')) return { ok: false, status: 403 };

  return { ok: true, orgId: profile.org_id as string };
}

export async function GET(req: NextRequest) {
  const ctx = await getSettingsCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { data: profiles, error } = await supabaseAdmin
    .from('auth_profiles')
    .select('id, data')
    .eq('org_id', ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: roleRows } = await supabaseAdmin
    .from('innovation_user_roles')
    .select('user_id, role')
    .eq('org_id', ctx.orgId);

  const roleMap: Record<string, InnovationRole[]> = {};
  for (const row of roleRows ?? []) {
    if (!roleMap[row.user_id]) roleMap[row.user_id] = [];
    roleMap[row.user_id].push(row.role as InnovationRole);
  }

  const users = (profiles ?? []).map((p) => {
    const d = (p.data as Record<string, unknown>) ?? {};
    return {
      id: p.id,
      name: (d.name as string) ?? '',
      email: (d.email as string) ?? '',
      department: (d.department as string | null) ?? null,
      innovation_roles: roleMap[p.id] ?? [],
    };
  });

  return NextResponse.json(users);
}
