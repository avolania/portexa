import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findIdeaById, updateIdea, deleteIdea, canEdit, canDelete } from '@/lib/innovation/services/ideasService';
import { getInnovContext } from '@/lib/innovation/utils';
import { hasInnovPerm } from '@/lib/innovation/permissions';
import type { UpdateIdeaDto } from '@/lib/innovation/types';

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
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: p } = await supabaseAdmin
    .from('auth_profiles').select('org_id').eq('id', user.id).single();
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const idea = await findIdeaById(id, p.org_id as string);
  if (!idea) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

  const { data: voteRow } = await supabaseAdmin
    .from('innovation_votes')
    .select('value')
    .eq('idea_id', id)
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({ ...idea, user_vote: voteRow?.value ?? null });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const idea = await findIdeaById(id, ctx.orgId);
  if (!idea) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  if (!canEdit(idea, ctx.userId, ctx.permissions))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dto = await req.json() as UpdateIdeaDto;
  if (dto.status !== undefined && !hasInnovPerm(ctx.permissions, 'ideas.status'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await updateIdea(id, dto);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const idea = await findIdeaById(id, ctx.orgId);
  if (!idea) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  if (!canDelete(idea, ctx.userId, ctx.permissions))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await deleteIdea(id);
  return NextResponse.json({ ok: true });
}
