import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { EvaluationCriterion, IdeaEvaluation, CreateEvaluationDto, CreateCriterionDto, UpdateCriterionDto } from '../types';

export async function findActiveCriteria(): Promise<EvaluationCriterion[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .select('*')
    .eq('is_active', true)
    .order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []) as EvaluationCriterion[];
}

export async function findEvaluationsByIdea(ideaId: string): Promise<IdeaEvaluation[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_evaluations')
    .select(`
      *,
      evaluator:auth_profiles!innovation_evaluations_evaluator_id_fkey(id, data),
      innovation_evaluation_scores(
        *,
        criterion:innovation_evaluation_criteria(*)
      )
    `)
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...row,
    evaluator: row.evaluator
      ? {
          id: (row.evaluator as Record<string, unknown>).id,
          name: ((row.evaluator as Record<string, unknown>).data as Record<string, unknown>)?.name ?? 'Bilinmiyor',
        }
      : undefined,
    scores: (row.innovation_evaluation_scores as unknown[]) ?? [],
  })) as IdeaEvaluation[];
}

export async function countEvaluationsForIdea(ideaId: string, stageId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('innovation_evaluations')
    .select('id', { count: 'exact', head: true })
    .eq('idea_id', ideaId)
    .eq('stage_id', stageId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function createEvaluation(params: {
  ideaId: string;
  evaluatorId: string;
  stageId: string;
  dto: CreateEvaluationDto;
  totalScore: number;
}): Promise<string> {
  const evalId = crypto.randomUUID();
  const { error: evalError } = await supabaseAdmin
    .from('innovation_evaluations')
    .insert({
      id: evalId,
      idea_id: params.ideaId,
      evaluator_id: params.evaluatorId,
      stage_id: params.stageId,
      notes: params.dto.notes,
      total_score: params.totalScore,
      created_at: new Date().toISOString(),
    });
  if (evalError) throw new Error(evalError.message);

  const scoreRows = params.dto.scores.map((s) => ({
    id: crypto.randomUUID(),
    evaluation_id: evalId,
    criterion_id: s.criterion_id,
    score: s.score,
    comment: s.comment ?? null,
  }));

  const { error: scoresError } = await supabaseAdmin
    .from('innovation_evaluation_scores')
    .insert(scoreRows);
  if (scoresError) throw new Error(scoresError.message);

  return evalId;
}

export async function getAvgCompositeScore(ideaId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('innovation_evaluations')
    .select('total_score')
    .eq('idea_id', ideaId);
  if (error || !data?.length) return 0;
  const avg = data.reduce((sum, r) => sum + Number(r.total_score), 0) / data.length;
  return Math.round(avg * 100) / 100;
}

export async function findAllCriteria(): Promise<EvaluationCriterion[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .select('*')
    .order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []) as EvaluationCriterion[];
}

export async function createCriterion(dto: CreateCriterionDto): Promise<EvaluationCriterion> {
  const { data: maxRow } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single();
  const nextOrder = ((maxRow as { order_index: number } | null)?.order_index ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .insert({
      id: crypto.randomUUID(),
      order_index: nextOrder,
      name: dto.name,
      description: dto.description ?? '',
      weight: dto.weight,
      max_score: dto.max_score,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as EvaluationCriterion;
}

export async function updateCriterion(id: string, dto: UpdateCriterionDto): Promise<EvaluationCriterion> {
  const { data, error } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as EvaluationCriterion;
}

export async function deleteCriterion(id: string): Promise<void> {
  const { count } = await supabaseAdmin
    .from('innovation_evaluation_scores')
    .select('id', { count: 'exact', head: true })
    .eq('criterion_id', id);
  if (count && count > 0) throw new Error('Bu kritere ait değerlendirme var, silinemez');
  const { error } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
