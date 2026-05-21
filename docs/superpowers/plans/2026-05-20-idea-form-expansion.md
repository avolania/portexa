# Fikir Formu Genişletmesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `description` to `problem`, add 7 new DB columns, update NewIdeaModal with `idea_type` field, and create a new idea detail page at `/innovation/ideas/[id]`.

**Architecture:** Bottom-up: DB migration → types → repository → service → UI. Each layer depends on the one below. The detail page is a new route; modals redirect to it after submit instead of calling `onCreated`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (supabaseAdmin), Tailwind CSS v4, React hooks

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `supabase-idea-form-expansion.sql` | DB migration: rename + 7 new columns |
| Modify | `src/lib/innovation/types/index.ts` | New types + interface updates |
| Modify | `src/lib/innovation/repositories/ideasRepo.ts` | description→problem, sponsor join, allowlist |
| Modify | `src/lib/innovation/services/ideasService.ts` | description→problem pass-through |
| Modify | `src/app/api/innovation/ideas/similar/route.ts` | description→problem in select + mapping |
| Modify | `src/components/innovation/SimilarIdeasModal.tsx` | description→problem display |
| Modify | `src/app/(app)/innovation/pipeline/page.tsx` | Modal: idea_type field + redirect |
| Modify | `src/app/(app)/innovation/kampanyalar/[id]/page.tsx` | Modal: idea_type field + redirect |
| Create | `src/app/(app)/innovation/ideas/[id]/page.tsx` | Full idea detail page |

---

### Task 1: DB Migration SQL

**Files:**
- Create: `supabase-idea-form-expansion.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase-idea-form-expansion.sql

-- Rename description to problem (preserves all existing data)
ALTER TABLE innovation_ideas RENAME COLUMN description TO problem;

-- Add 7 new columns (all with safe defaults)
ALTER TABLE innovation_ideas
  ADD COLUMN proposed_solution TEXT NOT NULL DEFAULT '',
  ADD COLUMN affected_area     TEXT NOT NULL DEFAULT '',
  ADD COLUMN location_process  TEXT NOT NULL DEFAULT '',
  ADD COLUMN idea_type         TEXT NOT NULL DEFAULT '',
  ADD COLUMN estimated_impact  TEXT NOT NULL DEFAULT '',
  ADD COLUMN confidentiality   TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN sponsor_id        TEXT REFERENCES auth_profiles(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Run migration in Supabase SQL editor**

Open Supabase dashboard → SQL editor → paste and run the file contents. Verify in Table Editor that `innovation_ideas` now has a `problem` column (data intact) and 7 new columns.

- [ ] **Step 3: Commit**

```bash
git add supabase-idea-form-expansion.sql
git commit -m "sql: rename description→problem, add 7 new idea form columns"
```

---

### Task 2: Types Update

**Files:**
- Modify: `src/lib/innovation/types/index.ts`

- [ ] **Step 1: Add three new union types**

After line 5 (`export type InnovationRole = ...`), insert:

```ts
export type IdeaType =
  | 'quick_win' | 'process' | 'digital' | 'ai_data' | 'ot' | 'strategic' | '';

export type EstimatedImpact = 'low' | 'medium' | 'high' | '';

export type IdeaConfidentiality = 'open' | 'team' | 'private';
```

- [ ] **Step 2: Replace `InnovationIdea` interface**

Replace lines 85–111 with:

```ts
export interface InnovationIdea {
  id: string;
  idea_number: string;
  org_id: string;
  submitter_id: string;
  submitter?: IdeaAuthor;
  stage_id: string;
  stage?: InnovationStage;
  status: IdeaStatus;
  title: string;
  problem: string;
  proposed_solution: string;
  affected_area: string;
  location_process: string;
  idea_type: IdeaType;
  estimated_impact: EstimatedImpact;
  confidentiality: IdeaConfidentiality;
  sponsor_id: string | null;
  sponsor?: { name: string } | null;
  category: string;
  impact_score: number;
  feasibility_score: number;
  composite_score: number;
  vote_count: number;
  comment_count: number;
  estimated_value?: number;
  currency_code: string;
  created_at: string;
  updated_at: string;
  tags?: IdeaTag[];
  comments?: IdeaComment[];
  evaluations?: IdeaEvaluation[];
  stage_history?: StageHistoryEntry[];
  user_vote?: number | null;
}
```

- [ ] **Step 3: Replace `CreateIdeaDto`**

Replace lines 147–155 with:

```ts
export interface CreateIdeaDto {
  title: string;
  problem: string;
  category: string;
  idea_type?: IdeaType;
  estimated_value?: number;
  currency_code?: string;
  tag_ids?: string[];
  campaign_id?: string;
}
```

- [ ] **Step 4: Replace `UpdateIdeaDto`**

Replace lines 157–164 with:

```ts
export interface UpdateIdeaDto {
  title?: string;
  problem?: string;
  proposed_solution?: string;
  category?: string;
  affected_area?: string;
  location_process?: string;
  idea_type?: IdeaType;
  estimated_impact?: EstimatedImpact;
  confidentiality?: IdeaConfidentiality;
  sponsor_id?: string | null;
  estimated_value?: number;
  currency_code?: string;
  status?: IdeaStatus;
}
```

- [ ] **Step 5: Replace `SimilarIdea`**

Replace lines 272–280 with:

```ts
export interface SimilarIdea {
  id: string;
  idea_number: string;
  title: string;
  problem: string | null;
  stage: { name: string; color: string } | null;
  submitter: { name: string } | null;
  created_at: string;
}
```

- [ ] **Step 6: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: errors in files that still use `description` — will be fixed in later tasks. The types file itself must be error-free.

- [ ] **Step 7: Commit**

```bash
git add src/lib/innovation/types/index.ts
git commit -m "feat(types): add IdeaType/EstimatedImpact/IdeaConfidentiality; update InnovationIdea, DTOs, SimilarIdea"
```

---

### Task 3: Repository Update

**Files:**
- Modify: `src/lib/innovation/repositories/ideasRepo.ts`

- [ ] **Step 1: Replace `createIdea` function**

Replace lines 95–134 with:

```ts
export async function createIdea(params: {
  ideaNumber: string;
  orgId: string;
  submitterId: string;
  stageId: string;
  title: string;
  problem: string;
  category: string;
  ideaType?: string;
  estimatedValue?: number;
  currencyCode: string;
  campaignId?: string;
}): Promise<InnovationIdea> {
  const { data, error } = await supabaseAdmin
    .from('innovation_ideas')
    .insert({
      id: crypto.randomUUID(),
      idea_number: params.ideaNumber,
      org_id: params.orgId,
      submitter_id: params.submitterId,
      stage_id: params.stageId,
      status: 'submitted',
      title: params.title,
      problem: params.problem,
      category: params.category,
      idea_type: params.ideaType ?? '',
      estimated_value: params.estimatedValue ?? null,
      currency_code: params.currencyCode,
      campaign_id: params.campaignId ?? null,
      impact_score: 0,
      feasibility_score: 0,
      composite_score: 0,
      vote_count: 0,
      comment_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as InnovationIdea;
}
```

- [ ] **Step 2: Add sponsor join to `findIdeaById` select**

In `findIdeaById`, replace the `.select(`` ` ... ` ``)` call (lines 48–69) with:

```ts
  const { data, error } = await supabaseAdmin
    .from('innovation_ideas')
    .select(`
      *,
      submitter:auth_profiles!innovation_ideas_submitter_id_fkey(id, data),
      sponsor:auth_profiles!innovation_ideas_sponsor_id_fkey(id, data),
      stage:innovation_stages!innovation_ideas_stage_id_fkey(id, name, color, order_index, min_score_to_advance, required_evaluations, is_active),
      innovation_comments(
        *,
        author:auth_profiles!innovation_comments_author_id_fkey(id, data)
      ),
      innovation_evaluations(
        *,
        evaluator:auth_profiles!innovation_evaluations_evaluator_id_fkey(id, data),
        innovation_evaluation_scores(*, criterion:innovation_evaluation_criteria(*))
      ),
      innovation_stage_history(
        *,
        to_stage:innovation_stages!innovation_stage_history_to_stage_id_fkey(id, name, color),
        from_stage:innovation_stages!innovation_stage_history_from_stage_id_fkey(id, name, color),
        changer:auth_profiles!innovation_stage_history_changed_by_fkey(id, data)
      )
    `)
    .eq('id', id)
    .single();
```

- [ ] **Step 3: Add sponsor to `findIdeaById` return mapping**

In the return object of `findIdeaById`, add the `sponsor` line after `submitter`:

```ts
  return {
    ...row,
    submitter: mapProfile(row.submitter as Record<string, unknown>),
    sponsor: mapProfile(row.sponsor as Record<string, unknown>) ?? null,
    comments: ((row.innovation_comments ?? []) as Record<string, unknown>[]).map((c) => ({
      ...c,
      author: mapProfile(c.author as Record<string, unknown>),
    })),
    evaluations: ((row.innovation_evaluations ?? []) as Record<string, unknown>[]).map((e) => ({
      ...e,
      evaluator: mapProfile(e.evaluator as Record<string, unknown>),
      scores: (e.innovation_evaluation_scores as unknown[]) ?? [],
    })),
    stage_history: ((row.innovation_stage_history ?? []) as Record<string, unknown>[]).map((h) => ({
      ...h,
      changer: mapProfile(h.changer as Record<string, unknown>),
    })),
  } as unknown as InnovationIdea;
```

- [ ] **Step 4: Replace `updateIdea` with allowlist filter**

Replace lines 136–142 with:

```ts
const ALLOWED_UPDATE_FIELDS = new Set([
  'title', 'problem', 'proposed_solution', 'category',
  'affected_area', 'location_process', 'idea_type',
  'estimated_impact', 'confidentiality', 'sponsor_id',
  'estimated_value', 'currency_code', 'status',
]);

export async function updateIdea(id: string, dto: UpdateIdeaDto): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(dto)) {
    if (ALLOWED_UPDATE_FIELDS.has(k)) patch[k] = v;
  }
  const { error } = await supabaseAdmin
    .from('innovation_ideas')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 5: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: errors only in service (still passes `description`). Repo itself must be clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/innovation/repositories/ideasRepo.ts
git commit -m "feat(repo): description→problem in createIdea, sponsor join in findIdeaById, allowlist in updateIdea"
```

---

### Task 4: Service + Similar Route + SimilarIdeasModal

**Files:**
- Modify: `src/lib/innovation/services/ideasService.ts`
- Modify: `src/app/api/innovation/ideas/similar/route.ts`
- Modify: `src/components/innovation/SimilarIdeasModal.tsx`

- [ ] **Step 1: Update `ideasService.ts` createIdea call**

In `src/lib/innovation/services/ideasService.ts`, replace the `ideasRepo.createIdea(...)` call (lines 48–59) with:

```ts
  const idea = await ideasRepo.createIdea({
    ideaNumber,
    orgId: params.orgId,
    submitterId: params.submitterId,
    stageId,
    title: params.dto.title,
    problem: params.dto.problem ?? '',
    category: params.dto.category ?? '',
    ideaType: params.dto.idea_type,
    estimatedValue: params.dto.estimated_value,
    currencyCode: params.dto.currency_code ?? 'TRY',
    campaignId,
  });
```

- [ ] **Step 2: Replace `similar/route.ts`**

Replace the entire file `src/app/api/innovation/ideas/similar/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { SimilarIdea } from '@/lib/innovation/types';

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
  if (!p?.org_id) return null;
  return { orgId: p.org_id as string };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 200);
  const words = q.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return NextResponse.json([]);

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('innovation_ideas')
      .select(`
        id,
        idea_number,
        title,
        problem,
        created_at,
        submitter:auth_profiles!innovation_ideas_submitter_id_fkey(data),
        stage:innovation_stages!innovation_ideas_stage_id_fkey(name, color)
      `)
      .eq('org_id', ctx.orgId)
      .neq('status', 'rejected')
      .neq('status', 'archived')
      .textSearch('title', q, { config: 'turkish', type: 'plain' })
      .limit(5);

    if (error) throw error;

    const result: SimilarIdea[] = ((rows ?? []) as Record<string, unknown>[]).map((row) => {
      const profileData = (row.submitter as Record<string, unknown> | null)?.data as Record<string, unknown> | null;
      const stageRow = row.stage as { name: string; color: string } | null;
      return {
        id: row.id as string,
        idea_number: row.idea_number as string,
        title: row.title as string,
        problem: row.problem ? (row.problem as string).slice(0, 120) : null,
        stage: stageRow ?? null,
        submitter: profileData?.name ? { name: profileData.name as string } : null,
        created_at: row.created_at as string,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
```

- [ ] **Step 3: Update `SimilarIdeasModal.tsx`**

In `src/components/innovation/SimilarIdeasModal.tsx`, change line 47–49:

Old:
```tsx
                {idea.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{idea.description}</p>
                )}
```

New:
```tsx
                {idea.problem && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{idea.problem}</p>
                )}
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: errors only in the two modal pages (pipeline + kampanyalar). All other files must be clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/innovation/services/ideasService.ts \
        src/app/api/innovation/ideas/similar/route.ts \
        src/components/innovation/SimilarIdeasModal.tsx
git commit -m "feat: description→problem in service, similar route, and SimilarIdeasModal"
```

---

### Task 5: Pipeline NewIdeaModal Update

**Files:**
- Modify: `src/app/(app)/innovation/pipeline/page.tsx`

- [ ] **Step 1: Add `useRouter` to next/navigation import**

Line 4 currently reads:
```ts
import { useSearchParams } from "next/navigation";
```

Change to:
```ts
import { useSearchParams, useRouter } from "next/navigation";
```

- [ ] **Step 2: Add `IdeaType` to types import**

Line 12 currently reads:
```ts
import type { InnovationIdea, InnovationStage, InnovationRole, SimilarIdea } from "@/lib/innovation/types";
```

Change to:
```ts
import type { InnovationIdea, InnovationStage, InnovationRole, SimilarIdea, IdeaType } from "@/lib/innovation/types";
```

- [ ] **Step 3: Update `NewIdeaModal` form state and add router**

Inside the `NewIdeaModal` function body, replace:
```ts
  const [form, setForm] = useState({ title: "", description: "", category: "" });
```

With:
```ts
  const router = useRouter();
  const [form, setForm] = useState({ title: "", problem: "", category: "", idea_type: "" as IdeaType });
```

- [ ] **Step 4: Replace `handleSubmit` to redirect on success**

Replace the `handleSubmit` function (lines 359–375):

```ts
  async function handleSubmit() {
    if (!form.title.trim()) { setError("Başlık zorunludur"); return; }
    abortRef.current?.abort();
    setSubmitting(true);
    const res = await fetch("/api/innovation/ideas", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const idea = await res.json() as InnovationIdea;
      router.push(`/innovation/ideas/${idea.id}`);
    } else {
      const d = await res.json();
      setError(d.error ?? "Hata oluştu");
    }
    setSubmitting(false);
  }
```

- [ ] **Step 5: Replace the description textarea and add idea_type select in JSX**

In the form body, replace the textarea block (around lines 405–423):

Old:
```tsx
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Açıklama</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Fikrinizi detaylandırın..."
                rows={4}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategori</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Süreç İyileştirme, Müşteri Deneyimi..."
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
```

New:
```tsx
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Problem / Fırsat</label>
              <textarea
                value={form.problem}
                onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
                placeholder="Çözülmek istenen problem veya yakalanmak istenen fırsatı açıklayın..."
                rows={4}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategori</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Süreç İyileştirme, Müşteri Deneyimi..."
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fikir Tipi</label>
              <select
                value={form.idea_type}
                onChange={(e) => setForm((f) => ({ ...f, idea_type: e.target.value as IdeaType }))}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
              >
                <option value="">Seçiniz...</option>
                <option value="quick_win">Quick Win</option>
                <option value="process">Süreç İyileştirme</option>
                <option value="digital">Dijital / BT Projesi</option>
                <option value="ai_data">Yapay Zeka / Veri</option>
                <option value="ot">BT-OT / Akıllı Fabrika</option>
                <option value="strategic">Stratejik İnovasyon</option>
              </select>
            </div>
```

- [ ] **Step 6: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: errors only in the kampanyalar page. Pipeline must be clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/innovation/pipeline/page.tsx
git commit -m "feat(pipeline): NewIdeaModal — problem/idea_type fields, redirect to detail page after submit"
```

---

### Task 6: Campaign NewIdeaModal Update

**Files:**
- Modify: `src/app/(app)/innovation/kampanyalar/[id]/page.tsx`

- [ ] **Step 1: Add `IdeaType` to types import**

Line 11–15 currently reads:
```ts
import type {
  InnovationCampaign, InnovationIdea,
  CampaignInvite, CreateIdeaDto, UpdateCampaignDto, CampaignStatus,
  SimilarIdea,
} from "@/lib/innovation/types";
```

Change to:
```ts
import type {
  InnovationCampaign, InnovationIdea,
  CampaignInvite, CreateIdeaDto, UpdateCampaignDto, CampaignStatus,
  SimilarIdea, IdeaType,
} from "@/lib/innovation/types";
```

- [ ] **Step 2: Replace the entire `NewIdeaModal` function (lines 94–234)**

```tsx
function NewIdeaModal({
  campaignId,
  token,
  onClose,
}: {
  campaignId: string;
  token: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Omit<CreateIdeaDto, 'campaign_id'>>({
    title: "",
    problem: "",
    category: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [similarIdeas, setSimilarIdeas] = useState<SimilarIdea[]>([]);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleTitleBlur() {
    const words = form.title.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setCheckingSimilarity(true);
    try {
      const res = await fetch(
        `/api/innovation/ideas/similar?q=${encodeURIComponent(form.title)}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: abortRef.current.signal }
      );
      if (res.ok) {
        const data = await res.json() as SimilarIdea[];
        if (data.length > 0) {
          setSimilarIdeas(data);
          setShowSimilarModal(true);
        }
      }
    } catch {
      // sessizce yutulur (AbortError dahil)
    } finally {
      setCheckingSimilarity(false);
    }
  }

  async function handleSubmit() {
    if (!form.title.trim()) { setError("Başlık zorunludur"); return; }
    abortRef.current?.abort();
    setSaving(true);
    setError("");
    const res = await fetch("/api/innovation/ideas", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, campaign_id: campaignId }),
    });
    setSaving(false);
    if (res.ok) {
      const idea = await res.json() as InnovationIdea;
      router.push(`/innovation/ideas/${idea.id}`);
    } else {
      const err = await res.json().catch(() => ({ error: "Bir hata oluştu" }));
      setError((err as { error: string }).error);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={saving ? undefined : onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Fikir Gönder</h2>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Başlık *</label>
              <div className="relative">
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  onBlur={handleTitleBlur}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 pr-8"
                  placeholder="Fikrin başlığı"
                />
                {checkingSimilarity && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Problem / Fırsat</label>
              <textarea
                value={form.problem}
                onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                placeholder="Çözülmek istenen problem veya fırsatı açıklayın"
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
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Fikir Tipi</label>
              <select
                value={form.idea_type ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, idea_type: e.target.value as IdeaType }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
              >
                <option value="">Seçiniz...</option>
                <option value="quick_win">Quick Win</option>
                <option value="process">Süreç İyileştirme</option>
                <option value="digital">Dijital / BT Projesi</option>
                <option value="ai_data">Yapay Zeka / Veri</option>
                <option value="ot">BT-OT / Akıllı Fabrika</option>
                <option value="strategic">Stratejik İnovasyon</option>
              </select>
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
      {showSimilarModal && (
        <SimilarIdeasModal
          ideas={similarIdeas}
          onClose={() => setShowSimilarModal(false)}
          onConfirm={() => {
            setShowSimilarModal(false);
            handleSubmit();
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Fix the call site — remove `onCreated` prop**

Search the file for `<NewIdeaModal` and remove the `onCreated` prop. The call site should change from:

```tsx
<NewIdeaModal
  campaignId={campaign.id}
  token={token}
  onCreated={(idea) => { /* handler */ }}
  onClose={() => setShowNewIdeaModal(false)}
/>
```

To:

```tsx
<NewIdeaModal
  campaignId={campaign.id}
  token={token}
  onClose={() => setShowNewIdeaModal(false)}
/>
```

- [ ] **Step 4: Verify types compile — must be 0 errors**

```bash
npx tsc --noEmit
```

Expected: 0 errors. All description→problem renames are now complete.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/innovation/kampanyalar/[id]/page.tsx
git commit -m "feat(kampanyalar): NewIdeaModal — problem/idea_type fields, redirect to detail page after submit"
```

---

### Task 7: Idea Detail Page

**Files:**
- Create: `src/app/(app)/innovation/ideas/[id]/page.tsx`

- [ ] **Step 1: Create the page file**

Create `src/app/(app)/innovation/ideas/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  InnovationIdea, UpdateIdeaDto, IdeaType, EstimatedImpact,
  IdeaConfidentiality, InnovationRole, IdeaComment, IdeaEvaluation,
  StageHistoryEntry,
} from "@/lib/innovation/types";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

type Tab = 'details' | 'comments' | 'evaluations' | 'history';
type OrgUser = { id: string; name: string };

const IDEA_TYPE_LABELS: Record<string, string> = {
  '': '—',
  quick_win: 'Quick Win',
  process: 'Süreç İyileştirme',
  digital: 'Dijital / BT Projesi',
  ai_data: 'Yapay Zeka / Veri',
  ot: 'BT-OT / Akıllı Fabrika',
  strategic: 'Stratejik İnovasyon',
};

const IMPACT_LABELS: Record<string, string> = {
  '': '—',
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
};

const CONFIDENTIALITY_LABELS: Record<string, string> = {
  open: 'Açık',
  team: 'Ekip',
  private: 'Gizli',
};

export default function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, session } = useAuthStore();
  const token = session?.access_token ?? '';

  const [idea, setIdea] = useState<InnovationIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('details');

  const [innovationRole, setInnovationRole] = useState<InnovationRole>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [form, setForm] = useState<UpdateIdeaDto>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [commentBody, setCommentBody] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const fetchIdea = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`/api/innovation/ideas/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) { setNotFound(true); setLoading(false); return; }
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json() as InnovationIdea;
    setIdea(data);
    setForm({
      title: data.title,
      problem: data.problem,
      proposed_solution: data.proposed_solution,
      category: data.category,
      affected_area: data.affected_area,
      location_process: data.location_process,
      idea_type: data.idea_type,
      estimated_impact: data.estimated_impact,
      confidentiality: data.confidentiality,
      sponsor_id: data.sponsor_id,
      estimated_value: data.estimated_value,
      currency_code: data.currency_code,
    });
    setLoading(false);
  }, [id, token]);

  useEffect(() => { fetchIdea(); }, [fetchIdea]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('auth_profiles')
      .select('innovation_role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setInnovationRole((data?.innovation_role ?? null) as InnovationRole);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/innovation/users', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: OrgUser[]) => setOrgUsers(data))
      .catch(() => {});
  }, [token]);

  const canEdit = idea
    ? idea.submitter_id === user?.id || innovationRole === 'innovation_admin'
    : false;

  async function handleSave() {
    if (!idea) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    const res = await fetch(`/api/innovation/ideas/${idea.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchIdea();
    } else {
      const d = await res.json().catch(() => ({ error: 'Hata oluştu' }));
      setSaveError(d.error ?? 'Hata oluştu');
    }
  }

  async function handleAddComment() {
    if (!commentBody.trim() || !idea) return;
    setPostingComment(true);
    const res = await fetch(`/api/innovation/ideas/${idea.id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentBody }),
    });
    setPostingComment(false);
    if (res.ok) {
      setCommentBody('');
      fetchIdea();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound || !idea) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">Fikir bulunamadı.</p>
        <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">
          Geri dön
        </button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Detaylar' },
    { key: 'comments', label: `Yorumlar (${(idea.comments ?? []).length})` },
    { key: 'evaluations', label: `Değerlendirmeler (${(idea.evaluations ?? []).length})` },
    { key: 'history', label: 'Geçmiş' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="font-mono text-xs font-bold text-gray-400">{idea.idea_number}</span>
          {idea.stage && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: idea.stage.color + '22', color: idea.stage.color }}
            >
              {idea.stage.name}
            </span>
          )}
          <span className="text-xs text-gray-400 capitalize">{idea.status}</span>
        </div>
        <h1 className="text-lg font-bold text-gray-900">{idea.title}</h1>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {tab === 'details' && (
          <DetailsTab
            idea={idea}
            form={form}
            setForm={setForm}
            canEdit={canEdit}
            orgUsers={orgUsers}
            saving={saving}
            saveError={saveError}
            saveSuccess={saveSuccess}
            onSave={handleSave}
          />
        )}
        {tab === 'comments' && (
          <CommentsTab
            comments={idea.comments ?? []}
            commentBody={commentBody}
            setCommentBody={setCommentBody}
            posting={postingComment}
            onSubmit={handleAddComment}
          />
        )}
        {tab === 'evaluations' && (
          <EvaluationsTab evaluations={idea.evaluations ?? []} />
        )}
        {tab === 'history' && (
          <HistoryTab history={idea.stage_history ?? []} />
        )}
      </div>
    </div>
  );
}

function ReadField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {multiline
        ? <p className="text-sm text-gray-800 whitespace-pre-wrap">{value || '—'}</p>
        : <p className="text-sm text-gray-800">{value || '—'}</p>
      }
    </div>
  );
}

function EditField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

function DetailsTab({
  idea, form, setForm, canEdit, orgUsers, saving, saveError, saveSuccess, onSave,
}: {
  idea: InnovationIdea;
  form: UpdateIdeaDto;
  setForm: React.Dispatch<React.SetStateAction<UpdateIdeaDto>>;
  canEdit: boolean;
  orgUsers: OrgUser[];
  saving: boolean;
  saveError: string;
  saveSuccess: boolean;
  onSave: () => void;
}) {
  if (!canEdit) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReadField label="Problem / Fırsat" value={idea.problem} multiline />
        <ReadField label="Önerilen Çözüm" value={idea.proposed_solution} multiline />
        <ReadField label="Kategori" value={idea.category} />
        <ReadField label="Fikir Tipi" value={IDEA_TYPE_LABELS[idea.idea_type] ?? idea.idea_type} />
        <ReadField label="Etkilenen Alan" value={idea.affected_area} />
        <ReadField label="Lokasyon / Süreç" value={idea.location_process} />
        <ReadField label="Tahmini Etki" value={IMPACT_LABELS[idea.estimated_impact] ?? idea.estimated_impact} />
        <ReadField label="Gizlilik" value={CONFIDENTIALITY_LABELS[idea.confidentiality] ?? idea.confidentiality} />
        <ReadField label="Tahmini Değer" value={idea.estimated_value ? `${idea.estimated_value} ${idea.currency_code}` : '—'} />
        <ReadField label="Sponsor" value={idea.sponsor?.name ?? '—'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <EditField label="Problem / Fırsat">
            <textarea
              value={form.problem ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
            />
          </EditField>
          <EditField label="Kategori">
            <input
              value={form.category ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            />
          </EditField>
          <EditField label="Etkilenen Alan">
            <input
              value={form.affected_area ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, affected_area: e.target.value }))}
              placeholder="Üretim, Kalite, R&D, Supply Chain..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            />
          </EditField>
          <EditField label="Tahmini Etki">
            <select
              value={form.estimated_impact ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, estimated_impact: e.target.value as EstimatedImpact }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="">Seçiniz...</option>
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
            </select>
          </EditField>
          <div className="flex gap-2">
            <EditField label="Tahmini Değer" className="flex-1">
              <input
                type="number"
                value={form.estimated_value ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </EditField>
            <EditField label="Para Birimi" className="w-24">
              <input
                value={form.currency_code ?? 'TRY'}
                onChange={(e) => setForm((f) => ({ ...f, currency_code: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </EditField>
          </div>
        </div>

        <div className="space-y-4">
          <EditField label="Önerilen Çözüm">
            <textarea
              value={form.proposed_solution ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, proposed_solution: e.target.value }))}
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
            />
          </EditField>
          <EditField label="Fikir Tipi">
            <select
              value={form.idea_type ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, idea_type: e.target.value as IdeaType }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="">Seçiniz...</option>
              <option value="quick_win">Quick Win</option>
              <option value="process">Süreç İyileştirme</option>
              <option value="digital">Dijital / BT Projesi</option>
              <option value="ai_data">Yapay Zeka / Veri</option>
              <option value="ot">BT-OT / Akıllı Fabrika</option>
              <option value="strategic">Stratejik İnovasyon</option>
            </select>
          </EditField>
          <EditField label="Lokasyon / Süreç">
            <input
              value={form.location_process ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, location_process: e.target.value }))}
              placeholder="Fabrika, hat, departman, ülke..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            />
          </EditField>
          <EditField label="Gizlilik">
            <select
              value={form.confidentiality ?? 'open'}
              onChange={(e) => setForm((f) => ({ ...f, confidentiality: e.target.value as IdeaConfidentiality }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="open">Açık</option>
              <option value="team">Ekip</option>
              <option value="private">Gizli</option>
            </select>
          </EditField>
          <EditField label="Sponsor">
            <select
              value={form.sponsor_id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, sponsor_id: e.target.value || null }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="">Sponsor Yok</option>
              {orgUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </EditField>
        </div>
      </div>

      {saveError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Kaydet
        </button>
        {saveSuccess && (
          <span className="text-sm text-green-600 font-medium">✓ Kaydedildi</span>
        )}
      </div>
    </div>
  );
}

function CommentsTab({
  comments, commentBody, setCommentBody, posting, onSubmit,
}: {
  comments: IdeaComment[];
  commentBody: string;
  setCommentBody: (v: string) => void;
  posting: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {comments.length === 0 && (
          <p className="text-sm text-gray-400 italic">Henüz yorum yok.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-gray-800">{c.author?.name ?? 'Kullanıcı'}</span>
              <span className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: tr })}
              </span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <MessageCircle className="w-3.5 h-3.5" />
          Yorum Ekle
        </label>
        <textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          rows={3}
          placeholder="Yorumunuzu yazın..."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
        />
        <button
          onClick={onSubmit}
          disabled={posting || !commentBody.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {posting && <Loader2 className="w-4 h-4 animate-spin" />}
          Gönder
        </button>
      </div>
    </div>
  );
}

function EvaluationsTab({ evaluations }: { evaluations: IdeaEvaluation[] }) {
  if (!evaluations.length) {
    return <p className="text-sm text-gray-400 italic">Henüz değerlendirme yok.</p>;
  }
  return (
    <div className="space-y-4">
      {evaluations.map((ev) => (
        <div key={ev.id} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-800">{ev.evaluator?.name ?? 'Değerlendirici'}</span>
            <span className="text-sm font-bold text-blue-600">{ev.total_score} puan</span>
          </div>
          {ev.notes && <p className="text-sm text-gray-600">{ev.notes}</p>}
          <p className="text-xs text-gray-400 mt-2">
            {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: tr })}
          </p>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ history }: { history: StageHistoryEntry[] }) {
  if (!history.length) {
    return <p className="text-sm text-gray-400 italic">Geçmiş kaydı yok.</p>;
  }
  return (
    <div className="space-y-3">
      {history.map((entry) => (
        <div key={entry.id} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm flex-wrap mb-1">
            {entry.from_stage && (
              <>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: entry.from_stage.color + '22', color: entry.from_stage.color }}
                >
                  {entry.from_stage.name}
                </span>
                <span className="text-gray-400">→</span>
              </>
            )}
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: entry.to_stage.color + '22', color: entry.to_stage.color }}
            >
              {entry.to_stage.name}
            </span>
          </div>
          {entry.reason && <p className="text-sm text-gray-600">{entry.reason}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {entry.changer?.name ?? 'Sistem'} ·{' '}
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: tr })}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/innovation/ideas/[id]/page.tsx
git commit -m "feat: add idea detail page /innovation/ideas/[id] with 4-tab layout (details/comments/evaluations/history)"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|-------------|------|
| `description` → `problem` rename | 1, 2, 3, 4 |
| 7 new DB columns | 1 |
| `IdeaType`, `EstimatedImpact`, `IdeaConfidentiality` types | 2 |
| `CreateIdeaDto` updated | 2 |
| `UpdateIdeaDto` expanded | 2 |
| `SimilarIdea.description` → `problem` | 2, 4 |
| `createIdea` repo: problem + idea_type | 3 |
| `findIdeaById`: sponsor join | 3 |
| `updateIdea`: allowed fields filter | 3 |
| Service: description→problem | 4 |
| Similar route: description→problem | 4 |
| SimilarIdeasModal: description→problem | 4 |
| Pipeline modal: 4 fields + idea_type | 5 |
| Pipeline modal: redirect to detail | 5 |
| Campaign modal: 4 fields + idea_type | 6 |
| Campaign modal: redirect to detail | 6 |
| Detail page `/innovation/ideas/[id]` | 7 |
| Detail page: 4 tabs | 7 |
| Detail page: edit for submitter/admin, read-only for others | 7 |
| Detail page: PATCH save | 7 |
| Detail page: sponsor select (silent fail for non-admin) | 7 |
| Detail page: 404 handling | 7 |
| Detail page: save error inline | 7 |

**Placeholder scan:** None found. All steps include complete code.

**Type consistency:**
- `IdeaType`, `EstimatedImpact`, `IdeaConfidentiality` defined in Task 2, imported by name in Tasks 5, 6, 7 ✓
- `UpdateIdeaDto` expanded in Task 2; Task 7 form state matches all fields ✓
- `mapProfile` returns `{ id, name }` — assignable to `{ name: string }` on `InnovationIdea.sponsor` ✓
- `OrgUser` typed locally in detail page; matches what `/api/innovation/users` returns ✓
- `ALLOWED_UPDATE_FIELDS` in Task 3 matches all keys of `UpdateIdeaDto` from Task 2 ✓
