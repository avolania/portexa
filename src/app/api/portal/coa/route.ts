import { NextRequest, NextResponse } from 'next/server';
import { getPortalCtx } from '@/lib/qms/portalAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { COA } from '@/lib/qms/types';

export async function GET(req: NextRequest) {
  const ctx = await getPortalCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { org_id: orgId, supplier_id: supplierId } = ctx.user;

  try {
    const { data, error } = await supabaseAdmin
      .from('qms_coas')
      .select('*')
      .eq('org_id', orgId)
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json((data ?? []) as COA[]);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
