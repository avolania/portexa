import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { vote } from '@/lib/innovation/services/votingService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: p } = await supabaseAdmin
    .from('auth_profiles').select('org_id').eq('id', user.id).single();
  if (!p) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: idea } = await supabaseAdmin
    .from('innovation_ideas')
    .select('org_id')
    .eq('id', id)
    .single();
  if (!idea) return NextResponse.json({ error: 'Fikir bulunamadı' }, { status: 404 });
  if ((idea as Record<string, unknown>).org_id !== p.org_id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { value } = await req.json() as { value: 1 | -1 };
  if (value !== 1 && value !== -1) return NextResponse.json({ error: 'value 1 veya -1 olmalı' }, { status: 400 });

  try {
    const result = await vote({ ideaId: id, userId: user.id, value });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
