import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageQms } from '@/lib/qms/permissions';
import { findCapaById, updateCapaAction, deleteCapaAction } from '@/lib/qms/repositories/capa.repo';

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, actionId } = await params;
  const body = await req.json() as { status: 'open' | 'done' | 'verified' };

  if (!body.status) return NextResponse.json({ error: 'Durum gereklidir' }, { status: 400 });

  try {
    const capa = await findCapaById(id);
    if (!capa || capa.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'CAPA bulunamadı' }, { status: 404 });
    }

    const updated = await updateCapaAction(actionId, body.status);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, actionId } = await params;

  try {
    const capa = await findCapaById(id);
    if (!capa || capa.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'CAPA bulunamadı' }, { status: 404 });
    }

    await deleteCapaAction(actionId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
