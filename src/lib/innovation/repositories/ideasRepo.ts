import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationIdea, IdeasListParams, UpdateIdeaDto } from '../types';

const mapProfile = (p: Record<string, unknown> | null | undefined) =>
  p ? { id: p.id as string, name: ((p.data as Record<string, unknown>)?.name ?? 'Bilinmiyor') as string } : undefined;

export async function findIdeas(params: IdeasListParams): Promise<{ ideas: InnovationIdea[]; total: number }> {
  const { org_id, stage_id, status, search, sort = 'date', page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('innovation_ideas')
    .select(
      `*,
       submitter:auth_profiles!innovation_ideas_submitter_id_fkey(id, data),
       stage:innovation_stages!innovation_ideas_stage_id_fkey(id, name, color, order_index, min_score_to_advance, required_evaluations)`,
      { count: 'exact' }
    )
    .eq('org_id', org_id)
    .neq('status', 'draft');

  if (stage_id) query = query.eq('stage_id', stage_id);
  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('title', `%${search}%`);

  if (sort === 'score') query = query.order('composite_score', { ascending: false });
  else if (sort === 'votes') query = query.order('vote_count', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const ideas = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...row,
    submitter: mapProfile(row.submitter as Record<string, unknown>),
  })) as InnovationIdea[];

  return { ideas, total: count ?? 0 };
}

export async function findIdeaById(id: string): Promise<InnovationIdea | null> {
  const { data, error } = await supabaseAdmin
    .from('innovation_ideas')
    .select(`
      *,
      submitter:auth_profiles!innovation_ideas_submitter_id_fkey(id, data),
      stage:innovation_stages!innovation_ideas_stage_id_fkey(id, name, color, order_index, min_score_to_advance, required_evaluations, is_active),
      innovation_comments(
        *,
        author:auth_profiles!innovation_comments_author_id_fkey(id, data)
      ),
      innovation_evaluations(
        *,
        evaluator:auth_profiles!innovation_evaluations_evaluator_id_fkey(id, data),
        innovation_evaluation_scores(*, criterion:innovation_evaluation_criteria(*))
      ),
      innovation_stage_history(
        *,
        to_stage:innovation_stages!innovation_stage_history_to_stage_id_fkey(id, name, color),
        from_stage:innovation_stages!innovation_stage_history_from_stage_id_fkey(id, name, color),
        changer:auth_profiles!innovation_stage_history_changed_by_fkey(id, data)
      )
    `)
    .eq('id', id)
    .single();

  if (error) return null;

  const row = data as Record<string, unknown>;

  return {
    ...row,
    submitter: mapProfile(row.submitter as Record<string, unknown>),
    comments: ((row.innovation_comments ?? []) as Record<string, unknown>[]).map((c) => ({
      ...c,
      author: mapProfile(c.author as Record<string, unknown>),
    })),
    evaluations: ((row.innovation_evaluations ?? []) as Record<string, unknown>[]).map((e) => ({
      ...e,
      evaluator: mapProfile(e.evaluator as Record<string, unknown>),
      scores: (e.innovation_evaluation_scores as unknown[]) ?? [],
    })),
    stage_history: ((row.innovation_stage_history ?? []) as Record<string, unknown>[]).map((h) => ({
      ...h,
      changer: mapProfile(h.changer as Record<string, unknown>),
    })),
  } as unknown as InnovationIdea;
}

export async function createIdea(params: {
  ideaNumber: string;
  orgId: string;
  submitterId: string;
  stageId: string;
  title: string;
  description: string;
  category: string;
  estimatedValue?: number;
  currencyCode: string;
}): Promise<InnovationIdea> {
  const { data, error } = await supabaseAdmin
    .from('innovation_ideas')
    .insert({
      id: crypto.randomUUID(),
      idea_number: params.ideaNumber,
      org_id: params.orgId,
      submitter_id: params.submitterId,
      stage_id: params.stageId,
      status: 'submitted',
      title: params.title,
      description: params.description,
      category: params.category,
      estimated_value: params.estimatedValue ?? null,
      currency_code: params.currencyCode,
      impact_score: 0,
      feasibility_score: 0,
      composite_score: 0,
      vote_count: 0,
      comment_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as InnovationIdea;
}

export async function updateIdea(id: string, dto: UpdateIdeaDto): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_ideas')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteIdea(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('innovation_ideas').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateIdeaStage(id: string, stageId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_ideas')
    .update({ stage_id: stageId, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateCompositeScore(id: string, score: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_ideas')
    .update({ composite_score: score, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function addStageHistoryEntry(params: {
  ideaId: string;
  fromStageId: string | null;
  toStageId: string;
  changedBy: string;
  reason: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('innovation_stage_history').insert({
    id: crypto.randomUUID(),
    idea_id: params.ideaId,
    from_stage_id: params.fromStageId,
    to_stage_id: params.toStageId,
    changed_by: params.changedBy,
    reason: params.reason,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
