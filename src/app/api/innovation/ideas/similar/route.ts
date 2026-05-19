import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { SimilarIdea } from '@/lib/innovation/types';

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
  if (!p?.org_id) return null;
  return { orgId: p.org_id as string };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 200);
  const words = q.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return NextResponse.json([]);

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('innovation_ideas')
      .select(`
        id,
        idea_number,
        title,
        description,
        created_at,
        submitter:auth_profiles!innovation_ideas_submitter_id_fkey(data),
        stage:innovation_stages!innovation_ideas_stage_id_fkey(name, color)
      `)
      .eq('org_id', ctx.orgId)
      .neq('status', 'rejected')
      .neq('status', 'archived')
      .textSearch('title', q, { config: 'turkish', type: 'plain' })
      .limit(5);

    if (error) throw error;

    const result: SimilarIdea[] = ((rows ?? []) as Record<string, unknown>[]).map((row) => {
      const profileData = (row.submitter as Record<string, unknown> | null)?.data as Record<string, unknown> | null;
      const stageRow = row.stage as { name: string; color: string } | null;
      return {
        id: row.id as string,
        idea_number: row.idea_number as string,
        title: row.title as string,
        description: row.description
          ? (row.description as string).slice(0, 120)
          : null,
        stage: stageRow ?? null,
        submitter: profileData?.name
          ? { name: profileData.name as string }
          : null,
        created_at: row.created_at as string,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
