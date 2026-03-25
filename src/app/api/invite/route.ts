import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/invite — davet gönder
export async function POST(req: NextRequest) {
  const { email, orgId, orgName, invitedBy } = await req.json() as {
    email: string;
    orgId: string;
    orgName: string;
    invitedBy: string;
  };

  if (!email || !orgId || !invitedBy) {
    return NextResponse.json({ error: "Eksik parametreler." }, { status: 400 });
  }

  // Mevcut aktif davet var mı?
  const { data: existing } = await supabaseAdmin
    .from("org_invitations")
    .select("id")
    .eq("org_id", orgId)
    .eq("email", email)
    .eq("accepted", false)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Bu e-posta adresine zaten aktif bir davet gönderilmiş." }, { status: 409 });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 gün

  const { error: dbError } = await supabaseAdmin.from("org_invitations").insert({
    id: crypto.randomUUID(),
    org_id: orgId,
    email,
    token,
    invited_by: invitedBy,
    org_name: orgName,
    expires_at: expiresAt,
    accepted: false,
  });

  if (dbError) {
    return NextResponse.json({ error: "Davet oluşturulamadı." }, { status: 500 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const inviteUrl = `${origin}/davet?token=${token}`;

  const { error: emailError } = await resend.emails.send({
    from: "Portexa <noreply@portexa.app>",
    to: email,
    subject: `${orgName} sizi Portexa'ya davet etti`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Portexa'ya Davet</h2>
        <p><strong>${orgName}</strong> organizasyonuna katılmak için davet aldınız.</p>
        <p>Aşağıdaki butona tıklayarak hesabınızı oluşturabilir ve takıma katılabilirsiniz.</p>
        <a href="${inviteUrl}"
           style="display:inline-block; margin: 24px 0; padding: 12px 24px;
                  background: #4f46e5; color: #fff; border-radius: 8px;
                  text-decoration: none; font-weight: 600;">
          Daveti Kabul Et
        </a>
        <p style="color: #6b7280; font-size: 12px;">Bu bağlantı 7 gün geçerlidir.</p>
      </div>
    `,
  });

  if (emailError) {
    return NextResponse.json({ error: "E-posta gönderilemedi." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
