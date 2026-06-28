import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import { findNcrById, updateNcr } from '@/lib/qms/repositories/ncr.repo';
import type { NCR } from '@/lib/qms/types';

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
    const ncr = await findNcrById(id);
    if (!ncr || ncr.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }
    return NextResponse.json(ncr);
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
  const body = await req.json() as Partial<NCR>;

  try {
    const ncr = await findNcrById(id);
    if (!ncr || ncr.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }

    // Only allow updating metadata fields, not state/workflow fields
    const allowed: Partial<NCR> = {};
    if (body.description !== undefined) allowed.description = body.description;
    if (body.assignee_id !== undefined) allowed.assignee_id = body.assignee_id;
    if (body.category !== undefined) allowed.category = body.category;
    if (body.cost_recovery_amount !== undefined) allowed.cost_recovery_amount = body.cost_recovery_amount;
    if (body.cost_recovery_currency !== undefined) allowed.cost_recovery_currency = body.cost_recovery_currency;
    if (body.cost_recovery_status !== undefined) allowed.cost_recovery_status = body.cost_recovery_status;

    const updated = await updateNcr(id, allowed);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
