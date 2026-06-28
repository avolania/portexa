import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageQms } from '@/lib/qms/permissions';
import { transitionNcr } from '@/lib/qms/services/quality.service';
import { findNcrById } from '@/lib/qms/repositories/ncr.repo';
import type { NcrDisposition } from '@/lib/qms/types';

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
    action: 'investigate' | 'set_disposition' | 'approve_disposition' | 'link_capa' | 'close' | 'reject';
    disposition?: NcrDisposition;
    capaId?: string;
  };

  if (!body.action) return NextResponse.json({ error: 'Aksiyon gereklidir' }, { status: 400 });

  try {
    const ncr = await findNcrById(id);
    if (!ncr || ncr.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }

    const updated = await transitionNcr(id, ctx.userId, body.action, {
      disposition: body.disposition,
      capaId: body.capaId,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
