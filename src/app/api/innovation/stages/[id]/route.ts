import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { updateStage, deleteStage } from '@/lib/innovation/repositories/stagesRepo';
import type { UpdateStageDto, InnovationRole } from '@/lib/innovation/types';

async function getAdminCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', user.id)
    .single();
  const role = (profile?.innovation_role ?? null) as InnovationRole;
  if (role !== 'innovation_admin') return null;
  return { userId: user.id };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: 403 });

  const dto = await req.json() as UpdateStageDto;
  try {
    const stage = await updateStage(id, dto);
    return NextResponse.json(stage);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: 403 });

  try {
    await deleteStage(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
