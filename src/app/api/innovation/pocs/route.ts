import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getInnovationRoles } from '@/lib/innovation/utils';
import { findPocs } from '@/lib/innovation/repositories/pocsRepo';
import { createPoc } from '@/lib/innovation/services/pocService';
import type { CreatePocDto, InnovationRole } from '@/lib/innovation/types';

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

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = req.nextUrl;
  try {
    const pocs = await findPocs({
      orgId: ctx.orgId,
      status: searchParams.get('status') ?? undefined,
      ideaId: searchParams.get('idea_id') ?? undefined,
    });
    return NextResponse.json(pocs);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const dto = await req.json() as CreatePocDto;
    if (!dto.idea_id?.trim()) return NextResponse.json({ error: 'idea_id zorunlu' }, { status: 400 });
    if (!dto.title?.trim()) return NextResponse.json({ error: 'Başlık zorunlu' }, { status: 400 });
    if (!dto.owner_id?.trim()) return NextResponse.json({ error: 'owner_id zorunlu' }, { status: 400 });
    const poc = await createPoc({ orgId: ctx.orgId, userId: ctx.userId, roles: ctx.roles, dto });
    return NextResponse.json(poc, { status: 201 });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('yetki') || msg.includes('rolü') ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
