import * as campaignsRepo from '../repositories/campaignsRepo';
import type {
  InnovationCampaign, CampaignStatus, CampaignInvite,
  CreateCampaignDto, UpdateCampaignDto,
} from '../types';

export function deriveCampaignStatus(startDate: string, endDate: string): CampaignStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return 'draft';
  if (today > endDate) return 'ended';
  return 'active';
}

function withStatus(c: Omit<InnovationCampaign, 'status'>): InnovationCampaign {
  return { ...c, status: deriveCampaignStatus(c.start_date, c.end_date) };
}

export async function listCampaigns(orgId: string): Promise<InnovationCampaign[]> {
  const rows = await campaignsRepo.findCampaignsByOrg(orgId);
  return rows.map(withStatus);
}

export async function getCampaign(id: string): Promise<InnovationCampaign | null> {
  const row = await campaignsRepo.findCampaignById(id);
  if (!row) return null;
  return withStatus(row);
}

export async function createCampaign(params: {
  orgId: string;
  createdBy: string;
  dto: CreateCampaignDto;
}): Promise<InnovationCampaign> {
  if (!params.dto.title?.trim()) throw new Error('Başlık zorunludur');
  if (!params.dto.start_date || !params.dto.end_date) throw new Error('Başlangıç ve bitiş tarihleri zorunludur');
  if (params.dto.end_date < params.dto.start_date) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz');

  const row = await campaignsRepo.createCampaign(params);
  return withStatus(row);
}

export async function updateCampaign(params: {
  campaign: InnovationCampaign;
  dto: UpdateCampaignDto;
}): Promise<InnovationCampaign> {
  const { campaign, dto } = params;
  const newStart = dto.start_date ?? campaign.start_date;
  const newEnd = dto.end_date ?? campaign.end_date;
  if (newEnd < newStart) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz');
  await campaignsRepo.updateCampaign(campaign.id, dto);

  // Build updated campaign from existing + dto, re-derive status
  const merged: Omit<InnovationCampaign, 'status'> = {
    ...campaign,
    title: dto.title ?? campaign.title,
    description: dto.description !== undefined ? dto.description : campaign.description,
    goal: dto.goal !== undefined ? dto.goal : campaign.goal,
    start_date: newStart,
    end_date: newEnd,
    is_invite_only: dto.is_invite_only ?? campaign.is_invite_only,
    updated_at: new Date().toISOString(),
  };
  return { ...merged, status: deriveCampaignStatus(merged.start_date, merged.end_date) };
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const count = await campaignsRepo.countIdeasForCampaign(campaignId);
  if (count > 0) throw new Error(`Bu kampanyada ${count} fikir bulunuyor. Önce fikirleri taşıyın veya kampanyayı kapatın.`);
  await campaignsRepo.deleteCampaign(campaignId);
}

export async function getInvites(campaignId: string): Promise<CampaignInvite[]> {
  return campaignsRepo.findInvites(campaignId);
}

export async function addInvites(
  campaignId: string,
  userIds: string[]
): Promise<{ added: number; already_invited: number }> {
  if (!userIds.length) return { added: 0, already_invited: 0 };
  return campaignsRepo.addInvites(campaignId, userIds);
}

export async function removeInvite(campaignId: string, userId: string): Promise<void> {
  return campaignsRepo.removeInvite(campaignId, userId);
}

export async function checkSubmissionAccess(params: {
  campaign: InnovationCampaign;
  userId: string;
  innovationRole: string | null;
}): Promise<{ allowed: boolean; reason?: string }> {
  const { campaign, userId, innovationRole } = params;

  if (campaign.status !== 'active') {
    return { allowed: false, reason: 'Kampanya aktif değil' };
  }

  if (campaign.is_invite_only && innovationRole !== 'innovation_admin') {
    const invited = await campaignsRepo.isInvited(campaign.id, userId);
    if (!invited) {
      return { allowed: false, reason: 'Bu kampanya yalnızca davetli katılımcılara açıktır' };
    }
  }

  return { allowed: true };
}
