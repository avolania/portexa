import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageQms } from '@/lib/qms/permissions';
import { findCoaById, updateCoaFileRef } from '@/lib/qms/repositories/coa.repo';

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

  try {
    const coa = await findCoaById(id);
    if (!coa || coa.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Dosya gereklidir' }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${ctx.orgId}/coa/${id}/${timestamp}_${safeFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('qms-documents')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Yükleme hatası: ${uploadError.message}` }, { status: 500 });
    }

    await updateCoaFileRef(id, filePath, file.name);

    return NextResponse.json({ file_ref: filePath, file_name: file.name });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
