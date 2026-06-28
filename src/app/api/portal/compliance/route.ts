import { NextRequest, NextResponse } from 'next/server';
import { getPortalCtx } from '@/lib/qms/portalAuth';
import { findDocuments } from '@/lib/qms/repositories/document.repo';

export async function GET(req: NextRequest) {
  const ctx = await getPortalCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { org_id: orgId, supplier_id: supplierId } = ctx.user;

  try {
    const docs = await findDocuments(orgId, { supplierId });
    return NextResponse.json(docs);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
