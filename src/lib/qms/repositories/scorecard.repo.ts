import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Scorecard } from '@/lib/qms/types';

function getPeriodDateRange(period: string): { start: string; end: string } {
  // period format: "2026-Q2"
  const [yearStr, quarter] = period.split('-');
  const year = parseInt(yearStr, 10);
  const q = parseInt(quarter.replace('Q', ''), 10);

  const startMonth = (q - 1) * 3; // 0-indexed months: Q1=0,Q2=3,Q3=6,Q4=9
  const endMonth = startMonth + 2;

  const start = new Date(year, startMonth, 1).toISOString().split('T')[0];
  const lastDay = new Date(year, endMonth + 1, 0); // last day of endMonth
  const end = lastDay.toISOString().split('T')[0];

  return { start, end };
}

function getPreviousPeriod(period: string): string {
  const [yearStr, quarter] = period.split('-');
  const year = parseInt(yearStr, 10);
  const q = parseInt(quarter.replace('Q', ''), 10);

  if (q === 1) return `${year - 1}-Q4`;
  return `${year}-Q${q - 1}`;
}

export async function findScorecard(
  orgId: string,
  supplierId: string,
  period: string
): Promise<Scorecard | null> {
  const { data, error } = await supabaseAdmin
    .from('qms_scorecards')
    .select('*')
    .eq('org_id', orgId)
    .eq('supplier_id', supplierId)
    .eq('period', period)
    .single();

  if (error) return null;
  return data as Scorecard;
}

export async function upsertScorecard(
  orgId: string,
  supplierId: string,
  period: string,
  scoreData: Partial<Scorecard>
): Promise<Scorecard> {
  const { data, error } = await supabaseAdmin
    .from('qms_scorecards')
    .upsert(
      {
        org_id: orgId,
        supplier_id: supplierId,
        period,
        ...scoreData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,supplier_id,period' }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Scorecard;
}

export async function computeScorecard(
  orgId: string,
  supplierId: string,
  period: string
): Promise<Scorecard> {
  const { start, end } = getPeriodDateRange(period);

  // Lots for this period
  const { data: lots } = await supabaseAdmin
    .from('qms_lots')
    .select('id, disposition')
    .eq('org_id', orgId)
    .eq('supplier_id', supplierId)
    .gte('received_date', start)
    .lte('received_date', end);

  const totalLots = lots?.length ?? 0;
  const acceptedLots = lots?.filter((l) => l.disposition === 'accepted').length ?? 0;
  const qualityAcceptanceRate = totalLots > 0 ? (acceptedLots / totalLots) * 100 : null;

  // NCR count for this period
  const { count: ncrCount } = await supabaseAdmin
    .from('qms_ncrs')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('supplier_id', supplierId)
    .gte('created_at', `${start}T00:00:00Z`)
    .lte('created_at', `${end}T23:59:59Z`);

  const ncrCountVal = ncrCount ?? 0;
  const ncrRatePerLot = totalLots > 0 ? ncrCountVal / totalLots : null;

  // Doc compliance: approved / total for supplier
  const { count: totalDocs } = await supabaseAdmin
    .from('qms_compliance_documents')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('supplier_id', supplierId);

  const { count: approvedDocs } = await supabaseAdmin
    .from('qms_compliance_documents')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('supplier_id', supplierId)
    .eq('status', 'approved');

  const docCompliancePct =
    (totalDocs ?? 0) > 0 ? ((approvedDocs ?? 0) / (totalDocs ?? 1)) * 100 : null;

  // Determine rating based on quality_acceptance_rate
  let rating: 'A' | 'B' | 'C' | 'D' | null = null;
  if (qualityAcceptanceRate !== null) {
    if (qualityAcceptanceRate > 90) rating = 'A';
    else if (qualityAcceptanceRate > 75) rating = 'B';
    else if (qualityAcceptanceRate > 60) rating = 'C';
    else rating = 'D';
  }

  // Trend: compare with previous period
  const prevPeriod = getPreviousPeriod(period);
  const { data: prevScorecard } = await supabaseAdmin
    .from('qms_scorecards')
    .select('rating')
    .eq('org_id', orgId)
    .eq('supplier_id', supplierId)
    .eq('period', prevPeriod)
    .single();

  const ratingOrder: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
  let trend: 'up' | 'flat' | 'down' | null = null;
  if (rating && prevScorecard?.rating) {
    const curr = ratingOrder[rating] ?? 0;
    const prev = ratingOrder[prevScorecard.rating] ?? 0;
    if (curr > prev) trend = 'up';
    else if (curr < prev) trend = 'down';
    else trend = 'flat';
  }

  const scoreData: Partial<Scorecard> = {
    quality_acceptance_rate: qualityAcceptanceRate,
    doc_compliance_pct: docCompliancePct,
    ncr_count: ncrCountVal,
    ncr_rate_per_lot: ncrRatePerLot,
    rating,
    trend,
    on_time_delivery_pct: null,
    capa_closure_on_time_pct: null,
    avg_capa_close_days: null,
    notes: '',
  };

  return upsertScorecard(orgId, supplierId, period, scoreData);
}

export async function findScorecardsByPeriod(
  orgId: string,
  period: string
): Promise<Scorecard[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_scorecards')
    .select('*')
    .eq('org_id', orgId)
    .eq('period', period)
    .order('rating', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Scorecard[];
}
