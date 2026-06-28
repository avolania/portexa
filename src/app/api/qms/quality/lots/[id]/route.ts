import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import { findLotById, updateLotDisposition } from '@/lib/qms/repositories/lot.repo';
import type { LotDisposition } from '@/lib/qms/types';

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canViewQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const lot = await findLotById(id);
    if (!lot || lot.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }
    return NextResponse.json(lot);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { disposition?: LotDisposition };

  try {
    const lot = await findLotById(id);
    if (!lot || lot.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }

    if (body.disposition) {
      await updateLotDisposition(id, body.disposition);
    }

    const updated = await findLotById(id);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
