import * as votesRepo from '../repositories/votesRepo';

export async function vote(params: {
  ideaId: string;
  userId: string;
  value: 1 | -1;
}): Promise<{ action: 'added' | 'removed' | 'changed'; newCount: number }> {
  const existing = await votesRepo.findUserVote(params.ideaId, params.userId);

  let action: 'added' | 'removed' | 'changed';
  if (existing === params.value) {
    await votesRepo.deleteVote(params.ideaId, params.userId);
    action = 'removed';
  } else if (existing !== null) {
    await votesRepo.upsertVote(params.ideaId, params.userId, params.value);
    action = 'changed';
  } else {
    await votesRepo.upsertVote(params.ideaId, params.userId, params.value);
    action = 'added';
  }

  await votesRepo.syncVoteCount(params.ideaId);
  const newCount = await votesRepo.getNetVoteCount(params.ideaId);
  return { action, newCount };
}
