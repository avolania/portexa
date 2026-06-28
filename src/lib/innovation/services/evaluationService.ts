import * as evaluationsRepo from '../repositories/evaluationsRepo';
import * as ideasRepo from '../repositories/ideasRepo';
import type { CreateEvaluationDto } from '../types';
import { hasInnovPerm, type InnovationPermission } from '../permissions';

export async function saveEvaluation(params: {
  ideaId: string;
  evaluatorId: string;
  stageId: string;
  permissions: Set<InnovationPermission>;
  dto: CreateEvaluationDto;
}): Promise<{ evaluationId: string; totalScore: number; compositeScore: number }> {
  if (!hasInnovPerm(params.permissions, 'ideas.evaluate')) {
    throw new Error('Bu işlem için ideas.evaluate yetkisi gereklidir');
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
