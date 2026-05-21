import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createIdea, findIdeas } from '@/lib/innovation/services/ideasService';
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
import type { CreateIdeaDto, InnovationRole } from '@/lib/innovation/types';
import { notifyIdeaSubmitted } from '@/lib/innovation/services/innovationNotifications';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id, data')
    .eq('id', user.id)
    .single();
  if (!p) return null;
  const profileData = p.data as Record<string, unknown> | null;
  const roles = await getInnovationRoles(user.id);
  return {
    userId: user.id,
    orgId: p.org_id as string,
    innovationRoles: roles as InnovationRole[],
    submitterName: (profileData?.name as string | undefined) ?? 'Kullanıcı',
  };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  try {
    const result = await findIdeas({
      org_id: ctx.orgId,
      stage_id: searchParams.get('stage') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      sort: (searchParams.get('sort') as 'date' | 'score' | 'votes') ?? 'date',
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '20'),
      campaign_id: (searchParams.get('campaign_id') ?? undefined) as string | 'none' | undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dto = await req.json() as CreateIdeaDto;
  if (!dto.title?.trim()) return NextResponse.json({ error: 'Başlık zorunludur' }, { status: 400 });

  try {
    const idea = await createIdea({
      orgId: ctx.orgId,
      submitterId: ctx.userId,
      dto,
      innovationRole: hasRole(ctx.innovationRoles, 'innovation_admin') ? 'innovation_admin' : (ctx.innovationRoles[0] ?? null),
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    notifyIdeaSubmitted(idea, ctx.submitterName, appUrl).catch(console.error);
    return NextResponse.json(idea, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
