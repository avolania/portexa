import { NextRequest, NextResponse } from 'next/server';
import { getPortalCtx } from '@/lib/qms/portalAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getPortalCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (ctx.user.role === 'viewer') {
    return NextResponse.json({ error: 'Görüntüleyici dosya yükleyemez' }, { status: 403 });
  }

  const { id: ncrId } = await params;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${ctx.user.org_id}/ncr-responses/${ncrId}/${timestamp}_${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from('qms-documents')
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    return NextResponse.json({ ref: path, name: file.name });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
