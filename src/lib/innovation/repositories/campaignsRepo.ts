import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationCampaign, CampaignInvite, CreateCampaignDto, UpdateCampaignDto } from '../types';

const mapProfile = (p: Record<string, unknown> | null | undefined) =>
  p ? { id: p.id as string, name: ((p.data as Record<string, unknown>)?.name ?? 'Bilinmiyor') as string } : undefined;

export async function findCampaignsByOrg(orgId: string): Promise<Omit<InnovationCampaign, 'status'>[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_campaigns')
    .select('*, idea_count:innovation_ideas(count)')
    .eq('org_id', orgId)
    .order('start_date', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...row,
    idea_count: (row.idea_count as Array<{ count: number }>)?.[0]?.count ?? 0,
  })) as Omit<InnovationCampaign, 'status'>[];
}

export async function findCampaignById(id: string): Promise<Omit<InnovationCampaign, 'status'> | null> {
  const { data, error } = await supabaseAdmin
    .from('innovation_campaigns')
    .select('*, idea_count:innovation_ideas(count), invite_count:innovation_campaign_invites(count)')
    .eq('id', id)
    .single();
  if (error) return null;

  const row = data as Record<string, unknown>;
  return {
    ...row,
    idea_count: (row.idea_count as Array<{ count: number }>)?.[0]?.count ?? 0,
    invite_count: (row.invite_count as Array<{ count: number }>)?.[0]?.count ?? 0,
  } as Omit<InnovationCampaign, 'status'>;
}

export async function createCampaign(params: {
  orgId: string;
  createdBy: string;
  dto: CreateCampaignDto;
}): Promise<Omit<InnovationCampaign, 'status'>> {
  const { data, error } = await supabaseAdmin
    .from('innovation_campaigns')
    .insert({
      id: crypto.randomUUID(),
      org_id: params.orgId,
      created_by: params.createdBy,
      title: params.dto.title,
      description: params.dto.description ?? null,
      goal: params.dto.goal ?? null,
      start_date: params.dto.start_date,
      end_date: params.dto.end_date,
      is_invite_only: params.dto.is_invite_only ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...(data as Record<string, unknown>), idea_count: 0 } as Omit<InnovationCampaign, 'status'>;
}

export async function updateCampaign(id: string, dto: UpdateCampaignDto): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_campaigns')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_campaigns')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function countIdeasForCampaign(campaignId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('innovation_ideas')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);
  return count ?? 0;
}

export async function findInvites(campaignId: string): Promise<CampaignInvite[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_campaign_invites')
    .select('*, profile:auth_profiles!innovation_campaign_invites_user_id_fkey(id, data)')
    .eq('campaign_id', campaignId)
    .order('created_at');
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const profile = mapProfile(row.profile as Record<string, unknown>);
    return {
      campaign_id: row.campaign_id as string,
      user_id: row.user_id as string,
      name: profile?.name ?? 'Bilinmiyor',
      created_at: row.created_at as string,
    };
  });
}

export async function addInvites(campaignId: string, userIds: string[]): Promise<{ added: number; already_invited: number }> {
  const existing = await supabaseAdmin
    .from('innovation_campaign_invites')
    .select('user_id')
    .eq('campaign_id', campaignId)
    .in('user_id', userIds);

  const existingIds = new Set((existing.data ?? []).map((r) => (r as { user_id: string }).user_id));
  const newIds = userIds.filter((id) => !existingIds.has(id));

  if (newIds.length > 0) {
    const { error } = await supabaseAdmin
      .from('innovation_campaign_invites')
      .insert(newIds.map((uid) => ({
        campaign_id: campaignId,
        user_id: uid,
        created_at: new Date().toISOString(),
      })));
    if (error) throw new Error(error.message);
  }

  return { added: newIds.length, already_invited: existingIds.size };
}

export async function removeInvite(campaignId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_campaign_invites')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function isInvited(campaignId: string, userId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from('innovation_campaign_invites')
    .select('user_id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  return (count ?? 0) > 0;
}
