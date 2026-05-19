import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { saveEvaluation } from '@/lib/innovation/services/evaluationService';
import type { CreateEvaluationDto, InnovationRole } from '@/lib/innovation/types';
import { notifyIdeaEvaluated } from '@/lib/innovation/services/innovationNotifications';

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

  const { data: idea } = await supabaseAdmin
    .from('innovation_ideas')
    .select('id, idea_number, title, org_id, submitter_id, stage_id')
    .eq('id', id)
    .single();
  if (!idea) return NextResponse.json({ error: 'Fikir bulunamadı' }, { status: 404 });

  const dto = await req.json() as CreateEvaluationDto;
  if (!dto.scores?.length) return NextResponse.json({ error: 'Puan listesi boş olamaz' }, { status: 400 });

  try {
    const result = await saveEvaluation({
      ideaId: id,
      evaluatorId: user.id,
      stageId: idea.stage_id as string,
      role,
      dto,
    });

    const sendNotification = async () => {
      const { data: evalProfile } = await supabaseAdmin
        .from('auth_profiles')
        .select('data')
        .eq('id', user.id)
        .single();
      const evaluatorName =
        (evalProfile?.data as Record<string, unknown> | null)?.name as string | undefined
        ?? 'Değerlendirici';
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
      await notifyIdeaEvaluated(
        idea as { id: string; idea_number: string; title: string; org_id: string; submitter_id: string },
        evaluatorName,
        appUrl
      );
    };
    sendNotification().catch(console.error);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
}
