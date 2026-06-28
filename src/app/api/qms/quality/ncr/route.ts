import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import { findNcrs } from '@/lib/qms/repositories/ncr.repo';
import { createNcr } from '@/lib/qms/services/quality.service';
import type { CreateNcrDto } from '@/lib/qms/types';

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
  if (!canViewQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const supplierId = searchParams.get('supplierId') ?? undefined;
  const state = searchParams.get('state') ?? undefined;
  const severity = searchParams.get('severity') ?? undefined;
  const search = searchParams.get('search') ?? undefined;

  try {
    const ncrs = await findNcrs(ctx.orgId, { supplierId, state, severity, search });
    return NextResponse.json(ncrs);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dto = await req.json() as CreateNcrDto;
  if (!dto.supplier_id) return NextResponse.json({ error: 'Tedarikçi gereklidir' }, { status: 400 });
  if (!dto.severity) return NextResponse.json({ error: 'Önem derecesi gereklidir' }, { status: 400 });
  if (!dto.description?.trim()) return NextResponse.json({ error: 'Açıklama gereklidir' }, { status: 400 });

  try {
    const ncr = await createNcr(ctx.orgId, ctx.userId, dto);
    return NextResponse.json(ncr, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
