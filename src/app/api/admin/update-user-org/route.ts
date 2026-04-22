import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

// Sadece system_admin çağırabilir — caller doğrulaması yapılır
export async function POST(req: NextRequest) {
  try {
    const { userId, newOrgId } = await req.json();
    if (!userId || !newOrgId) {
      return NextResponse.json({ error: "userId ve newOrgId gerekli" }, { status: 400 });
    }

    // Caller kimlik doğrulaması: Authorization header'dan session token al
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    // Token ile kullanıcıyı doğrula
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    // Caller'ın system_admin olduğunu doğrula
    const { data: profileRow } = await supabaseAdmin
      .from("auth_profiles")
      .select("data")
      .eq("id", user.id)
      .single();
    const callerRole = (profileRow?.data as { role?: string } | null)?.role;
    if (callerRole !== "system_admin") {
      return NextResponse.json({ error: "Yetkisiz — sadece sistem yöneticisi" }, { status: 403 });
    }

    // team_members tablosunda bu kullanıcının kaydı varsa org_id güncelle
    const { error: tmError } = await supabaseAdmin
      .from("team_members")
      .update({ org_id: newOrgId })
      .eq("id", userId);
    if (tmError) console.error("[update-user-org] team_members:", tmError.message);

    // activity_entries — userId bazlı değil, kullanıcının kendi kayıtları (userId field in data)
    // Bu tablo ayrı bir yapıda, şimdilik atlanıyor

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[update-user-org]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
