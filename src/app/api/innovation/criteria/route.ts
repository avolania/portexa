import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findAllCriteria, createCriterion } from '@/lib/innovation/repositories/evaluationsRepo';
import type { CreateCriterionDto, InnovationRole } from '@/lib/innovation/types';

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
  return NextResponse.json(await findAllCriteria());
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'innovation_admin')
    return NextResponse.json({ error: 'Sadece innovation_admin yapabilir' }, { status: 403 });

  try {
    const dto = await req.json() as CreateCriterionDto;
    if (!dto.name?.trim()) return NextResponse.json({ error: 'İsim zorunlu' }, { status: 400 });
    if (!dto.weight || dto.weight <= 0 || dto.weight > 1)
      return NextResponse.json({ error: 'Ağırlık 0-1 arasında olmalı' }, { status: 400 });
    if (typeof dto.max_score !== 'number' || dto.max_score < 1)
      return NextResponse.json({ error: 'Max skor en az 1 olmalı' }, { status: 400 });

    const criterion = await createCriterion(dto);
    return NextResponse.json(criterion, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
