import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
import type { InnovationRole } from '@/lib/innovation/types';

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string; orgId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const roles = await getInnovationRoles(user.id);
  if (!hasRole(roles, 'innovation_admin')) return { ok: false, status: 403 };
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!profile?.org_id) return { ok: false, status: 403 };
  return { ok: true, userId: user.id, orgId: profile.org_id as string };
}

export async function GET(req: NextRequest) {
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { data: profiles, error } = await supabaseAdmin
    .from('auth_profiles')
    .select('id, data')
    .eq('org_id', ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (profiles ?? []).map((p) => p.id as string);

  if (userIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from('innovation_user_roles')
    .select('user_id, role')
    .in('user_id', userIds);
  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });

  const rolesByUser: Record<string, InnovationRole[]> = {};
  for (const r of roleRows ?? []) {
    const row = r as { user_id: string; role: InnovationRole };
    if (!rolesByUser[row.user_id]) rolesByUser[row.user_id] = [];
    rolesByUser[row.user_id].push(row.role);
  }

  const users = (profiles ?? []).map((row) => {
    const p = row.data as Record<string, unknown>;
    return {
      id: row.id as string,
      name: (p?.name as string) ?? 'Bilinmiyor',
      email: (p?.email as string) ?? '',
      department: (p?.department as string | null) ?? null,
      innovation_roles: rolesByUser[row.id as string] ?? [],
    };
  });

  return NextResponse.json(users);
}
