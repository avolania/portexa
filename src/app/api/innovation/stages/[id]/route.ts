import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { updateStage, deleteStage } from '@/lib/innovation/repositories/stagesRepo';
import { getInnovContext } from '@/lib/innovation/utils';
import { hasInnovPerm } from '@/lib/innovation/permissions';
import type { UpdateStageDto } from '@/lib/innovation/types';

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string; orgId: string; permissions: Awaited<ReturnType<typeof getInnovContext>>['permissions'] }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const { data: p } = await supabaseAdmin
    .from('auth_profiles').select('org_id').eq('id', user.id).single();
  if (!p?.org_id) return { ok: false, status: 403 };
  const { permissions } = await getInnovContext(user.id, p.org_id as string);
  if (!hasInnovPerm(permissions, 'stages.manage')) return { ok: false, status: 403 };
  return { ok: true, userId: user.id, orgId: p.org_id as string, permissions };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: ctx.status });
  try {
    const dto = await req.json() as UpdateStageDto;
    const stage = await updateStage(id, dto);
    return NextResponse.json(stage);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: ctx.status });
  try {
    await deleteStage(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
