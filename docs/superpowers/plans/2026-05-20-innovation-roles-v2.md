# Innovation V2 — Rol Sistemi Genişletmesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut tek kolonlu `auth_profiles.innovation_role` yapısını junction tabloya taşıyarak her kullanıcının birden fazla innovation rolü taşımasına izin ver; `business_sponsor`, `finance`, `pmo_manager`, `executive` rollerini ekle.

**Architecture:** Yeni `innovation_user_roles` junction tablosu oluşturulur. Mevcut veriler migration ile taşınır. `src/lib/innovation/utils.ts` dosyasında `hasRole` ve `getInnovationRoles` helper'ları tanımlanır. Tüm route handler'lardaki `innovation_role` kolon okuma kaldırılarak junction tablo sorgusuna geçilir. Settings UI dropdown → per-role checkbox olur.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL), Tailwind CSS

---

## File Structure

| İşlem | Dosya |
|-------|-------|
| Create | `supabase-innovation-roles-v2.sql` |
| Create | `src/lib/innovation/utils.ts` |
| Modify | `src/lib/innovation/types/index.ts` |
| Modify | `src/types/index.ts` |
| Modify | `src/lib/db.ts` |
| Modify | `src/lib/innovation/services/evaluationService.ts` |
| Modify | `src/lib/innovation/services/innovationNotifications.ts` |
| Modify | `src/app/api/innovation/users/route.ts` |
| Modify | `src/app/api/innovation/users/[id]/route.ts` |
| Modify | `src/app/api/innovation/stages/route.ts` |
| Modify | `src/app/api/innovation/stages/[id]/route.ts` |
| Modify | `src/app/api/innovation/criteria/route.ts` |
| Modify | `src/app/api/innovation/criteria/[id]/route.ts` |
| Modify | `src/app/api/innovation/campaigns/route.ts` |
| Modify | `src/app/api/innovation/campaigns/[id]/route.ts` |
| Modify | `src/app/api/innovation/campaigns/[id]/invites/route.ts` |
| Modify | `src/app/api/innovation/ideas/route.ts` |
| Modify | `src/app/api/innovation/ideas/[id]/route.ts` |
| Modify | `src/app/api/innovation/ideas/[id]/advance/route.ts` |
| Modify | `src/app/api/innovation/ideas/[id]/evaluate/route.ts` |
| Modify | `src/app/api/innovation/stats/route.ts` |
| Modify | `src/components/layout/Sidebar.tsx` |
| Modify | `src/app/(app)/innovation/ideas/[id]/page.tsx` |
| Modify | `src/app/(app)/innovation/settings/page.tsx` |

---

### Task 1: DB Migration SQL

**Files:**
- Create: `supabase-innovation-roles-v2.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase-innovation-roles-v2.sql
-- Step 1: Create junction table
CREATE TABLE innovation_user_roles (
  user_id    TEXT NOT NULL REFERENCES auth_profiles(id) ON DELETE CASCADE,
  org_id     TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN (
               'innovation_evaluator', 'innovation_admin',
               'business_sponsor', 'finance', 'pmo_manager', 'executive'
             )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

-- Step 2: Migrate existing data
INSERT INTO innovation_user_roles (user_id, org_id, role)
SELECT id, org_id, innovation_role
FROM auth_profiles
WHERE innovation_role IS NOT NULL;

-- Note: auth_profiles.innovation_role column is NOT dropped here.
-- Code will stop writing/reading it. Drop it manually later with:
-- ALTER TABLE auth_profiles DROP COLUMN innovation_role;
```

- [ ] **Step 2: Run in Supabase SQL editor**

Go to Supabase dashboard → SQL editor → paste and run the file.
Verify: `SELECT * FROM innovation_user_roles LIMIT 5;` should show migrated rows.

- [ ] **Step 3: Commit**

```bash
git add supabase-innovation-roles-v2.sql
git commit -m "sql: create innovation_user_roles junction table, migrate existing data"
```

---

### Task 2: Types + Helpers Foundation

**Files:**
- Modify: `src/lib/innovation/types/index.ts:5`
- Modify: `src/lib/innovation/types/index.ts:128-133`
- Modify: `src/types/index.ts:120`
- Create: `src/lib/innovation/utils.ts`

This task establishes the type foundation that all subsequent tasks depend on. Do not proceed to Task 3 until TypeScript compiles cleanly.

- [ ] **Step 1: Update `InnovationRole` type in `src/lib/innovation/types/index.ts`**

Find line 5:
```ts
export type InnovationRole = 'innovation_evaluator' | 'innovation_admin' | null;
```
Replace with:
```ts
export type InnovationRole =
  | 'innovation_evaluator'
  | 'innovation_admin'
  | 'business_sponsor'
  | 'finance'
  | 'pmo_manager'
  | 'executive';
```

- [ ] **Step 2: Update `InnovationStats.user_role` in `src/lib/innovation/types/index.ts`**

Find line 133 (inside `InnovationStats` interface):
```ts
  user_role: InnovationRole;
```
Replace with:
```ts
  user_roles: InnovationRole[];
```

- [ ] **Step 3: Update `User` interface in `src/types/index.ts`**

Find line 120:
```ts
  innovation_role?: 'innovation_evaluator' | 'innovation_admin' | null;
```
Replace with:
```ts
  innovation_roles?: InnovationRole[];
```

Add the import at the top of the file if not already present. Check line 1 of `src/types/index.ts` for existing imports. If `InnovationRole` is not imported there, add:
```ts
import type { InnovationRole } from '@/lib/innovation/types';
```

- [ ] **Step 4: Create `src/lib/innovation/utils.ts`**

```ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationRole } from './types';

export function hasRole(
  roles: InnovationRole[] | undefined,
  role: InnovationRole
): boolean {
  return roles?.includes(role) ?? false;
}

export async function getInnovationRoles(userId: string): Promise<InnovationRole[]> {
  const { data } = await supabaseAdmin
    .from('innovation_user_roles')
    .select('role')
    .eq('user_id', userId);
  return (data ?? []).map((r) => (r as { role: InnovationRole }).role);
}
```

- [ ] **Step 5: Check TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about `innovation_role` usages in files not yet updated (db.ts, route files, etc.) — NOT about the types themselves. If you see errors in `types/index.ts` or `utils.ts`, fix them before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/innovation/types/index.ts src/types/index.ts src/lib/innovation/utils.ts
git commit -m "feat(types): expand InnovationRole, add innovation_roles[] to User, add hasRole helper"
```

---

### Task 3: Auth Store — `db.ts`

**Files:**
- Modify: `src/lib/db.ts:229-251`

- [ ] **Step 1: Update `dbLoadProfile` to read from junction table**

Find the `dbLoadProfile` function (around line 229). Replace the entire function:

```ts
// Before (lines 229-238):
export async function dbLoadProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("auth_profiles")
    .select("data, innovation_role")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  const profile = data.data as User;
  return { ...profile, innovation_role: (data.innovation_role ?? null) as User['innovation_role'] };
}
```

With:
```ts
export async function dbLoadProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("auth_profiles")
    .select("data")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  const profile = data.data as User;
  const { data: roleRows } = await supabase
    .from("innovation_user_roles")
    .select("role")
    .eq("user_id", userId);
  const innovation_roles = (roleRows ?? []).map((r) => (r as { role: string }).role) as import('@/lib/innovation/types').InnovationRole[];
  return { ...profile, innovation_roles };
}
```

- [ ] **Step 2: Update `dbUpsertProfile` to not write `innovation_role`**

Find the `dbUpsertProfile` function (around line 240). Replace the relevant line:

```ts
// Before (line 245):
  if ('innovation_role' in d) row.innovation_role = d.innovation_role ?? null;
```

Delete that line entirely. `innovation_role` is no longer written via dbUpsertProfile — roles are managed through the junction table exclusively.

- [ ] **Step 3: Check TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "db.ts"
```
Expected: no errors in `db.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(auth): dbLoadProfile reads innovation_roles[] from junction table"
```

---

### Task 4: Users API Routes

**Files:**
- Modify: `src/app/api/innovation/users/route.ts`
- Modify: `src/app/api/innovation/users/[id]/route.ts`

- [ ] **Step 1: Rewrite `src/app/api/innovation/users/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
import type { InnovationRole } from '@/lib/innovation/types';

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string; orgId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const roles = await getInnovationRoles(user.id);
  if (!hasRole(roles, 'innovation_admin')) return { ok: false, status: 403 };
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!profile?.org_id) return { ok: false, status: 403 };
  return { ok: true, userId: user.id, orgId: profile.org_id as string };
}

export async function GET(req: NextRequest) {
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { data: profiles, error } = await supabaseAdmin
    .from('auth_profiles')
    .select('id, data')
    .eq('org_id', ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (profiles ?? []).map((p) => p.id as string);

  const { data: roleRows } = await supabaseAdmin
    .from('innovation_user_roles')
    .select('user_id, role')
    .in('user_id', userIds);

  const rolesByUser: Record<string, InnovationRole[]> = {};
  for (const r of roleRows ?? []) {
    const row = r as { user_id: string; role: InnovationRole };
    if (!rolesByUser[row.user_id]) rolesByUser[row.user_id] = [];
    rolesByUser[row.user_id].push(row.role);
  }

  const users = (profiles ?? []).map((row) => {
    const p = row.data as Record<string, unknown>;
    return {
      id: row.id as string,
      name: (p?.name as string) ?? 'Bilinmiyor',
      email: (p?.email as string) ?? '',
      department: (p?.department as string | null) ?? null,
      innovation_roles: rolesByUser[row.id as string] ?? [],
    };
  });

  return NextResponse.json(users);
}
```

- [ ] **Step 2: Rewrite `src/app/api/innovation/users/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
import type { InnovationRole } from '@/lib/innovation/types';

const VALID_ROLES: InnovationRole[] = [
  'innovation_evaluator', 'innovation_admin',
  'business_sponsor', 'finance', 'pmo_manager', 'executive',
];

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string; orgId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const roles = await getInnovationRoles(user.id);
  if (!hasRole(roles, 'innovation_admin')) return { ok: false, status: 403 };
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!profile?.org_id) return { ok: false, status: 403 };
  return { ok: true, userId: user.id, orgId: profile.org_id as string };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { id } = await params;

  let body: { role: InnovationRole; action: 'add' | 'remove' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 });
  }

  if (!VALID_ROLES.includes(body.role) || !['add', 'remove'].includes(body.action)) {
    return NextResponse.json({ error: 'Geçersiz rol veya aksiyon' }, { status: 400 });
  }

  // Verify target user belongs to the same org
  const { data: targetRow } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id, data')
    .eq('id', id)
    .single();

  if (!targetRow || targetRow.org_id !== ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (body.action === 'add') {
    const { error } = await supabaseAdmin
      .from('innovation_user_roles')
      .upsert({ user_id: id, org_id: ctx.orgId, role: body.role }, { onConflict: 'user_id,role' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin
      .from('innovation_user_roles')
      .delete()
      .eq('user_id', id)
      .eq('role', body.role);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updatedRoles = await getInnovationRoles(id);
  const p = targetRow.data as Record<string, unknown>;
  return NextResponse.json({
    id,
    name: (p?.name as string) ?? 'Bilinmiyor',
    email: (p?.email as string) ?? '',
    department: (p?.department as string | null) ?? null,
    innovation_roles: updatedRoles,
  });
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "users/route|users/\[id\]"
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/innovation/users/route.ts src/app/api/innovation/users/\[id\]/route.ts
git commit -m "feat(api): users routes — innovation_roles[] response, add/remove action"
```

---

### Task 5: Mechanical Route Updates (stages, criteria, campaigns, ideas, stats)

**Files:**
- Modify: `src/app/api/innovation/stages/route.ts`
- Modify: `src/app/api/innovation/stages/[id]/route.ts`
- Modify: `src/app/api/innovation/criteria/route.ts`
- Modify: `src/app/api/innovation/criteria/[id]/route.ts`
- Modify: `src/app/api/innovation/campaigns/route.ts`
- Modify: `src/app/api/innovation/campaigns/[id]/route.ts`
- Modify: `src/app/api/innovation/campaigns/[id]/invites/route.ts`
- Modify: `src/app/api/innovation/ideas/route.ts`
- Modify: `src/app/api/innovation/ideas/[id]/route.ts`
- Modify: `src/app/api/innovation/stats/route.ts`

The pattern is the same for every file: replace the `innovation_role` column read with a junction table query using `getInnovationRoles`. Each file gets the import added and the `getCtx`/`getAdminCtx` updated.

- [ ] **Step 1: Update `src/app/api/innovation/stages/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findAllStages, findAllStagesAdmin, createStage } from '@/lib/innovation/repositories/stagesRepo';
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
import type { CreateStageDto } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const roles = await getInnovationRoles(user.id);
  return { userId: user.id, roles };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const all = req.nextUrl.searchParams.get('all') === '1';
  if (all && hasRole(ctx.roles, 'innovation_admin')) {
    return NextResponse.json(await findAllStagesAdmin());
  }
  return NextResponse.json(await findAllStages());
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRole(ctx.roles, 'innovation_admin'))
    return NextResponse.json({ error: 'Sadece innovation_admin yapabilir' }, { status: 403 });

  try {
    const dto = await req.json() as CreateStageDto;
    if (!dto.name?.trim()) return NextResponse.json({ error: 'İsim zorunlu' }, { status: 400 });
    if (!dto.color?.trim()) return NextResponse.json({ error: 'Renk zorunlu' }, { status: 400 });
    if (typeof dto.min_score_to_advance !== 'number') return NextResponse.json({ error: 'Min skor sayı olmalı' }, { status: 400 });
    if (typeof dto.required_evaluations !== 'number') return NextResponse.json({ error: 'Zorunlu değerlendirme sayısı sayı olmalı' }, { status: 400 });

    const stage = await createStage(dto);
    return NextResponse.json(stage, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Update `src/app/api/innovation/stages/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { updateStage, deleteStage } from '@/lib/innovation/repositories/stagesRepo';
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
import type { UpdateStageDto } from '@/lib/innovation/types';

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const roles = await getInnovationRoles(user.id);
  if (!hasRole(roles, 'innovation_admin')) return { ok: false, status: 403 };
  return { ok: true, userId: user.id };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: ctx.status });

  try {
    const dto = await req.json() as UpdateStageDto;
    const stage = await updateStage(id, dto);
    return NextResponse.json(stage);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: ctx.status });

  try {
    await deleteStage(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 3: Update `src/app/api/innovation/criteria/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findAllCriteria, createCriterion } from '@/lib/innovation/repositories/evaluationsRepo';
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
import type { CreateCriterionDto } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const roles = await getInnovationRoles(user.id);
  return { userId: user.id, roles };
}

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const roles = await getInnovationRoles(user.id);
  if (!hasRole(roles, 'innovation_admin')) return { ok: false, status: 403 };
  return { ok: true, userId: user.id };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await findAllCriteria());
}

export async function POST(req: NextRequest) {
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: ctx.status });

  try {
    const dto = await req.json() as CreateCriterionDto;
    if (!dto.name?.trim()) return NextResponse.json({ error: 'İsim zorunlu' }, { status: 400 });
    if (dto.weight === undefined || dto.weight === null)
      return NextResponse.json({ error: 'Ağırlık zorunlu' }, { status: 400 });
    if (dto.weight <= 0 || dto.weight > 1)
      return NextResponse.json({ error: 'Ağırlık 0-1 arasında olmalı' }, { status: 400 });
    if (typeof dto.max_score !== 'number' || dto.max_score < 1)
      return NextResponse.json({ error: 'Max skor en az 1 olmalı' }, { status: 400 });

    const criterion = await createCriterion(dto);
    return NextResponse.json(criterion, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 4: Update `src/app/api/innovation/criteria/[id]/route.ts`**

Read the current file first. It has `getAdminCtx` that reads `innovation_role`. Replace the import block and `getAdminCtx` the same way as above (use `getInnovationRoles` + `hasRole`). The rest of the file (PATCH, DELETE handlers) stays identical.

The updated file:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { updateCriterion, deleteCriterion } from '@/lib/innovation/repositories/evaluationsRepo';
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
import type { UpdateCriterionDto } from '@/lib/innovation/types';

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const roles = await getInnovationRoles(user.id);
  if (!hasRole(roles, 'innovation_admin')) return { ok: false, status: 403 };
  return { ok: true, userId: user.id };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: ctx.status });
  try {
    const dto = await req.json() as UpdateCriterionDto;
    const criterion = await updateCriterion(id, dto);
    return NextResponse.json(criterion);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: ctx.status });
  try {
    await deleteCriterion(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 5: Update `src/app/api/innovation/campaigns/route.ts`**

The `getCtx` currently reads `org_id, innovation_role` together. After the change, `org_id` still comes from `auth_profiles`, roles from junction table. Update only the `getCtx` function:

```ts
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
  return {
    userId: user.id,
    orgId: p.org_id as string,
    innovationRoles: roles,
  };
}
```

Add the import:
```ts
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
```

Remove `InnovationRole` from the types import if it was only used for the role typing.

Then update any authorization checks in the handler from:
```ts
if (ctx.innovationRole !== 'innovation_admin') ...
```
To:
```ts
if (!hasRole(ctx.innovationRoles, 'innovation_admin')) ...
```

- [ ] **Step 6: Update `src/app/api/innovation/campaigns/[id]/route.ts`**

Same pattern as Step 5 — update `getCtx` to use `getInnovationRoles`, update all `innovationRole !== 'innovation_admin'` checks to `!hasRole(ctx.innovationRoles, 'innovation_admin')`. Add import.

- [ ] **Step 7: Update `src/app/api/innovation/campaigns/[id]/invites/route.ts`**

Same pattern as Step 5 — update `getCtx` and all admin checks. Add import.

- [ ] **Step 8: Update `src/app/api/innovation/ideas/route.ts`**

Same pattern. The `getCtx` function currently reads `org_id, innovation_role`. Update to use `getInnovationRoles`. Update admin checks. Add import.

- [ ] **Step 9: Update `src/app/api/innovation/ideas/[id]/route.ts`**

Same pattern. Update `getCtx` to use `getInnovationRoles`. The admin check `ctx.innovationRole !== 'innovation_admin'` becomes `!hasRole(ctx.innovationRoles, 'innovation_admin')`. Note: this file also has `canEdit` and `canDelete` service calls — those use `ctx.innovationRole` which needs to become `ctx.innovationRoles`. Check the `canEdit`/`canDelete` function signatures in `src/lib/innovation/services/ideasService.ts` and pass the array.

Read `src/lib/innovation/services/ideasService.ts` to see the `canEdit` signature:
```bash
grep -n "canEdit\|canDelete" src/lib/innovation/services/ideasService.ts | head -10
```
If `canEdit` takes `InnovationRole` (single), update it to accept `InnovationRole[]` and use `hasRole` internally. Then pass `ctx.innovationRoles` from the route.

- [ ] **Step 10: Update `src/app/api/innovation/stats/route.ts`**

The stats route currently returns `user_role: ctx.innovationRole`. The type was changed to `user_roles: InnovationRole[]` in Task 2.

Update `getAuthContext`:
```ts
async function getAuthContext(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!profile) return null;
  const roles = await getInnovationRoles(user.id);
  return {
    userId: user.id,
    orgId: profile.org_id as string,
    innovationRoles: roles,
  };
}
```

Add import:
```ts
import { getInnovationRoles } from '@/lib/innovation/utils';
import type { InnovationRole } from '@/lib/innovation/types';
```

Update the stats object construction (around line 118-127):
```ts
// Change:
user_role: ctx.innovationRole as InnovationStats['user_role'],
// To:
user_roles: ctx.innovationRoles,
```

- [ ] **Step 11: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```
Expected: errors only in files not yet updated (settings page, sidebar, ideas detail page). No errors in the API route files.

- [ ] **Step 12: Commit**

```bash
git add src/app/api/innovation/stages/route.ts \
        "src/app/api/innovation/stages/[id]/route.ts" \
        src/app/api/innovation/criteria/route.ts \
        "src/app/api/innovation/criteria/[id]/route.ts" \
        src/app/api/innovation/campaigns/route.ts \
        "src/app/api/innovation/campaigns/[id]/route.ts" \
        "src/app/api/innovation/campaigns/[id]/invites/route.ts" \
        src/app/api/innovation/ideas/route.ts \
        "src/app/api/innovation/ideas/[id]/route.ts" \
        src/app/api/innovation/stats/route.ts
git commit -m "feat(api): migrate all route handlers from innovation_role column to junction table"
```

---

### Task 6: Evaluate Route + evaluationService

**Files:**
- Modify: `src/lib/innovation/services/evaluationService.ts:5-13`
- Modify: `src/app/api/innovation/ideas/[id]/evaluate/route.ts`
- Modify: `src/app/api/innovation/ideas/[id]/advance/route.ts`

- [ ] **Step 1: Update `saveEvaluation` signature in `evaluationService.ts`**

The function currently takes `role: InnovationRole`. Change to `roles: InnovationRole[]`.

```ts
import * as evaluationsRepo from '../repositories/evaluationsRepo';
import * as ideasRepo from '../repositories/ideasRepo';
import type { CreateEvaluationDto, InnovationRole } from '../types';
import { hasRole } from '../utils';

export async function saveEvaluation(params: {
  ideaId: string;
  evaluatorId: string;
  stageId: string;
  roles: InnovationRole[];
  dto: CreateEvaluationDto;
}): Promise<{ evaluationId: string; totalScore: number; compositeScore: number }> {
  if (!hasRole(params.roles, 'innovation_evaluator') && !hasRole(params.roles, 'innovation_admin')) {
    throw new Error('Değerlendirme yapmak için innovation_evaluator veya innovation_admin rolü gereklidir');
  }

  const criteria = await evaluationsRepo.findActiveCriteria();

  let totalScore = 0;
  for (const scoreInput of params.dto.scores) {
    const criterion = criteria.find((c) => c.id === scoreInput.criterion_id);
    if (!criterion) continue;
    totalScore += (scoreInput.score / criterion.max_score) * criterion.weight * 100;
  }
  totalScore = Math.round(totalScore * 100) / 100;

  const evaluationId = await evaluationsRepo.createEvaluation({
    ideaId: params.ideaId,
    evaluatorId: params.evaluatorId,
    stageId: params.stageId,
    dto: params.dto,
    totalScore,
  });

  const compositeScore = await evaluationsRepo.getAvgCompositeScore(params.ideaId);
  await ideasRepo.updateCompositeScore(params.ideaId, compositeScore);

  return { evaluationId, totalScore, compositeScore };
}
```

- [ ] **Step 2: Update `src/app/api/innovation/ideas/[id]/evaluate/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { saveEvaluation } from '@/lib/innovation/services/evaluationService';
import { getInnovationRoles } from '@/lib/innovation/utils';
import type { CreateEvaluationDto } from '@/lib/innovation/types';
import { notifyIdeaEvaluated } from '@/lib/innovation/services/innovationNotifications';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roles = await getInnovationRoles(user.id);

  const { data: idea } = await supabaseAdmin
    .from('innovation_ideas')
    .select('id, idea_number, title, org_id, submitter_id, stage_id')
    .eq('id', id)
    .single();
  if (!idea) return NextResponse.json({ error: 'Fikir bulunamadı' }, { status: 404 });

  const dto = await req.json() as CreateEvaluationDto;
  if (!dto.scores?.length) return NextResponse.json({ error: 'Puan listesi boş olamaz' }, { status: 400 });

  try {
    const result = await saveEvaluation({
      ideaId: id,
      evaluatorId: user.id,
      stageId: idea.stage_id as string,
      roles,
      dto,
    });

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
}
```

- [ ] **Step 3: Update `src/app/api/innovation/ideas/[id]/advance/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { advanceStage } from '@/lib/innovation/services/ideasService';
import { getInnovationRoles, hasRole } from '@/lib/innovation/utils';
import type { AdvanceStageDto } from '@/lib/innovation/types';
import { notifyIdeaStageAdvanced } from '@/lib/innovation/services/innovationNotifications';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roles = await getInnovationRoles(user.id);
  if (!hasRole(roles, 'innovation_admin'))
    return NextResponse.json({ error: 'Sadece innovation_admin stage ilerletebilir' }, { status: 403 });

  const dto = await req.json() as AdvanceStageDto;
  try {
    await advanceStage({ ideaId: id, userId: user.id, dto });

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
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "evaluate|advance|evaluationService" | head -10
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/innovation/services/evaluationService.ts \
        "src/app/api/innovation/ideas/[id]/evaluate/route.ts" \
        "src/app/api/innovation/ideas/[id]/advance/route.ts"
git commit -m "feat(eval): update saveEvaluation to accept roles[], update advance route"
```

---

### Task 7: innovationNotifications — Junction Table Query

**Files:**
- Modify: `src/lib/innovation/services/innovationNotifications.ts:52-59`

- [ ] **Step 1: Update `getEvaluatorsAndAdmins` function**

Find the function (around line 52):

```ts
async function getEvaluatorsAndAdmins(orgId: string, excludeUserId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('auth_profiles')
    .select('id')
    .eq('org_id', orgId)
    .in('innovation_role', ['innovation_admin', 'innovation_evaluator'])
    .neq('id', excludeUserId);
  return (data ?? []).map((r) => r.id as string);
}
```

Replace with:

```ts
async function getEvaluatorsAndAdmins(orgId: string, excludeUserId: string): Promise<string[]> {
  const { data: roleRows } = await supabaseAdmin
    .from('innovation_user_roles')
    .select('user_id')
    .eq('org_id', orgId)
    .in('role', ['innovation_admin', 'innovation_evaluator'])
    .neq('user_id', excludeUserId);
  return [...new Set((roleRows ?? []).map((r) => (r as { user_id: string }).user_id))];
}
```

Note: `new Set` deduplicates in case a user has both admin and evaluator roles (which would produce two rows).

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "innovationNotifications" | head -5
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/services/innovationNotifications.ts
git commit -m "feat(notifications): query junction table for admin/evaluator recipients"
```

---

### Task 8: Sidebar + Ideas Detail Page

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:245`
- Modify: `src/app/(app)/innovation/ideas/[id]/page.tsx`

- [ ] **Step 1: Update `Sidebar.tsx`**

Find line 245:
```ts
const isInnovationAdmin = user?.innovation_role === 'innovation_admin';
```

Replace with:
```ts
const isInnovationAdmin = user?.innovation_roles?.includes('innovation_admin') ?? false;
```

No import change needed — `user` is already typed from the auth store.

- [ ] **Step 2: Update `src/app/(app)/innovation/ideas/[id]/page.tsx`**

The file has two things to fix:

**Fix A** — The state type and initialization (around line 53):
```ts
// Before:
const [innovationRole, setInnovationRole] = useState<InnovationRole>(null);
```
Change to:
```ts
const [innovationRoles, setInnovationRoles] = useState<InnovationRole[]>([]);
```

**Fix B** — The useEffect that reads `innovation_role` (around lines 100-110):
```ts
// Before:
useEffect(() => {
  if (!userId) return;
  supabase
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', userId)
    .single()
    .then(({ data }) => {
      setInnovationRole((data?.innovation_role ?? null) as InnovationRole);
    });
}, [userId]);
```

Replace with:
```ts
useEffect(() => {
  if (!userId) return;
  supabase
    .from('innovation_user_roles')
    .select('role')
    .eq('user_id', userId)
    .then(({ data }) => {
      setInnovationRoles((data ?? []).map((r) => (r as { role: InnovationRole }).role));
    });
}, [userId]);
```

**Fix C** — The `canEdit` usage (search for `innovationRole` in the file):
```ts
// Before:
const canEdit = idea.submitter_id === userId || innovationRole === 'innovation_admin';
```
Change to:
```ts
const canEdit = idea.submitter_id === userId || innovationRoles.includes('innovation_admin');
```

Also update the `orgUsers` fetch call (around line 113) — if it checks `innovationRole` for fetching org users, update similarly:
```ts
// If present, change:
// innovationRole === 'innovation_admin'
// To:
// innovationRoles.includes('innovation_admin')
```

Also check the import at the top of the file: `InnovationRole` import likely already exists. Remove `null` from the type usage if it appears.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep -v "settings/page" | head -20
```
Expected: errors only in `settings/page.tsx` (not yet updated), nothing else.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx \
        "src/app/(app)/innovation/ideas/[id]/page.tsx"
git commit -m "feat(ui): update sidebar and idea detail page to use innovation_roles[]"
```

---

### Task 9: Settings Page — Checkbox UI

**Files:**
- Modify: `src/app/(app)/innovation/settings/page.tsx`

This is the most significant UI change. The "Kullanıcılar" tab currently shows a dropdown per user. Replace with per-role checkboxes that auto-save immediately on toggle.

- [ ] **Step 1: Update User type in the settings page**

Find the local user type definition (around line 24):
```ts
innovation_role: InnovationRole;
```
Replace with:
```ts
innovation_roles: InnovationRole[];
```

- [ ] **Step 2: Replace role state management**

The existing state uses `pendingRoles: Record<string, InnovationRole>`. Replace with a per-toggle saving state:
```ts
// Remove:
const [pendingRoles, setPendingRoles] = useState<Record<string, InnovationRole>>({});
const [userSaving, setUserSaving] = useState(false);

// Add:
const [savingToggle, setSavingToggle] = useState<Record<string, boolean>>({});  // key: `${userId}:${role}`
```

Keep `userErrors: Record<string, string>` — but change the key to `${userId}:${role}` for per-checkbox errors.

- [ ] **Step 3: Replace `handleRoleSelect` and `handleSaveRoles` with `handleToggleRole`**

Remove `handleRoleSelect`, `handleSaveRoles`, `handleCancelRoles`. Add:

```ts
const handleToggleRole = useCallback(async (userId: string, role: InnovationRole, currentlyOn: boolean) => {
  const key = `${userId}:${role}`;
  setSavingToggle((prev) => ({ ...prev, [key]: true }));
  setUserErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });

  const action = currentlyOn ? 'remove' : 'add';
  const res = await apiCall(`/api/innovation/users/${userId}`, 'PATCH', token, { role, action });

  if (res.ok) {
    const updated = await res.json();
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, innovation_roles: updated.innovation_roles } : u));
  } else {
    const err = await res.json().catch(() => ({}));
    setUserErrors((prev) => ({ ...prev, [key]: (err as { error?: string }).error ?? 'Hata' }));
  }
  setSavingToggle((prev) => { const next = { ...prev }; delete next[key]; return next; });
}, [token]);
```

- [ ] **Step 4: Update the Users tab render**

Replace the current table render (lines ~695-760) in the Users tab section with:

```tsx
{tab === "users" && (
  <div className="bg-white rounded-lg border border-gray-200">
    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-gray-700">Kullanıcılar</h2>
      <span className="text-xs text-gray-400">{users.length} kullanıcı</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <th className="text-left px-4 py-2">Kullanıcı</th>
            <th className="text-left px-4 py-2">E-posta</th>
            <th className="text-center px-3 py-2">Admin</th>
            <th className="text-center px-3 py-2">Evaluator</th>
            <th className="text-center px-3 py-2">Sponsor</th>
            <th className="text-center px-3 py-2">Finance</th>
            <th className="text-center px-3 py-2">PMO</th>
            <th className="text-center px-3 py-2">Executive</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const initials = u.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
            const roles: InnovationRole[] = ['innovation_admin', 'innovation_evaluator', 'business_sponsor', 'finance', 'pmo_manager', 'executive'];
            return (
              <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                      {initials}
                    </div>
                    <span className="font-medium text-gray-800">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                {roles.map((role) => {
                  const key = `${u.id}:${role}`;
                  const isOn = u.innovation_roles.includes(role);
                  const isSaving = !!savingToggle[key];
                  const errMsg = userErrors[key];
                  return (
                    <td key={role} className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="relative group">
                          {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isOn}
                              disabled={isSelf}
                              onChange={() => handleToggleRole(u.id, role, isOn)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          )}
                          {isSelf && (
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              Kendi rolünüzü değiştiremezsiniz
                            </span>
                          )}
                        </div>
                        {errMsg && <AlertCircle className="w-3 h-3 text-red-500" title={errMsg} />}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400 italic">
                Kullanıcı bulunamadı.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
)}
```

- [ ] **Step 5: Remove the "Kaydet" button from users tab**

The old UI had a "Kaydet" / "İptal" button row for bulk save. Remove those buttons — the new design auto-saves per checkbox.

- [ ] **Step 6: Update settings page `user_role` → `user_roles` check**

Around line 105:
```ts
// Before:
if (stats.user_role !== "innovation_admin") { ... }

// After:
if (!stats.user_roles?.includes("innovation_admin")) { ... }
```

- [ ] **Step 7: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```
Expected: **zero errors**.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/innovation/settings/page.tsx"
git commit -m "feat(settings): users tab — dropdown replaced with per-role checkbox, auto-save on toggle"
```

---

### Task 10: ideasService.ts canEdit/canDelete Update

**Files:**
- Modify: `src/lib/innovation/services/ideasService.ts`

Before Task 9 passes TypeScript, check if `canEdit` and `canDelete` in `ideasService.ts` accept `InnovationRole` (single). Run:

```bash
grep -n "canEdit\|canDelete" src/lib/innovation/services/ideasService.ts
```

- [ ] **Step 1: If `canEdit` takes `InnovationRole` (single value), update it**

If signature is:
```ts
export function canEdit(idea: InnovationIdea, userId: string, role: InnovationRole): boolean {
  return idea.submitter_id === userId || role === 'innovation_admin';
}
```

Change to:
```ts
import { hasRole } from './utils'; // add this import

export function canEdit(idea: InnovationIdea, userId: string, roles: InnovationRole[]): boolean {
  return idea.submitter_id === userId || hasRole(roles, 'innovation_admin');
}
```

Do the same for `canDelete` if it exists with a similar signature.

- [ ] **Step 2: Update `ideas/[id]/route.ts` call sites**

In `src/app/api/innovation/ideas/[id]/route.ts`, any calls:
```ts
canEdit(idea, ctx.userId, ctx.innovationRole)
```
become:
```ts
canEdit(idea, ctx.userId, ctx.innovationRoles)
```

- [ ] **Step 3: Final TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```
Expected: **zero errors**.

- [ ] **Step 4: Commit**

```bash
git add src/lib/innovation/services/ideasService.ts "src/app/api/innovation/ideas/[id]/route.ts"
git commit -m "feat(service): update canEdit/canDelete to accept InnovationRole[] array"
```
