import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import { findCapas } from '@/lib/qms/repositories/capa.repo';
import { createCapa } from '@/lib/qms/services/quality.service';
import type { CreateCapaDto } from '@/lib/qms/types';

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
  const ncrId = searchParams.get('ncrId') ?? undefined;
  const state = searchParams.get('state') ?? undefined;
  const search = searchParams.get('search') ?? undefined;

  try {
    const capas = await findCapas(ctx.orgId, { ncrId, state, search });
    return NextResponse.json(capas);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dto = await req.json() as CreateCapaDto;
  if (!dto.type) return NextResponse.json({ error: 'CAPA tipi gereklidir' }, { status: 400 });
  if (!dto.owner_id) return NextResponse.json({ error: 'Sorumlu gereklidir' }, { status: 400 });
  if (!dto.due_date) return NextResponse.json({ error: 'Son tarih gereklidir' }, { status: 400 });

  try {
    const capa = await createCapa(ctx.orgId, ctx.userId, dto);
    return NextResponse.json(capa, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
