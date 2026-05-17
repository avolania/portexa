# Innovation Campaigns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stage-gate campaign management to the innovation module — admins create time-boxed idea collection campaigns, users submit ideas into campaign pipelines, separate from the general pipeline.

**Architecture:** Campaigns are first-class DB entities (`innovation_campaigns`, `innovation_campaign_invites`). Ideas get a nullable `campaign_id` FK — `NULL` means general pool, a UUID means campaign idea. The existing global stage-gate pipeline is reused unchanged; campaigns just filter ideas by `campaign_id`. A new `/innovation/kampanyalar` section provides list + detail pages.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase (supabaseAdmin for all server-side DB access), Lucide React icons, date-fns.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `supabase-innovation-campaigns.sql` | DB migration |
| Modify | `src/lib/innovation/types/index.ts` | Campaign types + updated DTOs |
| Create | `src/lib/innovation/repositories/campaignsRepo.ts` | Campaign + invite DB queries |
| Create | `src/lib/innovation/services/campaignService.ts` | Business logic + `deriveCampaignStatus` |
| Create | `src/app/api/innovation/campaigns/route.ts` | GET list + POST create |
| Create | `src/app/api/innovation/campaigns/[id]/route.ts` | GET + PATCH + DELETE |
| Create | `src/app/api/innovation/campaigns/[id]/invites/route.ts` | GET + POST + DELETE invites |
| Modify | `src/lib/innovation/repositories/ideasRepo.ts` | `campaign_id` filter + column in insert |
| Modify | `src/lib/innovation/services/ideasService.ts` | Campaign validation on createIdea |
| Modify | `src/app/api/innovation/ideas/route.ts` | Pass `campaign_id` query param + DTO field |
| Modify | `src/app/(app)/innovation/pipeline/page.tsx` | Add `campaign_id=none` filter |
| Modify | `src/components/layout/Sidebar.tsx` | Add Kampanyalar nav item |
| Create | `src/app/(app)/innovation/kampanyalar/page.tsx` | Campaign list page |
| Create | `src/app/(app)/innovation/kampanyalar/[id]/page.tsx` | Campaign detail page |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase-innovation-campaigns.sql`

- [ ] **Step 1: Create the SQL migration file**

```sql
-- supabase-innovation-campaigns.sql

CREATE TABLE innovation_campaigns (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         uuid NOT NULL,
  created_by     uuid NOT NULL,
  title          text NOT NULL,
  description    text,
  goal           text,
  start_date     date NOT NULL,
  end_date       date NOT NULL,
  is_invite_only boolean NOT NULL DEFAULT false,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);

ALTER TABLE innovation_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON innovation_campaigns
  USING (auth.role() = 'service_role');

CREATE TABLE innovation_campaign_invites (
  campaign_id uuid NOT NULL REFERENCES innovation_campaigns(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);

ALTER TABLE innovation_campaign_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON innovation_campaign_invites
  USING (auth.role() = 'service_role');

ALTER TABLE innovation_ideas
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES innovation_campaigns(id) ON DELETE SET NULL;

CREATE INDEX ON innovation_ideas (campaign_id);
```

- [ ] **Step 2: Run the migration in Supabase**

Open Supabase dashboard → SQL Editor → paste and run the file content. Verify:
- Table `innovation_campaigns` exists with all columns.
- Table `innovation_campaign_invites` exists with composite PK.
- `innovation_ideas` has column `campaign_id` (nullable uuid).

- [ ] **Step 3: Commit**

```bash
git add supabase-innovation-campaigns.sql
git commit -m "feat(innovation): add campaigns and campaign_invites DB migration"
```

---

## Task 2: Campaign Types

**Files:**
- Modify: `src/lib/innovation/types/index.ts`

- [ ] **Step 1: Add campaign types and update DTOs**

Append to `src/lib/innovation/types/index.ts` (after the existing content):

```ts
// ── Campaign types ────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'active' | 'ended';

export interface InnovationCampaign {
  id: string;
  org_id: string;
  created_by: string;
  title: string;
  description: string | null;
  goal: string | null;
  start_date: string;    // YYYY-MM-DD
  end_date: string;      // YYYY-MM-DD
  is_invite_only: boolean;
  created_at: string;
  updated_at: string;
  // Derived — not stored in DB
  status: CampaignStatus;
  idea_count: number;
  invite_count?: number;
}

export interface CampaignInvite {
  campaign_id: string;
  user_id: string;
  name: string;
  avatar?: string;
  created_at: string;
}

export interface CreateCampaignDto {
  title: string;
  description?: string;
  goal?: string;
  start_date: string;
  end_date: string;
  is_invite_only?: boolean;
}

export interface UpdateCampaignDto {
  title?: string;
  description?: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  is_invite_only?: boolean;
}
```

Also update the existing `CreateIdeaDto` — add `campaign_id`:

```ts
export interface CreateIdeaDto {
  title: string;
  description: string;
  category: string;
  estimated_value?: number;
  currency_code?: string;
  tag_ids?: string[];
  campaign_id?: string;    // ← add this line
}
```

Also update `IdeasListParams` — add `campaign_id`:

```ts
export interface IdeasListParams {
  org_id: string;
  stage_id?: string;
  status?: string;
  search?: string;
  sort?: 'date' | 'score' | 'votes';
  page?: number;
  limit?: number;
  campaign_id?: string | 'none';    // ← add this line
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/types/index.ts
git commit -m "feat(innovation): add campaign types and update CreateIdeaDto/IdeasListParams"
```

---

## Task 3: `campaignsRepo.ts`

**Files:**
- Create: `src/lib/innovation/repositories/campaignsRepo.ts`

- [ ] **Step 1: Create the repository file**

```ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationCampaign, CampaignInvite, CreateCampaignDto, UpdateCampaignDto } from '../types';

const mapProfile = (p: Record<string, unknown> | null | undefined) =>
  p ? { id: p.id as string, name: ((p.data as Record<string, unknown>)?.name ?? 'Bilinmiyor') as string } : undefined;

export async function findCampaignsByOrg(orgId: string): Promise<Omit<InnovationCampaign, 'status'>[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_campaigns')
    .select('*, idea_count:innovation_ideas(count)')
    .eq('org_id', orgId)
    .order('start_date', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...row,
    idea_count: (row.idea_count as Array<{ count: number }>)?.[0]?.count ?? 0,
  })) as Omit<InnovationCampaign, 'status'>[];
}

export async function findCampaignById(id: string): Promise<Omit<InnovationCampaign, 'status'> | null> {
  const { data, error } = await supabaseAdmin
    .from('innovation_campaigns')
    .select('*, idea_count:innovation_ideas(count), invite_count:innovation_campaign_invites(count)')
    .eq('id', id)
    .single();
  if (error) return null;

  const row = data as Record<string, unknown>;
  return {
    ...row,
    idea_count: (row.idea_count as Array<{ count: number }>)?.[0]?.count ?? 0,
    invite_count: (row.invite_count as Array<{ count: number }>)?.[0]?.count ?? 0,
  } as Omit<InnovationCampaign, 'status'>;
}

export async function createCampaign(params: {
  orgId: string;
  createdBy: string;
  dto: CreateCampaignDto;
}): Promise<Omit<InnovationCampaign, 'status'>> {
  const { data, error } = await supabaseAdmin
    .from('innovation_campaigns')
    .insert({
      id: crypto.randomUUID(),
      org_id: params.orgId,
      created_by: params.createdBy,
      title: params.dto.title,
      description: params.dto.description ?? null,
      goal: params.dto.goal ?? null,
      start_date: params.dto.start_date,
      end_date: params.dto.end_date,
      is_invite_only: params.dto.is_invite_only ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...(data as Record<string, unknown>), idea_count: 0 } as Omit<InnovationCampaign, 'status'>;
}

export async function updateCampaign(id: string, dto: UpdateCampaignDto): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_campaigns')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_campaigns')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function countIdeasForCampaign(campaignId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('innovation_ideas')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);
  return count ?? 0;
}

export async function findInvites(campaignId: string): Promise<CampaignInvite[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_campaign_invites')
    .select('*, profile:auth_profiles!innovation_campaign_invites_user_id_fkey(id, data)')
    .eq('campaign_id', campaignId)
    .order('created_at');
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const profile = mapProfile(row.profile as Record<string, unknown>);
    return {
      campaign_id: row.campaign_id as string,
      user_id: row.user_id as string,
      name: profile?.name ?? 'Bilinmiyor',
      created_at: row.created_at as string,
    };
  });
}

export async function addInvites(campaignId: string, userIds: string[]): Promise<{ added: number; already_invited: number }> {
  const existing = await supabaseAdmin
    .from('innovation_campaign_invites')
    .select('user_id')
    .eq('campaign_id', campaignId)
    .in('user_id', userIds);

  const existingIds = new Set((existing.data ?? []).map((r) => (r as { user_id: string }).user_id));
  const newIds = userIds.filter((id) => !existingIds.has(id));

  if (newIds.length > 0) {
    const { error } = await supabaseAdmin
      .from('innovation_campaign_invites')
      .insert(newIds.map((uid) => ({
        campaign_id: campaignId,
        user_id: uid,
        created_at: new Date().toISOString(),
      })));
    if (error) throw new Error(error.message);
  }

  return { added: newIds.length, already_invited: existingIds.size };
}

export async function removeInvite(campaignId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_campaign_invites')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function isInvited(campaignId: string, userId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from('innovation_campaign_invites')
    .select('user_id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  return (count ?? 0) > 0;
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/repositories/campaignsRepo.ts
git commit -m "feat(innovation): add campaignsRepo with CRUD + invite management"
```

---

## Task 4: `campaignService.ts`

**Files:**
- Create: `src/lib/innovation/services/campaignService.ts`

- [ ] **Step 1: Create the service file**

```ts
import * as campaignsRepo from '../repositories/campaignsRepo';
import type {
  InnovationCampaign, CampaignStatus, CampaignInvite,
  CreateCampaignDto, UpdateCampaignDto,
} from '../types';

export function deriveCampaignStatus(startDate: string, endDate: string): CampaignStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return 'draft';
  if (today > endDate) return 'ended';
  return 'active';
}

function withStatus(c: Omit<InnovationCampaign, 'status'>): InnovationCampaign {
  return { ...c, status: deriveCampaignStatus(c.start_date, c.end_date) };
}

export async function listCampaigns(orgId: string): Promise<InnovationCampaign[]> {
  const rows = await campaignsRepo.findCampaignsByOrg(orgId);
  return rows.map(withStatus);
}

export async function getCampaign(id: string): Promise<InnovationCampaign | null> {
  const row = await campaignsRepo.findCampaignById(id);
  if (!row) return null;
  return withStatus(row);
}

export async function createCampaign(params: {
  orgId: string;
  createdBy: string;
  dto: CreateCampaignDto;
}): Promise<InnovationCampaign> {
  if (!params.dto.title?.trim()) throw new Error('Başlık zorunludur');
  if (!params.dto.start_date || !params.dto.end_date) throw new Error('Başlangıç ve bitiş tarihleri zorunludur');
  if (params.dto.end_date < params.dto.start_date) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz');

  const row = await campaignsRepo.createCampaign(params);
  return withStatus(row);
}

export async function updateCampaign(params: {
  campaign: InnovationCampaign;
  dto: UpdateCampaignDto;
}): Promise<void> {
  const { campaign, dto } = params;
  const newStart = dto.start_date ?? campaign.start_date;
  const newEnd = dto.end_date ?? campaign.end_date;
  if (newEnd < newStart) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz');
  await campaignsRepo.updateCampaign(campaign.id, dto);
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const count = await campaignsRepo.countIdeasForCampaign(campaignId);
  if (count > 0) throw new Error(`Bu kampanyada ${count} fikir bulunuyor. Önce fikirleri taşıyın veya kampanyayı kapatın.`);
  await campaignsRepo.deleteCampaign(campaignId);
}

export async function getInvites(campaignId: string): Promise<CampaignInvite[]> {
  return campaignsRepo.findInvites(campaignId);
}

export async function addInvites(
  campaignId: string,
  userIds: string[]
): Promise<{ added: number; already_invited: number }> {
  if (!userIds.length) return { added: 0, already_invited: 0 };
  return campaignsRepo.addInvites(campaignId, userIds);
}

export async function removeInvite(campaignId: string, userId: string): Promise<void> {
  return campaignsRepo.removeInvite(campaignId, userId);
}

export async function checkSubmissionAccess(params: {
  campaign: InnovationCampaign;
  userId: string;
  innovationRole: string | null;
}): Promise<{ allowed: boolean; reason?: string }> {
  const { campaign, userId, innovationRole } = params;

  if (campaign.status !== 'active') {
    return { allowed: false, reason: 'Kampanya aktif değil' };
  }

  if (campaign.is_invite_only && innovationRole !== 'innovation_admin') {
    const invited = await campaignsRepo.isInvited(campaign.id, userId);
    if (!invited) {
      return { allowed: false, reason: 'Bu kampanya yalnızca davetli katılımcılara açıktır' };
    }
  }

  return { allowed: true };
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/services/campaignService.ts
git commit -m "feat(innovation): add campaignService with status derivation and access control"
```

---

## Task 5: Campaigns List + Create API

**Files:**
- Create: `src/app/api/innovation/campaigns/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  listCampaigns, createCampaign,
} from '@/lib/innovation/services/campaignService';
import type { CreateCampaignDto } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id, innovation_role')
    .eq('id', user.id)
    .single();
  if (!p) return null;
  return {
    userId: user.id,
    orgId: p.org_id as string,
    innovationRole: (p.innovation_role ?? null) as string | null,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const all = await listCampaigns(ctx.orgId);
    const visible = ctx.innovationRole === 'innovation_admin'
      ? all
      : all.filter((c) => c.status === 'active');
    return NextResponse.json(visible);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.innovationRole !== 'innovation_admin') {
    return NextResponse.json({ error: 'Sadece innovation_admin kampanya oluşturabilir' }, { status: 403 });
  }

  try {
    const dto = await req.json() as CreateCampaignDto;
    const campaign = await createCampaign({ orgId: ctx.orgId, createdBy: ctx.userId, dto });
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Manual test**

Start dev server (`npm run dev`). Using browser devtools or a REST client:
```
GET /api/innovation/campaigns
Authorization: Bearer <session_token>
```
Expected: `200` with an empty array `[]` (no campaigns yet).

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/innovation/campaigns/route.ts"
git commit -m "feat(innovation): add campaigns list + create API"
```

---

## Task 6: Campaign Detail API

**Files:**
- Create: `src/app/api/innovation/campaigns/[id]/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getCampaign, updateCampaign, deleteCampaign,
} from '@/lib/innovation/services/campaignService';
import type { UpdateCampaignDto } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id, innovation_role')
    .eq('id', user.id)
    .single();
  if (!p) return null;
  return {
    userId: user.id,
    orgId: p.org_id as string,
    innovationRole: (p.innovation_role ?? null) as string | null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const campaign = await getCampaign(id);
    if (!campaign) return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });
    if (campaign.status === 'draft' && ctx.innovationRole !== 'innovation_admin') {
      return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });
    }
    if (campaign.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });
    }
    return NextResponse.json(campaign);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.innovationRole !== 'innovation_admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const campaign = await getCampaign(id);
    if (!campaign || campaign.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });
    }
    const dto = await req.json() as UpdateCampaignDto;
    await updateCampaign({ campaign, dto });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.innovationRole !== 'innovation_admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const campaign = await getCampaign(id);
    if (!campaign || campaign.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });
    }
    await deleteCampaign(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/innovation/campaigns/[id]/route.ts"
git commit -m "feat(innovation): add campaign detail GET/PATCH/DELETE API"
```

---

## Task 7: Invites API

**Files:**
- Create: `src/app/api/innovation/campaigns/[id]/invites/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getCampaign, getInvites, addInvites, removeInvite,
} from '@/lib/innovation/services/campaignService';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id, innovation_role')
    .eq('id', user.id)
    .single();
  if (!p) return null;
  return {
    userId: user.id,
    orgId: p.org_id as string,
    innovationRole: (p.innovation_role ?? null) as string | null,
  };
}

async function resolveCampaign(id: string, orgId: string) {
  const campaign = await getCampaign(id);
  if (!campaign || campaign.org_id !== orgId) return null;
  return campaign;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.innovationRole !== 'innovation_admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const { id } = await params;
  const campaign = await resolveCampaign(id, ctx.orgId);
  if (!campaign) return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });

  try {
    const invites = await getInvites(id);
    return NextResponse.json(invites);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.innovationRole !== 'innovation_admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const { id } = await params;
  const campaign = await resolveCampaign(id, ctx.orgId);
  if (!campaign) return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });

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
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.innovationRole !== 'innovation_admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const { id } = await params;
  const campaign = await resolveCampaign(id, ctx.orgId);
  if (!campaign) return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 });

  try {
    const body = await req.json() as { user_id: string };
    if (!body.user_id) {
      return NextResponse.json({ error: 'user_id zorunludur' }, { status: 400 });
    }
    await removeInvite(id, body.user_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/innovation/campaigns/[id]/invites/route.ts"
git commit -m "feat(innovation): add campaign invites GET/POST/DELETE API"
```

---

## Task 8: Update Ideas Repo, Service, and Route

**Files:**
- Modify: `src/lib/innovation/repositories/ideasRepo.ts`
- Modify: `src/lib/innovation/services/ideasService.ts`
- Modify: `src/app/api/innovation/ideas/route.ts`

- [ ] **Step 1: Update `ideasRepo.ts` — add `campaign_id` filter and column**

In `findIdeas`, after `if (status) query = query.eq('status', status);`, add:

```ts
  if (params.campaign_id === 'none') {
    query = query.is('campaign_id', null);
  } else if (params.campaign_id) {
    query = query.eq('campaign_id', params.campaign_id);
  }
```

In `createIdea`, add `campaign_id` to the params type and the insert:

Replace the `createIdea` function signature:
```ts
export async function createIdea(params: {
  ideaNumber: string;
  orgId: string;
  submitterId: string;
  stageId: string;
  title: string;
  description: string;
  category: string;
  estimatedValue?: number;
  currencyCode: string;
  campaignId?: string;
}): Promise<InnovationIdea> {
```

And in the `.insert({...})` block, add:
```ts
      campaign_id: params.campaignId ?? null,
```

- [ ] **Step 2: Update `ideasService.ts` — campaign validation on create**

Add `getCampaign` and `checkSubmissionAccess` imports at the top:

```ts
import { getCampaign, checkSubmissionAccess } from './campaignService';
```

Update `createIdea` params type to include `innovationRole`:

```ts
export async function createIdea(params: {
  orgId: string;
  submitterId: string;
  dto: CreateIdeaDto;
  innovationRole: string | null;
}): Promise<InnovationIdea> {
```

Add campaign validation block inside `createIdea`, before calling `ideasRepo.createIdea`:

```ts
  let campaignId: string | undefined;
  if (params.dto.campaign_id) {
    const campaign = await getCampaign(params.dto.campaign_id);
    if (!campaign) throw new Error('Kampanya bulunamadı');

    const access = await checkSubmissionAccess({
      campaign,
      userId: params.submitterId,
      innovationRole: params.innovationRole,
    });
    if (!access.allowed) throw new Error(access.reason ?? 'Bu kampanyaya fikir gönderemezsiniz');
    campaignId = campaign.id;
  }
```

Pass `campaignId` to `ideasRepo.createIdea`:

```ts
  const idea = await ideasRepo.createIdea({
    ideaNumber,
    orgId: params.orgId,
    submitterId: params.submitterId,
    stageId,
    title: params.dto.title,
    description: params.dto.description ?? '',
    category: params.dto.category ?? '',
    estimatedValue: params.dto.estimated_value,
    currencyCode: params.dto.currency_code ?? 'TRY',
    campaignId,
  });
```

- [ ] **Step 3: Update `ideas/route.ts` — pass `campaign_id` + `innovationRole`**

In the `GET` handler, pass `campaign_id` from query params to `findIdeas`:

```ts
    const result = await findIdeas({
      org_id: ctx.orgId,
      stage_id: searchParams.get('stage') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      sort: (searchParams.get('sort') as 'date' | 'score' | 'votes') ?? 'date',
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '20'),
      campaign_id: (searchParams.get('campaign_id') ?? undefined) as string | 'none' | undefined,
    });
```

In the `POST` handler, pass `innovationRole` to `createIdea`:

```ts
    const idea = await createIdea({
      orgId: ctx.orgId,
      submitterId: ctx.userId,
      dto,
      innovationRole: ctx.innovationRole,
    });
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/innovation/repositories/ideasRepo.ts src/lib/innovation/services/ideasService.ts "src/app/api/innovation/ideas/route.ts"
git commit -m "feat(innovation): add campaign_id support to ideas repo, service, and route"
```

---

## Task 9: Sidebar Nav + Pipeline Page Filter

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/(app)/innovation/pipeline/page.tsx`

- [ ] **Step 1: Add Kampanyalar nav item to Sidebar**

In `src/components/layout/Sidebar.tsx`, find the innovation section:

```ts
    items: [
      { href: "/innovation",          icon: LayoutDashboard, label: "Dashboard" },
      { href: "/innovation/pipeline", icon: Lightbulb,       label: "Pipeline"  },
      { href: "/innovation/settings", icon: SlidersHorizontal, label: "Ayarlar", innovationAdminOnly: true },
    ],
```

Add the Kampanyalar item (import `Megaphone` from lucide-react first at the top of the file):

```ts
import { ..., Megaphone } from 'lucide-react';
```

Then update the items array:

```ts
    items: [
      { href: "/innovation",              icon: LayoutDashboard,   label: "Dashboard"   },
      { href: "/innovation/pipeline",     icon: Lightbulb,         label: "Pipeline"    },
      { href: "/innovation/kampanyalar",  icon: Megaphone,         label: "Kampanyalar" },
      { href: "/innovation/settings",     icon: SlidersHorizontal, label: "Ayarlar", innovationAdminOnly: true },
    ],
```

- [ ] **Step 2: Add `campaign_id=none` filter to pipeline page**

In `src/app/(app)/innovation/pipeline/page.tsx`, find `loadIdeas`:

```ts
  const loadIdeas = useCallback(async (tok: string, f: typeof filters) => {
    const params = new URLSearchParams();
    if (f.stage) params.set("stage", f.stage);
    if (f.search) params.set("search", f.search);
    params.set("sort", f.sort);

    const res = await fetch(`/api/innovation/ideas?${params}`, {
```

Add `campaign_id=none` to the params:

```ts
  const loadIdeas = useCallback(async (tok: string, f: typeof filters) => {
    const params = new URLSearchParams();
    if (f.stage) params.set("stage", f.stage);
    if (f.search) params.set("search", f.search);
    params.set("sort", f.sort);
    params.set("campaign_id", "none");

    const res = await fetch(`/api/innovation/ideas?${params}`, {
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx "src/app/(app)/innovation/pipeline/page.tsx"
git commit -m "feat(innovation): add Kampanyalar sidebar nav + filter general pipeline to non-campaign ideas"
```

---

## Task 10: Campaign List Page

**Files:**
- Create: `src/app/(app)/innovation/kampanyalar/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Megaphone, Lock, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { InnovationCampaign, CreateCampaignDto, CampaignStatus } from "@/lib/innovation/types";

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Taslak",
  active: "Aktif",
  ended: "Sona Erdi",
};

const STATUS_STYLE: Record<CampaignStatus, { bg: string; text: string }> = {
  draft:  { bg: "#F3F4F6", text: "#6B7280" },
  active: { bg: "#D1FAE5", text: "#065F46" },
  ended:  { bg: "#F3E8FF", text: "#6D28D9" },
};

// ── New Campaign Modal ────────────────────────────────────────────────────────

function NewCampaignModal({
  token,
  onCreated,
  onClose,
}: {
  token: string;
  onCreated: (c: InnovationCampaign) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CreateCampaignDto>({
    title: "",
    description: "",
    goal: "",
    start_date: "",
    end_date: "",
    is_invite_only: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!form.title.trim() || !form.start_date || !form.end_date) {
      setError("Başlık, başlangıç ve bitiş tarihleri zorunludur");
      return;
    }
    if (form.end_date < form.start_date) {
      setError("Bitiş tarihi başlangıç tarihinden önce olamaz");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/innovation/campaigns", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const campaign = await res.json() as InnovationCampaign;
      onCreated(campaign);
    } else {
      const err = await res.json().catch(() => ({ error: "Bir hata oluştu" }));
      setError((err as { error: string }).error);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Yeni Kampanya</h2>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Başlık *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Kampanya başlığı"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Açıklama</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                placeholder="Kampanya açıklaması"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Hedef</label>
              <input
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Bu kampanyanın hedefi nedir?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Başlangıç *</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Bitiş *</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_invite_only}
                onChange={(e) => setForm((f) => ({ ...f, is_invite_only: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700">Sadece davetlilere açık</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Oluştur
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | CampaignStatus;

export default function KampanyalarPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<InnovationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<FilterTab>("all");

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);

      const [campaignsRes, statsRes] = await Promise.all([
        fetch("/api/innovation/campaigns", { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch("/api/innovation/stats", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ]);

      if (campaignsRes.ok) setCampaigns(await campaignsRes.json());
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setIsAdmin(stats.user_role === "innovation_admin");
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = tab === "all" ? campaigns : campaigns.filter((c) => c.status === tab);

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Tümü" },
    { key: "active", label: "Aktif" },
    { key: "draft", label: "Taslak" },
    { key: "ended", label: "Sona Erdi" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kampanyalar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tematik fikir toplama kampanyaları</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Kampanya
          </button>
        )}
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === t.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Campaign Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm italic">Henüz kampanya bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign) => {
            const style = STATUS_STYLE[campaign.status];
            return (
              <button
                key={campaign.id}
                onClick={() => router.push(`/innovation/kampanyalar/${campaign.id}`)}
                className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: style.bg, color: style.text }}
                  >
                    {STATUS_LABEL[campaign.status]}
                  </span>
                  {campaign.is_invite_only && (
                    <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm leading-snug">{campaign.title}</p>
                  {campaign.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{campaign.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {campaign.start_date} → {campaign.end_date}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-semibold">
                  {campaign.idea_count} fikir
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showModal && (
        <NewCampaignModal
          token={token}
          onCreated={(c) => {
            setCampaigns((prev) => [c, ...prev]);
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual test**

Navigate to `/innovation/kampanyalar`. Should show empty state. As admin, click "Yeni Kampanya" — fill form and submit. Card should appear with correct status badge.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/innovation/kampanyalar/page.tsx"
git commit -m "feat(innovation): add campaign list page"
```

---

## Task 11: Campaign Detail Page

**Files:**
- Create: `src/app/(app)/innovation/kampanyalar/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Lock, Calendar, Target,
  Plus, Search, ChevronUp, ChevronDown, MessageCircle, Star,
  UserPlus, Trash2, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  InnovationCampaign, InnovationIdea, InnovationStage,
  CampaignInvite, CreateIdeaDto,
} from "@/lib/innovation/types";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

const STATUS_LABEL: Record<string, string> = {
  draft:  "Taslak",
  active: "Aktif",
  ended:  "Sona Erdi",
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  draft:  { bg: "#F3F4F6", text: "#6B7280" },
  active: { bg: "#D1FAE5", text: "#065F46" },
  ended:  { bg: "#F3E8FF", text: "#6D28D9" },
};

// ── Idea Card ─────────────────────────────────────────────────────────────────

function IdeaCard({ idea, onOpen }: { idea: InnovationIdea; onOpen: (idea: InnovationIdea) => void }) {
  return (
    <button
      onClick={() => onOpen(idea)}
      className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-gray-400">{idea.idea_number}</span>
            {idea.stage && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: idea.stage.color + "22", color: idea.stage.color }}
              >
                {idea.stage.name}
              </span>
            )}
          </div>
          <p className="font-semibold text-gray-900 mt-1 text-sm">{idea.title}</p>
          {idea.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{idea.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {idea.submitter && (
              <span className="text-xs text-gray-400">{idea.submitter.name}</span>
            )}
            {idea.category && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {idea.category}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(idea.created_at), { addSuffix: true, locale: tr })}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div
            className="flex items-center gap-0.5 text-sm font-bold"
            style={{ color: idea.vote_count >= 0 ? "#059669" : "#DC2626" }}
          >
            {idea.vote_count >= 0 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {Math.abs(idea.vote_count)}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <MessageCircle className="w-3.5 h-3.5" />
            {idea.comment_count}
          </div>
          {idea.composite_score > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
              <Star className="w-3.5 h-3.5" />
              {idea.composite_score}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── New Idea Modal ────────────────────────────────────────────────────────────

function NewIdeaModal({
  campaignId,
  token,
  stages,
  onCreated,
  onClose,
}: {
  campaignId: string;
  token: string;
  stages: InnovationStage[];
  onCreated: (idea: InnovationIdea) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<CreateIdeaDto, 'campaign_id'>>({
    title: "",
    description: "",
    category: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  void stages;

  async function handleSubmit() {
    if (!form.title.trim()) { setError("Başlık zorunludur"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/innovation/ideas", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, campaign_id: campaignId }),
    });
    setSaving(false);
    if (res.ok) {
      onCreated(await res.json() as InnovationIdea);
    } else {
      const err = await res.json().catch(() => ({ error: "Bir hata oluştu" }));
      setError((err as { error: string }).error);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Fikir Gönder</h2>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Başlık *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Fikrin başlığı"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Açıklama</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                placeholder="Fikrin detayları"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Kategori</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Örn: Verimlilik, Müşteri Deneyimi"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Gönder
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Invites Tab ───────────────────────────────────────────────────────────────

function InvitesTab({ campaignId, token }: { campaignId: string; token: string }) {
  const [invites, setInvites] = useState<CampaignInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [userIdInput, setUserIdInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/innovation/campaigns/${campaignId}/invites`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok && r.json())
      .then((d) => d && setInvites(d))
      .finally(() => setLoading(false));
  }, [campaignId, token]);

  async function handleAdd() {
    const ids = userIdInput.split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return;
    setAdding(true);
    setError("");
    const res = await fetch(`/api/innovation/campaigns/${campaignId}/invites`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_ids: ids }),
    });
    setAdding(false);
    if (res.ok) {
      const fresh = await fetch(`/api/innovation/campaigns/${campaignId}/invites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fresh.ok) setInvites(await fresh.json());
      setUserIdInput("");
    } else {
      const err = await res.json().catch(() => ({ error: "Bir hata oluştu" }));
      setError((err as { error: string }).error);
    }
  }

  async function handleRemove(userId: string) {
    const res = await fetch(`/api/innovation/campaigns/${campaignId}/invites`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) setInvites((prev) => prev.filter((i) => i.user_id !== userId));
  }

  if (loading) return <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
          placeholder="Kullanıcı ID (virgülle ayırın)"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !userIdInput.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Ekle
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {invites.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">Henüz davetli yok.</p>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => (
            <div key={invite.user_id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-gray-800">{invite.name}</span>
              <button
                onClick={() => handleRemove(invite.user_id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ActiveTab = "pipeline" | "invites";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<InnovationCampaign | null>(null);
  const [ideas, setIdeas] = useState<InnovationIdea[]>([]);
  const [stages, setStages] = useState<InnovationStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInvited, setIsInvited] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("pipeline");
  const [showNewModal, setShowNewModal] = useState(false);
  const [search, setSearch] = useState("");

  const loadIdeas = useCallback(async (tok: string, q: string) => {
    const p = new URLSearchParams({ campaign_id: campaignId });
    if (q) p.set("search", q);
    const res = await fetch(`/api/innovation/ideas?${p}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (res.ok) {
      const data = await res.json();
      setIdeas(data.ideas ?? []);
    }
  }, [campaignId]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const tok = session.access_token;
      setToken(tok);

      const [campaignRes, stagesRes, statsRes] = await Promise.all([
        fetch(`/api/innovation/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${tok}` } }),
        fetch("/api/innovation/stages", { headers: { Authorization: `Bearer ${tok}` } }),
        fetch("/api/innovation/stats", { headers: { Authorization: `Bearer ${tok}` } }),
      ]);

      if (!campaignRes.ok) { router.replace("/innovation/kampanyalar"); return; }
      const c = await campaignRes.json() as InnovationCampaign;
      setCampaign(c);

      if (stagesRes.ok) setStages(await stagesRes.json());
      if (statsRes.ok) {
        const stats = await statsRes.json();
        const role = stats.user_role;
        setIsAdmin(role === "innovation_admin");
      }

      if (c.is_invite_only) {
        const invitesRes = await fetch(`/api/innovation/campaigns/${campaignId}/invites`, {
          headers: { Authorization: `Bearer ${tok}` },
        }).catch(() => null);
        if (invitesRes?.ok) {
          const inv = await invitesRes.json() as CampaignInvite[];
          const { data: { user } } = await supabase.auth.getUser();
          setIsInvited(inv.some((i) => i.user_id === user?.id));
        }
      } else {
        setIsInvited(true);
      }

      await loadIdeas(tok, "");
      setLoading(false);
    }
    init();
  }, [campaignId, router, loadIdeas]);

  useEffect(() => {
    if (token) loadIdeas(token, search);
  }, [search, token, loadIdeas]);

  const canSubmit = campaign?.status === "active" && (isAdmin || isInvited);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!campaign) return null;

  const style = STATUS_STYLE[campaign.status];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/innovation/kampanyalar")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kampanyalar
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: style.bg, color: style.text }}
              >
                {STATUS_LABEL[campaign.status]}
              </span>
              {campaign.is_invite_only && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Lock className="w-3 h-3" /> Davetli
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{campaign.title}</h1>
            {campaign.description && (
              <p className="text-sm text-gray-500 mt-1">{campaign.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {campaign.start_date} → {campaign.end_date}
              </span>
              {campaign.goal && (
                <span className="flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  {campaign.goal}
                </span>
              )}
              <span>{campaign.idea_count} fikir</span>
            </div>
          </div>
        </div>
      </div>

      {/* Invite-only banner for non-invited */}
      {campaign.is_invite_only && !isAdmin && !isInvited && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Bu kampanya yalnızca davetli katılımcılara açıktır.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "pipeline"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Pipeline
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab("invites")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "invites"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Davetler
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          {/* Pipeline toolbar */}
          <div className="flex items-center gap-3">
            {canSubmit && (
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Fikir Gönder
              </button>
            )}
            {campaign.status !== "active" && (
              <span className="text-sm text-gray-400 italic">
                {campaign.status === "ended" ? "Kampanya sona erdi — yeni fikir gönderilemez." : "Kampanya henüz başlamadı."}
              </span>
            )}
            <div className="flex-1" />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ara..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-44"
              />
            </div>
          </div>

          {/* Ideas list */}
          {ideas.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-400 text-sm italic">
                {canSubmit ? "İlk fikri siz gönderin." : "Henüz fikir bulunmuyor."}
              </p>
              {canSubmit && (
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  Fikir Gönder
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {ideas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} onOpen={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "invites" && isAdmin && (
        <InvitesTab campaignId={campaignId} token={token} />
      )}

      {showModal && (
        <NewIdeaModal
          campaignId={campaignId}
          token={token}
          stages={stages}
          onCreated={(idea) => {
            setIdeas((prev) => [idea, ...prev]);
            setShowNewModal(false);
          }}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual test**

1. Navigate to `/innovation/kampanyalar`.
2. Create a campaign with today as start date (status: active).
3. Click the campaign → detail page opens.
4. Click "Fikir Gönder" → modal opens → submit → idea appears in list.
5. As admin, click "Davetler" tab → invite management UI shows.
6. Check pipeline page `/innovation/pipeline` — submitted campaign idea should NOT appear there.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/innovation/kampanyalar/[id]/page.tsx"
git commit -m "feat(innovation): add campaign detail page with pipeline and invites tabs"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| `innovation_campaigns` table | Task 1 |
| `innovation_campaign_invites` table | Task 1 |
| `campaign_id` FK on ideas | Task 1 |
| `deriveCampaignStatus()` | Task 4 |
| `GET/POST /api/innovation/campaigns` | Task 5 |
| `GET/PATCH/DELETE /api/innovation/campaigns/[id]` | Task 6 |
| `GET/POST/DELETE /api/innovation/campaigns/[id]/invites` | Task 7 |
| `campaign_id` filter in ideas GET | Task 8 |
| `campaign_id` support in ideas POST + invite-only check | Task 8 |
| Campaign list page | Task 10 |
| Campaign detail page + pipeline tab | Task 11 |
| Invites tab (admin only) | Task 11 |
| General pipeline shows only non-campaign ideas | Task 9 |
| Sidebar Kampanyalar nav item | Task 9 |
| Draft campaigns hidden from non-admins | Task 5, Task 6 |
| Active-only submission | Task 4 + Task 8 |
| Delete blocked if campaign has ideas | Task 4 |
| Invite-only banner for non-invited | Task 11 |
