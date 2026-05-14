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

export async function GET(req: NextRequest) {
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { data: callerRow } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id')
    .eq('id', ctx.userId)
    .single();
  if (!callerRow?.org_id) return NextResponse.json({ error: 'Org bulunamadı' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('auth_profiles')
    .select('id, data, innovation_role')
    .eq('org_id', callerRow.org_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = (data ?? []).map((row) => {
    const p = row.data as Record<string, unknown>;
    return {
      id: row.id as string,
      name: (p?.name as string) ?? 'Bilinmiyor',
      email: (p?.email as string) ?? '',
      department: (p?.department as string | null) ?? null,
      innovation_role: (row.innovation_role ?? null) as InnovationRole,
    };
  });

  return NextResponse.json(users);
}
