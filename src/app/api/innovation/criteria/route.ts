import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findAllCriteria, createCriterion } from '@/lib/innovation/repositories/evaluationsRepo';
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
import type { CreateCriterionDto } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const roles = await getInnovationRoles(user.id);
  return { userId: user.id, roles };
}

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const roles = await getInnovationRoles(user.id);
  if (!hasRole(roles, 'innovation_admin')) return { ok: false, status: 403 };
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
