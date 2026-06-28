import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import { findDocuments } from '@/lib/qms/repositories/document.repo';
import { requestDocument } from '@/lib/qms/services/compliance.service';
import type { CreateDocumentDto } from '@/lib/qms/types';

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

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canViewQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const supplierId = searchParams.get('supplierId') ?? undefined;
  const type = searchParams.get('type') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const expiringWithinStr = searchParams.get('expiringWithin');
  const expiringWithin = expiringWithinStr ? parseInt(expiringWithinStr) : undefined;

  try {
    const docs = await findDocuments(ctx.orgId, { supplierId, type, status, expiringWithin });
    return NextResponse.json(docs);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dto = await req.json() as CreateDocumentDto;
  if (!dto.supplier_id) return NextResponse.json({ error: 'Tedarikçi zorunludur' }, { status: 400 });
  if (!dto.type) return NextResponse.json({ error: 'Doküman tipi zorunludur' }, { status: 400 });
  if (!dto.title?.trim()) return NextResponse.json({ error: 'Başlık zorunludur' }, { status: 400 });

  try {
    const doc = await requestDocument(ctx.orgId, ctx.userId, dto);
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
