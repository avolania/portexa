# Innovation Bildirimler (Notifications) Design

## Hedef

Innovation modülündeki beş kilit olayda hem uygulama içi (in-app) hem e-posta bildirimi gönder. Bildirimler Topbar çan ikonunda Supabase Realtime ile anlık güncellenir.

---

## Kapsam

**In scope:**
- 5 olay için bildirim tetikleyici: yeni fikir, aşama ilerleme, değerlendirme, kampanya daveti, kampanya sonu
- In-app bildirim: mevcut `notificationService.createNotification()` + Zustand store
- E-posta: Resend SDK doğrudan (mevcut `/api/notify` route'una yeni case'ler eklenmez; server-side servis kendi emailini gönderir)
- Supabase Realtime: Topbar'da mount-time aboneliği
- Vercel Cron: kampanya sonu için günlük job
- Mevcut `Notification` type'ına 5 yeni tip

**Out of scope:**
- Oy (vote) bildirimleri
- Bildirim tercihleri (tüm kullanıcılar tüm olayları alır)
- Push notification / SMS
- Şablonlu HTML e-posta (düz metin yeterli)

---

## Olaylar ve Alıcılar

| Olay | Tetikleyen route | Alıcılar |
|------|-----------------|----------|
| Yeni fikir gönderildi | `POST /api/innovation/ideas` | Org'daki tüm `innovation_admin` + `innovation_evaluator` (submitter hariç) |
| Fikir aşama ilerledi | `POST /api/innovation/ideas/[id]/advance` | Fikir sahibi (`submitter_id`) |
| Fikir değerlendirildi | `POST /api/innovation/ideas/[id]/evaluate` | Fikir sahibi (`submitter_id`) |
| Kampanyaya davet edildi | `POST /api/innovation/campaigns/[id]/invites` | Davet edilen her kullanıcı |
| Kampanya sona erdi | `GET /api/cron/innovation-campaign-ended` | Kampanya yaratıcısı + kampanyaya fikir gönderenler |

---

## Veri Modeli

### `src/types/index.ts` — Notification type genişletmesi

Mevcut `Notification` interface'indeki `type` union'ına ekleme:

```ts
export interface Notification {
  id: string;
  type:
    | "task_assigned" | "task_updated" | "comment" | "deadline"
    | "budget_alert" | "mention" | "approval_requested" | "approval_resolved"
    // Yeni innovation tipleri:
    | "idea_submitted" | "idea_stage_advanced" | "idea_evaluated"
    | "campaign_invite" | "campaign_ended";
  recipientId: string;   // optional → required (innovation için zorunlu; ITSM koduna dokunulmaz)
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}
```

`recipientId`'yi `optional → required` yapmak: mevcut ITSM kodu `createNotification()` servisini çağırmıyor — sadece `/api/notify` route'u üzerinden email gönderiyor. Bu nedenle ITSM tarafında kırılma yoktur. Olası beklenmedik kırılmaları `tsc --noEmit` yakalar.

---

## Servis Katmanı

### `src/lib/innovation/services/innovationNotifications.ts` (yeni dosya)

```ts
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createNotification } from '@/services/notificationService';
import type { Notification } from '@/types';
import type { InnovationIdea, InnovationStage, InnovationCampaign } from '@/lib/innovation/types';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Pixanto <noreply@pixanto.app>';

// ── Yardımcı: DB'ye kaydet + email gönder ───────────────────────────────────

async function notify({
  recipientId,
  orgId,
  type,
  title,
  message,
  link,
  emailSubject,
  emailHtml,
}: {
  recipientId: string;
  orgId: string;
  type: Notification['type'];
  title: string;
  message: string;
  link?: string;
  emailSubject: string;
  emailHtml: string;
}) {
  // 1. In-app — DB'ye yaz (Realtime bu insert'ı yakalar)
  await createNotification(
    { id: uuidv4(), type, recipientId, title, message, read: false, link, createdAt: new Date().toISOString() },
    orgId
  );

  // 2. E-posta — alıcının adresini auth.users'dan al
  const { data } = await supabaseAdmin.auth.admin.getUserById(recipientId);
  const email = data?.user?.email;
  if (!email) return;

  // Fire-and-forget — email başarısız olsa in-app etkilenmez
  resend.emails.send({ from: FROM, to: email, subject: emailSubject, html: emailHtml })
    .catch((err) => console.error('[innovationNotifications] email error:', err));
}

// ── Org'daki evaluator + admin listesi ──────────────────────────────────────

async function getEvaluatorsAndAdmins(orgId: string, excludeUserId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('auth_profiles')
    .select('id')
    .eq('org_id', orgId)
    .in('innovation_role', ['innovation_admin', 'innovation_evaluator'])
    .neq('id', excludeUserId);
  return (data ?? []).map((r) => r.id as string);
}

// ── 5 Bildirim fonksiyonu ────────────────────────────────────────────────────

export async function notifyIdeaSubmitted(
  idea: Pick<InnovationIdea, 'id' | 'idea_number' | 'title' | 'org_id' | 'submitter_id'>,
  submitterName: string,
  appUrl: string
) {
  const recipients = await getEvaluatorsAndAdmins(idea.org_id, idea.submitter_id);
  const link = `${appUrl}/innovation/pipeline`;
  await Promise.allSettled(recipients.map((recipientId) =>
    notify({
      recipientId,
      orgId: idea.org_id,
      type: 'idea_submitted',
      title: 'Yeni fikir gönderildi',
      message: `${submitterName}: "${idea.title}" (${idea.idea_number})`,
      link,
      emailSubject: `Yeni fikir: ${idea.title}`,
      emailHtml: `<p><strong>${submitterName}</strong> yeni bir fikir gönderdi.</p>
        <p><strong>${idea.idea_number} — ${idea.title}</strong></p>
        <p><a href="${link}">Fikri incele →</a></p>`,
    })
  ));
}

export async function notifyIdeaStageAdvanced(
  idea: Pick<InnovationIdea, 'id' | 'idea_number' | 'title' | 'org_id' | 'submitter_id'>,
  newStage: Pick<InnovationStage, 'name'>,
  appUrl: string
) {
  const link = `${appUrl}/innovation/pipeline`;
  await notify({
    recipientId: idea.submitter_id,
    orgId: idea.org_id,
    type: 'idea_stage_advanced',
    title: 'Fikrin yeni aşamaya geçti',
    message: `"${idea.title}" → ${newStage.name}`,
    link,
    emailSubject: `Fikrin "${newStage.name}" aşamasına geçti`,
    emailHtml: `<p>Fikrin <strong>${newStage.name}</strong> aşamasına ilerledi.</p>
      <p><strong>${idea.idea_number} — ${idea.title}</strong></p>
      <p><a href="${link}">Fikri görüntüle →</a></p>`,
  });
}

export async function notifyIdeaEvaluated(
  idea: Pick<InnovationIdea, 'id' | 'idea_number' | 'title' | 'org_id' | 'submitter_id'>,
  evaluatorName: string,
  appUrl: string
) {
  const link = `${appUrl}/innovation/pipeline`;
  await notify({
    recipientId: idea.submitter_id,
    orgId: idea.org_id,
    type: 'idea_evaluated',
    title: 'Fikrin değerlendirildi',
    message: `${evaluatorName}, "${idea.title}" fikrini değerlendirdi`,
    link,
    emailSubject: 'Fikrin değerlendirildi',
    emailHtml: `<p><strong>${evaluatorName}</strong> fikrinin değerlendirmesini tamamladı.</p>
      <p><strong>${idea.idea_number} — ${idea.title}</strong></p>
      <p><a href="${link}">Sonucu görüntüle →</a></p>`,
  });
}

export async function notifyCampaignInvite(
  campaign: Pick<InnovationCampaign, 'id' | 'title' | 'org_id'>,
  invitedUserId: string,
  appUrl: string
) {
  const link = `${appUrl}/innovation/kampanyalar/${campaign.id}`;
  await notify({
    recipientId: invitedUserId,
    orgId: campaign.org_id,
    type: 'campaign_invite',
    title: 'Kampanyaya davet edildin',
    message: `"${campaign.title}" kampanyasına davet edildin`,
    link,
    emailSubject: `"${campaign.title}" kampanyasına davet edildin`,
    emailHtml: `<p>Bir fikir kampanyasına davet edildin.</p>
      <p><strong>${campaign.title}</strong></p>
      <p><a href="${link}">Kampanyayı görüntüle →</a></p>`,
  });
}

export async function notifyCampaignEnded(
  campaign: Pick<InnovationCampaign, 'id' | 'title' | 'org_id' | 'created_by'>,
  participantIds: string[],  // created_by + distinct submitter_ids
  appUrl: string
) {
  const link = `${appUrl}/innovation/kampanyalar/${campaign.id}`;
  await Promise.allSettled(participantIds.map((recipientId) =>
    notify({
      recipientId,
      orgId: campaign.org_id,
      type: 'campaign_ended',
      title: 'Kampanya sona erdi',
      message: `"${campaign.title}" kampanyası sona erdi`,
      link,
      emailSubject: `"${campaign.title}" kampanyası sona erdi`,
      emailHtml: `<p><strong>${campaign.title}</strong> kampanyası sona erdi.</p>
        <p><a href="${link}">Kampanya sonuçlarını görüntüle →</a></p>`,
    })
  ));
}
```

---

## Route Değişiklikleri

### `POST /api/innovation/ideas` — `notifyIdeaSubmitted` çağrısı

`createIdea` başarılı döndükten sonra, submitter'ın adını `auth_profiles.data.name`'den al ve:

```ts
notifyIdeaSubmitted(idea, submitterName, appUrl).catch(console.error);
```

`appUrl`: `process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin`

### `POST /api/innovation/ideas/[id]/advance` — `notifyIdeaStageAdvanced` çağrısı

`advanceStage()` başarılı döndükten sonra fikri ve yeni stage'i çek:

```ts
// advanceStage sadece void döner; idea + yeni stage'i fetch et
const { data: idea } = await supabaseAdmin
  .from('innovation_ideas')
  .select('id, idea_number, title, org_id, submitter_id, stage_id')
  .eq('id', id).single();

const { data: stage } = await supabaseAdmin
  .from('innovation_stages')
  .select('name')
  .eq('id', idea.stage_id).single();

notifyIdeaStageAdvanced(idea, stage, appUrl).catch(console.error);
```

### `POST /api/innovation/ideas/[id]/evaluate` — `notifyIdeaEvaluated` çağrısı

Evaluate route'unda `user.id` zaten mevcut. Evaluator adını `auth_profiles.data.name`'den çek, ardından:

```ts
const { data: evalProfile } = await supabaseAdmin
  .from('auth_profiles')
  .select('data')
  .eq('id', user.id)
  .single();
const evaluatorName = (evalProfile?.data as Record<string, unknown>)?.name as string ?? 'Değerlendirici';

notifyIdeaEvaluated(idea, evaluatorName, appUrl).catch(console.error);
```

`idea` aynı route'un başında zaten fetch edilir (`innovation_ideas` tablosundan).

### `POST /api/innovation/campaigns/[id]/invites` — `notifyCampaignInvite` çağrısı

`addInvites()` başarılı döndükten sonra her `user_id` için:

```ts
await Promise.allSettled(
  body.user_ids.map((uid) => notifyCampaignInvite(campaign, uid, appUrl))
);
```

---

## Cron Job

### `src/app/api/cron/innovation-campaign-ended/route.ts` (yeni dosya)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyCampaignEnded } from '@/lib/innovation/services/innovationNotifications';

export async function GET(req: NextRequest) {
  // Vercel Cron doğrulama
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: campaigns } = await supabaseAdmin
    .from('innovation_campaigns')
    .select('id, title, org_id, created_by')
    .eq('end_date', dateStr);

  if (!campaigns?.length) return NextResponse.json({ ok: true, processed: 0 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  let processed = 0;

  for (const campaign of campaigns) {
    // Kampanyaya fikir gönderen kullanıcılar
    const { data: ideas } = await supabaseAdmin
      .from('innovation_ideas')
      .select('submitter_id')
      .eq('campaign_id', campaign.id);

    const submitterIds = [...new Set((ideas ?? []).map((i) => i.submitter_id as string))];
    const allRecipients = [...new Set([campaign.created_by, ...submitterIds])];

    await notifyCampaignEnded(campaign, allRecipients, appUrl).catch(console.error);
    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
```

### `vercel.json` — cron ekleme

```json
{
  "crons": [
    { "path": "/api/exchange-rates/refresh", "schedule": "0 6 * * *" },
    { "path": "/api/cron/innovation-campaign-ended", "schedule": "0 1 * * *" }
  ]
}
```

---

## Realtime In-App

`src/components/layout/Topbar.tsx`'e mount-time Supabase Realtime aboneliği eklenir:

```ts
useEffect(() => {
  if (!currentUserId) return;

  const channel = supabase
    .channel(`notifications:${currentUserId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
    }, (payload) => {
      // DB şeması JSONB data kolonu kullanıyorsa:
      const notif = (payload.new?.data ?? payload.new) as Notification;
      if (notif.recipientId === currentUserId) {
        receiveRealtime(notif);
      }
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [currentUserId]);
```

`receiveRealtime` mevcut store'da zaten tanımlı — DB'ye yazmaz, sadece state'e ekler ve toast kuyruğuna alır.

**Not:** Realtime filtreleme `recipientId` alanının DB'de top-level kolon olup olmadığına bağlıdır. Eğer `notifications` tablosu JSONB `data` kolonu kullanıyorsa, filtreleme callback içinde yapılır (yukarıdaki kod). Eğer top-level kolon varsa, `filter: 'recipient_id=eq.${currentUserId}'` şeklinde channel seviyesinde filtrelenebilir.

---

## Hata Yönetimi

| Senaryo | Davranış |
|---------|---------|
| Email gönderimi başarısız | `console.error` — in-app bildirim etkilenmez |
| Alıcı kullanıcı bulunamadı | `getUserEmail` null döner, email atlanır |
| `notifyX()` throw atar | `.catch(console.error)` — ana route yanıtı etkilenmez |
| Cron job — kampanya bulunamaz | `{ ok: true, processed: 0 }` |
| Cron job — unauthorized | 401 |
| Realtime bağlantı kesilir | Supabase client otomatik yeniden bağlanır |

---

## Dosya Haritası

| Aksiyon | Dosya | Amaç |
|---------|-------|------|
| Create | `src/lib/innovation/services/innovationNotifications.ts` | 5 bildirim fonksiyonu |
| Create | `src/app/api/cron/innovation-campaign-ended/route.ts` | Kampanya sonu cron job |
| Modify | `src/types/index.ts` | 5 yeni notification type; `recipientId` required |
| Modify | `src/app/api/innovation/ideas/route.ts` | `notifyIdeaSubmitted` çağrısı |
| Modify | `src/app/api/innovation/ideas/[id]/advance/route.ts` | `notifyIdeaStageAdvanced` çağrısı |
| Modify | `src/app/api/innovation/ideas/[id]/evaluate/route.ts` | `notifyIdeaEvaluated` çağrısı |
| Modify | `src/app/api/innovation/campaigns/[id]/invites/route.ts` | `notifyCampaignInvite` çağrısı |
| Modify | `src/components/layout/Topbar.tsx` | Realtime aboneliği |
| Modify | `vercel.json` | Cron schedule ekleme |
