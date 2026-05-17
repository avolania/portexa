import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getCampaign, getInvites, addInvites, removeInvite,
} from '@/lib/innovation/services/campaignService';

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

async function resolveCampaign(id: string, orgId: string) {
  const campaign = await getCampaign(id);
  if (!campaign || campaign.org_id !== orgId) return null;
  return campaign;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.innovationRole !== 'innovation_admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const { id } = await params;
  const campaign = await resolveCampaign(id, ctx.orgId);
  if (!campaign) return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });

  try {
    const invites = await getInvites(id);
    return NextResponse.json(invites);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.innovationRole !== 'innovation_admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const { id } = await params;
  const campaign = await resolveCampaign(id, ctx.orgId);
  if (!campaign) return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });

  try {
    const body = await req.json() as { user_ids: string[] };
    if (!Array.isArray(body.user_ids)) {
      return NextResponse.json({ error: 'user_ids dizisi zorunludur' }, { status: 400 });
    }
    const result = await addInvites(id, body.user_ids);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
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
  const campaign = await resolveCampaign(id, ctx.orgId);
  if (!campaign) return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });

  try {
    const body = await req.json() as { user_id: string };
    if (!body.user_id) {
      return NextResponse.json({ error: 'user_id zorunludur' }, { status: 400 });
    }
    await removeInvite(id, body.user_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
