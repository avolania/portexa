import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import { findSpecifications } from '@/lib/qms/repositories/specification.repo';
import { createSpec } from '@/lib/qms/services/specification.service';
import type { CreateSpecDto } from '@/lib/qms/types';

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
  const type = searchParams.get('type') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const search = searchParams.get('search') ?? undefined;
  const supplierId = searchParams.get('supplier_id') ?? undefined;

  try {
    const specs = await findSpecifications(ctx.orgId, { type, status, supplierId, search });
    return NextResponse.json(specs);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dto = await req.json() as CreateSpecDto;
  if (!dto.type) return NextResponse.json({ error: 'Tip zorunludur' }, { status: 400 });
  if (!dto.name?.trim()) return NextResponse.json({ error: 'Ad zorunludur' }, { status: 400 });
  if (!dto.code?.trim()) return NextResponse.json({ error: 'Kod zorunludur' }, { status: 400 });

  try {
    const spec = await createSpec(ctx.orgId, ctx.userId, dto);
    return NextResponse.json(spec, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
