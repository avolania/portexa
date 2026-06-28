import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getInnovContext } from '@/lib/innovation/utils';
import { findPocById } from '@/lib/innovation/repositories/pocsRepo';
import { updatePoc } from '@/lib/innovation/services/pocService';
import type { UpdatePocDto } from '@/lib/innovation/types';

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
  const { roles, permissions } = await getInnovContext(user.id, p.org_id as string);
  return { userId: user.id, orgId: p.org_id as string, roles, permissions };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const poc = await findPocById(id);
  if (!poc || poc.org_id !== ctx.orgId) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  return NextResponse.json(poc);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const poc = await findPocById(id);
  if (!poc || poc.org_id !== ctx.orgId) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  try {
    const dto = await req.json() as UpdatePocDto;
    await updatePoc({ poc, userId: ctx.userId, permissions: ctx.permissions, dto });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('yetki') || msg.includes('olmanız') ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
