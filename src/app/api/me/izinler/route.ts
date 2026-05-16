import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectivePermissions } from '@/lib/permissions';
import type { UserRole, Permission } from '@/types';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('data, org_id')
    .eq('id', user.id)
    .single();

  const role = (profile?.data as Record<string, unknown> | null)?.role as UserRole | undefined;
  if (!role || !profile?.org_id) {
    return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 403 });
  }

  const { data: orgPermsRow } = await supabaseAdmin
    .from('org_role_permissions')
    .select('data')
    .eq('org_id', profile.org_id)
    .maybeSingle();

  const overrides = (orgPermsRow?.data ?? null) as Record<UserRole, Permission[]> | null;
  const effectivePermissions = resolveEffectivePermissions(role, overrides);

  return NextResponse.json({ effectivePermissions });
}
