import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import {
  findScorecard,
  findScorecardsByPeriod,
  computeScorecard,
} from '@/lib/qms/repositories/scorecard.repo';

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

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canViewQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const supplierId = searchParams.get('supplierId');
  const period = searchParams.get('period');

  try {
    if (supplierId && period) {
      const scorecard = await findScorecard(ctx.orgId, supplierId, period);
      return NextResponse.json(scorecard ?? null);
    } else if (period) {
      const scorecards = await findScorecardsByPeriod(ctx.orgId, period);
      return NextResponse.json(scorecards);
    }
    return NextResponse.json({ error: 'period parametresi gereklidir' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { supplierId?: string; period: string };

  if (!body.period) return NextResponse.json({ error: 'Dönem gereklidir' }, { status: 400 });

  try {
    if (body.supplierId) {
      // Compute for a single supplier
      const scorecard = await computeScorecard(ctx.orgId, body.supplierId, body.period);
      return NextResponse.json(scorecard, { status: 201 });
    } else {
      // Compute for all suppliers in this org
      const { data: suppliers } = await supabaseAdmin
        .from('qms_suppliers')
        .select('id')
        .eq('org_id', ctx.orgId);

      const scorecards = await Promise.all(
        (suppliers ?? []).map((s: { id: string }) =>
          computeScorecard(ctx.orgId, s.id, body.period)
        )
      );
      return NextResponse.json(scorecards, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
