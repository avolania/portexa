import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import { findSpecificationById, getImpactReviews } from '@/lib/qms/repositories/specification.repo';
import { resolveImpactReview } from '@/lib/qms/services/specification.service';

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

  const spec = await findSpecificationById(id);
  if (!spec || spec.org_id !== ctx.orgId) {
    return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  }

  try {
    const reviews = await getImpactReviews(id);
    return NextResponse.json(reviews);
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

  const body = await req.json() as {
    review_id: string;
    status: 'reviewed' | 'dismissed';
    notes?: string;
  };

  if (!body.review_id) return NextResponse.json({ error: 'review_id zorunludur' }, { status: 400 });
  if (!body.status) return NextResponse.json({ error: 'status zorunludur' }, { status: 400 });

  try {
    await resolveImpactReview(body.review_id, ctx.userId, body.status, body.notes);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
