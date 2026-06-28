import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { listCampaigns, createCampaign } from '@/lib/innovation/services/campaignService';
import { getInnovContext } from '@/lib/innovation/utils';
import { hasInnovPerm } from '@/lib/innovation/permissions';
import type { CreateCampaignDto } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles').select('org_id').eq('id', user.id).single();
  if (!p) return null;
  const { roles, permissions } = await getInnovContext(user.id, p.org_id as string);
  return { userId: user.id, orgId: p.org_id as string, roles, permissions };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const all = await listCampaigns(ctx.orgId);
    const visible = hasInnovPerm(ctx.permissions, 'campaigns.manage')
      ? all
      : all.filter((c) => c.status === 'active');
    return NextResponse.json(visible);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasInnovPerm(ctx.permissions, 'campaigns.create')) {
    return NextResponse.json({ error: 'Kampanya oluşturma yetkisi yok' }, { status: 403 });
  }

  try {
    const dto = await req.json() as CreateCampaignDto;
    const campaign = await createCampaign({ orgId: ctx.orgId, createdBy: ctx.userId, dto });
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
