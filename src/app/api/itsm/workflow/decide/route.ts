import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { submitDecision } from '@/services/workflowEngine';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // approverId ve approverName istemciden ALINMAZ — sunucu tarafında çözümlenir
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('data, org_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const approverName =
    ((profile.data as Record<string, unknown> | null)?.name as string | undefined) ?? 'Onaylayıcı';
  const orgId = (profile as { org_id?: string }).org_id ?? '';

  const body = await req.json() as {
    instanceId: string;
    stepDefId: string;
    decision: 'approved' | 'rejected';
    comment?: string;
  };

  const { instanceId, stepDefId, decision, comment } = body;
  if (!instanceId || !stepDefId || !decision) {
    return NextResponse.json({ error: 'instanceId, stepDefId ve decision zorunludur' }, { status: 400 });
  }
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'decision "approved" veya "rejected" olmalı' }, { status: 400 });
  }

  try {
    const result = await submitDecision(
      instanceId,
      stepDefId,
      user.id,        // approverId — JWT'den alındı
      approverName,   // approverName — DB'den alındı
      decision,
      orgId,          // orgId — DB'den alındı (çapraz-tenant koruması)
      comment,
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
