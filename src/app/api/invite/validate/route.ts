import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/invite/validate?token=xxx — token doğrula
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token gerekli." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("org_invitations")
    .select("email, org_id, org_name, expires_at, accepted")
    .eq("token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Geçersiz davet linki." }, { status: 404 });
  }

  if (data.accepted) {
    return NextResponse.json({ error: "Bu davet zaten kullanılmış." }, { status: 410 });
  }

  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: "Davet linkinin süresi dolmuş." }, { status: 410 });
  }

  return NextResponse.json({
    email: data.email,
    orgId: data.org_id,
    orgName: data.org_name,
  });
}
