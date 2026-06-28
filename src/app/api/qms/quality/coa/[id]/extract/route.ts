import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageQms } from '@/lib/qms/permissions';
import { findCoaById } from '@/lib/qms/repositories/coa.repo';
import { findSpecificationById } from '@/lib/qms/repositories/specification.repo';
import { extractCoaFromPdf } from '@/lib/qms/services/coaExtraction.service';

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
    if (!coa.file_ref) {
      return NextResponse.json({ error: 'COA dosyası henüz yüklenmemiş' }, { status: 400 });
    }

    // Load spec attributes for context
    let specAttributes: string[] = [];
    if (coa.spec_id) {
      const spec = await findSpecificationById(coa.spec_id);
      if (spec) {
        specAttributes = [
          ...Object.keys(spec.physical_chemical ?? {}),
          ...(spec.microbiological ?? []).map((m) =>
            m.organism.toLowerCase().replace(/\s+/g, '_')
          ),
        ];
      }
    }

    const extracted = await extractCoaFromPdf(coa.file_ref, specAttributes);
    return NextResponse.json({ extracted });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
