import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectivePermissions } from '@/lib/permissions';
import { INNOV_ROLE_PERM_DEFAULTS, type InnovationPermission } from '@/lib/innovation/permissions';
import type { UserRole, Permission } from '@/types';

interface RoleDef {
  role_key: string;
  label: string;
  description: string;
  color: string;
  bg: string;
  is_custom: boolean;
  is_active: boolean;
  order_index: number;
  permissions: InnovationPermission[];
}

const BUILTIN_DEFAULTS: RoleDef[] = [
  { role_key: 'innovation_admin',     label: 'İnovasyon Admin',  description: 'Tüm inovasyon işlemlerini yönetir',    color: 'text-violet-700', bg: 'bg-violet-100', is_custom: false, is_active: true, order_index: 0, permissions: INNOV_ROLE_PERM_DEFAULTS['innovation_admin'] ?? [] },
  { role_key: 'business_sponsor',     label: 'Business Sponsor', description: 'POC başlatma ve tamamlama onayı',       color: 'text-blue-700',   bg: 'bg-blue-100',   is_custom: false, is_active: true, order_index: 1, permissions: INNOV_ROLE_PERM_DEFAULTS['business_sponsor'] ?? [] },
  { role_key: 'innovation_evaluator', label: 'Değerlendirici',   description: 'Fikirleri puanlar ve değerlendirir',   color: 'text-green-700',  bg: 'bg-green-100',  is_custom: false, is_active: true, order_index: 2, permissions: INNOV_ROLE_PERM_DEFAULTS['innovation_evaluator'] ?? [] },
  { role_key: 'finance',              label: 'Finans',            description: 'Bütçe onaylama ve finansal analiz',    color: 'text-amber-700',  bg: 'bg-amber-100',  is_custom: false, is_active: true, order_index: 3, permissions: INNOV_ROLE_PERM_DEFAULTS['finance'] ?? [] },
  { role_key: 'pmo_manager',          label: 'PMO Yöneticisi',   description: 'Proje portföy yönetimi',               color: 'text-indigo-700', bg: 'bg-indigo-100', is_custom: false, is_active: true, order_index: 4, permissions: INNOV_ROLE_PERM_DEFAULTS['pmo_manager'] ?? [] },
  { role_key: 'executive',            label: 'Yönetici',          description: 'Üst düzey görüntüleme ve onaylama',   color: 'text-gray-700',   bg: 'bg-gray-100',   is_custom: false, is_active: true, order_index: 5, permissions: INNOV_ROLE_PERM_DEFAULTS['executive'] ?? [] },
];

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
  if (!profile) return { ok: false, status: 403 };

  const role = (profile.data as Record<string, unknown>)?.role as UserRole;
  if (!role || !profile.org_id) return { ok: false, status: 403 };

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

// GET — list all roles (built-in defaults merged with DB overrides + custom)
export async function GET(req: NextRequest) {
  const ctx = await getSettingsCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { data: dbRows } = await supabaseAdmin
    .from('innovation_role_definitions')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('order_index');

  const dbMap = new Map((dbRows ?? []).map((r) => [r.role_key as string, r]));
  const builtinKeys = new Set(BUILTIN_DEFAULTS.map((r) => r.role_key));

  const result: RoleDef[] = BUILTIN_DEFAULTS.map((r) => {
    const ov = dbMap.get(r.role_key);
    if (!ov) return r;
    const dbPerms = ov.permissions;
    return {
      ...r,
      label: ov.label as string,
      description: ov.description as string,
      color: ov.color as string,
      bg: ov.bg as string,
      permissions: (Array.isArray(dbPerms) && dbPerms.length > 0)
        ? dbPerms as InnovationPermission[]
        : r.permissions,
    };
  });

  for (const row of dbRows ?? []) {
    if (!(row.is_custom as boolean) || builtinKeys.has(row.role_key as string)) continue;
    if (!(row.is_active as boolean)) continue;
    const dbPerms = row.permissions;
    result.push({
      role_key: row.role_key as string,
      label: row.label as string,
      description: row.description as string,
      color: row.color as string,
      bg: row.bg as string,
      is_custom: true,
      is_active: true,
      order_index: row.order_index as number,
      permissions: (Array.isArray(dbPerms) ? dbPerms : []) as InnovationPermission[],
    });
  }

  return NextResponse.json(result);
}

// POST — create a new custom role
export async function POST(req: NextRequest) {
  const ctx = await getSettingsCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.label !== 'string' || !body.label.trim()) {
    return NextResponse.json({ error: 'Rol adı gerekli' }, { status: 400 });
  }

  const label = (body.label as string).trim();
  const slug = `custom_${label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 28)}_${Date.now().toString(36)}`;

  const { data: lastRow } = await supabaseAdmin
    .from('innovation_role_definitions')
    .select('order_index')
    .eq('org_id', ctx.orgId)
    .order('order_index', { ascending: false })
    .limit(1);

  const nextOrder = ((lastRow?.[0]?.order_index as number | undefined) ?? 5) + 1;

  const newRole = {
    org_id: ctx.orgId,
    role_key: slug,
    label,
    description: typeof body.description === 'string' ? body.description : '',
    color: typeof body.color === 'string' ? body.color : 'text-gray-700',
    bg: typeof body.bg === 'string' ? body.bg : 'bg-gray-100',
    is_custom: true,
    is_active: true,
    order_index: nextOrder,
    permissions: Array.isArray(body.permissions) ? body.permissions : [],
  };

  const { error } = await supabaseAdmin.from('innovation_role_definitions').insert(newRole);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(newRole);
}

// PATCH — update role metadata (both built-in and custom)
export async function PATCH(req: NextRequest) {
  const ctx = await getSettingsCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.role_key !== 'string') {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const { role_key, label, description, color, bg } = body as Record<string, string>;
  const permissions = Array.isArray(body.permissions) ? body.permissions as InnovationPermission[] : undefined;

  const builtin = BUILTIN_DEFAULTS.find((r) => r.role_key === role_key);
  if (builtin) {
    const upsertData: Record<string, unknown> = {
      org_id: ctx.orgId,
      role_key,
      label: label ?? builtin.label,
      description: description ?? builtin.description,
      color: color ?? builtin.color,
      bg: bg ?? builtin.bg,
      is_custom: false,
      is_active: true,
      order_index: builtin.order_index,
      updated_at: new Date().toISOString(),
    };
    if (permissions !== undefined) upsertData.permissions = permissions;
    const { error } = await supabaseAdmin
      .from('innovation_role_definitions')
      .upsert(upsertData, { onConflict: 'org_id,role_key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (label !== undefined) updates.label = label;
  if (description !== undefined) updates.description = description;
  if (color !== undefined) updates.color = color;
  if (bg !== undefined) updates.bg = bg;
  if (permissions !== undefined) updates.permissions = permissions;

  const { error } = await supabaseAdmin
    .from('innovation_role_definitions')
    .update(updates)
    .eq('org_id', ctx.orgId)
    .eq('role_key', role_key)
    .eq('is_custom', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove a custom role (only if no users assigned)
export async function DELETE(req: NextRequest) {
  const ctx = await getSettingsCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { searchParams } = new URL(req.url);
  const role_key = searchParams.get('role_key');
  if (!role_key) return NextResponse.json({ error: 'role_key gerekli' }, { status: 400 });

  const { data: roleDef } = await supabaseAdmin
    .from('innovation_role_definitions')
    .select('is_custom')
    .eq('org_id', ctx.orgId)
    .eq('role_key', role_key)
    .single();

  if (!roleDef?.is_custom) {
    return NextResponse.json({ error: 'Yerleşik roller silinemez' }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from('innovation_user_roles')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId)
    .eq('role', role_key);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Bu role atanmış kullanıcılar var. Önce kullanıcıları çıkarın.' },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin
    .from('innovation_role_definitions')
    .delete()
    .eq('org_id', ctx.orgId)
    .eq('role_key', role_key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
