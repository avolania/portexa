import { NextRequest, NextResponse } from 'next/server';
import { getPortalCtx } from '@/lib/qms/portalAuth';
import { findNcrById } from '@/lib/qms/repositories/ncr.repo';
import { getNcrResponses } from '@/lib/qms/repositories/supplierPortal.repo';
import { respondToNcr } from '@/lib/qms/services/portal.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getPortalCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const ncr = await findNcrById(id);
    // Bulunamadı ve erişim yok durumu aynı 404 → UUID enumeration engellenir
    if (!ncr || ncr.supplier_id !== ctx.user.supplier_id) {
      return NextResponse.json({ error: 'NCR bulunamadı' }, { status: 404 });
    }

    const responses = await getNcrResponses(id);
    return NextResponse.json({ ncr, responses });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getPortalCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (ctx.user.role === 'viewer') {
    return NextResponse.json({ error: 'Görüntüleyici yanıt ekleyemez' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { response_text: string; attachments?: Array<{ name: string; ref: string }> };

  if (!body.response_text?.trim()) {
    return NextResponse.json({ error: 'Yanıt metni gereklidir' }, { status: 400 });
  }

  try {
    const response = await respondToNcr(id, ctx.user, body.response_text, body.attachments);
    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
