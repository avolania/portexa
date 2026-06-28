import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import { findLots } from '@/lib/qms/repositories/lot.repo';
import { receiveLot } from '@/lib/qms/services/quality.service';
import type { CreateLotDto } from '@/lib/qms/types';

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
  const status = searchParams.get('disposition') ?? undefined;
  const search = searchParams.get('search') ?? undefined;

  try {
    const lots = await findLots(ctx.orgId, { supplierId, status, search });
    return NextResponse.json(lots);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dto = await req.json() as CreateLotDto;
  if (!dto.supplier_id) return NextResponse.json({ error: 'Tedarikçi gereklidir' }, { status: 400 });
  if (!dto.lot_number?.trim()) return NextResponse.json({ error: 'Lot numarası gereklidir' }, { status: 400 });
  if (!dto.received_date) return NextResponse.json({ error: 'Teslim tarihi gereklidir' }, { status: 400 });

  try {
    const lot = await receiveLot(ctx.orgId, ctx.userId, dto);
    return NextResponse.json(lot, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
