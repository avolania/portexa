import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import { findCapaById, getCapaActions, createCapaAction } from '@/lib/qms/repositories/capa.repo';

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
    const capa = await findCapaById(id);
    if (!capa || capa.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }
    const actions = await getCapaActions(id);
    return NextResponse.json(actions);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as {
    description: string;
    owner_id: string;
    due_date: string;
  };

  if (!body.description?.trim()) return NextResponse.json({ error: 'Açıklama gereklidir' }, { status: 400 });
  if (!body.owner_id) return NextResponse.json({ error: 'Sorumlu gereklidir' }, { status: 400 });
  if (!body.due_date) return NextResponse.json({ error: 'Son tarih gereklidir' }, { status: 400 });

  try {
    const capa = await findCapaById(id);
    if (!capa || capa.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }

    const action = await createCapaAction(id, {
      description: body.description,
      owner_id: body.owner_id,
      due_date: body.due_date,
      status: 'open',
    });
    return NextResponse.json(action, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
