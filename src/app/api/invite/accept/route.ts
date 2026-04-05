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
    const { error } = await supabaseAdmin
      .from("org_invitations")
      .update({ accepted: true })
      .eq("token", token);

    if (error) {
      return NextResponse.json({ error: "Güncelleme başarısız." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // Kullanıcı zaten var mı kontrol et
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const alreadyExists = existingUsers?.users?.some(
    (u) => u.email?.toLowerCase() === invite.email.toLowerCase()
  );

  if (alreadyExists) {
    return NextResponse.json(
      { error: "Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin." },
      { status: 409 }
    );
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
    return NextResponse.json(
      { error: createError?.message ?? "Kullanıcı oluşturulamadı." },
      { status: 500 }
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
    .upsert([{ id: newUser.user.id, data: profile }], { defaultToNull: false });

  // Token'ı kullanıldı olarak işaretle
  await supabaseAdmin
    .from("org_invitations")
    .update({ accepted: true })
    .eq("token", token);

  return NextResponse.json({ success: true, email: invite.email });
}
