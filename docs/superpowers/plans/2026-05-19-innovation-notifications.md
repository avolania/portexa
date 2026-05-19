# Innovation Bildirimler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Innovation modülündeki 5 kilit olayda (yeni fikir, aşama ilerleme, değerlendirme, kampanya daveti, kampanya sonu) hem uygulama içi hem e-posta bildirimi gönder; Topbar çan ikonu Supabase Realtime ile anlık güncellenir.

**Architecture:** Merkezi bir `innovationNotifications.ts` servisi 5 typed fonksiyon barındırır; her fonksiyon mevcut `notificationService.createNotification()` ile DB'ye yazar ve Resend SDK'yı doğrudan çağırarak email gönderir. İlgili API route'ları operasyon sonrası bu fonksiyonları fire-and-forget olarak çağırır. Topbar, Supabase Realtime üzerinden kendi kullanıcısına gelen bildirimleri dinler ve mevcut `receiveRealtime()` store fonksiyonunu tetikler.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (`supabaseAdmin`), Resend, Zustand, Vercel Cron.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/types/index.ts` | 5 yeni notification type + `recipientId` required |
| Create | `src/lib/innovation/services/innovationNotifications.ts` | 5 bildirim fonksiyonu + yardımcı |
| Modify | `src/app/api/innovation/ideas/route.ts` | `notifyIdeaSubmitted` çağrısı |
| Modify | `src/app/api/innovation/ideas/[id]/advance/route.ts` | `notifyIdeaStageAdvanced` çağrısı |
| Modify | `src/app/api/innovation/ideas/[id]/evaluate/route.ts` | `notifyIdeaEvaluated` çağrısı |
| Modify | `src/app/api/innovation/campaigns/[id]/invites/route.ts` | `notifyCampaignInvite` çağrısı |
| Create | `src/app/api/cron/innovation-campaign-ended/route.ts` | Kampanya sonu cron job |
| Modify | `vercel.json` | Cron schedule ekleme |
| Modify | `src/components/layout/Topbar.tsx` | Supabase Realtime aboneliği |

---

## Task 1: Notification Tip Genişletmesi

**Files:**
- Modify: `src/types/index.ts` (satır 294-304)

- [ ] **Step 1: `Notification` interface'ini güncelle**

`src/types/index.ts` dosyasını aç. Şu mevcut bloğu bul:

```ts
export interface Notification {
  id: string;
  type: "task_assigned" | "task_updated" | "comment" | "deadline" | "budget_alert" | "mention" | "approval_requested" | "approval_resolved";
  /** Sadece approval bildirimleri için: hangi kullanıcıya ait */
  recipientId?: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}
```

Şununla değiştir:

```ts
export interface Notification {
  id: string;
  type:
    | "task_assigned" | "task_updated" | "comment" | "deadline"
    | "budget_alert" | "mention" | "approval_requested" | "approval_resolved"
    | "idea_submitted" | "idea_stage_advanced" | "idea_evaluated"
    | "campaign_invite" | "campaign_ended";
  recipientId: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}
```

- [ ] **Step 2: Derlemeyi doğrula**

```bash
npx tsc --noEmit
```

Beklenen: hata yok. Eğer `recipientId` ile ilgili hata çıkarsa, o kullanım yeri `id` değeri set ediyordur — ekle.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(notifications): add innovation notification types"
```

---

## Task 2: `innovationNotifications.ts` Servisi

**Files:**
- Create: `src/lib/innovation/services/innovationNotifications.ts`

- [ ] **Step 1: Dosyayı oluştur**

```ts
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createNotification } from '@/services/notificationService';
import type { Notification } from '@/types';
import type { InnovationIdea, InnovationStage, InnovationCampaign } from '@/lib/innovation/types';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Pixanto <noreply@pixanto.app>';

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
  await createNotification(
    {
      id: crypto.randomUUID(),
      type,
      recipientId,
      title,
      message,
      read: false,
      link,
      createdAt: new Date().toISOString(),
    },
    orgId
  );

  const { data } = await supabaseAdmin.auth.admin.getUserById(recipientId);
  const email = data?.user?.email;
  if (!email) return;

  resend.emails
    .send({ from: FROM, to: email, subject: emailSubject, html: emailHtml })
    .catch((err) => console.error('[innovationNotifications] email:', err));
}

async function getEvaluatorsAndAdmins(orgId: string, excludeUserId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('auth_profiles')
    .select('id')
    .eq('org_id', orgId)
    .in('innovation_role', ['innovation_admin', 'innovation_evaluator'])
    .neq('id', excludeUserId);
  return (data ?? []).map((r) => r.id as string);
}

export async function notifyIdeaSubmitted(
  idea: Pick<InnovationIdea, 'id' | 'idea_number' | 'title' | 'org_id' | 'submitter_id'>,
  submitterName: string,
  appUrl: string
) {
  const recipients = await getEvaluatorsAndAdmins(idea.org_id, idea.submitter_id);
  const link = `${appUrl}/innovation/pipeline`;
  await Promise.allSettled(
    recipients.map((recipientId) =>
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
    )
  );
}

export async function notifyIdeaStageAdvanced(
  idea: Pick<InnovationIdea, 'id' | 'idea_number' | 'title' | 'org_id' | 'submitter_id'>,
  newStageName: string,
  appUrl: string
) {
  const link = `${appUrl}/innovation/pipeline`;
  await notify({
    recipientId: idea.submitter_id,
    orgId: idea.org_id,
    type: 'idea_stage_advanced',
    title: 'Fikrin yeni aşamaya geçti',
    message: `"${idea.title}" → ${newStageName}`,
    link,
    emailSubject: `Fikrin "${newStageName}" aşamasına geçti`,
    emailHtml: `<p>Fikrin <strong>${newStageName}</strong> aşamasına ilerledi.</p>
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
  participantIds: string[],
  appUrl: string
) {
  const link = `${appUrl}/innovation/kampanyalar/${campaign.id}`;
  await Promise.allSettled(
    participantIds.map((recipientId) =>
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
    )
  );
}
```

- [ ] **Step 2: Derlemeyi doğrula**

```bash
npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/services/innovationNotifications.ts
git commit -m "feat(notifications): add innovationNotifications service"
```

---

## Task 3: `POST /api/innovation/ideas` — `notifyIdeaSubmitted`

**Files:**
- Modify: `src/app/api/innovation/ideas/route.ts`

Mevcut `getCtx` sadece `'org_id, innovation_role'` seçiyor. Submitter adını almak için `data` da seçilmeli.

- [ ] **Step 1: `getCtx`'i güncelle ve notification import'unu ekle**

Dosyanın başındaki import bloğunu bul:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createIdea, findIdeas } from '@/lib/innovation/services/ideasService';
import type { CreateIdeaDto } from '@/lib/innovation/types';
```

Şununla değiştir:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createIdea, findIdeas } from '@/lib/innovation/services/ideasService';
import { notifyIdeaSubmitted } from '@/lib/innovation/services/innovationNotifications';
import type { CreateIdeaDto } from '@/lib/innovation/types';
```

- [ ] **Step 2: `getCtx`'te `data` sütununu da seç**

Bul:

```ts
    .select('org_id, innovation_role')
```

Şununla değiştir:

```ts
    .select('org_id, innovation_role, data')
```

Ve return bloğunu güncelle. Bul:

```ts
  return {
    userId: user.id,
    orgId: p.org_id as string,
    innovationRole: (p.innovation_role ?? null) as string | null,
  };
```

Şununla değiştir:

```ts
  const profileData = p.data as Record<string, unknown> | null;
  return {
    userId: user.id,
    orgId: p.org_id as string,
    innovationRole: (p.innovation_role ?? null) as string | null,
    submitterName: (profileData?.name as string | undefined) ?? 'Kullanıcı',
  };
```

- [ ] **Step 3: `POST` handler'da bildirimi tetikle**

Mevcut `POST` handler'ındaki try bloğunu bul:

```ts
  try {
    const idea = await createIdea({ orgId: ctx.orgId, submitterId: ctx.userId, dto, innovationRole: ctx.innovationRole });
    return NextResponse.json(idea, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
```

Şununla değiştir:

```ts
  try {
    const idea = await createIdea({ orgId: ctx.orgId, submitterId: ctx.userId, dto, innovationRole: ctx.innovationRole });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    notifyIdeaSubmitted(idea, ctx.submitterName, appUrl).catch(console.error);
    return NextResponse.json(idea, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
```

- [ ] **Step 4: Derlemeyi doğrula**

```bash
npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/innovation/ideas/route.ts
git commit -m "feat(notifications): notify evaluators on new idea submission"
```

---

## Task 4: `POST /api/innovation/ideas/[id]/advance` — `notifyIdeaStageAdvanced`

**Files:**
- Modify: `src/app/api/innovation/ideas/[id]/advance/route.ts`

Mevcut route `advanceStage()` başarılı olduğunda `{ ok: true }` döner. Bildirimi tetiklemek için fikrin güncel `stage_id`'sini ve yeni stage adını fetch etmek gerekir.

- [ ] **Step 1: Import ekle**

Dosyanın başını bul:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { advanceStage } from '@/lib/innovation/services/ideasService';
import type { AdvanceStageDto, InnovationRole } from '@/lib/innovation/types';
```

Şununla değiştir:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { advanceStage } from '@/lib/innovation/services/ideasService';
import { notifyIdeaStageAdvanced } from '@/lib/innovation/services/innovationNotifications';
import type { AdvanceStageDto, InnovationRole } from '@/lib/innovation/types';
```

- [ ] **Step 2: try bloğunu güncelle**

Mevcut try bloğunu bul:

```ts
  const dto = await req.json() as AdvanceStageDto;
  try {
    await advanceStage({ ideaId: id, userId: user.id, dto });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
```

Şununla değiştir:

```ts
  const dto = await req.json() as AdvanceStageDto;
  try {
    await advanceStage({ ideaId: id, userId: user.id, dto });

    // Bildirim için fikir + yeni stage'i çek (fire-and-forget)
    const sendNotification = async () => {
      const { data: idea } = await supabaseAdmin
        .from('innovation_ideas')
        .select('id, idea_number, title, org_id, submitter_id, stage_id')
        .eq('id', id)
        .single();
      if (!idea) return;

      const { data: stage } = await supabaseAdmin
        .from('innovation_stages')
        .select('name')
        .eq('id', idea.stage_id)
        .single();
      if (!stage) return;

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
      await notifyIdeaStageAdvanced(
        idea as { id: string; idea_number: string; title: string; org_id: string; submitter_id: string },
        stage.name as string,
        appUrl
      );
    };
    sendNotification().catch(console.error);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
```

- [ ] **Step 3: Derlemeyi doğrula**

```bash
npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/innovation/ideas/[id]/advance/route.ts"
git commit -m "feat(notifications): notify submitter on idea stage advance"
```

---

## Task 5: `POST /api/innovation/ideas/[id]/evaluate` — `notifyIdeaEvaluated`

**Files:**
- Modify: `src/app/api/innovation/ideas/[id]/evaluate/route.ts`

Mevcut route fikri sadece `stage_id` için seçiyor. Bildirim için `submitter_id`, `title`, `idea_number`, `org_id` de gerekiyor.

- [ ] **Step 1: Import ekle**

Dosyanın başını bul:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { saveEvaluation } from '@/lib/innovation/services/evaluationService';
import type { CreateEvaluationDto, InnovationRole } from '@/lib/innovation/types';
```

Şununla değiştir:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { saveEvaluation } from '@/lib/innovation/services/evaluationService';
import { notifyIdeaEvaluated } from '@/lib/innovation/services/innovationNotifications';
import type { CreateEvaluationDto, InnovationRole } from '@/lib/innovation/types';
```

- [ ] **Step 2: Fikir sorgusunu genişlet**

Bul:

```ts
  const { data: idea } = await supabaseAdmin
    .from('innovation_ideas')
    .select('stage_id')
    .eq('id', id)
    .single();
  if (!idea) return NextResponse.json({ error: 'Fikir bulunamadı' }, { status: 404 });
```

Şununla değiştir:

```ts
  const { data: idea } = await supabaseAdmin
    .from('innovation_ideas')
    .select('id, idea_number, title, org_id, submitter_id, stage_id')
    .eq('id', id)
    .single();
  if (!idea) return NextResponse.json({ error: 'Fikir bulunamadı' }, { status: 404 });
```

- [ ] **Step 3: try bloğunu güncelle**

Bul:

```ts
  try {
    const result = await saveEvaluation({
      ideaId: id,
      evaluatorId: user.id,
      stageId: idea.stage_id as string,
      role,
      dto,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
```

Şununla değiştir:

```ts
  try {
    const result = await saveEvaluation({
      ideaId: id,
      evaluatorId: user.id,
      stageId: idea.stage_id as string,
      role,
      dto,
    });

    // Bildirim — evaluator adını çek (fire-and-forget)
    const sendNotification = async () => {
      const { data: evalProfile } = await supabaseAdmin
        .from('auth_profiles')
        .select('data')
        .eq('id', user.id)
        .single();
      const evaluatorName =
        (evalProfile?.data as Record<string, unknown> | null)?.name as string | undefined
        ?? 'Değerlendirici';
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
      await notifyIdeaEvaluated(
        idea as { id: string; idea_number: string; title: string; org_id: string; submitter_id: string },
        evaluatorName,
        appUrl
      );
    };
    sendNotification().catch(console.error);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
```

- [ ] **Step 4: Derlemeyi doğrula**

```bash
npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/innovation/ideas/[id]/evaluate/route.ts"
git commit -m "feat(notifications): notify submitter on idea evaluation"
```

---

## Task 6: `POST /api/innovation/campaigns/[id]/invites` — `notifyCampaignInvite`

**Files:**
- Modify: `src/app/api/innovation/campaigns/[id]/invites/route.ts`

- [ ] **Step 1: Import ekle**

Dosyanın başındaki import bloğunu bul:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getCampaign, getInvites, addInvites, removeInvite,
} from '@/lib/innovation/services/campaignService';
```

Şununla değiştir:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getCampaign, getInvites, addInvites, removeInvite,
} from '@/lib/innovation/services/campaignService';
import { notifyCampaignInvite } from '@/lib/innovation/services/innovationNotifications';
```

- [ ] **Step 2: `POST` handler'ına bildirim ekle**

Mevcut `POST` handler'ının try bloğunu bul:

```ts
  try {
    const body = await req.json() as { user_ids: string[] };
    if (!Array.isArray(body.user_ids)) {
      return NextResponse.json({ error: 'user_ids dizisi zorunludur' }, { status: 400 });
    }
    const result = await addInvites(id, body.user_ids);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
```

Şununla değiştir:

```ts
  try {
    const body = await req.json() as { user_ids: string[] };
    if (!Array.isArray(body.user_ids)) {
      return NextResponse.json({ error: 'user_ids dizisi zorunludur' }, { status: 400 });
    }
    const result = await addInvites(id, body.user_ids);

    // Her davet edilen kullanıcıya bildirim (fire-and-forget)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    Promise.allSettled(
      body.user_ids.map((uid) => notifyCampaignInvite(campaign, uid, appUrl))
    ).catch(console.error);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
```

- [ ] **Step 3: Derlemeyi doğrula**

```bash
npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/innovation/campaigns/[id]/invites/route.ts"
git commit -m "feat(notifications): notify users on campaign invite"
```

---

## Task 7: Cron Job + `vercel.json`

**Files:**
- Create: `src/app/api/cron/innovation-campaign-ended/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Cron route oluştur**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyCampaignEnded } from '@/lib/innovation/services/innovationNotifications';

export async function GET(req: NextRequest) {
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

  if (!campaigns?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  let processed = 0;

  for (const campaign of campaigns) {
    const { data: ideas } = await supabaseAdmin
      .from('innovation_ideas')
      .select('submitter_id')
      .eq('campaign_id', campaign.id);

    const submitterIds = [
      ...new Set((ideas ?? []).map((i) => i.submitter_id as string)),
    ];
    const allRecipients = [
      ...new Set([campaign.created_by as string, ...submitterIds]),
    ];

    await notifyCampaignEnded(
      campaign as { id: string; title: string; org_id: string; created_by: string },
      allRecipients,
      appUrl
    ).catch(console.error);

    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
```

- [ ] **Step 2: `vercel.json`'u güncelle**

Mevcut içerik:

```json
{
  "crons": [
    {
      "path": "/api/exchange-rates/refresh",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Yeni içerik:

```json
{
  "crons": [
    {
      "path": "/api/exchange-rates/refresh",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/innovation-campaign-ended",
      "schedule": "0 1 * * *"
    }
  ]
}
```

- [ ] **Step 3: Derlemeyi doğrula**

```bash
npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/cron/innovation-campaign-ended/route.ts" vercel.json
git commit -m "feat(notifications): add campaign-ended cron job"
```

---

## Task 8: Topbar Realtime Aboneliği

**Files:**
- Modify: `src/components/layout/Topbar.tsx`

- [ ] **Step 1: Import'ları güncelle**

Mevcut import bloğunu bul:

```ts
import { useState, useRef, useEffect, useCallback } from "react";
```

Şununla değiştir:

```ts
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Notification } from "@/types";
```

- [ ] **Step 2: Store'dan `receiveRealtime` al**

Bul:

```ts
  const unreadCount = useNotificationStore((s) => s.unreadCount());
```

Şununla değiştir:

```ts
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const receiveRealtime = useNotificationStore((s) => s.receiveRealtime);
```

- [ ] **Step 3: Realtime `useEffect` ekle**

Mevcut ilk `useEffect`'in hemen önüne (satır 82 civarı, `search(query)` çağıran effect'ten önce) şunu ekle:

```ts
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          // DB JSONB data kolonu kullanıyorsa payload.new.data içinde; değilse doğrudan payload.new
          const notif = (raw?.data ?? raw) as Notification;
          if (notif?.recipientId === user.id) {
            receiveRealtime(notif);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, receiveRealtime]);
```

- [ ] **Step 4: Derlemeyi doğrula**

```bash
npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Topbar.tsx
git commit -m "feat(notifications): add realtime notification subscription to Topbar"
```

---

## Self-Review

### Spec Coverage

| Spec gereksinimi | Kapsayan görev |
|-----------------|----------------|
| 5 yeni tip + `recipientId` required | Task 1 |
| `innovationNotifications.ts` servisi, 5 fonksiyon | Task 2 |
| `notifyIdeaSubmitted` → ideas POST route | Task 3 |
| `notifyIdeaStageAdvanced` → advance route | Task 4 |
| `notifyIdeaEvaluated` → evaluate route | Task 5 |
| `notifyCampaignInvite` → invites POST route | Task 6 |
| Cron job + vercel.json | Task 7 |
| Realtime abonelik → Topbar | Task 8 |
| Email: Resend doğrudan, fire-and-forget | Task 2 (`notify()` yardımcısı) |
| Org'daki evaluator + admin listesi (submitter hariç) | Task 2 (`getEvaluatorsAndAdmins`) |
| Kampanya katılımcıları = created_by + distinct submitter_ids | Task 7 |

Tüm gereksinimler kapsanmaktadır.
