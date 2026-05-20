import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  listCampaigns, createCampaign,
} from '@/lib/innovation/services/campaignService';
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
import type { CreateCampaignDto, InnovationRole } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!p) return null;
  const roles = await getInnovationRoles(user.id);
  return {
    userId: user.id,
    orgId: p.org_id as string,
    innovationRoles: roles as InnovationRole[],
  };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const all = await listCampaigns(ctx.orgId);
    const visible = hasRole(ctx.innovationRoles, 'innovation_admin')
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
  if (!hasRole(ctx.innovationRoles, 'innovation_admin')) {
    return NextResponse.json({ error: 'Sadece innovation_admin kampanya oluşturabilir' }, { status: 403 });
  }

  try {
    const dto = await req.json() as CreateCampaignDto;
    const campaign = await createCampaign({ orgId: ctx.orgId, createdBy: ctx.userId, dto });
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
