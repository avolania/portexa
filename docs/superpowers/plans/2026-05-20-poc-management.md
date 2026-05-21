# Innovation V2 — POC Yönetimi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onaylanan fikirlerden manuel POC başlatma, `business_sponsor` iki aşamalı onay akışı (başlatma + tamamlama), haftalık güncelleme logu ve ayrı POC listesi/detay sayfası.

**Architecture:** Ayrı `innovation_pocs` + `innovation_poc_updates` tabloları. 3-katmanlı mimari: `pocsRepo` (Supabase CRUD) → `pocService` (iş mantığı, durum geçişleri) → API route handler'lar. İki yeni sayfa (`/innovation/pocs`, `/innovation/pocs/[id]`) + ideas detail sayfasına POC sekmesi.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL), Tailwind CSS v4

---

## File Structure

| İşlem | Dosya |
|-------|-------|
| Create | `supabase-innovation-pocs.sql` |
| Modify | `src/lib/innovation/types/index.ts` |
| Create | `src/lib/innovation/repositories/pocsRepo.ts` |
| Create | `src/lib/innovation/services/pocService.ts` |
| Create | `src/app/api/innovation/pocs/route.ts` |
| Create | `src/app/api/innovation/pocs/[id]/route.ts` |
| Create | `src/app/api/innovation/pocs/[id]/transition/route.ts` |
| Create | `src/app/api/innovation/pocs/[id]/updates/route.ts` |
| Modify | `src/components/layout/Sidebar.tsx` |
| Modify | `src/app/(app)/innovation/ideas/[id]/page.tsx` |
| Create | `src/app/(app)/innovation/pocs/page.tsx` |
| Create | `src/app/(app)/innovation/pocs/[id]/page.tsx` |

---

### Task 1: DB Migration SQL

**Files:**
- Create: `supabase-innovation-pocs.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase-innovation-pocs.sql

CREATE TABLE innovation_pocs (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id       TEXT NOT NULL,
  idea_id      TEXT NOT NULL REFERENCES innovation_ideas(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  owner_id     TEXT NOT NULL REFERENCES auth_profiles(id),
  sponsor_id   TEXT REFERENCES auth_profiles(id),
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN (
                 'draft', 'pending_sponsor_approval', 'active',
                 'on_hold', 'pending_completion_approval', 'completed', 'cancelled'
               )),
  budget       NUMERIC(12,2),
  goals        TEXT,
  success_criteria TEXT,
  notes        TEXT,
  start_date   DATE,
  end_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_innovation_pocs_org_id  ON innovation_pocs(org_id);
CREATE INDEX idx_innovation_pocs_idea_id ON innovation_pocs(idea_id);
CREATE INDEX idx_innovation_pocs_status  ON innovation_pocs(status);

CREATE TABLE innovation_poc_updates (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  poc_id     TEXT NOT NULL REFERENCES innovation_pocs(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES auth_profiles(id),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_innovation_poc_updates_poc_id ON innovation_poc_updates(poc_id);
```

- [ ] **Step 2: Run in Supabase SQL editor**

Supabase dashboard → SQL Editor → dosyayı yapıştır ve çalıştır.
Doğrula: `SELECT * FROM innovation_pocs LIMIT 1;` → tablo var.

- [ ] **Step 3: Commit**

```bash
git add supabase-innovation-pocs.sql
git commit -m "sql: create innovation_pocs and innovation_poc_updates tables"
```

---

### Task 2: Types + DTOs

**Files:**
- Modify: `src/lib/innovation/types/index.ts`

- [ ] **Step 1: Read the current file**

```bash
grep -n "export type\|export interface" src/lib/innovation/types/index.ts
```

- [ ] **Step 2: Add POC types at the end of the file**

```ts
// ── POC ────────────────────────────────────────────────────────────────────

export type PocStatus =
  | 'draft'
  | 'pending_sponsor_approval'
  | 'active'
  | 'on_hold'
  | 'pending_completion_approval'
  | 'completed'
  | 'cancelled';

export type PocTransitionAction =
  | 'submit_for_approval'
  | 'approve_start'
  | 'reject_start'
  | 'hold'
  | 'resume'
  | 'submit_completion'
  | 'approve_completion'
  | 'reject_completion'
  | 'cancel';

export interface InnovationPoc {
  id: string;
  org_id: string;
  idea_id: string;
  idea_title?: string;
  title: string;
  owner_id: string;
  owner_name?: string;
  sponsor_id: string | null;
  sponsor_name?: string;
  status: PocStatus;
  budget: number | null;
  goals: string | null;
  success_criteria: string | null;
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  updates?: PocUpdate[];
}

export interface PocUpdate {
  id: string;
  poc_id: string;
  author_id: string;
  author_name?: string;
  content: string;
  created_at: string;
}

export interface CreatePocDto {
  idea_id: string;
  title: string;
  owner_id: string;
  sponsor_id?: string | null;
  budget?: number | null;
  goals?: string;
  success_criteria?: string;
  notes?: string;
  start_date?: string;
  end_date?: string;
}

export interface UpdatePocDto {
  title?: string;
  owner_id?: string;
  sponsor_id?: string | null;
  budget?: number | null;
  goals?: string;
  success_criteria?: string;
  notes?: string;
  start_date?: string;
  end_date?: string;
}

export interface TransitionPocDto {
  action: PocTransitionAction;
  note?: string;
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "types/index.ts" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/innovation/types/index.ts
git commit -m "feat(types): add PocStatus, InnovationPoc, PocUpdate, DTOs"
```

---

### Task 3: pocsRepo.ts

**Files:**
- Create: `src/lib/innovation/repositories/pocsRepo.ts`

- [ ] **Step 1: Create the file**

```ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationPoc, PocUpdate, CreatePocDto, UpdatePocDto, PocStatus } from '../types';

const mapProfile = (p: Record<string, unknown> | null | undefined) =>
  p ? ((p.data as Record<string, unknown>)?.name ?? 'Bilinmiyor') as string : undefined;

export async function findPocs(params: {
  orgId: string;
  status?: string;
  ideaId?: string;
}): Promise<InnovationPoc[]> {
  let query = supabaseAdmin
    .from('innovation_pocs')
    .select(`
      *,
      owner:auth_profiles!innovation_pocs_owner_id_fkey(id, data),
      sponsor:auth_profiles!innovation_pocs_sponsor_id_fkey(id, data),
      idea:innovation_ideas!innovation_pocs_idea_id_fkey(id, title)
    `)
    .eq('org_id', params.orgId)
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.ideaId) query = query.eq('idea_id', params.ideaId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...row,
    owner_name: mapProfile(row.owner as Record<string, unknown>),
    sponsor_name: mapProfile(row.sponsor as Record<string, unknown>),
    idea_title: (row.idea as Record<string, unknown> | null)?.title as string | undefined,
  })) as unknown as InnovationPoc[];
}

export async function findPocById(id: string): Promise<InnovationPoc | null> {
  const { data, error } = await supabaseAdmin
    .from('innovation_pocs')
    .select(`
      *,
      owner:auth_profiles!innovation_pocs_owner_id_fkey(id, data),
      sponsor:auth_profiles!innovation_pocs_sponsor_id_fkey(id, data),
      idea:innovation_ideas!innovation_pocs_idea_id_fkey(id, title),
      innovation_poc_updates(
        *,
        author:auth_profiles!innovation_poc_updates_author_id_fkey(id, data)
      )
    `)
    .eq('id', id)
    .single();

  if (error) return null;

  const row = data as Record<string, unknown>;
  return {
    ...row,
    owner_name: mapProfile(row.owner as Record<string, unknown>),
    sponsor_name: mapProfile(row.sponsor as Record<string, unknown>),
    idea_title: (row.idea as Record<string, unknown> | null)?.title as string | undefined,
    updates: ((row.innovation_poc_updates ?? []) as Record<string, unknown>[]).map((u) => ({
      ...u,
      author_name: mapProfile(u.author as Record<string, unknown>),
    })),
  } as unknown as InnovationPoc;
}

export async function findActivePocByIdeaId(ideaId: string): Promise<InnovationPoc | null> {
  const { data } = await supabaseAdmin
    .from('innovation_pocs')
    .select('id, status')
    .eq('idea_id', ideaId)
    .not('status', 'in', '("completed","cancelled")')
    .maybeSingle();
  return data as InnovationPoc | null;
}

export async function createPoc(params: {
  orgId: string;
  dto: CreatePocDto;
}): Promise<InnovationPoc> {
  const { data, error } = await supabaseAdmin
    .from('innovation_pocs')
    .insert({
      id: crypto.randomUUID(),
      org_id: params.orgId,
      idea_id: params.dto.idea_id,
      title: params.dto.title,
      owner_id: params.dto.owner_id,
      sponsor_id: params.dto.sponsor_id ?? null,
      status: 'draft' as PocStatus,
      budget: params.dto.budget ?? null,
      goals: params.dto.goals ?? null,
      success_criteria: params.dto.success_criteria ?? null,
      notes: params.dto.notes ?? null,
      start_date: params.dto.start_date ?? null,
      end_date: params.dto.end_date ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as InnovationPoc;
}

export async function updatePoc(id: string, dto: UpdatePocDto): Promise<void> {
  const ALLOWED = new Set([
    'title', 'owner_id', 'sponsor_id', 'budget',
    'goals', 'success_criteria', 'notes', 'start_date', 'end_date',
  ]);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(dto)) {
    if (ALLOWED.has(k)) patch[k] = v;
  }
  const { error } = await supabaseAdmin
    .from('innovation_pocs')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updatePocStatus(id: string, status: PocStatus): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_pocs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function addPocUpdate(params: {
  pocId: string;
  authorId: string;
  content: string;
}): Promise<PocUpdate> {
  const { data, error } = await supabaseAdmin
    .from('innovation_poc_updates')
    .insert({
      id: crypto.randomUUID(),
      poc_id: params.pocId,
      author_id: params.authorId,
      content: params.content,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as PocUpdate;
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "pocsRepo" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/repositories/pocsRepo.ts
git commit -m "feat(repo): add pocsRepo — CRUD for innovation_pocs and poc_updates"
```

---

### Task 4: pocService.ts

**Files:**
- Create: `src/lib/innovation/services/pocService.ts`

- [ ] **Step 1: Create the file**

```ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import * as pocsRepo from '../repositories/pocsRepo';
import type {
  InnovationPoc, CreatePocDto, UpdatePocDto, TransitionPocDto,
  PocStatus, PocTransitionAction, InnovationRole,
} from '../types';
import { hasRole } from '../utils';

// ── Transition rules ────────────────────────────────────────────────────────

type TransitionRule = {
  from: PocStatus;
  to: PocStatus;
  roles: InnovationRole[];
  ownerAllowed?: boolean;
};

const TRANSITIONS: Record<PocTransitionAction, TransitionRule> = {
  submit_for_approval: {
    from: 'draft',
    to: 'pending_sponsor_approval',
    roles: ['innovation_admin'],
    ownerAllowed: true,
  },
  approve_start: {
    from: 'pending_sponsor_approval',
    to: 'active',
    roles: ['business_sponsor', 'innovation_admin'],
  },
  reject_start: {
    from: 'pending_sponsor_approval',
    to: 'draft',
    roles: ['business_sponsor', 'innovation_admin'],
  },
  hold: {
    from: 'active',
    to: 'on_hold',
    roles: ['innovation_admin'],
    ownerAllowed: true,
  },
  resume: {
    from: 'on_hold',
    to: 'active',
    roles: ['innovation_admin'],
    ownerAllowed: true,
  },
  submit_completion: {
    from: 'active',
    to: 'pending_completion_approval',
    roles: ['innovation_admin'],
    ownerAllowed: true,
  },
  approve_completion: {
    from: 'pending_completion_approval',
    to: 'completed',
    roles: ['business_sponsor', 'innovation_admin'],
  },
  reject_completion: {
    from: 'pending_completion_approval',
    to: 'active',
    roles: ['business_sponsor', 'innovation_admin'],
  },
  cancel: {
    from: 'draft',          // placeholder — cancel checked separately
    to: 'cancelled',
    roles: ['innovation_admin'],
  },
};

const CANCELLABLE: PocStatus[] = [
  'draft', 'pending_sponsor_approval', 'active', 'on_hold', 'pending_completion_approval',
];

// ── Service functions ────────────────────────────────────────────────────────

export async function createPoc(params: {
  orgId: string;
  userId: string;
  roles: InnovationRole[];
  dto: CreatePocDto;
}): Promise<InnovationPoc> {
  if (!hasRole(params.roles, 'innovation_admin') && !hasRole(params.roles, 'business_sponsor')) {
    throw new Error('POC oluşturmak için innovation_admin veya business_sponsor rolü gereklidir');
  }

  // Verify the idea exists, belongs to this org, and is approved
  const { data: idea } = await supabaseAdmin
    .from('innovation_ideas')
    .select('id, status, org_id')
    .eq('id', params.dto.idea_id)
    .eq('org_id', params.orgId)
    .single();

  if (!idea) throw new Error('Fikir bulunamadı');
  if ((idea as Record<string, unknown>).status !== 'approved') {
    throw new Error('POC yalnızca onaylı fikirler için başlatılabilir');
  }

  // Check for existing active/pending POC
  const existing = await pocsRepo.findActivePocByIdeaId(params.dto.idea_id);
  if (existing) throw new Error('Bu fikrin zaten aktif bir POC\'u var');

  return pocsRepo.createPoc({ orgId: params.orgId, dto: params.dto });
}

export async function updatePoc(params: {
  poc: InnovationPoc;
  userId: string;
  roles: InnovationRole[];
  dto: UpdatePocDto;
}): Promise<void> {
  const isAdmin = hasRole(params.roles, 'innovation_admin');
  const isOwner = params.poc.owner_id === params.userId;
  if (!isAdmin && !isOwner) {
    throw new Error('POC güncellemek için innovation_admin veya POC sahibi olmanız gerekir');
  }
  if (params.poc.status === 'completed' || params.poc.status === 'cancelled') {
    throw new Error('Tamamlanan veya iptal edilen POC güncellenemez');
  }
  await pocsRepo.updatePoc(params.poc.id, params.dto);
}

export async function transitionPoc(params: {
  poc: InnovationPoc;
  userId: string;
  roles: InnovationRole[];
  dto: TransitionPocDto;
}): Promise<void> {
  const { poc, userId, roles, dto } = params;

  if (dto.action === 'cancel') {
    if (!hasRole(roles, 'innovation_admin')) {
      throw new Error('İptal etmek için innovation_admin rolü gereklidir');
    }
    if (!CANCELLABLE.includes(poc.status)) {
      throw new Error(`${poc.status} durumundaki POC iptal edilemez`);
    }
    await pocsRepo.updatePocStatus(poc.id, 'cancelled');
    return;
  }

  const rule = TRANSITIONS[dto.action];
  if (!rule) throw new Error('Geçersiz aksiyon');

  if (poc.status !== rule.from) {
    throw new Error(`Bu geçiş mevcut durumdan (${poc.status}) yapılamaz`);
  }

  const hasRequiredRole = rule.roles.some((r) => hasRole(roles, r));
  const isOwner = poc.owner_id === userId;
  if (!hasRequiredRole && !(rule.ownerAllowed && isOwner)) {
    throw new Error('Bu geçiş için yetkiniz yok');
  }

  await pocsRepo.updatePocStatus(poc.id, rule.to);
}

export async function addPocUpdate(params: {
  poc: InnovationPoc;
  userId: string;
  roles: InnovationRole[];
  content: string;
}): Promise<void> {
  if (params.poc.status === 'cancelled') {
    throw new Error('İptal edilen POC\'a güncelleme eklenemez');
  }
  const canUpdate =
    hasRole(params.roles, 'innovation_admin') ||
    hasRole(params.roles, 'innovation_evaluator') ||
    params.poc.owner_id === params.userId;
  if (!canUpdate) {
    throw new Error('Güncelleme eklemek için yetkiniz yok');
  }
  await pocsRepo.addPocUpdate({
    pocId: params.poc.id,
    authorId: params.userId,
    content: params.content,
  });
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "pocService" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/services/pocService.ts
git commit -m "feat(service): add pocService — transition rules, create/update/transition/addUpdate"
```

---

### Task 5: API Routes (4 files)

**Files:**
- Create: `src/app/api/innovation/pocs/route.ts`
- Create: `src/app/api/innovation/pocs/[id]/route.ts`
- Create: `src/app/api/innovation/pocs/[id]/transition/route.ts`
- Create: `src/app/api/innovation/pocs/[id]/updates/route.ts`

- [ ] **Step 1: Create `src/app/api/innovation/pocs/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getInnovationRoles } from '@/lib/innovation/utils';
import { findPocs } from '@/lib/innovation/repositories/pocsRepo';
import { createPoc } from '@/lib/innovation/services/pocService';
import type { CreatePocDto, InnovationRole } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!p) return null;
  const roles = await getInnovationRoles(user.id);
  return { userId: user.id, orgId: p.org_id as string, roles: roles as InnovationRole[] };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = req.nextUrl;
  try {
    const pocs = await findPocs({
      orgId: ctx.orgId,
      status: searchParams.get('status') ?? undefined,
      ideaId: searchParams.get('idea_id') ?? undefined,
    });
    return NextResponse.json(pocs);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const dto = await req.json() as CreatePocDto;
    if (!dto.idea_id?.trim()) return NextResponse.json({ error: 'idea_id zorunlu' }, { status: 400 });
    if (!dto.title?.trim()) return NextResponse.json({ error: 'Başlık zorunlu' }, { status: 400 });
    if (!dto.owner_id?.trim()) return NextResponse.json({ error: 'owner_id zorunlu' }, { status: 400 });
    const poc = await createPoc({ orgId: ctx.orgId, userId: ctx.userId, roles: ctx.roles, dto });
    return NextResponse.json(poc, { status: 201 });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('yetki') || msg.includes('rolü') ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
```

- [ ] **Step 2: Create `src/app/api/innovation/pocs/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getInnovationRoles } from '@/lib/innovation/utils';
import { findPocById } from '@/lib/innovation/repositories/pocsRepo';
import { updatePoc } from '@/lib/innovation/services/pocService';
import type { UpdatePocDto, InnovationRole } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!p) return null;
  const roles = await getInnovationRoles(user.id);
  return { userId: user.id, orgId: p.org_id as string, roles: roles as InnovationRole[] };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const poc = await findPocById(id);
  if (!poc || poc.org_id !== ctx.orgId) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  return NextResponse.json(poc);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const poc = await findPocById(id);
  if (!poc || poc.org_id !== ctx.orgId) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  try {
    const dto = await req.json() as UpdatePocDto;
    await updatePoc({ poc, userId: ctx.userId, roles: ctx.roles, dto });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('yetki') || msg.includes('olmanız') ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
```

- [ ] **Step 3: Create `src/app/api/innovation/pocs/[id]/transition/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getInnovationRoles } from '@/lib/innovation/utils';
import { findPocById } from '@/lib/innovation/repositories/pocsRepo';
import { transitionPoc } from '@/lib/innovation/services/pocService';
import type { TransitionPocDto, InnovationRole } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!p) return null;
  const roles = await getInnovationRoles(user.id);
  return { userId: user.id, orgId: p.org_id as string, roles: roles as InnovationRole[] };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const poc = await findPocById(id);
  if (!poc || poc.org_id !== ctx.orgId) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  try {
    const dto = await req.json() as TransitionPocDto;
    if (!dto.action) return NextResponse.json({ error: 'action zorunlu' }, { status: 400 });
    await transitionPoc({ poc, userId: ctx.userId, roles: ctx.roles, dto });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('yetki') || msg.includes('rolü') ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
```

- [ ] **Step 4: Create `src/app/api/innovation/pocs/[id]/updates/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getInnovationRoles } from '@/lib/innovation/utils';
import { findPocById } from '@/lib/innovation/repositories/pocsRepo';
import { addPocUpdate } from '@/lib/innovation/services/pocService';
import type { InnovationRole } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!p) return null;
  const roles = await getInnovationRoles(user.id);
  return { userId: user.id, orgId: p.org_id as string, roles: roles as InnovationRole[] };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const poc = await findPocById(id);
  if (!poc || poc.org_id !== ctx.orgId) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  try {
    const { content } = await req.json() as { content: string };
    if (!content?.trim()) return NextResponse.json({ error: 'İçerik zorunlu' }, { status: 400 });
    const update = await addPocUpdate({ poc, userId: ctx.userId, roles: ctx.roles, content });
    return NextResponse.json(update, { status: 201 });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('yetki') ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "innovation/pocs" | grep -v node_modules | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add \
  src/app/api/innovation/pocs/route.ts \
  "src/app/api/innovation/pocs/[id]/route.ts" \
  "src/app/api/innovation/pocs/[id]/transition/route.ts" \
  "src/app/api/innovation/pocs/[id]/updates/route.ts"
git commit -m "feat(api): POC routes — list/create, detail/update, transition, updates"
```

---

### Task 6: Sidebar + Ideas Detail Page POC Tab

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/(app)/innovation/ideas/[id]/page.tsx`

- [ ] **Step 1: Add "POC'lar" to sidebar**

In `src/components/layout/Sidebar.tsx`, find the innovation section items array (around line 90):

```ts
{ href: "/innovation/pipeline",    icon: Lightbulb,          label: "Pipeline"    },
{ href: "/innovation/kampanyalar", icon: Megaphone,           label: "Kampanyalar" },
```

Add after the pipeline item:
```ts
{ href: "/innovation/pocs",        icon: FlaskConical,        label: "POC'lar"     },
```

Add `FlaskConical` to the lucide-react import at the top of the file.

- [ ] **Step 2: Add POC tab to ideas detail page**

In `src/app/(app)/innovation/ideas/[id]/page.tsx`:

**2a.** Find the `Tab` type (line 15):
```ts
type Tab = 'details' | 'comments' | 'evaluations' | 'history';
```
Change to:
```ts
type Tab = 'details' | 'comments' | 'evaluations' | 'history' | 'poc';
```

**2b.** Add POC state below existing state declarations (around line 55):
```ts
const [poc, setPoc] = useState<InnovationPoc | null | undefined>(undefined); // undefined=loading
```

Add the `InnovationPoc` import to the types import line at the top.

**2c.** Add a `useEffect` to fetch the POC when the tab is selected or idea loads (after existing useEffects):
```ts
useEffect(() => {
  if (!idea || !session?.access_token) return;
  fetch(`/api/innovation/pocs?idea_id=${idea.id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
    .then((r) => r.json())
    .then((data: InnovationPoc[]) => setPoc(data[0] ?? null))
    .catch(() => setPoc(null));
}, [idea?.id, session?.access_token]);
```

**2d.** Find the tabs array (around line 184):
```ts
const tabs: { key: Tab; label: string }[] = [
  { key: 'details',     label: 'Detaylar' },
  { key: 'comments',    label: `Yorumlar (${idea.comment_count ?? 0})` },
  { key: 'evaluations', label: 'Değerlendirmeler' },
  { key: 'history',     label: 'Geçmiş' },
];
```
Add:
```ts
  { key: 'poc', label: 'POC' },
```

**2e.** After the `{tab === 'history' && ...}` block, add:
```tsx
{tab === 'poc' && (
  <PocTab
    poc={poc}
    idea={idea}
    session={session}
    innovationRoles={innovationRoles}
    userId={userId ?? ''}
  />
)}
```

**2f.** Add `PocTab` component at the bottom of the file (before the closing):
```tsx
function PocTab({
  poc,
  idea,
  session,
  innovationRoles,
  userId,
}: {
  poc: InnovationPoc | null | undefined;
  idea: InnovationIdea;
  session: { access_token: string } | null;
  innovationRoles: InnovationRole[];
  userId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const canManage =
    innovationRoles.includes('innovation_admin') ||
    innovationRoles.includes('business_sponsor');

  const handleCreate = async () => {
    if (!session) return;
    setCreating(true);
    setError('');
    const res = await fetch('/api/innovation/pocs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        idea_id: idea.id,
        title: `${idea.title} — POC`,
        owner_id: userId,
      }),
    });
    setCreating(false);
    if (res.ok) {
      window.location.href = `/innovation/pocs/${(await res.json()).id}`;
    } else {
      const d = await res.json();
      setError(d.error ?? 'Hata');
    }
  };

  if (poc === undefined) {
    return <div className="py-8 text-center text-sm text-gray-400">Yükleniyor…</div>;
  }

  if (!poc) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-500 mb-4">Bu fikre ait POC bulunamadı.</p>
        {canManage && idea.status === 'approved' && (
          <>
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{
                background: '#3B82F6', color: '#fff', border: 'none',
                borderRadius: 8, padding: '9px 20px', fontSize: 13,
                fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer',
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? 'Oluşturuluyor…' : '+ POC Başlat'}
            </button>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </>
        )}
        {canManage && idea.status !== 'approved' && (
          <p className="text-xs text-gray-400">POC başlatmak için fikrin onaylı olması gerekir.</p>
        )}
      </div>
    );
  }

  const STATUS_LABELS: Record<string, string> = {
    draft: 'Taslak', pending_sponsor_approval: 'Sponsor Onayı Bekliyor',
    active: 'Aktif', on_hold: 'Beklemede',
    pending_completion_approval: 'Tamamlama Onayı Bekliyor',
    completed: 'Tamamlandı', cancelled: 'İptal Edildi',
  };
  const STATUS_COLORS: Record<string, string> = {
    draft: '#6B7280', pending_sponsor_approval: '#7C3AED', active: '#059669',
    on_hold: '#D97706', pending_completion_approval: '#7C3AED',
    completed: '#374151', cancelled: '#9CA3AF',
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{poc.title}</p>
          <span style={{
            display: 'inline-block', marginTop: 4,
            fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '2px 8px',
            background: STATUS_COLORS[poc.status] + '20',
            color: STATUS_COLORS[poc.status],
          }}>
            {STATUS_LABELS[poc.status] ?? poc.status}
          </span>
        </div>
        <a
          href={`/innovation/pocs/${poc.id}`}
          style={{
            fontSize: 12, fontWeight: 600, color: '#3B82F6',
            textDecoration: 'none', border: '1px solid #DBEAFE',
            borderRadius: 6, padding: '6px 14px',
          }}
        >
          Detayı Gör →
        </a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {poc.owner_name && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 2 }}>Sorumlu</p>
            <p style={{ fontSize: 12, color: '#374151' }}>{poc.owner_name}</p>
          </div>
        )}
        {poc.budget !== null && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 2 }}>Bütçe</p>
            <p style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>{poc.budget.toLocaleString('tr-TR')} ₺</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "Sidebar|ideas/\[id\]/page" | grep -v node_modules | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx "src/app/(app)/innovation/ideas/[id]/page.tsx"
git commit -m "feat(ui): add POC'lar sidebar item, POC tab on idea detail page"
```

---

### Task 7: POC List Page

**Files:**
- Create: `src/app/(app)/innovation/pocs/page.tsx`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p "src/app/(app)/innovation/pocs"
```

- [ ] **Step 2: Create `src/app/(app)/innovation/pocs/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { InnovationPoc } from '@/lib/innovation/types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  pending_sponsor_approval: 'Sponsor Onayı Bekliyor',
  active: 'Aktif',
  on_hold: 'Beklemede',
  pending_completion_approval: 'Tamamlama Onayı Bekliyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:                       { bg: '#F3F4F6', text: '#6B7280' },
  pending_sponsor_approval:    { bg: '#F3E8FF', text: '#7C3AED' },
  active:                      { bg: '#D1FAE5', text: '#059669' },
  on_hold:                     { bg: '#FEF3C7', text: '#D97706' },
  pending_completion_approval: { bg: '#F3E8FF', text: '#7C3AED' },
  completed:                   { bg: '#E5E7EB', text: '#374151' },
  cancelled:                   { bg: '#F9FAFB', text: '#9CA3AF' },
};

export default function PocsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [pocs, setPocs] = useState<InnovationPoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const url = `/api/innovation/pocs${statusFilter ? `?status=${statusFilter}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setPocs(await res.json());
      setLoading(false);
    };
    load();
  }, [statusFilter]);

  return (
    <div style={{ padding: 24, fontFamily: 'IBM Plex Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>POC'lar</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
            Proof of Concept takibi
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'active', 'pending_sponsor_approval', 'on_hold', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              fontSize: 12, fontWeight: 600, borderRadius: 6,
              padding: '5px 12px', cursor: 'pointer', border: 'none',
              background: statusFilter === s ? '#3B82F6' : '#F3F4F6',
              color: statusFilter === s ? '#fff' : '#6B7280',
            }}
          >
            {s === '' ? 'Tümü' : (STATUS_LABELS[s] ?? s)}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>Yükleniyor…</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#F9FAFB' }}>
                {['Fikir', 'POC Başlığı', 'Sorumlu', 'Sponsor', 'Durum', 'Bütçe', 'Bitiş', ''].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 14px',
                    fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pocs.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' }}>
                    POC bulunamadı.
                  </td>
                </tr>
              )}
              {pocs.map((poc) => {
                const sc = STATUS_COLORS[poc.status] ?? { bg: '#F3F4F6', text: '#6B7280' };
                return (
                  <tr
                    key={poc.id}
                    style={{ borderBottom: '1px solid #F9FAFB', cursor: 'pointer' }}
                    onClick={() => router.push(`/innovation/pocs/${poc.id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '12px 14px', color: '#6B7280', fontSize: 12 }}>
                      {poc.idea_title ?? '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#111827' }}>
                      {poc.title}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>{poc.owner_name ?? '—'}</td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>{poc.sponsor_name ?? '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 4,
                        padding: '2px 8px', background: sc.bg, color: sc.text,
                      }}>
                        {STATUS_LABELS[poc.status] ?? poc.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151', fontFamily: 'monospace', fontSize: 12 }}>
                      {poc.budget !== null ? poc.budget.toLocaleString('tr-TR') + ' ₺' : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151', fontSize: 12 }}>
                      {poc.end_date ? new Date(poc.end_date).toLocaleDateString('tr-TR') : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ color: '#3B82F6', fontSize: 12, fontWeight: 600 }}>Detay →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "pocs/page" | grep -v node_modules | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/innovation/pocs/page.tsx"
git commit -m "feat(ui): POC list page with status filter"
```

---

### Task 8: POC Detail Page

**Files:**
- Create: `src/app/(app)/innovation/pocs/[id]/page.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "src/app/(app)/innovation/pocs/[id]"
```

- [ ] **Step 2: Create `src/app/(app)/innovation/pocs/[id]/page.tsx`**

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { InnovationPoc, PocUpdate, PocTransitionAction, InnovationRole } from '@/lib/innovation/types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  pending_sponsor_approval: 'Sponsor Onayı Bekliyor',
  active: 'Aktif',
  on_hold: 'Beklemede',
  pending_completion_approval: 'Tamamlama Onayı Bekliyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#6B7280', pending_sponsor_approval: '#7C3AED', active: '#059669',
  on_hold: '#D97706', pending_completion_approval: '#7C3AED',
  completed: '#374151', cancelled: '#9CA3AF',
};

function getActions(status: string, roles: InnovationRole[], ownerId: string, userId: string): { action: PocTransitionAction; label: string; danger?: boolean }[] {
  const isAdmin = roles.includes('innovation_admin');
  const isSponsor = roles.includes('business_sponsor');
  const isOwner = ownerId === userId;
  const actions: { action: PocTransitionAction; label: string; danger?: boolean }[] = [];

  if (status === 'draft' && (isAdmin || isOwner))
    actions.push({ action: 'submit_for_approval', label: 'Onaya Gönder' });
  if (status === 'pending_sponsor_approval' && (isAdmin || isSponsor)) {
    actions.push({ action: 'approve_start', label: 'Onayla & Başlat' });
    actions.push({ action: 'reject_start', label: 'Reddet', danger: true });
  }
  if (status === 'active' && (isAdmin || isOwner)) {
    actions.push({ action: 'hold', label: 'Askıya Al' });
    actions.push({ action: 'submit_completion', label: 'Tamamlamaya Gönder' });
  }
  if (status === 'on_hold' && (isAdmin || isOwner))
    actions.push({ action: 'resume', label: 'Devam Ettir' });
  if (status === 'pending_completion_approval' && (isAdmin || isSponsor)) {
    actions.push({ action: 'approve_completion', label: 'Tamamlandı Onayla' });
    actions.push({ action: 'reject_completion', label: 'Geri Al', danger: true });
  }
  if (!['completed', 'cancelled'].includes(status) && isAdmin)
    actions.push({ action: 'cancel', label: 'İptal Et', danger: true });

  return actions;
}

export default function PocDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [poc, setPoc] = useState<InnovationPoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [innovationRoles, setInnovationRoles] = useState<InnovationRole[]>([]);
  const [token, setToken] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [updateContent, setUpdateContent] = useState('');
  const [addingUpdate, setAddingUpdate] = useState(false);
  const [error, setError] = useState('');
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setToken(session.access_token);
      setUserId(session.user.id);

      const [pocRes, rolesRes] = await Promise.all([
        fetch(`/api/innovation/pocs/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase
          .from('innovation_user_roles')
          .select('role')
          .eq('user_id', session.user.id),
      ]);

      if (pocRes.ok) setPoc(await pocRes.json());
      else router.push('/innovation/pocs');

      setInnovationRoles((rolesRes.data ?? []).map((r: { role: string }) => r.role as InnovationRole));
      setLoading(false);
    };
    load();
  }, [id]);

  const handleTransition = useCallback(async (action: PocTransitionAction) => {
    if (!token) return;
    setTransitioning(true);
    setError('');
    const res = await fetch(`/api/innovation/pocs/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const updated = await fetch(`/api/innovation/pocs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (updated.ok) setPoc(await updated.json());
    } else {
      const d = await res.json();
      setError(d.error ?? 'Hata');
    }
    setTransitioning(false);
  }, [id, token]);

  const handleAddUpdate = async () => {
    if (!updateContent.trim() || !token) return;
    setAddingUpdate(true);
    setError('');
    const res = await fetch(`/api/innovation/pocs/${id}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: updateContent }),
    });
    if (res.ok) {
      const newUpdate = await res.json();
      setPoc((prev) => prev ? {
        ...prev,
        updates: [newUpdate, ...(prev.updates ?? [])],
      } : prev);
      setUpdateContent('');
    } else {
      const d = await res.json();
      setError(d.error ?? 'Hata');
    }
    setAddingUpdate(false);
  };

  const handleSaveField = async (field: string, value: string) => {
    if (!token) return;
    const res = await fetch(`/api/innovation/pocs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      setPoc((prev) => prev ? { ...prev, [field]: value } : prev);
      setEditField(null);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontFamily: 'IBM Plex Sans, sans-serif' }}>
      Yükleniyor…
    </div>
  );

  if (!poc) return null;

  const statusColor = STATUS_COLORS[poc.status] ?? '#6B7280';
  const actions = getActions(poc.status, innovationRoles, poc.owner_id, userId);

  return (
    <div style={{ padding: 24, fontFamily: 'IBM Plex Sans, sans-serif', maxWidth: 1100 }}>
      {/* Back link */}
      <button
        onClick={() => router.push('/innovation/pocs')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13, marginBottom: 16, padding: 0 }}
      >
        ← POC Listesi
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{poc.title}</h1>
          {poc.idea_title && (
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
              Fikir: <span style={{ color: '#3B82F6' }}>{poc.idea_title}</span>
            </p>
          )}
          <span style={{
            display: 'inline-block', marginTop: 8,
            fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '3px 10px',
            background: statusColor + '20', color: statusColor,
          }}>
            {STATUS_LABELS[poc.status] ?? poc.status}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {actions.map((a) => (
            <button
              key={a.action}
              onClick={() => handleTransition(a.action)}
              disabled={transitioning}
              style={{
                fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '7px 14px',
                cursor: transitioning ? 'not-allowed' : 'pointer', border: 'none',
                background: a.danger ? '#FEE2E2' : '#DBEAFE',
                color: a.danger ? '#DC2626' : '#1D4ED8',
                opacity: transitioning ? 0.6 : 1,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 6, padding: '8px 14px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Main content: 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Left column: details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Info grid */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 14px' }}>Genel Bilgiler</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Sorumlu', value: poc.owner_name ?? '—' },
                { label: 'Sponsor', value: poc.sponsor_name ?? '—' },
                { label: 'Başlangıç', value: poc.start_date ? new Date(poc.start_date).toLocaleDateString('tr-TR') : '—' },
                { label: 'Bitiş', value: poc.end_date ? new Date(poc.end_date).toLocaleDateString('tr-TR') : '—' },
                {
                  label: 'Bütçe',
                  value: poc.budget !== null ? poc.budget.toLocaleString('tr-TR') + ' ₺' : '—',
                },
              ].map((field) => (
                <div key={field.label}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', margin: '0 0 3px' }}>
                    {field.label}
                  </p>
                  <p style={{ fontSize: 13, color: '#111827', margin: 0, fontFamily: field.label === 'Bütçe' ? 'monospace' : undefined }}>
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Goals */}
          {(['goals', 'success_criteria', 'notes'] as const).map((field) => {
            const labels: Record<string, string> = {
              goals: 'Hedefler',
              success_criteria: 'Başarı Kriterleri',
              notes: 'Notlar',
            };
            const value = poc[field] ?? '';
            const isEditing = editField === field;
            return (
              <div key={field} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h2 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: 0 }}>{labels[field]}</h2>
                  {!isEditing && (
                    <button
                      onClick={() => { setEditField(field); setEditValue(value); }}
                      style={{ fontSize: 11, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Düzenle
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div>
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={4}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 6,
                        border: '1.5px solid #3B82F6', fontSize: 13, resize: 'vertical',
                        fontFamily: 'inherit', boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        onClick={() => handleSaveField(field, editValue)}
                        style={{ fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '6px 14px', background: '#3B82F6', color: '#fff', border: 'none', cursor: 'pointer' }}
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={() => setEditField(null)}
                        style={{ fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '6px 14px', background: '#F3F4F6', color: '#6B7280', border: 'none', cursor: 'pointer' }}
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: value ? '#111827' : '#D1D5DB', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {value || 'Henüz girilmedi.'}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Right column: updates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 14px' }}>Güncellemeler</h2>

            {/* Add update */}
            {poc.status !== 'cancelled' && (
              <div style={{ marginBottom: 16 }}>
                <textarea
                  value={updateContent}
                  onChange={(e) => setUpdateContent(e.target.value)}
                  placeholder="Haftalık güncelleme ekle…"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6, resize: 'vertical',
                    border: '1.5px solid #E5E7EB', fontSize: 12, fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#3B82F6')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
                />
                <button
                  onClick={handleAddUpdate}
                  disabled={addingUpdate || !updateContent.trim()}
                  style={{
                    marginTop: 6, fontSize: 12, fontWeight: 600, borderRadius: 6,
                    padding: '6px 14px', background: '#3B82F6', color: '#fff', border: 'none',
                    cursor: (addingUpdate || !updateContent.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (addingUpdate || !updateContent.trim()) ? 0.6 : 1,
                  }}
                >
                  {addingUpdate ? 'Ekleniyor…' : '+ Ekle'}
                </button>
              </div>
            )}

            {/* Update list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(poc.updates ?? []).length === 0 && (
                <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>
                  Henüz güncelleme yok.
                </p>
              )}
              {(poc.updates ?? []).map((u: PocUpdate) => (
                <div key={u.id} style={{ borderLeft: '3px solid #DBEAFE', paddingLeft: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 3px' }}>
                    {u.author_name ?? 'Kullanıcı'}
                    <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: 8 }}>
                      {new Date(u.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </p>
                  <p style={{ fontSize: 12, color: '#374151', margin: 0, whiteSpace: 'pre-wrap' }}>{u.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -10
```

Expected: **zero errors**.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/innovation/pocs/[id]/page.tsx"
git commit -m "feat(ui): POC detail page — info, inline edit, transitions, updates timeline"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Gereksinimi | Task |
|-----------------|------|
| `innovation_pocs` tablosu | Task 1 |
| `innovation_poc_updates` tablosu | Task 1 |
| `PocStatus`, `InnovationPoc`, DTOs | Task 2 |
| `pocsRepo` CRUD | Task 3 |
| Durum geçiş kuralları | Task 4 (`pocService`) |
| GET/POST `/api/innovation/pocs` | Task 5 |
| GET/PATCH `/api/innovation/pocs/[id]` | Task 5 |
| POST `.../transition` | Task 5 |
| POST `.../updates` | Task 5 |
| Sidebar "POC'lar" menüsü | Task 6 |
| Ideas detail POC sekmesi | Task 6 |
| POC list sayfası | Task 7 |
| POC detail sayfası | Task 8 |
| `business_sponsor` onay akışı (2 nokta) | Task 4 + Task 8 |
| `cancel` sadece `innovation_admin` | Task 4 |

### 2. Placeholder Taraması

Placeholder yok. Tüm adımlarda tam kod mevcut.

### 3. Tip Tutarlılığı

- `InnovationPoc` Task 2'de tanımlandı, Task 3-8'de kullanıldı. ✅
- `PocTransitionAction` Task 2'de tanımlandı, Task 4 TRANSITIONS map'i ile eşleşiyor. ✅
- `findPocById` Task 3'te tanımlandı, Task 5'te import edildi. ✅
- `createPoc`, `updatePoc`, `transitionPoc`, `addPocUpdate` servisleri Task 4'te tanımlandı, Task 5'te import edildi. ✅
