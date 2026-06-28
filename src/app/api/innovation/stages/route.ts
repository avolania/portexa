import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findAllStages, findAllStagesAdmin, createStage } from '@/lib/innovation/repositories/stagesRepo';
import { getInnovContext } from '@/lib/innovation/utils';
import { hasInnovPerm } from '@/lib/innovation/permissions';
import type { CreateStageDto } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles').select('org_id').eq('id', user.id).single();
  if (!p?.org_id) return null;
  const { roles, permissions } = await getInnovContext(user.id, p.org_id as string);
  return { userId: user.id, orgId: p.org_id as string, roles, permissions };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const all = req.nextUrl.searchParams.get('all') === '1';
  if (all && hasInnovPerm(ctx.permissions, 'stages.manage')) {
    return NextResponse.json(await findAllStagesAdmin());
  }
  return NextResponse.json(await findAllStages());
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasInnovPerm(ctx.permissions, 'stages.manage'))
    return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  try {
    const dto = await req.json() as CreateStageDto;
    if (!dto.name?.trim()) return NextResponse.json({ error: 'İsim zorunlu' }, { status: 400 });
    if (!dto.color?.trim()) return NextResponse.json({ error: 'Renk zorunlu' }, { status: 400 });
    if (typeof dto.min_score_to_advance !== 'number') return NextResponse.json({ error: 'Min skor sayı olmalı' }, { status: 400 });
    if (typeof dto.required_evaluations !== 'number') return NextResponse.json({ error: 'Zorunlu değerlendirme sayısı sayı olmalı' }, { status: 400 });
    const stage = await createStage(dto);
    return NextResponse.json(stage, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
