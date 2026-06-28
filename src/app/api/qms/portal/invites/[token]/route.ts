import { NextRequest, NextResponse } from 'next/server';
import { findInviteByToken } from '@/lib/qms/repositories/supplierPortal.repo';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Public endpoint — no auth required
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const invite = await findInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: 'Davet bulunamadı veya geçersiz' }, { status: 404 });
    }

    const now = new Date();
    const isExpired = new Date(invite.expires_at) < now;
    const isAccepted = !!invite.accepted_at;

    // Get supplier info
    const { data: supplier } = await supabaseAdmin
      .from('qms_suppliers')
      .select('display_name, legal_name')
      .eq('id', invite.supplier_id)
      .single();

    return NextResponse.json({
      id: invite.id,
      email: invite.email,
      name: invite.name,
      role: invite.role,
      expires_at: invite.expires_at,
      accepted_at: invite.accepted_at,
      is_expired: isExpired,
      is_accepted: isAccepted,
      supplier_name: supplier?.display_name ?? supplier?.legal_name ?? 'Bilinmiyor',
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
