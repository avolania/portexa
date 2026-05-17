import { supabaseAdmin } from '@/lib/supabaseAdmin';
import * as ideasRepo from '../repositories/ideasRepo';
import * as stagesRepo from '../repositories/stagesRepo';
import type { InnovationIdea, CreateIdeaDto, AdvanceStageDto, InnovationRole } from '../types';
import { getCampaign, checkSubmissionAccess } from './campaignService';

async function generateIdeaNumber(orgId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('next_ticket_number', {
    p_prefix: 'INN',
    p_org_id: orgId,
  });
  if (error) throw new Error(`Fikir numarası oluşturulamadı: ${error.message}`);
  return data as string;
}

async function getFirstStageId(): Promise<string> {
  const stages = await stagesRepo.findAllStages();
  const first = stages.find((s) => s.order_index === 1) ?? stages[0];
  if (!first) throw new Error('Hiç aktif stage bulunamadı. Seed verilerini kontrol edin.');
  return first.id;
}

export async function createIdea(params: {
  orgId: string;
  submitterId: string;
  dto: CreateIdeaDto;
  innovationRole: string | null;
}): Promise<InnovationIdea> {
  let campaignId: string | undefined;
  if (params.dto.campaign_id) {
    const campaign = await getCampaign(params.dto.campaign_id);
    if (!campaign) throw new Error('Kampanya bulunamadı');

    const access = await checkSubmissionAccess({
      campaign,
      userId: params.submitterId,
      innovationRole: params.innovationRole,
    });
    if (!access.allowed) throw new Error(access.reason ?? 'Bu kampanyaya fikir gönderemezsiniz');
    campaignId = campaign.id;
  }

  const [ideaNumber, stageId] = await Promise.all([
    generateIdeaNumber(params.orgId),
    getFirstStageId(),
  ]);

  const idea = await ideasRepo.createIdea({
    ideaNumber,
    orgId: params.orgId,
    submitterId: params.submitterId,
    stageId,
    title: params.dto.title,
    description: params.dto.description ?? '',
    category: params.dto.category ?? '',
    estimatedValue: params.dto.estimated_value,
    currencyCode: params.dto.currency_code ?? 'TRY',
    campaignId,
  });

  await ideasRepo.addStageHistoryEntry({
    ideaId: idea.id,
    fromStageId: null,
    toStageId: stageId,
    changedBy: params.submitterId,
    reason: 'Fikir gönderildi',
  });

  return idea;
}

export async function advanceStage(params: {
  ideaId: string;
  userId: string;
  dto: AdvanceStageDto;
}): Promise<void> {
  const idea = await ideasRepo.findIdeaById(params.ideaId);
  if (!idea) throw new Error('Fikir bulunamadı');

  const stages = await stagesRepo.findAllStages();
  const currentStage = stages.find((s) => s.id === idea.stage_id);
  if (!currentStage) throw new Error('Mevcut stage bulunamadı');

  const nextStage = stages.find((s) => s.order_index === currentStage.order_index + 1);
  if (!nextStage) throw new Error('Bu en son stage, ileriye geçiş yok');

  if (
    currentStage.min_score_to_advance > 0 &&
    idea.composite_score < currentStage.min_score_to_advance
  ) {
    throw new Error(
      `Bu stage'den geçmek için minimum ${currentStage.min_score_to_advance} puan gerekiyor (mevcut: ${idea.composite_score})`
    );
  }

  await ideasRepo.updateIdeaStage(params.ideaId, nextStage.id);
  await ideasRepo.addStageHistoryEntry({
    ideaId: params.ideaId,
    fromStageId: currentStage.id,
    toStageId: nextStage.id,
    changedBy: params.userId,
    reason: params.dto.reason,
  });
}

export async function canEdit(idea: InnovationIdea, userId: string, role: InnovationRole): Promise<boolean> {
  return idea.submitter_id === userId || role === 'innovation_admin';
}

export async function canDelete(idea: InnovationIdea, userId: string, role: InnovationRole): Promise<boolean> {
  return (idea.submitter_id === userId && idea.status === 'draft') || role === 'innovation_admin';
}

export { findIdeas, findIdeaById, updateIdea, deleteIdea } from '../repositories/ideasRepo';
