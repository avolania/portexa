import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getInnovContext, getInnovationRoles } from '@/lib/innovation/utils';
import { hasInnovPerm } from '@/lib/innovation/permissions';

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string; orgId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles').select('org_id').eq('id', user.id).single();
  if (!profile?.org_id) return { ok: false, status: 403 };
  const { permissions } = await getInnovContext(user.id, profile.org_id as string);
  if (!hasInnovPerm(permissions, 'users.manage')) return { ok: false, status: 403 };
  return { ok: true, userId: user.id, orgId: profile.org_id as string };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { id } = await params;

  let body: { role: string; action: 'add' | 'remove' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 });
  }

  if (!body.role || !['add', 'remove'].includes(body.action)) {
    return NextResponse.json({ error: 'Geçersiz rol veya aksiyon' }, { status: 400 });
  }

  const { data: targetRow, error: targetError } = await supabaseAdmin
    .from('auth_profiles').select('org_id, data').eq('id', id).single();
  if (targetError && targetError.code !== 'PGRST116') {
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }
  if (!targetRow || targetRow.org_id !== ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (body.action === 'add') {
    const { error } = await supabaseAdmin
      .from('innovation_user_roles')
      .upsert({ user_id: id, org_id: ctx.orgId, role: body.role }, { onConflict: 'user_id,role' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin
      .from('innovation_user_roles').delete().eq('user_id', id).eq('role', body.role);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updatedRoles = await getInnovationRoles(id);
  const p = targetRow.data as Record<string, unknown>;
  return NextResponse.json({
    id,
    name: (p?.name as string) ?? 'Bilinmiyor',
    email: (p?.email as string) ?? '',
    department: (p?.department as string | null) ?? null,
    innovation_roles: updatedRoles,
  });
}
