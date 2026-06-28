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

  const { id: coaId } = await params;

  // Validate COA belongs to this supplier
  const { data: coa, error: coaErr } = await supabaseAdmin
    .from('qms_coas')
    .select('id, supplier_id, org_id')
    .eq('id', coaId)
    .single();

  if (coaErr || !coa) return NextResponse.json({ error: 'COA bulunamadı' }, { status: 404 });
  if (coa.supplier_id !== ctx.user.supplier_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${ctx.user.org_id}/coa/${coaId}/${timestamp}_${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from('qms-documents')
      .upload(path, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    // Update COA record with file ref
    const { error: updateError } = await supabaseAdmin
      .from('qms_coas')
      .update({
        file_ref: path,
        file_name: file.name,
        submitted_by: { type: 'supplier', userId: ctx.user.id },
        updated_at: new Date().toISOString(),
      })
      .eq('id', coaId);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ ref: path, name: file.name });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
