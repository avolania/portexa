import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationStats } from '@/lib/innovation/types';

async function getAuthContext(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id, innovation_role')
    .eq('id', user.id)
    .single();
  if (!profile) return null;
  return {
    userId: user.id,
    orgId: profile.org_id as string,
    innovationRole: (profile.innovation_role ?? null) as string | null,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    totalRes, monthRes, underReviewRes, implementedRes,
    stageCountsRes, stagesRes, topIdeasRes,
    recentHistoryRes, recentIdeasRes,
  ] = await Promise.all([
    supabaseAdmin.from('innovation_ideas').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).neq('status', 'draft'),
    supabaseAdmin.from('innovation_ideas').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).gte('created_at', monthStart),
    supabaseAdmin.from('innovation_ideas').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).eq('status', 'under_review'),
    supabaseAdmin.from('innovation_ideas').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).eq('status', 'implemented'),
    supabaseAdmin.from('innovation_ideas').select('stage_id').eq('org_id', ctx.orgId).neq('status', 'draft'),
    supabaseAdmin.from('innovation_stages').select('id, name, color').eq('is_active', true).order('order_index'),
    supabaseAdmin
      .from('innovation_ideas')
      .select('id, idea_number, title, vote_count, composite_score, stage_id, stage:innovation_stages!innovation_ideas_stage_id_fkey(name, color)')
      .eq('org_id', ctx.orgId)
      .neq('status', 'draft')
      .order('vote_count', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('innovation_stage_history')
      .select('idea_id, reason, created_at, changer:auth_profiles!innovation_stage_history_changed_by_fkey(data), to_stage:innovation_stages!innovation_stage_history_to_stage_id_fkey(name), idea:innovation_ideas!innovation_stage_history_idea_id_fkey(idea_number, title, org_id)')
      .order('created_at', { ascending: false })
      .limit(15),
    supabaseAdmin
      .from('innovation_ideas')
      .select('id, idea_number, title, created_at, submitter:auth_profiles!innovation_ideas_submitter_id_fkey(data)')
      .eq('org_id', ctx.orgId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // Stage count aggregation
  const stageCounts: Record<string, number> = {};
  for (const row of stageCountsRes.data ?? []) {
    const stageId = (row as Record<string, unknown>).stage_id as string;
    stageCounts[stageId] = (stageCounts[stageId] ?? 0) + 1;
  }

  const byStage = ((stagesRes.data ?? []) as Record<string, unknown>[]).map((s) => ({
    stage_id: s.id as string,
    stage_name: s.name as string,
    stage_color: s.color as string,
    count: stageCounts[s.id as string] ?? 0,
  }));

  const topIdeas = ((topIdeasRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const stg = r.stage as Record<string, unknown> | null;
    return {
      id: r.id as string,
      idea_number: r.idea_number as string,
      title: r.title as string,
      vote_count: r.vote_count as number,
      composite_score: r.composite_score as number,
      stage_name: (stg?.name ?? '') as string,
      stage_color: (stg?.color ?? '#6B7280') as string,
    };
  });

  const recentHistory = ((recentHistoryRes.data ?? []) as Record<string, unknown>[])
    .filter((h) => {
      const idea = h.idea as Record<string, unknown> | null;
      return idea?.org_id === ctx.orgId;
    })
    .map((h) => ({
      type: 'stage_change' as const,
      idea_id: h.idea_id as string,
      idea_number: ((h.idea as Record<string, unknown>)?.idea_number ?? '') as string,
      idea_title: ((h.idea as Record<string, unknown>)?.title ?? '') as string,
      actor_name: ((((h.changer as Record<string, unknown>)?.data) as Record<string, unknown>)?.name ?? 'Bilinmiyor') as string,
      detail: ((h.to_stage as Record<string, unknown>)?.name ?? '') as string,
      created_at: h.created_at as string,
    }));

  const recentIdeas = ((recentIdeasRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    type: 'new_idea' as const,
    idea_id: r.id as string,
    idea_number: r.idea_number as string,
    idea_title: r.title as string,
    actor_name: ((((r.submitter as Record<string, unknown>)?.data) as Record<string, unknown>)?.name ?? 'Bilinmiyor') as string,
    detail: undefined,
    created_at: r.created_at as string,
  }));

  const recentActivity = [...recentHistory, ...recentIdeas]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  const stats: InnovationStats = {
    total_ideas: totalRes.count ?? 0,
    this_month: monthRes.count ?? 0,
    under_review: underReviewRes.count ?? 0,
    implemented: implementedRes.count ?? 0,
    user_role: ctx.innovationRole as InnovationStats['user_role'],
    by_stage: byStage,
    top_ideas: topIdeas,
    recent_activity: recentActivity,
  };

  return NextResponse.json(stats);
}
