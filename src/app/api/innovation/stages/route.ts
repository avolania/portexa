import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findAllStages, findAllStagesAdmin, createStage } from '@/lib/innovation/repositories/stagesRepo';
import type { CreateStageDto, InnovationRole } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', user.id)
    .single();
  return { userId: user.id, role: (profile?.innovation_role ?? null) as InnovationRole };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const all = req.nextUrl.searchParams.get('all') === '1';
  if (all && ctx.role === 'innovation_admin') {
    return NextResponse.json(await findAllStagesAdmin());
  }
  return NextResponse.json(await findAllStages());
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'innovation_admin')
    return NextResponse.json({ error: 'Sadece innovation_admin yapabilir' }, { status: 403 });

  const dto = await req.json() as CreateStageDto;
  if (!dto.name?.trim()) return NextResponse.json({ error: 'İsim zorunlu' }, { status: 400 });

  try {
    const stage = await createStage(dto);
    return NextResponse.json(stage, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
