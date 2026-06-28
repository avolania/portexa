import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import {
  findSpecificationById,
  getSpecChanges,
  deleteSpecification,
} from '@/lib/qms/repositories/specification.repo';
import { updateSpec } from '@/lib/qms/services/specification.service';
import type { UpdateSpecDto } from '@/lib/qms/types';

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
    const spec = await findSpecificationById(id);
    if (!spec || spec.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }
    const changes = await getSpecChanges(id);
    return NextResponse.json({ spec, changes });
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

  const spec = await findSpecificationById(id);
  if (!spec || spec.org_id !== ctx.orgId) {
    return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  }
  if (spec.status !== 'draft') {
    return NextResponse.json({ error: 'Yalnızca taslak spesifikasyonlar düzenlenebilir' }, { status: 400 });
  }

  const dto = await req.json() as UpdateSpecDto;

  try {
    const updated = await updateSpec(id, ctx.userId, dto);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const spec = await findSpecificationById(id);
  if (!spec || spec.org_id !== ctx.orgId) {
    return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  }
  if (spec.status !== 'draft') {
    return NextResponse.json({ error: 'Yalnızca taslak spesifikasyonlar silinebilir' }, { status: 400 });
  }

  try {
    await deleteSpecification(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
