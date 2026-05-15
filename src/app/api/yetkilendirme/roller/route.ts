import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ROLE_PERMISSIONS } from '@/lib/permissions';
import type { UserRole, Permission } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES: UserRole[] = [
  'system_admin', 'admin', 'pm', 'member', 'approver', 'viewer', 'end_user',
];

const ALL_PERMISSIONS = new Set<string>(
  (Object.values(ROLE_PERMISSIONS) as Permission[][]).flat()
);

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getSettingsCtx(req: NextRequest): Promise<
  | { ok: true; orgId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };

  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('data, org_id')
    .eq('id', user.id)
    .single();

  const role = (profile?.data as Record<string, unknown> | null)?.role as string | undefined;
  if (role !== 'admin' && role !== 'system_admin') return { ok: false, status: 403 };
  if (!profile?.org_id) return { ok: false, status: 403 };

  return { ok: true, orgId: profile.org_id as string };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ctx = await getSettingsCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { data } = await supabaseAdmin
    .from('org_role_permissions')
    .select('data')
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  const overrides = (data?.data ?? {}) as Record<string, Permission[]>;

  const permissions: Record<string, Permission[]> = {};
  const customized: string[] = [];

  for (const role of ALL_ROLES) {
    if (overrides[role]) {
      permissions[role] = overrides[role];
      customized.push(role);
    } else {
      permissions[role] = [...ROLE_PERMISSIONS[role]];
    }
  }

  return NextResponse.json({ permissions, customized });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const ctx = await getSettingsCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.role !== 'string') {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const { role, permissions } = body as { role: string; permissions: unknown };

  if (!ALL_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: 'Geçersiz rol' }, { status: 400 });
  }

  if (role === 'system_admin' && permissions !== null) {
    return NextResponse.json({ error: 'system_admin rolü düzenlenemez' }, { status: 400 });
  }

  if (permissions !== null) {
    if (
      !Array.isArray(permissions) ||
      (permissions as unknown[]).some((p) => !ALL_PERMISSIONS.has(p as string))
    ) {
      return NextResponse.json({ error: 'Geçersiz yetki listesi' }, { status: 400 });
    }
  }

  // Fetch or initialize the org's override row
  const { data: existing } = await supabaseAdmin
    .from('org_role_permissions')
    .select('id, data')
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  const current = (existing?.data ?? {}) as Record<string, unknown>;

  if (permissions === null) {
    delete current[role];
  } else {
    current[role] = permissions;
  }

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from('org_role_permissions')
      .update({ data: current, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin
      .from('org_role_permissions')
      .insert({ org_id: ctx.orgId, data: current });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
