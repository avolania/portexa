import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getCampaign, updateCampaign, deleteCampaign,
} from '@/lib/innovation/services/campaignService';
import { isInvited } from '@/lib/innovation/repositories/campaignsRepo';
import type { UpdateCampaignDto } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id, innovation_role')
    .eq('id', user.id)
    .single();
  if (!p) return null;
  return {
    userId: user.id,
    orgId: p.org_id as string,
    innovationRole: (p.innovation_role ?? null) as string | null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const campaign = await getCampaign(id);
    if (!campaign) return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });
    if (campaign.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });
    }
    if (campaign.status === 'draft' && ctx.innovationRole !== 'innovation_admin') {
      return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });
    }
    const invited = campaign.is_invite_only
      ? await isInvited(campaign.id, ctx.userId)
      : true;
    return NextResponse.json({ ...campaign, is_invited: invited });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.innovationRole !== 'innovation_admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const campaign = await getCampaign(id);
    if (!campaign || campaign.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });
    }
    const dto = await req.json() as UpdateCampaignDto;
    const updated = await updateCampaign({ campaign, dto });
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.innovationRole !== 'innovation_admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const campaign = await getCampaign(id);
    if (!campaign || campaign.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });
    }
    await deleteCampaign(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
