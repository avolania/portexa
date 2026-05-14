import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationRole } from '@/lib/innovation/types';

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', user.id)
    .single();
  if ((profile?.innovation_role ?? null) !== 'innovation_admin') return { ok: false, status: 403 };
  return { ok: true, userId: user.id };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { id } = await params;

  let body: { innovation_role: InnovationRole };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 });
  }

  const validRoles: Array<InnovationRole> = ['innovation_evaluator', 'innovation_admin', null];
  if (!validRoles.includes(body.innovation_role)) {
    return NextResponse.json({ error: 'Geçersiz rol değeri' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('auth_profiles')
    .update({ innovation_role: body.innovation_role })
    .eq('id', id)
    .select('id, data, innovation_role')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const p = (data.data as Record<string, unknown>);
  return NextResponse.json({
    id: data.id as string,
    name: (p?.name as string) ?? 'Bilinmiyor',
    email: (p?.email as string) ?? '',
    department: (p?.department as string | null) ?? null,
    innovation_role: (data.innovation_role ?? null) as InnovationRole,
  });
}
