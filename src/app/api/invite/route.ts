import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// POST /api/invite — davet gönder
export async function POST(req: NextRequest) {
  // ── 1. Caller'ı doğrula ──────────────────────────────────────────────────────
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Body parametrelerini al ───────────────────────────────────────────────
  const { email, orgId, orgName } = await req.json() as {
    email: string;
    orgId: string;
    orgName: string;
  };

  if (!email || !orgId) {
    return NextResponse.json({ error: "Eksik parametreler." }, { status: 400 });
  }

  // ── 3. Caller'ın bu org'a üye olduğunu doğrula ──────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .eq("org_id", orgId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // invitedBy artık body'den değil, doğrulanmış session'dan geliyor
  const invitedBy = user.id;

  // ── 4a. Rate limit: son 10 dakikada aynı kullanıcıdan max 5 davet ──────────
  const rateLimitWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabaseAdmin
    .from("org_invitations")
    .select("id", { count: "exact", head: true })
    .eq("invited_by", invitedBy)
    .gte("created_at", rateLimitWindow);

  if ((recentCount ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Çok fazla davet gönderdiniz. Lütfen 10 dakika bekleyin." },
      { status: 429 },
    );
  }

  // ── 4. Aktif davet kontrolü ──────────────────────────────────────────────────
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

  // ── 5. Daveti kaydet ─────────────────────────────────────────────────────────
  const inviteToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const createdAt = new Date().toISOString();
  const { error: dbError } = await supabaseAdmin.from("org_invitations").insert({
    id: crypto.randomUUID(),
    org_id: orgId,
    email,
    token: inviteToken,
    invited_by: invitedBy,
    org_name: orgName,
    expires_at: expiresAt,
    created_at: createdAt,
    accepted: false,
  });

  if (dbError) {
    return NextResponse.json({ error: "Davet oluşturulamadı." }, { status: 500 });
  }

  // ── 6. E-posta gönder ────────────────────────────────────────────────────────
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    req.headers.get("origin") ??
    req.nextUrl.origin
  ).replace(/\s+/g, "");
  const inviteUrl = `${appUrl}/davet?token=${inviteToken}`;

  const { error: emailError } = await resend.emails.send({
    from: "Pixanto <noreply@pixanto.app>",
    to: email,
    subject: `${escapeHtml(orgName)} sizi Pixanto'ya davet etti`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Pixanto'ya Davet</h2>
        <p><strong>${escapeHtml(orgName)}</strong> organizasyonuna katılmak için davet aldınız.</p>
        <p>Aşağıdaki butona tıklayarak hesabınızı oluşturabilir ve takıma katılabilirsiniz.</p>
        <a href="${inviteUrl}"
           style="display:inline-block; margin: 24px 0; padding: 12px 24px;
                  background: #4f46e5; color: #fff; border-radius: 8px;
                  text-decoration: none; font-weight: 600;">
          Daveti Kabul Et
        </a>
        <p style="color: #6b7280; font-size: 12px;">Bu bağlantı 7 gün geçerlidir.</p>
        <p style="color: #9ca3af; font-size: 11px; word-break: break-all;">Buton çalışmazsa bu linki kopyalayın: ${inviteUrl}</p>
      </div>
    `,
  });

  if (emailError) {
    console.error("[invite] Resend error:", emailError);
    await supabaseAdmin.from("org_invitations").delete().eq("token", inviteToken);
    return NextResponse.json({ error: `E-posta gönderilemedi: ${emailError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
