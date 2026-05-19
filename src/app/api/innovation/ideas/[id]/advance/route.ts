import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { advanceStage } from '@/lib/innovation/services/ideasService';
import type { AdvanceStageDto, InnovationRole } from '@/lib/innovation/types';
import { notifyIdeaStageAdvanced } from '@/lib/innovation/services/innovationNotifications';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', user.id)
    .single();
  const role = (profile?.innovation_role ?? null) as InnovationRole;
  if (role !== 'innovation_admin')
    return NextResponse.json({ error: 'Sadece innovation_admin stage ilerletebilir' }, { status: 403 });

  const dto = await req.json() as AdvanceStageDto;
  try {
    await advanceStage({ ideaId: id, userId: user.id, dto });

    const sendNotification = async () => {
      const { data: idea } = await supabaseAdmin
        .from('innovation_ideas')
        .select('id, idea_number, title, org_id, submitter_id, stage_id')
        .eq('id', id)
        .single();
      if (!idea) return;

      const { data: stage } = await supabaseAdmin
        .from('innovation_stages')
        .select('name')
        .eq('id', idea.stage_id)
        .single();
      if (!stage) return;

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
      await notifyIdeaStageAdvanced(
        idea as { id: string; idea_number: string; title: string; org_id: string; submitter_id: string },
        stage.name as string,
        appUrl
      );
    };
    sendNotification().catch(console.error);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
