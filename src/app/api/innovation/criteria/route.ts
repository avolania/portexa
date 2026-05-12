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

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', user.id)
    .single();
  const role = (profile?.innovation_role ?? null) as InnovationRole;
  if (role !== 'innovation_admin') return { ok: false, status: 403 };
  return { ok: true, userId: user.id };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await findAllCriteria());
}

export async function POST(req: NextRequest) {
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: ctx.status });

  try {
    const dto = await req.json() as CreateCriterionDto;
    if (!dto.name?.trim()) return NextResponse.json({ error: 'İsim zorunlu' }, { status: 400 });
    if (dto.weight === undefined || dto.weight === null)
      return NextResponse.json({ error: 'Ağırlık zorunlu' }, { status: 400 });
    if (dto.weight <= 0 || dto.weight > 1)
      return NextResponse.json({ error: 'Ağırlık 0-1 arasında olmalı' }, { status: 400 });
    if (typeof dto.max_score !== 'number' || dto.max_score < 1)
      return NextResponse.json({ error: 'Max skor en az 1 olmalı' }, { status: 400 });

    const criterion = await createCriterion(dto);
    return NextResponse.json(criterion, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
