import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import { findCapaById, getCapaActions, updateCapa } from '@/lib/qms/repositories/capa.repo';
import type { CAPA } from '@/lib/qms/types';

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
    return NextResponse.json({ ...capa, actions });
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
  const body = await req.json() as Partial<CAPA>;

  try {
    const capa = await findCapaById(id);
    if (!capa || capa.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }

    const allowed: Partial<CAPA> = {};
    if (body.root_cause !== undefined) allowed.root_cause = body.root_cause;
    if (body.root_cause_method !== undefined) allowed.root_cause_method = body.root_cause_method;
    if (body.due_date !== undefined) allowed.due_date = body.due_date;
    if (body.owner_id !== undefined) allowed.owner_id = body.owner_id;

    const updated = await updateCapa(id, allowed);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
