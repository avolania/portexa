import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getInnovationRoles } from '@/lib/innovation/utils';
import { findPocById } from '@/lib/innovation/repositories/pocsRepo';
import { transitionPoc } from '@/lib/innovation/services/pocService';
import type { TransitionPocDto, InnovationRole } from '@/lib/innovation/types';

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
  return { userId: user.id, orgId: p.org_id as string, roles: roles as InnovationRole[] };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const poc = await findPocById(id);
  if (!poc || poc.org_id !== ctx.orgId) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  try {
    const dto = await req.json() as TransitionPocDto;
    if (!dto.action) return NextResponse.json({ error: 'action zorunlu' }, { status: 400 });
    await transitionPoc({ poc, userId: ctx.userId, roles: ctx.roles, dto });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('yetki') || msg.includes('rolü') ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
