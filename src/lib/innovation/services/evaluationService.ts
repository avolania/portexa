import * as evaluationsRepo from '../repositories/evaluationsRepo';
import * as ideasRepo from '../repositories/ideasRepo';
import type { CreateEvaluationDto, InnovationRole } from '../types';
import { hasRole } from '../utils';

export async function saveEvaluation(params: {
  ideaId: string;
  evaluatorId: string;
  stageId: string;
  roles: InnovationRole[];
  dto: CreateEvaluationDto;
}): Promise<{ evaluationId: string; totalScore: number; compositeScore: number }> {
  if (!hasRole(params.roles, 'innovation_evaluator') && !hasRole(params.roles, 'innovation_admin')) {
    throw new Error('Değerlendirme yapmak için innovation_evaluator veya innovation_admin rolü gereklidir');
  }

  const criteria = await evaluationsRepo.findActiveCriteria();

  let totalScore = 0;
  for (const scoreInput of params.dto.scores) {
    const criterion = criteria.find((c) => c.id === scoreInput.criterion_id);
    if (!criterion) continue;
    totalScore += (scoreInput.score / criterion.max_score) * criterion.weight * 100;
  }
  totalScore = Math.round(totalScore * 100) / 100;

  const evaluationId = await evaluationsRepo.createEvaluation({
    ideaId: params.ideaId,
    evaluatorId: params.evaluatorId,
    stageId: params.stageId,
    dto: params.dto,
    totalScore,
  });

  const compositeScore = await evaluationsRepo.getAvgCompositeScore(params.ideaId);
  await ideasRepo.updateCompositeScore(params.ideaId, compositeScore);

  return { evaluationId, totalScore, compositeScore };
}
