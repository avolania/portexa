import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectivePermissions } from '@/lib/permissions';
import type { UserRole, Permission } from '@/types';

const BUILTIN_ROLES = [
  'innovation_evaluator', 'innovation_admin', 'business_sponsor',
  'finance', 'pmo_manager', 'executive',
];

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

async function isValidRole(orgId: string, role: string): Promise<boolean> {
  if (BUILTIN_ROLES.includes(role)) return true;

  const { data } = await supabaseAdmin
    .from('innovation_role_definitions')
    .select('role_key')
    .eq('org_id', orgId)
    .eq('role_key', role)
    .eq('is_custom', true)
    .eq('is_active', true)
    .maybeSingle();

  return data !== null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ctx = await getSettingsCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { userId } = await params;

  const { data: target } = await supabaseAdmin
    .from('auth_profiles')
    .select('id')
    .eq('id', userId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.role !== 'string' || !['add', 'remove'].includes(body.action)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const { role, action } = body as { role: string; action: 'add' | 'remove' };

  const valid = await isValidRole(ctx.orgId, role);
  if (!valid) {
    return NextResponse.json({ error: 'Geçersiz rol' }, { status: 400 });
  }

  if (action === 'add') {
    const { error } = await supabaseAdmin
      .from('innovation_user_roles')
      .upsert({ user_id: userId, org_id: ctx.orgId, role }, { onConflict: 'user_id,role' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin
      .from('innovation_user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
