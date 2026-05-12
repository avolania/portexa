# Innovation Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings page for stage/criteria CRUD and a Kanban toggle to the Pipeline page with drag-and-drop stage advance.

**Architecture:** Phase 1 3-layer pattern (Repository → Route Handler → Page). No Zustand. `@hello-pangea/dnd` for Kanban drag-and-drop. Settings page does immediate API calls on each action (no save button).

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, Tailwind CSS v4, `@hello-pangea/dnd`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/innovation/types/index.ts` | Modify | Add 4 CRUD DTOs |
| `src/lib/innovation/repositories/stagesRepo.ts` | Modify | Add createStage, updateStage, deleteStage, findAllStagesAdmin |
| `src/lib/innovation/repositories/evaluationsRepo.ts` | Modify | Add findAllCriteria, createCriterion, updateCriterion, deleteCriterion |
| `src/app/api/innovation/stages/route.ts` | Modify | Add POST handler, support `?all=1` |
| `src/app/api/innovation/stages/[id]/route.ts` | Create | PATCH + DELETE single stage |
| `src/app/api/innovation/criteria/route.ts` | Create | GET + POST criteria |
| `src/app/api/innovation/criteria/[id]/route.ts` | Create | PATCH + DELETE single criterion |
| `src/app/(app)/innovation/settings/page.tsx` | Create | Settings page (stages + criteria tabs) |
| `src/components/layout/Sidebar.tsx` | Modify | Add Settings link to innovation section |
| `src/app/(app)/innovation/pipeline/page.tsx` | Modify | Add viewMode toggle + KanbanBoard + AdvanceReasonModal |

---

### Task 1: TypeScript DTO additions

**Files:**
- Modify: `src/lib/innovation/types/index.ts`

- [ ] **Step 1: Add 4 DTOs to types/index.ts after the existing `AdvanceStageDto` interface**

Open `src/lib/innovation/types/index.ts`. After the `AdvanceStageDto` interface (end of file), add:

```typescript
export interface CreateStageDto {
  name: string;
  color: string;
  min_score_to_advance: number;
  required_evaluations: number;
}

export interface UpdateStageDto {
  name?: string;
  color?: string;
  min_score_to_advance?: number;
  required_evaluations?: number;
  is_active?: boolean;
  order_index?: number;
}

export interface CreateCriterionDto {
  name: string;
  description?: string;
  weight: number;
  max_score: number;
}

export interface UpdateCriterionDto {
  name?: string;
  description?: string;
  weight?: number;
  max_score?: number;
  is_active?: boolean;
  order_index?: number;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/types/index.ts
git commit -m "feat(innovation): add Stage and Criterion CRUD DTO types"
```

---

### Task 2: Stages repository additions

**Files:**
- Modify: `src/lib/innovation/repositories/stagesRepo.ts`

- [ ] **Step 1: Add imports and 4 new functions to stagesRepo.ts**

The current file exports `findAllStages` and `findStageById`. Add the following to the end of the file:

```typescript
import type { CreateStageDto, UpdateStageDto } from '../types';

export async function findAllStagesAdmin(): Promise<InnovationStage[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_stages')
    .select('*')
    .order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []) as InnovationStage[];
}

export async function createStage(dto: CreateStageDto): Promise<InnovationStage> {
  const { data: maxRow } = await supabaseAdmin
    .from('innovation_stages')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single();
  const nextOrder = ((maxRow as { order_index: number } | null)?.order_index ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from('innovation_stages')
    .insert({
      id: crypto.randomUUID(),
      order_index: nextOrder,
      name: dto.name,
      color: dto.color,
      min_score_to_advance: dto.min_score_to_advance,
      required_evaluations: dto.required_evaluations,
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as InnovationStage;
}

export async function updateStage(id: string, dto: UpdateStageDto): Promise<InnovationStage> {
  const { data, error } = await supabaseAdmin
    .from('innovation_stages')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as InnovationStage;
}

export async function deleteStage(id: string): Promise<void> {
  const { count } = await supabaseAdmin
    .from('innovation_ideas')
    .select('id', { count: 'exact', head: true })
    .eq('stage_id', id);
  if (count && count > 0) throw new Error('Bu aşamada fikir var, silinemez');
  const { error } = await supabaseAdmin
    .from('innovation_stages')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
```

**Important:** The import for `CreateStageDto` and `UpdateStageDto` must be added at the top of the file alongside the existing `InnovationStage` import:

```typescript
import type { InnovationStage, CreateStageDto, UpdateStageDto } from '../types';
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/repositories/stagesRepo.ts
git commit -m "feat(innovation): add createStage, updateStage, deleteStage, findAllStagesAdmin to stagesRepo"
```

---

### Task 3: Criteria repository additions

**Files:**
- Modify: `src/lib/innovation/repositories/evaluationsRepo.ts`

- [ ] **Step 1: Add imports and 4 new functions to evaluationsRepo.ts**

The current import line is:
```typescript
import type { EvaluationCriterion, IdeaEvaluation, CreateEvaluationDto } from '../types';
```

Change it to:
```typescript
import type { EvaluationCriterion, IdeaEvaluation, CreateEvaluationDto, CreateCriterionDto, UpdateCriterionDto } from '../types';
```

Then add the following 4 functions at the end of the file:

```typescript
export async function findAllCriteria(): Promise<EvaluationCriterion[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .select('*')
    .order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []) as EvaluationCriterion[];
}

export async function createCriterion(dto: CreateCriterionDto): Promise<EvaluationCriterion> {
  const { data: maxRow } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single();
  const nextOrder = ((maxRow as { order_index: number } | null)?.order_index ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .insert({
      id: crypto.randomUUID(),
      order_index: nextOrder,
      name: dto.name,
      description: dto.description ?? '',
      weight: dto.weight,
      max_score: dto.max_score,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as EvaluationCriterion;
}

export async function updateCriterion(id: string, dto: UpdateCriterionDto): Promise<EvaluationCriterion> {
  const { data, error } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as EvaluationCriterion;
}

export async function deleteCriterion(id: string): Promise<void> {
  const { count } = await supabaseAdmin
    .from('innovation_evaluation_scores')
    .select('id', { count: 'exact', head: true })
    .eq('criterion_id', id);
  if (count && count > 0) throw new Error('Bu kritere ait değerlendirme var, silinemez');
  const { error } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/repositories/evaluationsRepo.ts
git commit -m "feat(innovation): add findAllCriteria, createCriterion, updateCriterion, deleteCriterion to evaluationsRepo"
```

---

### Task 4: Stages API — POST + PATCH/DELETE

**Files:**
- Modify: `src/app/api/innovation/stages/route.ts`
- Create: `src/app/api/innovation/stages/[id]/route.ts`

- [ ] **Step 1: Replace the contents of `src/app/api/innovation/stages/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findAllStages, findAllStagesAdmin, createStage } from '@/lib/innovation/repositories/stagesRepo';
import type { CreateStageDto, InnovationRole } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', user.id)
    .single();
  return { userId: user.id, role: (profile?.innovation_role ?? null) as InnovationRole };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const all = req.nextUrl.searchParams.get('all') === '1';
  if (all && ctx.role === 'innovation_admin') {
    return NextResponse.json(await findAllStagesAdmin());
  }
  return NextResponse.json(await findAllStages());
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'innovation_admin')
    return NextResponse.json({ error: 'Sadece innovation_admin yapabilir' }, { status: 403 });

  const dto = await req.json() as CreateStageDto;
  if (!dto.name?.trim()) return NextResponse.json({ error: 'İsim zorunlu' }, { status: 400 });

  try {
    const stage = await createStage(dto);
    return NextResponse.json(stage, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Create `src/app/api/innovation/stages/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { updateStage, deleteStage } from '@/lib/innovation/repositories/stagesRepo';
import type { UpdateStageDto, InnovationRole } from '@/lib/innovation/types';

async function getAdminCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', user.id)
    .single();
  const role = (profile?.innovation_role ?? null) as InnovationRole;
  if (role !== 'innovation_admin') return null;
  return { userId: user.id };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: 403 });

  const dto = await req.json() as UpdateStageDto;
  try {
    const stage = await updateStage(id, dto);
    return NextResponse.json(stage);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: 403 });

  try {
    await deleteStage(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/innovation/stages/route.ts "src/app/api/innovation/stages/[id]/route.ts"
git commit -m "feat(innovation): add stages CRUD API (POST, PATCH, DELETE)"
```

---

### Task 5: Criteria API

**Files:**
- Create: `src/app/api/innovation/criteria/route.ts`
- Create: `src/app/api/innovation/criteria/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/innovation/criteria/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findAllCriteria, createCriterion } from '@/lib/innovation/repositories/evaluationsRepo';
import type { CreateCriterionDto, InnovationRole } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', user.id)
    .single();
  return { userId: user.id, role: (profile?.innovation_role ?? null) as InnovationRole };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await findAllCriteria());
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'innovation_admin')
    return NextResponse.json({ error: 'Sadece innovation_admin yapabilir' }, { status: 403 });

  const dto = await req.json() as CreateCriterionDto;
  if (!dto.name?.trim()) return NextResponse.json({ error: 'İsim zorunlu' }, { status: 400 });
  if (!dto.weight || dto.weight <= 0 || dto.weight > 1)
    return NextResponse.json({ error: 'Ağırlık 0-1 arasında olmalı' }, { status: 400 });

  try {
    const criterion = await createCriterion(dto);
    return NextResponse.json(criterion, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Create `src/app/api/innovation/criteria/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { updateCriterion, deleteCriterion } from '@/lib/innovation/repositories/evaluationsRepo';
import type { UpdateCriterionDto, InnovationRole } from '@/lib/innovation/types';

async function getAdminCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', user.id)
    .single();
  const role = (profile?.innovation_role ?? null) as InnovationRole;
  if (role !== 'innovation_admin') return null;
  return { userId: user.id };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: 403 });

  const dto = await req.json() as UpdateCriterionDto;
  try {
    const criterion = await updateCriterion(id, dto);
    return NextResponse.json(criterion);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized veya yetersiz yetki' }, { status: 403 });

  try {
    await deleteCriterion(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/innovation/criteria/route.ts "src/app/api/innovation/criteria/[id]/route.ts"
git commit -m "feat(innovation): add criteria CRUD API (GET, POST, PATCH, DELETE)"
```

---

### Task 6: Settings Page

**Files:**
- Create: `src/app/(app)/innovation/settings/page.tsx`

- [ ] **Step 1: Create the settings page file**

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, ArrowUp, ArrowDown,
  AlertCircle, Loader2, Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  InnovationStage, EvaluationCriterion,
  CreateStageDto, UpdateStageDto,
  CreateCriterionDto, UpdateCriterionDto,
} from "@/lib/innovation/types";

type Tab = "stages" | "criteria";

function apiCall(url: string, method: string, token: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export default function InnovationSettings() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<Tab>("stages");
  const [loading, setLoading] = useState(true);

  // Stages
  const [stages, setStages] = useState<InnovationStage[]>([]);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageForm, setEditStageForm] = useState<UpdateStageDto>({});
  const [showNewStage, setShowNewStage] = useState(false);
  const [newStageForm, setNewStageForm] = useState<CreateStageDto>({
    name: "", color: "#6B7280", min_score_to_advance: 0, required_evaluations: 0,
  });
  const [stageSaving, setStageSaving] = useState(false);
  const [stageError, setStageError] = useState("");

  // Criteria
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null);
  const [editCriterionForm, setEditCriterionForm] = useState<UpdateCriterionDto>({});
  const [showNewCriterion, setShowNewCriterion] = useState(false);
  const [newCriterionForm, setNewCriterionForm] = useState<CreateCriterionDto>({
    name: "", description: "", weight: 0.25, max_score: 10,
  });
  const [criterionSaving, setCriterionSaving] = useState(false);
  const [criterionError, setCriterionError] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/giris"); return; }
      setToken(session.access_token);

      const statsRes = await fetch("/api/innovation/stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        if (stats.user_role !== "innovation_admin") {
          router.push("/innovation");
          return;
        }
      }

      const [stagesRes, criteriaRes] = await Promise.all([
        fetch("/api/innovation/stages?all=1", { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch("/api/innovation/criteria", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ]);
      if (stagesRes.ok) setStages(await stagesRes.json());
      if (criteriaRes.ok) setCriteria(await criteriaRes.json());
      setLoading(false);
    }
    init();
  }, [router]);

  // ── Stage handlers ─────────────────────────────────────────────────────────

  const handleCreateStage = useCallback(async () => {
    if (!newStageForm.name.trim()) { setStageError("İsim zorunlu"); return; }
    setStageSaving(true); setStageError("");
    const res = await apiCall("/api/innovation/stages", "POST", token, newStageForm);
    if (res.ok) {
      const created: InnovationStage = await res.json();
      setStages((prev) => [...prev, created]);
      setShowNewStage(false);
      setNewStageForm({ name: "", color: "#6B7280", min_score_to_advance: 0, required_evaluations: 0 });
    } else {
      const err = await res.json();
      setStageError(err.error ?? "Hata");
    }
    setStageSaving(false);
  }, [token, newStageForm]);

  const handleSaveStage = useCallback(async (id: string) => {
    setStageSaving(true); setStageError("");
    const res = await apiCall(`/api/innovation/stages/${id}`, "PATCH", token, editStageForm);
    if (res.ok) {
      const updated: InnovationStage = await res.json();
      setStages((prev) => prev.map((s) => s.id === id ? updated : s));
      setEditingStageId(null);
    } else {
      const err = await res.json();
      setStageError(err.error ?? "Hata");
    }
    setStageSaving(false);
  }, [token, editStageForm]);

  const handleDeleteStage = useCallback(async (id: string) => {
    if (!confirm("Bu aşamayı silmek istediğinize emin misiniz?")) return;
    const res = await apiCall(`/api/innovation/stages/${id}`, "DELETE", token);
    if (res.ok) {
      setStages((prev) => prev.filter((s) => s.id !== id));
    } else {
      const err = await res.json();
      setStageError(err.error ?? "Hata");
    }
  }, [token]);

  const handleToggleStageActive = useCallback(async (stage: InnovationStage) => {
    const res = await apiCall(`/api/innovation/stages/${stage.id}`, "PATCH", token, { is_active: !stage.is_active });
    if (res.ok) {
      const updated: InnovationStage = await res.json();
      setStages((prev) => prev.map((s) => s.id === stage.id ? updated : s));
    }
  }, [token]);

  const handleReorderStage = useCallback(async (idx: number, dir: -1 | 1) => {
    const other = idx + dir;
    if (other < 0 || other >= stages.length) return;
    const a = stages[idx];
    const b = stages[other];
    await Promise.all([
      apiCall(`/api/innovation/stages/${a.id}`, "PATCH", token, { order_index: b.order_index }),
      apiCall(`/api/innovation/stages/${b.id}`, "PATCH", token, { order_index: a.order_index }),
    ]);
    setStages((prev) => {
      const next = [...prev];
      next[idx] = { ...a, order_index: b.order_index };
      next[other] = { ...b, order_index: a.order_index };
      return next.sort((x, y) => x.order_index - y.order_index);
    });
  }, [token, stages]);

  // ── Criterion handlers ─────────────────────────────────────────────────────

  const handleCreateCriterion = useCallback(async () => {
    if (!newCriterionForm.name.trim()) { setCriterionError("İsim zorunlu"); return; }
    setCriterionSaving(true); setCriterionError("");
    const res = await apiCall("/api/innovation/criteria", "POST", token, newCriterionForm);
    if (res.ok) {
      const created: EvaluationCriterion = await res.json();
      setCriteria((prev) => [...prev, created]);
      setShowNewCriterion(false);
      setNewCriterionForm({ name: "", description: "", weight: 0.25, max_score: 10 });
    } else {
      const err = await res.json();
      setCriterionError(err.error ?? "Hata");
    }
    setCriterionSaving(false);
  }, [token, newCriterionForm]);

  const handleSaveCriterion = useCallback(async (id: string) => {
    setCriterionSaving(true); setCriterionError("");
    const res = await apiCall(`/api/innovation/criteria/${id}`, "PATCH", token, editCriterionForm);
    if (res.ok) {
      const updated: EvaluationCriterion = await res.json();
      setCriteria((prev) => prev.map((c) => c.id === id ? updated : c));
      setEditingCriterionId(null);
    } else {
      const err = await res.json();
      setCriterionError(err.error ?? "Hata");
    }
    setCriterionSaving(false);
  }, [token, editCriterionForm]);

  const handleDeleteCriterion = useCallback(async (id: string) => {
    if (!confirm("Bu kriteri silmek istediğinize emin misiniz?")) return;
    const res = await apiCall(`/api/innovation/criteria/${id}`, "DELETE", token);
    if (res.ok) {
      setCriteria((prev) => prev.filter((c) => c.id !== id));
    } else {
      const err = await res.json();
      setCriterionError(err.error ?? "Hata");
    }
  }, [token]);

  const handleToggleCriterionActive = useCallback(async (criterion: EvaluationCriterion) => {
    const res = await apiCall(`/api/innovation/criteria/${criterion.id}`, "PATCH", token, { is_active: !criterion.is_active });
    if (res.ok) {
      const updated: EvaluationCriterion = await res.json();
      setCriteria((prev) => prev.map((c) => c.id === criterion.id ? updated : c));
    }
  }, [token]);

  const handleReorderCriterion = useCallback(async (idx: number, dir: -1 | 1) => {
    const other = idx + dir;
    if (other < 0 || other >= criteria.length) return;
    const a = criteria[idx];
    const b = criteria[other];
    await Promise.all([
      apiCall(`/api/innovation/criteria/${a.id}`, "PATCH", token, { order_index: b.order_index }),
      apiCall(`/api/innovation/criteria/${b.id}`, "PATCH", token, { order_index: a.order_index }),
    ]);
    setCriteria((prev) => {
      const next = [...prev];
      next[idx] = { ...a, order_index: b.order_index };
      next[other] = { ...b, order_index: a.order_index };
      return next.sort((x, y) => x.order_index - y.order_index);
    });
  }, [token, criteria]);

  const totalWeight = criteria.filter((c) => c.is_active).reduce((sum, c) => sum + c.weight, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">İnovasyon Ayarları</h1>
        <p className="text-sm text-gray-500 mt-0.5">Aşama ve değerlendirme kriteri yönetimi</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["stages", "criteria"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "stages" ? "Aşamalar" : "Değerlendirme Kriterleri"}
          </button>
        ))}
      </div>

      {/* ── Stages Tab ─────────────────────────────────────────────────────── */}
      {tab === "stages" && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Aşamalar</h2>
            <button
              onClick={() => setShowNewStage((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Yeni Aşama
            </button>
          </div>

          {stageError && (
            <div className="mx-4 mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {stageError}
              <button onClick={() => setStageError("")} className="ml-auto"><span className="text-xs">✕</span></button>
            </div>
          )}

          {showNewStage && (
            <div className="p-4 border-b border-blue-100 bg-blue-50">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">İsim *</label>
                  <input
                    value={newStageForm.name}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                    placeholder="Aşama ismi"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Renk</label>
                  <input
                    type="color"
                    value={newStageForm.color}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, color: e.target.value }))}
                    className="mt-1 w-full h-9 border border-gray-200 rounded-lg px-1 py-1 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Skor</label>
                  <input
                    type="number" min={0} max={100}
                    value={newStageForm.min_score_to_advance}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, min_score_to_advance: Number(e.target.value) }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zorunlu Değerlendirme</label>
                  <input
                    type="number" min={0} max={10}
                    value={newStageForm.required_evaluations}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, required_evaluations: Number(e.target.value) }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleCreateStage}
                  disabled={stageSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {stageSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Kaydet
                </button>
                <button onClick={() => setShowNewStage(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  İptal
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {stages.map((stage, idx) => (
              <div key={stage.id} className={`p-4 ${!stage.is_active ? "opacity-50" : ""}`}>
                {editingStageId === stage.id ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">İsim</label>
                      <input
                        value={editStageForm.name ?? stage.name}
                        onChange={(e) => setEditStageForm((f) => ({ ...f, name: e.target.value }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Renk</label>
                      <input
                        type="color"
                        value={editStageForm.color ?? stage.color}
                        onChange={(e) => setEditStageForm((f) => ({ ...f, color: e.target.value }))}
                        className="mt-1 w-full h-9 border border-gray-200 rounded-lg px-1 py-1 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Skor</label>
                      <input
                        type="number" min={0} max={100}
                        value={editStageForm.min_score_to_advance ?? stage.min_score_to_advance}
                        onChange={(e) => setEditStageForm((f) => ({ ...f, min_score_to_advance: Number(e.target.value) }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zorunlu Değerlendirme</label>
                      <input
                        type="number" min={0} max={10}
                        value={editStageForm.required_evaluations ?? stage.required_evaluations}
                        onChange={(e) => setEditStageForm((f) => ({ ...f, required_evaluations: Number(e.target.value) }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="col-span-2 flex gap-2 mt-1">
                      <button
                        onClick={() => handleSaveStage(stage.id)}
                        disabled={stageSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {stageSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Kaydet
                      </button>
                      <button onClick={() => setEditingStageId(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                    <span className="text-xs font-mono text-gray-400 w-5">{stage.order_index}</span>
                    <span className="flex-1 text-sm font-semibold text-gray-800">{stage.name}</span>
                    <span className="text-xs text-gray-500 hidden md:block">Min: {stage.min_score_to_advance}</span>
                    <span className="text-xs text-gray-500 hidden md:block">Değ: {stage.required_evaluations}</span>
                    <button
                      onClick={() => handleToggleStageActive(stage)}
                      className={`text-xs px-2 py-0.5 rounded font-semibold transition-colors ${
                        stage.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {stage.is_active ? "Aktif" : "Pasif"}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleReorderStage(idx, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleReorderStage(idx, 1)} disabled={idx === stages.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditingStageId(stage.id); setEditStageForm({}); }} className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteStage(stage.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {stages.length === 0 && (
              <p className="p-6 text-sm text-gray-400 italic text-center">Henüz aşama yok.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Criteria Tab ───────────────────────────────────────────────────── */}
      {tab === "criteria" && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Değerlendirme Kriterleri</h2>
              {Math.abs(totalWeight - 1) > 0.01 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  ⚠ Σ ağırlık = %{Math.round(totalWeight * 100)} — toplamın %100 olması önerilir
                </p>
              )}
            </div>
            <button
              onClick={() => setShowNewCriterion((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Yeni Kriter
            </button>
          </div>

          {criterionError && (
            <div className="mx-4 mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {criterionError}
              <button onClick={() => setCriterionError("")} className="ml-auto"><span className="text-xs">✕</span></button>
            </div>
          )}

          {showNewCriterion && (
            <div className="p-4 border-b border-blue-100 bg-blue-50">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">İsim *</label>
                  <input
                    value={newCriterionForm.name}
                    onChange={(e) => setNewCriterionForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                    placeholder="Kriter ismi"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Açıklama</label>
                  <input
                    value={newCriterionForm.description ?? ""}
                    onChange={(e) => setNewCriterionForm((f) => ({ ...f, description: e.target.value }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                    placeholder="Opsiyonel"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ağırlık (%)</label>
                  <input
                    type="number" min={1} max={100}
                    value={Math.round(newCriterionForm.weight * 100)}
                    onChange={(e) => setNewCriterionForm((f) => ({ ...f, weight: Number(e.target.value) / 100 }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Skor</label>
                  <input
                    type="number" min={1} max={100}
                    value={newCriterionForm.max_score}
                    onChange={(e) => setNewCriterionForm((f) => ({ ...f, max_score: Number(e.target.value) }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleCreateCriterion}
                  disabled={criterionSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {criterionSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Kaydet
                </button>
                <button onClick={() => setShowNewCriterion(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  İptal
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {criteria.map((criterion, idx) => (
              <div key={criterion.id} className={`p-4 ${!criterion.is_active ? "opacity-50" : ""}`}>
                {editingCriterionId === criterion.id ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">İsim</label>
                      <input
                        value={editCriterionForm.name ?? criterion.name}
                        onChange={(e) => setEditCriterionForm((f) => ({ ...f, name: e.target.value }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Açıklama</label>
                      <input
                        value={editCriterionForm.description ?? criterion.description ?? ""}
                        onChange={(e) => setEditCriterionForm((f) => ({ ...f, description: e.target.value }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ağırlık (%)</label>
                      <input
                        type="number" min={1} max={100}
                        value={Math.round((editCriterionForm.weight ?? criterion.weight) * 100)}
                        onChange={(e) => setEditCriterionForm((f) => ({ ...f, weight: Number(e.target.value) / 100 }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Skor</label>
                      <input
                        type="number" min={1} max={100}
                        value={editCriterionForm.max_score ?? criterion.max_score}
                        onChange={(e) => setEditCriterionForm((f) => ({ ...f, max_score: Number(e.target.value) }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="col-span-2 flex gap-2 mt-1">
                      <button
                        onClick={() => handleSaveCriterion(criterion.id)}
                        disabled={criterionSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {criterionSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Kaydet
                      </button>
                      <button onClick={() => setEditingCriterionId(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-semibold text-gray-800">{criterion.name}</span>
                    {criterion.description && (
                      <span className="text-xs text-gray-400 truncate max-w-[160px] hidden md:block">{criterion.description}</span>
                    )}
                    <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      %{Math.round(criterion.weight * 100)}
                    </span>
                    <span className="text-xs text-gray-500">Max: {criterion.max_score}</span>
                    <button
                      onClick={() => handleToggleCriterionActive(criterion)}
                      className={`text-xs px-2 py-0.5 rounded font-semibold transition-colors ${
                        criterion.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {criterion.is_active ? "Aktif" : "Pasif"}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleReorderCriterion(idx, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleReorderCriterion(idx, 1)} disabled={idx === criteria.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditingCriterionId(criterion.id); setEditCriterionForm({}); }} className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteCriterion(criterion.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {criteria.length === 0 && (
              <p className="p-6 text-sm text-gray-400 italic text-center">Henüz kriter yok.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/innovation/settings/page.tsx"
git commit -m "feat(innovation): add Settings page with stages and criteria CRUD"
```

---

### Task 7: Sidebar — Settings link

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

`SlidersHorizontal` is already imported. Find the innovation section in `navSections` and add the Settings item:

- [ ] **Step 1: Add Settings link to the innovation navSection**

Find this block in `src/components/layout/Sidebar.tsx`:

```typescript
  {
    id: "innovation",
    label: "İnovasyon",
    icon: Lightbulb,
    defaultOpen: false,
    items: [
      { href: "/innovation",          icon: LayoutDashboard, label: "Dashboard" },
      { href: "/innovation/pipeline", icon: Lightbulb,       label: "Pipeline"  },
    ],
  },
```

Replace with:

```typescript
  {
    id: "innovation",
    label: "İnovasyon",
    icon: Lightbulb,
    defaultOpen: false,
    items: [
      { href: "/innovation",          icon: LayoutDashboard,   label: "Dashboard" },
      { href: "/innovation/pipeline", icon: Lightbulb,         label: "Pipeline"  },
      { href: "/innovation/settings", icon: SlidersHorizontal, label: "Ayarlar"   },
    ],
  },
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(innovation): add Settings link to sidebar"
```

---

### Task 8: Install @hello-pangea/dnd + Kanban view

**Files:**
- Modify: `src/app/(app)/innovation/pipeline/page.tsx`

- [ ] **Step 1: Install the package**

```bash
npm install @hello-pangea/dnd
```

Expected: package added to `node_modules` and `package.json`.

- [ ] **Step 2: Add `AdvanceReasonModal` component**

Open `src/app/(app)/innovation/pipeline/page.tsx`. After the `NewIdeaModal` component (around line 407, just before `// ── Page ──`), add this new component:

```typescript
// ── Advance Reason Modal ──────────────────────────────────────────────────────

function AdvanceReasonModal({
  onConfirm,
  onCancel,
  error,
}: {
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
  error: string;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    await onConfirm(reason);
    setSubmitting(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <h3 className="text-base font-bold text-gray-900 mb-1">Aşama İlerlet</h3>
          <p className="text-sm text-gray-500 mb-4">Bu fikri bir sonraki aşamaya taşımak için gerekçe girin.</p>
          {error && (
            <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="flex-shrink-0">⚠</span>
              {error}
            </div>
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Gerekçe girin..."
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={onCancel}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={!reason.trim() || submitting}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              İlerlet
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Update imports in pipeline/page.tsx**

Find the existing import block at the top of the file:

```typescript
import {
  Plus, Search, X, ChevronUp, ChevronDown,
  Loader2, MessageCircle, Star, ArrowRight,
} from "lucide-react";
```

Replace with:

```typescript
import {
  Plus, Search, ChevronUp, ChevronDown,
  Loader2, MessageCircle, Star, LayoutList, LayoutGrid,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
```

(Note: `X` and `ArrowRight` are used in `DetailSlideOver` and `NewIdeaModal` — check if they're still needed. `X` is used in `DetailSlideOver` close button and `NewIdeaModal`. `ArrowRight` is used in `DetailSlideOver` stage advance. Keep them if present in those components.)

**Corrected import** (keeping all that are used in existing sub-components):

```typescript
import {
  Plus, Search, X, ChevronUp, ChevronDown,
  Loader2, MessageCircle, Star, ArrowRight, LayoutList, LayoutGrid,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
```

- [ ] **Step 4: Add viewMode and pendingAdvance state to InnovationPipeline page component**

In the `InnovationPipeline` function, find the existing state declarations (around line 415–428) and add after them:

```typescript
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [pendingAdvance, setPendingAdvance] = useState<{
    ideaId: string;
    originalStage: InnovationStage;
  } | null>(null);
  const [advanceError, setAdvanceError] = useState("");
```

Also add a `useEffect` to restore viewMode from localStorage. Add this after the existing state declarations:

```typescript
  useEffect(() => {
    const saved = localStorage.getItem('innovation_view_mode');
    if (saved === 'kanban') setViewMode('kanban');
  }, []);
```

- [ ] **Step 5: Add handleDragEnd and handleConfirmAdvance functions**

In the `InnovationPipeline` function, after the existing `handleVote` function (around line 482), add:

```typescript
  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.source.droppableId === result.destination.droppableId) return;

    const fromStage = stages.find((s) => s.id === result.source.droppableId);
    const toStage = stages.find((s) => s.id === result.destination!.droppableId);
    if (!fromStage || !toStage) return;
    if (toStage.order_index !== fromStage.order_index + 1) return;

    const idea = ideas.find((i) => i.id === result.draggableId);
    if (!idea) return;

    // Optimistic update
    setIdeas((prev) =>
      prev.map((i) => i.id === idea.id ? { ...i, stage_id: toStage.id, stage: toStage } : i)
    );
    setAdvanceError("");
    setPendingAdvance({ ideaId: idea.id, originalStage: fromStage });
  }

  async function handleConfirmAdvance(reason: string) {
    if (!pendingAdvance) return;
    const res = await fetch(`/api/innovation/ideas/${pendingAdvance.ideaId}/advance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      setAdvanceError(err.error ?? 'Stage ilerletme başarısız');
      // Revert optimistic update
      const orig = pendingAdvance.originalStage;
      setIdeas((prev) =>
        prev.map((i) => i.id === pendingAdvance.ideaId ? { ...i, stage_id: orig.id, stage: orig } : i)
      );
      return;
    }
    setPendingAdvance(null);
  }
```

- [ ] **Step 6: Add view toggle buttons to filter bar**

In the pipeline page's return JSX, find the filter bar div that ends with the `<select>` for sort (around line 549). Add the view toggle right after the closing `</select>` and before the closing `</div>` of the filter bar:

```tsx
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => { setViewMode('list'); localStorage.setItem('innovation_view_mode', 'list'); }}
            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
              viewMode === 'list' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Liste görünümü"
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setViewMode('kanban'); localStorage.setItem('innovation_view_mode', 'kanban'); }}
            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
              viewMode === 'kanban' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Kanban görünümü"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
```

- [ ] **Step 7: Add Kanban board JSX**

Find the `{/* Ideas List */}` section (around line 552). The current structure is:

```tsx
      {/* Ideas List */}
      {loading ? (
        ...
      ) : ideas.length === 0 ? (
        ...
      ) : (
        <div className="space-y-3">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} onOpen={setSelectedIdea} />
          ))}
        </div>
      )}
```

Replace the entire `{/* Ideas List */}` block with:

```tsx
      {/* Ideas List / Kanban */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : viewMode === 'list' ? (
        ideas.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-gray-400 text-sm italic">Henüz fikir bulunmuyor.</p>
            <button onClick={() => setShowNewModal(true)} className="mt-3 text-sm text-blue-600 hover:underline">
              İlk fikri siz gönderin
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} onOpen={setSelectedIdea} />
            ))}
          </div>
        )
      ) : (
        /* Kanban view */
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const colIdeas = ideas.filter((i) => i.stage_id === stage.id);
              return (
                <div
                  key={stage.id}
                  className="flex-shrink-0 w-[280px] bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div
                    className="p-3 border-b border-gray-200 flex items-center gap-2"
                    style={{ borderLeftWidth: 3, borderLeftColor: stage.color }}
                  >
                    <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{stage.name}</span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                      style={{ background: stage.color }}
                    >
                      {colIdeas.length}
                    </span>
                  </div>
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-2 min-h-[96px] space-y-2 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-blue-50' : ''
                        }`}
                      >
                        {colIdeas.map((idea, index) => (
                          <Draggable
                            key={idea.id}
                            draggableId={idea.id}
                            index={index}
                            isDragDisabled={userRole !== 'innovation_admin'}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => setSelectedIdea(idea)}
                                className={`bg-white border border-gray-200 rounded-lg p-3 transition-all ${
                                  dragSnapshot.isDragging ? 'shadow-lg rotate-1 border-blue-300' : 'hover:border-blue-200'
                                } ${userRole === 'innovation_admin' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                              >
                                <p className="font-mono text-xs text-gray-400 mb-1">{idea.idea_number}</p>
                                <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">{idea.title}</p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span
                                    className="text-xs font-bold"
                                    style={{ color: idea.vote_count >= 0 ? '#059669' : '#DC2626' }}
                                  >
                                    {idea.vote_count >= 0 ? '↑' : '↓'}{Math.abs(idea.vote_count)}
                                  </span>
                                  {idea.composite_score > 0 && (
                                    <span className="text-xs text-amber-600">⭐ {idea.composite_score}</span>
                                  )}
                                  {idea.submitter && (
                                    <span className="text-xs text-gray-400 ml-auto truncate max-w-[80px]">
                                      {idea.submitter.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {colIdeas.length === 0 && (
                          <p className="text-xs text-gray-400 italic text-center py-4">Boş</p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
```

- [ ] **Step 8: Add AdvanceReasonModal to page JSX**

Find the end of the page JSX (the `{/* New Idea Modal */}` block near the end, before the closing `</div>`). After the `NewIdeaModal` block, add:

```tsx
      {/* Advance Reason Modal */}
      {pendingAdvance && (
        <AdvanceReasonModal
          onConfirm={handleConfirmAdvance}
          onCancel={() => {
            // Revert optimistic update
            const orig = pendingAdvance.originalStage;
            setIdeas((prev) =>
              prev.map((i) => i.id === pendingAdvance.ideaId ? { ...i, stage_id: orig.id, stage: orig } : i)
            );
            setPendingAdvance(null);
            setAdvanceError("");
          }}
          error={advanceError}
        />
      )}
```

- [ ] **Step 9: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output. If there are type errors from `@hello-pangea/dnd`, run `npm install --save-dev @types/hello-pangea__dnd` (though the package ships its own types, so this usually isn't needed).

- [ ] **Step 10: Commit**

```bash
git add "src/app/(app)/innovation/pipeline/page.tsx" package.json package-lock.json
git commit -m "feat(innovation): add Kanban view with drag-and-drop stage advance to Pipeline"
```

---

### Task 9: Final build + push

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: Build completes with `/innovation`, `/innovation/pipeline`, and `/innovation/settings` all listed in the output. No errors.

- [ ] **Step 2: Push to GitHub (triggers Vercel deploy)**

```bash
git push origin main
```

Expected: Push succeeds. Vercel deployment auto-triggered.
