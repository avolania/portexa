import { NextRequest, NextResponse } from 'next/server';
import { getPortalCtx } from '@/lib/qms/portalAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Scorecard } from '@/lib/qms/types';

export async function GET(req: NextRequest) {
  const ctx = await getPortalCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { org_id: orgId, supplier_id: supplierId } = ctx.user;

  try {
    const { data, error } = await supabaseAdmin
      .from('qms_scorecards')
      .select('*')
      .eq('org_id', orgId)
      .eq('supplier_id', supplierId)
      .order('period', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return NextResponse.json(data as Scorecard | null);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
