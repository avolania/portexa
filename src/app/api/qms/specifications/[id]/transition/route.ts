import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageQms } from '@/lib/qms/permissions';
import { findSpecificationById } from '@/lib/qms/repositories/specification.repo';
import {
  submitForReview,
  approveSpec,
  publishSpec,
  archiveSpec,
} from '@/lib/qms/services/specification.service';

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

  const spec = await findSpecificationById(id);
  if (!spec || spec.org_id !== ctx.orgId) {
    return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  }

  const body = await req.json() as { action: string };
  const { action } = body;

  try {
    let updated;
    switch (action) {
      case 'submit':
        updated = await submitForReview(id, ctx.userId);
        break;
      case 'approve':
        updated = await approveSpec(id, ctx.userId);
        break;
      case 'publish':
        updated = await publishSpec(id, ctx.userId);
        break;
      case 'archive':
        updated = await archiveSpec(id, ctx.userId);
        break;
      default:
        return NextResponse.json({ error: 'Geçersiz aksiyon' }, { status: 400 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
