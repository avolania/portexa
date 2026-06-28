import { NextRequest, NextResponse } from 'next/server';
import { getPortalCtx } from '@/lib/qms/portalAuth';
import { findNcrs } from '@/lib/qms/repositories/ncr.repo';
import { getNcrResponses } from '@/lib/qms/repositories/supplierPortal.repo';

const ACTIVE_STATES = ['open', 'investigating', 'disposition_pending', 'capa_linked'];

export async function GET(req: NextRequest) {
  const ctx = await getPortalCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { org_id: orgId, supplier_id: supplierId } = ctx.user;
  const stateFilter = req.nextUrl.searchParams.get('state') ?? undefined;

  try {
    const allNcrs = await findNcrs(orgId, { supplierId, state: stateFilter });
    const ncrs = stateFilter
      ? allNcrs
      : allNcrs.filter(n => ACTIVE_STATES.includes(n.state));

    // Add response count
    const withCounts = await Promise.all(
      ncrs.map(async (ncr) => {
        const responses = await getNcrResponses(ncr.id);
        return { ...ncr, response_count: responses.length };
      })
    );

    return NextResponse.json(withCounts);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
