import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageQms } from '@/lib/qms/permissions';
import { findInvitesBySupplier } from '@/lib/qms/repositories/supplierPortal.repo';
import { sendInvite } from '@/lib/qms/services/portal.service';
import type { CreateInviteDto } from '@/lib/qms/types';

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
  if (!supplierId) return NextResponse.json({ error: 'supplierId gereklidir' }, { status: 400 });

  try {
    const invites = await findInvitesBySupplier(supplierId);
    return NextResponse.json(invites);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dto = await req.json() as CreateInviteDto;
  if (!dto.supplier_id) return NextResponse.json({ error: 'supplier_id gereklidir' }, { status: 400 });
  if (!dto.email?.trim()) return NextResponse.json({ error: 'E-posta gereklidir' }, { status: 400 });
  if (!dto.name?.trim()) return NextResponse.json({ error: 'Ad gereklidir' }, { status: 400 });

  try {
    const invite = await sendInvite(ctx.orgId, ctx.userId, dto);
    return NextResponse.json(invite, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
