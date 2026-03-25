import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST /api/invite/accept — daveti kabul edildi olarak işaretle
export async function POST(req: NextRequest) {
  const { token } = await req.json() as { token: string };
  if (!token) {
    return NextResponse.json({ error: "Token gerekli." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("org_invitations")
    .update({ accepted: true })
    .eq("token", token);

  if (error) {
    return NextResponse.json({ error: "Güncelleme başarısız." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
