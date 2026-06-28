import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageQms } from '@/lib/qms/permissions';
import {
  findSupplierUsersBySupplier,
  findAllSupplierUsers,
  updateSupplierUser,
} from '@/lib/qms/repositories/supplierPortal.repo';
import type { SupplierPortalRole } from '@/lib/qms/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles').select('org_id, data').eq('id', user.id).single();
  if (!p) return null;
  return { userId: user.id, orgId: p.org_id as string, userRole: (p.data as Record<string, unknown>)?.role as string };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supplierId = req.nextUrl.searchParams.get('supplierId');

  try {
    const users = supplierId
      ? await findSupplierUsersBySupplier(supplierId)
      : await findAllSupplierUsers(ctx.orgId);
    return NextResponse.json(users);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { id: string; role?: SupplierPortalRole; is_active?: boolean };
  if (!body.id) return NextResponse.json({ error: 'id gereklidir' }, { status: 400 });

  try {
    await updateSupplierUser(body.id, {
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
