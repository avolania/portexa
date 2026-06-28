import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageQms } from '@/lib/qms/permissions';
import { findDocumentById } from '@/lib/qms/repositories/document.repo';
import { reviewDocument } from '@/lib/qms/services/compliance.service';
import type { ReviewDocumentDto } from '@/lib/qms/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles').select('org_id, data').eq('id', user.id).single();
  if (!p) return null;
  return {
    userId: user.id,
    orgId: p.org_id as string,
    userRole: (p.data as Record<string, unknown>)?.role as string,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const doc = await findDocumentById(id);
    if (!doc || doc.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const dto = await req.json() as ReviewDocumentDto;
    if (!dto.decision || !['approve', 'reject'].includes(dto.decision)) {
      return NextResponse.json({ error: 'Geçerli bir karar belirtiniz (approve/reject)' }, { status: 400 });
    }

    const updated = await reviewDocument(id, ctx.userId, dto);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
