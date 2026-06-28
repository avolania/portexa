import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageQms } from '@/lib/qms/permissions';
import { findCoaById, saveCoaResults } from '@/lib/qms/repositories/coa.repo';
import { compareCoaWithSpec } from '@/lib/qms/services/quality.service';

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as {
    results: Array<{ attribute_key: string; reported_value: string; unit?: string }>;
  };

  if (!Array.isArray(body.results)) {
    return NextResponse.json({ error: 'results array gereklidir' }, { status: 400 });
  }

  try {
    const coa = await findCoaById(id);
    if (!coa || coa.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }

    await saveCoaResults(
      id,
      body.results.map((r) => ({
        attributeKey: r.attribute_key,
        reportedValue: r.reported_value,
        unit: r.unit,
      }))
    );

    const comparison = await compareCoaWithSpec(id);
    return NextResponse.json(comparison);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
