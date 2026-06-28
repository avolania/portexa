import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ROLE_LABELS: Record<string, string> = {
  system_admin: "Sistem Yöneticisi",
  admin:        "Admin",
  pm:           "Proje Yöneticisi",
  member:       "Proje Üyesi",
  approver:     "Onaycı",
  viewer:       "Görüntüleyici",
  end_user:     "Son Kullanıcı",
};

/** Newline ve uzun string injection riskini azaltmak için temizle. */
function sanitize(value: unknown, maxLen = 120): string {
  return String(value ?? "").replace(/[\r\n\t]/g, " ").trim().slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // İstemciden yalnızca messages dizisi alınır — context istemciden ALINMAZ
  const { messages } = await req.json() as { messages: { role: "user" | "assistant"; content: string }[] };

  // Kullanıcı ve organizasyon bilgilerini sunucu tarafında DB'den çek
  const [profileRes] = await Promise.all([
    supabaseAdmin.from("auth_profiles").select("data, org_id").eq("id", user.id).single(),
  ]);

  const profileData = profileRes.data?.data as Record<string, unknown> | null;
  const orgId = profileRes.data?.org_id as string | undefined;

  const orgRow = orgId
    ? await supabaseAdmin.from("organizations").select("data").eq("id", orgId).maybeSingle()
    : null;
  const orgData = orgRow?.data?.data as Record<string, unknown> | null;

  // Güvenli alanlar: DB'den alınan değerler, newline injection'a karşı temizlendi
  const userName  = sanitize(profileData?.name ?? "Bilinmiyor");
  const userRole  = sanitize(profileData?.role ?? "member");
  const roleLabel = ROLE_LABELS[userRole] ?? sanitize(userRole);
  const orgName   = sanitize(orgData?.name ?? "Bilinmiyor");

  const context = [
    `Kullanıcı adı: ${userName}`,
    `Rolü: ${roleLabel}`,
    `Organizasyon: ${orgName}`,
  ].join("\n");

  const system = `Sen Pixanto PPM platformunun yapay zeka asistanı Pixa'sın. Kullanıcıya proje yönetimi, görev takibi, ekip koordinasyonu, bütçe izleme ve yönetişim konularında yardım edersin.

## Davranış kuralları
- Türkçe konuş, kısa ve net cevaplar ver.
- Kullanıcının ROL ve YETKİLERİNE göre cevap ver. Yetkisi olmayan konularda işlem yapamayacağını belirt.
- Sayısal verileri (bütçe, ilerleme, görev sayısı vb.) bağlamdan alarak somut cevaplar ver.
- Öneri sunarken kullanıcının rolünü ve mevcut proje durumunu göz önünde bulundur.
- Yapamayacağın şeyler (gerçek zamanlı güncelleme, dosya yükleme vb.) için net sınırlarını belirt.

## Platform özellikleri
Pixanto şu modülleri içerir:
- **Projeler**: Agile (Kanban/Scrum) ve Waterfall proje yönetimi, faz planlaması
- **Görevler**: Epic, Story, Task, Bug, Subtask, İyileştirme, Test tiplerine destek
- **Ekip**: Üye yönetimi, proje atamaları, rol bazlı erişim
- **Bütçe**: Proje bütçe takibi, gider kayıtları
- **Yönetişim**: Risk kaydı, değişiklik talepleri, karar kaydı, toplantı tutanakları
- **Raporlar**: Haftalık, steerco ve dashboard raporları
- **ITSM**: Incident, servis talebi, değişiklik yönetimi
- **Talepler**: İş akışı tabanlı onay süreçleri
- **Aktiviteler**: Zaman takibi ve aktivite raporlama
- **Platform Yönetimi** (sadece sistem_admin): Organizasyon ve kullanıcı yönetimi

## Roller ve erişim seviyeleri
- **Sistem Yöneticisi**: Tüm organizasyonlara tam erişim
- **Admin**: Tüm proje ve ayarlara tam erişim
- **Proje Yöneticisi**: Proje oluşturma, görev atama, bütçe yönetimi
- **Proje Üyesi**: Atandığı görevleri görüntüleme ve güncelleme
- **Onaycı**: Sadece onay ve görüntüleme
- **Görüntüleyici**: Sadece proje görüntüleme

## Güncel kullanıcı bağlamı
${context}`;

  const stream = await client.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
