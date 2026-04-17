import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST /api/invite/accept — daveti kabul et ve kullanıcıyı oluştur (e-posta doğrulaması yok)
export async function POST(req: NextRequest) {
  const { token, name, password } = await req.json() as {
    token: string;
    name?: string;
    password?: string;
  };

  if (!token) {
    return NextResponse.json({ error: "Token gerekli." }, { status: 400 });
  }

  // Token'ı doğrula
  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("org_invitations")
    .select("email, org_id, org_name, expires_at, accepted")
    .eq("token", token)
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Geçersiz davet linki." }, { status: 404 });
  }

  if (invite.accepted) {
    return NextResponse.json({ error: "Bu davet zaten kullanılmış." }, { status: 410 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Davet linkinin süresi dolmuş." }, { status: 410 });
  }

  // Kayıt işlemi yoksa sadece token'ı kabul et (eski davranış)
  if (!name || !password) {
    // H-6: conditional update — sadece accepted=false ise güncelle (double-claim önlenir)
    const { count, error } = await supabaseAdmin
      .from("org_invitations")
      .update({ accepted: true }, { count: "exact" })
      .eq("token", token)
      .eq("accepted", false);

    if (error || (count ?? 0) === 0) {
      return NextResponse.json({ error: "Bu davet zaten kullanılmış." }, { status: 410 });
    }

    return NextResponse.json({ success: true });
  }

  // H-6: Önce token'ı atomik olarak "kullanıldı" say — conditional update
  // accepted=false koşulu ile sadece bir request kazanır; diğeri count:0 alır.
  const { count: claimCount, error: claimError } = await supabaseAdmin
    .from("org_invitations")
    .update({ accepted: true }, { count: "exact" })
    .eq("token", token)
    .eq("accepted", false);

  if (claimError || (claimCount ?? 0) === 0) {
    return NextResponse.json({ error: "Bu davet zaten kullanılmış." }, { status: 410 });
  }

  // Admin API ile kullanıcı oluştur — e-posta onayı gerekmez
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      orgId: invite.org_id,
      role: "member",
    },
  });

  if (createError || !newUser?.user) {
    // Kullanıcı oluşturulamadıysa token'ı geri al (rollback)
    await supabaseAdmin
      .from("org_invitations")
      .update({ accepted: false })
      .eq("token", token);

    const alreadyExists =
      createError?.message?.toLowerCase().includes("already") ||
      createError?.message?.toLowerCase().includes("registered");
    return NextResponse.json(
      { error: alreadyExists ? "Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin." : (createError?.message ?? "Kullanıcı oluşturulamadı.") },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  // auth_profiles tablosuna profil kaydet
  const profile = {
    id: newUser.user.id,
    email: invite.email,
    name,
    role: "member",
    orgId: invite.org_id,
    language: "tr",
  };

  await supabaseAdmin
    .from("auth_profiles")
    .upsert([{ id: newUser.user.id, data: profile, org_id: invite.org_id }], { defaultToNull: false });

  return NextResponse.json({ success: true, email: invite.email });
}
