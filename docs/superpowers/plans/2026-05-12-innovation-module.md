# Innovation (Fikir Yönetimi) Modülü — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pixanto PPM'e Stage-Gate fikir yönetimi modülü ekle — Dashboard + Pipeline ekranları, tam relational backend, sidebar entegrasyonu.

**Architecture:** Service-Only (no Zustand). Repository → Service → Route Handler → Page (useState/useEffect). ITSM 3-katman desenini izler.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL), supabaseAdmin (service_role) for writes, Tailwind CSS v4, Lucide React icons, date-fns.

---

## Dosya Yapısı

```
supabase/
  innovation-module.sql            ← Task 1

src/lib/innovation/
  types/index.ts                   ← Task 2
  repositories/
    stagesRepo.ts                  ← Task 3
    ideasRepo.ts                   ← Task 4
    votesRepo.ts                   ← Task 5
    commentsRepo.ts                ← Task 5
    evaluationsRepo.ts             ← Task 5
  services/
    ideasService.ts                ← Task 6
    votingService.ts               ← Task 6
    evaluationService.ts           ← Task 6

src/app/api/innovation/
  stats/route.ts                   ← Task 7
  stages/route.ts                  ← Task 7
  ideas/route.ts                   ← Task 8
  ideas/[id]/route.ts              ← Task 8
  ideas/[id]/vote/route.ts         ← Task 9
  ideas/[id]/comments/route.ts     ← Task 9
  ideas/[id]/evaluate/route.ts     ← Task 9
  ideas/[id]/advance/route.ts      ← Task 9

src/app/(app)/innovation/
  page.tsx                         ← Task 10
  pipeline/page.tsx                ← Task 11

src/components/layout/Sidebar.tsx  ← Task 12 (modify)
```

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/innovation-module.sql`

- [ ] **Step 1: Create the SQL file**

```sql
-- supabase/innovation-module.sql
-- Run this in Supabase SQL Editor

-- ── 1. auth_profiles: innovation_role kolonu ──────────────────────────────────
ALTER TABLE auth_profiles
  ADD COLUMN IF NOT EXISTS innovation_role TEXT
  CHECK (innovation_role IN ('innovation_evaluator', 'innovation_admin'));

-- ── 2. innovation_stages (global, no org_id in Phase 1) ──────────────────────
CREATE TABLE IF NOT EXISTS innovation_stages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index           INT NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  color                 TEXT NOT NULL DEFAULT '#6B7280',
  min_score_to_advance  NUMERIC(5,2) NOT NULL DEFAULT 0,
  required_evaluations  INT NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE innovation_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stages_select_all" ON innovation_stages FOR SELECT TO authenticated USING (true);

-- ── 3. innovation_ideas ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS innovation_ideas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_number       TEXT UNIQUE NOT NULL,
  org_id            TEXT NOT NULL,
  submitter_id      UUID NOT NULL REFERENCES auth_profiles(id) ON DELETE CASCADE,
  stage_id          UUID NOT NULL REFERENCES innovation_stages(id),
  status            TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('draft','submitted','under_review','approved','rejected','implemented','archived')),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT '',
  impact_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
  feasibility_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  composite_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
  vote_count        INT NOT NULL DEFAULT 0,
  comment_count     INT NOT NULL DEFAULT 0,
  estimated_value   NUMERIC,
  currency_code     TEXT NOT NULL DEFAULT 'TRY',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE innovation_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ideas_select" ON innovation_ideas FOR SELECT TO authenticated
  USING (
    (status != 'draft')
    OR (submitter_id = auth.uid())
  );
CREATE POLICY "ideas_insert" ON innovation_ideas FOR INSERT TO authenticated
  WITH CHECK (submitter_id = auth.uid());
CREATE POLICY "ideas_update" ON innovation_ideas FOR UPDATE TO authenticated
  USING (
    submitter_id = auth.uid()
    OR (SELECT innovation_role FROM auth_profiles WHERE id = auth.uid()) = 'innovation_admin'
  );
CREATE POLICY "ideas_delete" ON innovation_ideas FOR DELETE TO authenticated
  USING (
    (submitter_id = auth.uid() AND status = 'draft')
    OR (SELECT innovation_role FROM auth_profiles WHERE id = auth.uid()) = 'innovation_admin'
  );

-- ── 4. innovation_votes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS innovation_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id    UUID NOT NULL REFERENCES innovation_ideas(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth_profiles(id) ON DELETE CASCADE,
  value      SMALLINT NOT NULL CHECK (value IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(idea_id, user_id)
);

ALTER TABLE innovation_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_select" ON innovation_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "votes_insert" ON innovation_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "votes_update" ON innovation_votes FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "votes_delete" ON innovation_votes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── 5. innovation_comments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS innovation_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id    UUID NOT NULL REFERENCES innovation_ideas(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES auth_profiles(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES innovation_comments(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE innovation_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON innovation_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON innovation_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

-- ── 6. innovation_evaluation_criteria (global) ────────────────────────────────
CREATE TABLE IF NOT EXISTS innovation_evaluation_criteria (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  weight      NUMERIC(4,2) NOT NULL CHECK (weight > 0 AND weight <= 1),
  max_score   INT NOT NULL DEFAULT 10,
  order_index INT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE innovation_evaluation_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "criteria_select" ON innovation_evaluation_criteria FOR SELECT TO authenticated USING (true);

-- ── 7. innovation_evaluations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS innovation_evaluations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id      UUID NOT NULL REFERENCES innovation_ideas(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES auth_profiles(id) ON DELETE CASCADE,
  stage_id     UUID NOT NULL REFERENCES innovation_stages(id),
  notes        TEXT NOT NULL DEFAULT '',
  total_score  NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE innovation_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evals_select" ON innovation_evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "evals_insert" ON innovation_evaluations FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid()
    AND (SELECT innovation_role FROM auth_profiles WHERE id = auth.uid()) IN ('innovation_evaluator','innovation_admin')
  );

-- ── 8. innovation_evaluation_scores ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS innovation_evaluation_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id  UUID NOT NULL REFERENCES innovation_evaluations(id) ON DELETE CASCADE,
  criterion_id   UUID NOT NULL REFERENCES innovation_evaluation_criteria(id),
  score          INT NOT NULL,
  comment        TEXT
);

ALTER TABLE innovation_evaluation_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores_select" ON innovation_evaluation_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "scores_insert" ON innovation_evaluation_scores FOR INSERT TO authenticated WITH CHECK (true);

-- ── 9. innovation_tags ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS innovation_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6B7280',
  org_id     TEXT NOT NULL,
  created_by UUID REFERENCES auth_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE innovation_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_select" ON innovation_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_insert" ON innovation_tags FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- ── 10. innovation_idea_tags ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS innovation_idea_tags (
  idea_id UUID NOT NULL REFERENCES innovation_ideas(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES innovation_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, tag_id)
);

ALTER TABLE innovation_idea_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "idea_tags_select" ON innovation_idea_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "idea_tags_insert" ON innovation_idea_tags FOR INSERT TO authenticated WITH CHECK (true);

-- ── 11. innovation_stage_history ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS innovation_stage_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id       UUID NOT NULL REFERENCES innovation_ideas(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES innovation_stages(id),
  to_stage_id   UUID NOT NULL REFERENCES innovation_stages(id),
  changed_by    UUID NOT NULL REFERENCES auth_profiles(id),
  reason        TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE innovation_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history_select" ON innovation_stage_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "history_insert" ON innovation_stage_history FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid());

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_innovation_ideas_org_id ON innovation_ideas(org_id);
CREATE INDEX IF NOT EXISTS idx_innovation_ideas_stage_id ON innovation_ideas(stage_id);
CREATE INDEX IF NOT EXISTS idx_innovation_ideas_status ON innovation_ideas(status);
CREATE INDEX IF NOT EXISTS idx_innovation_ideas_created_at ON innovation_ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_innovation_votes_idea_id ON innovation_votes(idea_id);
CREATE INDEX IF NOT EXISTS idx_innovation_comments_idea_id ON innovation_comments(idea_id);
CREATE INDEX IF NOT EXISTS idx_innovation_evaluations_idea_id ON innovation_evaluations(idea_id);
CREATE INDEX IF NOT EXISTS idx_innovation_stage_history_idea_id ON innovation_stage_history(idea_id);

-- ── Seed: stages ──────────────────────────────────────────────────────────────
INSERT INTO innovation_stages (id, order_index, name, description, color, min_score_to_advance, required_evaluations) VALUES
  ('11111111-0001-0000-0000-000000000000', 1, 'Fikir',              'Ham fikir gönderimi',                       '#6B7280', 0,  0),
  ('11111111-0002-0000-0000-000000000000', 2, 'Ön Değerlendirme',   'İlk eleme ve puanlama',                     '#3B82F6', 40, 2),
  ('11111111-0003-0000-0000-000000000000', 3, 'Detaylı Analiz',     'Fizibilite ve etki analizi',                '#8B5CF6', 60, 3),
  ('11111111-0004-0000-0000-000000000000', 4, 'Pilot',              'Küçük ölçekli test ve doğrulama',           '#D97706', 70, 2),
  ('11111111-0005-0000-0000-000000000000', 5, 'Uygulama',           'Tam ölçekli hayata geçirme',                '#059669', 0,  0)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: evaluation criteria ─────────────────────────────────────────────────
INSERT INTO innovation_evaluation_criteria (id, name, description, weight, max_score, order_index) VALUES
  ('22222222-0001-0000-0000-000000000000', 'Etki',            'İş süreçlerine veya müşterilere etkisi',  0.40, 10, 1),
  ('22222222-0002-0000-0000-000000000000', 'Fizibilite',      'Teknik ve kaynak uygulanabilirliği',       0.30, 10, 2),
  ('22222222-0003-0000-0000-000000000000', 'Özgünlük',        'Yenilikçilik ve farklılaşma derecesi',     0.20, 10, 3),
  ('22222222-0004-0000-0000-000000000000', 'Uygulama Hızı',   'Ne kadar hızlı hayata geçirilebilir',     0.10, 10, 4)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Run the SQL in Supabase**

Supabase Dashboard → SQL Editor → `supabase/innovation-module.sql` içeriğini yapıştır → Run.

Beklenen: Tüm tablolar oluşturuldu, seed data eklendi, hata yok.

- [ ] **Step 3: Commit**

```bash
git add supabase/innovation-module.sql
git commit -m "feat(innovation): add database migration — 10 tables + RLS + seed"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/lib/innovation/types/index.ts`

- [ ] **Step 1: Create types file**

```typescript
// src/lib/innovation/types/index.ts

export type IdeaStatus =
  | 'draft' | 'submitted' | 'under_review' | 'approved'
  | 'rejected' | 'implemented' | 'archived';

export type InnovationRole = 'innovation_evaluator' | 'innovation_admin' | null;

export interface InnovationStage {
  id: string;
  order_index: number;
  name: string;
  description: string;
  color: string;
  min_score_to_advance: number;
  required_evaluations: number;
  is_active: boolean;
}

export interface IdeaAuthor {
  id: string;
  name: string;
  avatar?: string;
}

export interface IdeaTag {
  id: string;
  name: string;
  color: string;
}

export interface EvaluationCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  max_score: number;
  order_index: number;
  is_active: boolean;
}

export interface EvaluationScore {
  id: string;
  evaluation_id: string;
  criterion_id: string;
  criterion?: EvaluationCriterion;
  score: number;
  comment?: string;
}

export interface IdeaEvaluation {
  id: string;
  idea_id: string;
  evaluator_id: string;
  evaluator?: IdeaAuthor;
  stage_id: string;
  notes: string;
  total_score: number;
  created_at: string;
  scores?: EvaluationScore[];
}

export interface IdeaComment {
  id: string;
  idea_id: string;
  author_id: string;
  author?: IdeaAuthor;
  parent_id: string | null;
  body: string;
  created_at: string;
  replies?: IdeaComment[];
}

export interface StageHistoryEntry {
  id: string;
  idea_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  from_stage?: Pick<InnovationStage, 'id' | 'name' | 'color'>;
  to_stage?: Pick<InnovationStage, 'id' | 'name' | 'color'>;
  changed_by: string;
  changer?: IdeaAuthor;
  reason: string;
  created_at: string;
}

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
  description: string;
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

export interface InnovationStats {
  total_ideas: number;
  this_month: number;
  under_review: number;
  implemented: number;
  user_role: InnovationRole;
  by_stage: Array<{
    stage_id: string;
    stage_name: string;
    stage_color: string;
    count: number;
  }>;
  top_ideas: Array<{
    id: string;
    idea_number: string;
    title: string;
    vote_count: number;
    composite_score: number;
    stage_name: string;
    stage_color: string;
  }>;
  recent_activity: Array<{
    type: 'new_idea' | 'stage_change' | 'evaluation';
    idea_id: string;
    idea_number: string;
    idea_title: string;
    actor_name: string;
    detail?: string;
    created_at: string;
  }>;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateIdeaDto {
  title: string;
  description: string;
  category: string;
  estimated_value?: number;
  currency_code?: string;
  tag_ids?: string[];
}

export interface UpdateIdeaDto {
  title?: string;
  description?: string;
  category?: string;
  estimated_value?: number;
  currency_code?: string;
  status?: IdeaStatus;
}

export interface CreateCommentDto {
  body: string;
  parent_id?: string | null;
}

export interface CreateEvaluationDto {
  notes: string;
  scores: Array<{ criterion_id: string; score: number; comment?: string }>;
}

export interface AdvanceStageDto {
  reason: string;
}

export interface IdeasListParams {
  org_id: string;
  stage_id?: string;
  status?: string;
  search?: string;
  sort?: 'date' | 'score' | 'votes';
  page?: number;
  limit?: number;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Beklenen: Hata yok (sadece innovation types, bağımlılık yok).

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/types/index.ts
git commit -m "feat(innovation): add TypeScript types"
```

---

## Task 3: Repositories — Stages & Evaluations Criteria

**Files:**
- Create: `src/lib/innovation/repositories/stagesRepo.ts`
- Create: `src/lib/innovation/repositories/evaluationsRepo.ts` (criteria kısmı)

- [ ] **Step 1: Create stagesRepo.ts**

```typescript
// src/lib/innovation/repositories/stagesRepo.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationStage } from '../types';

export async function findAllStages(): Promise<InnovationStage[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_stages')
    .select('*')
    .eq('is_active', true)
    .order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []) as InnovationStage[];
}

export async function findStageById(id: string): Promise<InnovationStage | null> {
  const { data, error } = await supabaseAdmin
    .from('innovation_stages')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as InnovationStage;
}
```

- [ ] **Step 2: Create evaluationsRepo.ts (criteria + evaluations)**

```typescript
// src/lib/innovation/repositories/evaluationsRepo.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { EvaluationCriterion, IdeaEvaluation, CreateEvaluationDto } from '../types';

export async function findActiveCriteria(): Promise<EvaluationCriterion[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_evaluation_criteria')
    .select('*')
    .eq('is_active', true)
    .order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []) as EvaluationCriterion[];
}

export async function findEvaluationsByIdea(ideaId: string): Promise<IdeaEvaluation[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_evaluations')
    .select(`
      *,
      evaluator:auth_profiles!innovation_evaluations_evaluator_id_fkey(id, data),
      innovation_evaluation_scores(
        *,
        criterion:innovation_evaluation_criteria(*)
      )
    `)
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    evaluator: row.evaluator
      ? { id: (row.evaluator as Record<string,unknown>).id, name: ((row.evaluator as Record<string,unknown>).data as Record<string,unknown>)?.name ?? 'Bilinmiyor' }
      : undefined,
    scores: (row.innovation_evaluation_scores as unknown[]) ?? [],
  })) as IdeaEvaluation[];
}

export async function countEvaluationsForIdea(ideaId: string, stageId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('innovation_evaluations')
    .select('id', { count: 'exact', head: true })
    .eq('idea_id', ideaId)
    .eq('stage_id', stageId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function createEvaluation(params: {
  ideaId: string;
  evaluatorId: string;
  stageId: string;
  dto: CreateEvaluationDto;
  totalScore: number;
}): Promise<string> {
  const evalId = crypto.randomUUID();
  const { error: evalError } = await supabaseAdmin
    .from('innovation_evaluations')
    .insert({
      id: evalId,
      idea_id: params.ideaId,
      evaluator_id: params.evaluatorId,
      stage_id: params.stageId,
      notes: params.dto.notes,
      total_score: params.totalScore,
      created_at: new Date().toISOString(),
    });
  if (evalError) throw new Error(evalError.message);

  const scoreRows = params.dto.scores.map((s) => ({
    id: crypto.randomUUID(),
    evaluation_id: evalId,
    criterion_id: s.criterion_id,
    score: s.score,
    comment: s.comment ?? null,
  }));

  const { error: scoresError } = await supabaseAdmin
    .from('innovation_evaluation_scores')
    .insert(scoreRows);
  if (scoresError) throw new Error(scoresError.message);

  return evalId;
}

export async function getAvgCompositeScore(ideaId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('innovation_evaluations')
    .select('total_score')
    .eq('idea_id', ideaId);
  if (error || !data?.length) return 0;
  const avg = data.reduce((sum, r) => sum + Number(r.total_score), 0) / data.length;
  return Math.round(avg * 100) / 100;
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/innovation/repositories/stagesRepo.ts src/lib/innovation/repositories/evaluationsRepo.ts
git commit -m "feat(innovation): add stagesRepo and evaluationsRepo"
```

---

## Task 4: Repository — Ideas

**Files:**
- Create: `src/lib/innovation/repositories/ideasRepo.ts`

- [ ] **Step 1: Create ideasRepo.ts**

```typescript
// src/lib/innovation/repositories/ideasRepo.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationIdea, IdeasListParams, UpdateIdeaDto } from '../types';

export async function findIdeas(params: IdeasListParams): Promise<{ ideas: InnovationIdea[]; total: number }> {
  const { org_id, stage_id, status, search, sort = 'date', page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('innovation_ideas')
    .select(
      `*, 
       submitter:auth_profiles!innovation_ideas_submitter_id_fkey(id, data),
       stage:innovation_stages!innovation_ideas_stage_id_fkey(id, name, color, order_index, min_score_to_advance, required_evaluations)`,
      { count: 'exact' }
    )
    .eq('org_id', org_id)
    .neq('status', 'draft');

  if (stage_id) query = query.eq('stage_id', stage_id);
  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('title', `%${search}%`);

  if (sort === 'score') query = query.order('composite_score', { ascending: false });
  else if (sort === 'votes') query = query.order('vote_count', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const ideas = (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    submitter: row.submitter
      ? {
          id: (row.submitter as Record<string, unknown>).id,
          name: ((row.submitter as Record<string, unknown>).data as Record<string, unknown>)?.name ?? 'Bilinmiyor',
        }
      : undefined,
  })) as InnovationIdea[];

  return { ideas, total: count ?? 0 };
}

export async function findIdeaById(id: string): Promise<InnovationIdea | null> {
  const { data, error } = await supabaseAdmin
    .from('innovation_ideas')
    .select(`
      *,
      submitter:auth_profiles!innovation_ideas_submitter_id_fkey(id, data),
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

  if (error) return null;

  const mapProfile = (p: Record<string, unknown> | null) =>
    p ? { id: p.id, name: (p.data as Record<string, unknown>)?.name ?? 'Bilinmiyor' } : undefined;

  return {
    ...data,
    submitter: mapProfile(data.submitter as Record<string, unknown>),
    comments: ((data.innovation_comments ?? []) as Record<string, unknown>[]).map((c) => ({
      ...c,
      author: mapProfile(c.author as Record<string, unknown>),
    })),
    evaluations: ((data.innovation_evaluations ?? []) as Record<string, unknown>[]).map((e) => ({
      ...e,
      evaluator: mapProfile(e.evaluator as Record<string, unknown>),
      scores: (e.innovation_evaluation_scores ?? []) as unknown[],
    })),
    stage_history: ((data.innovation_stage_history ?? []) as Record<string, unknown>[]).map((h) => ({
      ...h,
      changer: mapProfile(h.changer as Record<string, unknown>),
    })),
  } as unknown as InnovationIdea;
}

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
      description: params.description,
      category: params.category,
      estimated_value: params.estimatedValue ?? null,
      currency_code: params.currencyCode,
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

export async function updateIdea(id: string, dto: UpdateIdeaDto): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_ideas')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteIdea(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('innovation_ideas').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateIdeaStage(id: string, stageId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_ideas')
    .update({ stage_id: stageId, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateCompositeScore(id: string, score: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_ideas')
    .update({ composite_score: score, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function addStageHistoryEntry(params: {
  ideaId: string;
  fromStageId: string | null;
  toStageId: string;
  changedBy: string;
  reason: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('innovation_stage_history').insert({
    id: crypto.randomUUID(),
    idea_id: params.ideaId,
    from_stage_id: params.fromStageId,
    to_stage_id: params.toStageId,
    changed_by: params.changedBy,
    reason: params.reason,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/innovation/repositories/ideasRepo.ts
git commit -m "feat(innovation): add ideasRepo"
```

---

## Task 5: Repositories — Votes & Comments

**Files:**
- Create: `src/lib/innovation/repositories/votesRepo.ts`
- Create: `src/lib/innovation/repositories/commentsRepo.ts`

- [ ] **Step 1: Create votesRepo.ts**

```typescript
// src/lib/innovation/repositories/votesRepo.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function findUserVote(ideaId: string, userId: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from('innovation_votes')
    .select('value')
    .eq('idea_id', ideaId)
    .eq('user_id', userId)
    .single();
  return data ? (data.value as number) : null;
}

export async function upsertVote(ideaId: string, userId: string, value: 1 | -1): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_votes')
    .upsert({ id: crypto.randomUUID(), idea_id: ideaId, user_id: userId, value, created_at: new Date().toISOString() }, { onConflict: 'idea_id,user_id' });
  if (error) throw new Error(error.message);
}

export async function deleteVote(ideaId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_votes')
    .delete()
    .eq('idea_id', ideaId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function getNetVoteCount(ideaId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('innovation_votes')
    .select('value')
    .eq('idea_id', ideaId);
  if (error || !data) return 0;
  return data.reduce((sum, r) => sum + (r.value as number), 0);
}

export async function syncVoteCount(ideaId: string): Promise<void> {
  const net = await getNetVoteCount(ideaId);
  const { error } = await supabaseAdmin
    .from('innovation_ideas')
    .update({ vote_count: net, updated_at: new Date().toISOString() })
    .eq('id', ideaId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Create commentsRepo.ts**

```typescript
// src/lib/innovation/repositories/commentsRepo.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { IdeaComment, CreateCommentDto } from '../types';

export async function findCommentsByIdea(ideaId: string): Promise<IdeaComment[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_comments')
    .select('*, author:auth_profiles!innovation_comments_author_id_fkey(id, data)')
    .eq('idea_id', ideaId)
    .order('created_at');
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    ...c,
    author: c.author
      ? {
          id: (c.author as Record<string, unknown>).id,
          name: ((c.author as Record<string, unknown>).data as Record<string, unknown>)?.name ?? 'Bilinmiyor',
        }
      : undefined,
  })) as IdeaComment[];
}

export async function createComment(params: {
  ideaId: string;
  authorId: string;
  dto: CreateCommentDto;
}): Promise<IdeaComment> {
  const { data, error } = await supabaseAdmin
    .from('innovation_comments')
    .insert({
      id: crypto.randomUUID(),
      idea_id: params.ideaId,
      author_id: params.authorId,
      parent_id: params.dto.parent_id ?? null,
      body: params.dto.body,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.rpc('_increment_comment_count', { p_idea_id: params.ideaId }).catch(() => {
    // RPC olmayabilir; fallback: manual increment
    supabaseAdmin
      .from('innovation_ideas')
      .update({ comment_count: supabaseAdmin.rpc('_noop') })
      .eq('id', params.ideaId);
  });

  // Fallback: comment_count'u doğrudan güncelle
  const { count } = await supabaseAdmin
    .from('innovation_comments')
    .select('id', { count: 'exact', head: true })
    .eq('idea_id', params.ideaId);
  await supabaseAdmin
    .from('innovation_ideas')
    .update({ comment_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq('id', params.ideaId);

  return data as unknown as IdeaComment;
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/innovation/repositories/votesRepo.ts src/lib/innovation/repositories/commentsRepo.ts
git commit -m "feat(innovation): add votesRepo and commentsRepo"
```

---

## Task 6: Services

**Files:**
- Create: `src/lib/innovation/services/ideasService.ts`
- Create: `src/lib/innovation/services/votingService.ts`
- Create: `src/lib/innovation/services/evaluationService.ts`

- [ ] **Step 1: Create ideasService.ts**

```typescript
// src/lib/innovation/services/ideasService.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import * as ideasRepo from '../repositories/ideasRepo';
import * as stagesRepo from '../repositories/stagesRepo';
import type { InnovationIdea, CreateIdeaDto, UpdateIdeaDto, AdvanceStageDto, InnovationRole } from '../types';

async function generateIdeaNumber(orgId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('next_ticket_number', {
    p_prefix: 'INN',
    p_org_id: orgId,
  });
  if (error) throw new Error(`Fikir numarası oluşturulamadı: ${error.message}`);
  return data as string;
}

async function getFirstStageId(): Promise<string> {
  const stages = await stagesRepo.findAllStages();
  const first = stages.find((s) => s.order_index === 1) ?? stages[0];
  if (!first) throw new Error('Hiç aktif stage bulunamadı. Seed verilerini kontrol edin.');
  return first.id;
}

export async function createIdea(params: {
  orgId: string;
  submitterId: string;
  dto: CreateIdeaDto;
}): Promise<InnovationIdea> {
  const [ideaNumber, stageId] = await Promise.all([
    generateIdeaNumber(params.orgId),
    getFirstStageId(),
  ]);

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
  });

  await ideasRepo.addStageHistoryEntry({
    ideaId: idea.id,
    fromStageId: null,
    toStageId: stageId,
    changedBy: params.submitterId,
    reason: 'Fikir gönderildi',
  });

  return idea;
}

export async function advanceStage(params: {
  ideaId: string;
  userId: string;
  dto: AdvanceStageDto;
}): Promise<void> {
  const idea = await ideasRepo.findIdeaById(params.ideaId);
  if (!idea) throw new Error('Fikir bulunamadı');

  const stages = await stagesRepo.findAllStages();
  const currentStage = stages.find((s) => s.id === idea.stage_id);
  if (!currentStage) throw new Error('Mevcut stage bulunamadı');

  const nextStage = stages.find((s) => s.order_index === currentStage.order_index + 1);
  if (!nextStage) throw new Error('Bu en son stage, ileriye geçiş yok');

  if (
    currentStage.min_score_to_advance > 0 &&
    idea.composite_score < currentStage.min_score_to_advance
  ) {
    throw new Error(
      `Bu stage'den geçmek için minimum ${currentStage.min_score_to_advance} puan gerekiyor (mevcut: ${idea.composite_score})`
    );
  }

  await ideasRepo.updateIdeaStage(params.ideaId, nextStage.id);
  await ideasRepo.addStageHistoryEntry({
    ideaId: params.ideaId,
    fromStageId: currentStage.id,
    toStageId: nextStage.id,
    changedBy: params.userId,
    reason: params.dto.reason,
  });
}

export async function canEdit(idea: InnovationIdea, userId: string, role: InnovationRole): Promise<boolean> {
  return idea.submitter_id === userId || role === 'innovation_admin';
}

export async function canDelete(idea: InnovationIdea, userId: string, role: InnovationRole): Promise<boolean> {
  return (idea.submitter_id === userId && idea.status === 'draft') || role === 'innovation_admin';
}

export { ideasRepo };
export { updateIdea, deleteIdea } from '../repositories/ideasRepo';
export { findIdeas, findIdeaById } from '../repositories/ideasRepo';
```

- [ ] **Step 2: Create votingService.ts**

```typescript
// src/lib/innovation/services/votingService.ts
import * as votesRepo from '../repositories/votesRepo';

export async function vote(params: {
  ideaId: string;
  userId: string;
  value: 1 | -1;
}): Promise<{ action: 'added' | 'removed' | 'changed'; newCount: number }> {
  const existing = await votesRepo.findUserVote(params.ideaId, params.userId);

  let action: 'added' | 'removed' | 'changed';
  if (existing === params.value) {
    // Same vote → toggle off
    await votesRepo.deleteVote(params.ideaId, params.userId);
    action = 'removed';
  } else if (existing !== null) {
    // Different vote → update
    await votesRepo.upsertVote(params.ideaId, params.userId, params.value);
    action = 'changed';
  } else {
    // New vote
    await votesRepo.upsertVote(params.ideaId, params.userId, params.value);
    action = 'added';
  }

  await votesRepo.syncVoteCount(params.ideaId);
  const newCount = await votesRepo.getNetVoteCount(params.ideaId);
  return { action, newCount };
}
```

- [ ] **Step 3: Create evaluationService.ts**

```typescript
// src/lib/innovation/services/evaluationService.ts
import * as evaluationsRepo from '../repositories/evaluationsRepo';
import * as ideasRepo from '../repositories/ideasRepo';
import type { CreateEvaluationDto, InnovationRole } from '../types';

export async function saveEvaluation(params: {
  ideaId: string;
  evaluatorId: string;
  stageId: string;
  role: InnovationRole;
  dto: CreateEvaluationDto;
}): Promise<{ evaluationId: string; totalScore: number; compositeScore: number }> {
  if (params.role !== 'innovation_evaluator' && params.role !== 'innovation_admin') {
    throw new Error('Değerlendirme yapmak için innovation_evaluator veya innovation_admin rolü gereklidir');
  }

  const criteria = await evaluationsRepo.findActiveCriteria();

  // Σ (score / max_score) × weight × 100
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

  // composite_score = ortalama tüm evaluations
  const compositeScore = await evaluationsRepo.getAvgCompositeScore(params.ideaId);
  await ideasRepo.updateCompositeScore(params.ideaId, compositeScore);

  return { evaluationId, totalScore, compositeScore };
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/innovation/services/
git commit -m "feat(innovation): add ideasService, votingService, evaluationService"
```

---

## Task 7: Route Handlers — Stats & Stages

**Files:**
- Create: `src/app/api/innovation/stats/route.ts`
- Create: `src/app/api/innovation/stages/route.ts`

- [ ] **Step 1: Create stats/route.ts**

```typescript
// src/app/api/innovation/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationStats } from '@/lib/innovation/types';

async function getAuthContext(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id, innovation_role')
    .eq('id', user.id)
    .single();
  if (!profile) return null;
  return { userId: user.id, orgId: profile.org_id as string, innovationRole: (profile.innovation_role ?? null) as string | null };
}

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [totalRes, monthRes, underReviewRes, implementedRes, stageCountsRes, stagesRes, topIdeasRes, recentHistoryRes, recentIdeasRes] =
    await Promise.all([
      supabaseAdmin.from('innovation_ideas').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).neq('status', 'draft'),
      supabaseAdmin.from('innovation_ideas').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).gte('created_at', monthStart),
      supabaseAdmin.from('innovation_ideas').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).eq('status', 'under_review'),
      supabaseAdmin.from('innovation_ideas').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).eq('status', 'implemented'),
      supabaseAdmin.from('innovation_ideas').select('stage_id').eq('org_id', ctx.orgId).neq('status', 'draft'),
      supabaseAdmin.from('innovation_stages').select('id, name, color').eq('is_active', true).order('order_index'),
      supabaseAdmin.from('innovation_ideas').select('id, idea_number, title, vote_count, composite_score, stage_id, innovation_stages(name, color)').eq('org_id', ctx.orgId).neq('status', 'draft').order('vote_count', { ascending: false }).limit(5),
      supabaseAdmin.from('innovation_stage_history').select('idea_id, reason, created_at, changer:auth_profiles!innovation_stage_history_changed_by_fkey(data), to_stage:innovation_stages!innovation_stage_history_to_stage_id_fkey(name), idea:innovation_ideas!innovation_stage_history_idea_id_fkey(idea_number, title, org_id)').order('created_at', { ascending: false }).limit(8),
      supabaseAdmin.from('innovation_ideas').select('id, idea_number, title, created_at, submitter:auth_profiles!innovation_ideas_submitter_id_fkey(data)').eq('org_id', ctx.orgId).neq('status', 'draft').order('created_at', { ascending: false }).limit(5),
    ]);

  // Stage count aggregation
  const stageCounts: Record<string, number> = {};
  for (const row of stageCountsRes.data ?? []) {
    stageCounts[row.stage_id] = (stageCounts[row.stage_id] ?? 0) + 1;
  }
  const byStage = (stagesRes.data ?? []).map((s: Record<string, unknown>) => ({
    stage_id: s.id as string,
    stage_name: s.name as string,
    stage_color: s.color as string,
    count: stageCounts[s.id as string] ?? 0,
  }));

  // Top ideas
  const topIdeas = (topIdeasRes.data ?? []).map((r: Record<string, unknown>) => {
    const stg = r.innovation_stages as Record<string, unknown> | null;
    return {
      id: r.id as string,
      idea_number: r.idea_number as string,
      title: r.title as string,
      vote_count: r.vote_count as number,
      composite_score: r.composite_score as number,
      stage_name: stg?.name as string ?? '',
      stage_color: stg?.color as string ?? '#6B7280',
    };
  });

  // Recent activity — stage changes
  const recentHistory = (recentHistoryRes.data ?? [])
    .filter((h: Record<string, unknown>) => {
      const idea = h.idea as Record<string, unknown> | null;
      return idea?.org_id === ctx.orgId;
    })
    .map((h: Record<string, unknown>) => ({
      type: 'stage_change' as const,
      idea_id: h.idea_id as string,
      idea_number: ((h.idea as Record<string, unknown>)?.idea_number ?? '') as string,
      idea_title: ((h.idea as Record<string, unknown>)?.title ?? '') as string,
      actor_name: (((h.changer as Record<string, unknown>)?.data as Record<string, unknown>)?.name ?? 'Bilinmiyor') as string,
      detail: ((h.to_stage as Record<string, unknown>)?.name ?? '') as string,
      created_at: h.created_at as string,
    }));

  // Recent activity — new ideas
  const recentIdeas = (recentIdeasRes.data ?? []).map((r: Record<string, unknown>) => ({
    type: 'new_idea' as const,
    idea_id: r.id as string,
    idea_number: r.idea_number as string,
    idea_title: r.title as string,
    actor_name: (((r.submitter as Record<string, unknown>)?.data as Record<string, unknown>)?.name ?? 'Bilinmiyor') as string,
    detail: undefined,
    created_at: r.created_at as string,
  }));

  const recentActivity = [...recentHistory, ...recentIdeas]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  const stats: InnovationStats = {
    total_ideas: totalRes.count ?? 0,
    this_month: monthRes.count ?? 0,
    under_review: underReviewRes.count ?? 0,
    implemented: implementedRes.count ?? 0,
    user_role: ctx.innovationRole as InnovationStats['user_role'],
    by_stage: byStage,
    top_ideas: topIdeas,
    recent_activity: recentActivity,
  };

  return NextResponse.json(stats);
}
```

- [ ] **Step 2: Create stages/route.ts**

```typescript
// src/app/api/innovation/stages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error: dbError } = await supabaseAdmin
    .from('innovation_stages')
    .select('*')
    .eq('is_active', true)
    .order('order_index');

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/innovation/
git commit -m "feat(innovation): add stats and stages route handlers"
```

---

## Task 8: Route Handlers — Ideas CRUD

**Files:**
- Create: `src/app/api/innovation/ideas/route.ts`
- Create: `src/app/api/innovation/ideas/[id]/route.ts`

- [ ] **Step 1: Create ideas/route.ts**

```typescript
// src/app/api/innovation/ideas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createIdea, findIdeas } from '@/lib/innovation/services/ideasService';
import type { CreateIdeaDto } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin.from('auth_profiles').select('org_id, innovation_role').eq('id', user.id).single();
  if (!p) return null;
  return { userId: user.id, orgId: p.org_id as string, innovationRole: (p.innovation_role ?? null) as string | null };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const result = await findIdeas({
    org_id: ctx.orgId,
    stage_id: searchParams.get('stage') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    sort: (searchParams.get('sort') as 'date' | 'score' | 'votes') ?? 'date',
    page: parseInt(searchParams.get('page') ?? '1'),
    limit: parseInt(searchParams.get('limit') ?? '20'),
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dto = await req.json() as CreateIdeaDto;
  if (!dto.title?.trim()) return NextResponse.json({ error: 'Başlık zorunludur' }, { status: 400 });

  const idea = await createIdea({ orgId: ctx.orgId, submitterId: ctx.userId, dto });
  return NextResponse.json(idea, { status: 201 });
}
```

- [ ] **Step 2: Create ideas/[id]/route.ts**

```typescript
// src/app/api/innovation/ideas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findIdeaById, updateIdea, deleteIdea, canEdit, canDelete } from '@/lib/innovation/services/ideasService';
import type { UpdateIdeaDto, InnovationRole } from '@/lib/innovation/types';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin.from('auth_profiles').select('org_id, innovation_role').eq('id', user.id).single();
  if (!p) return null;
  return { userId: user.id, orgId: p.org_id as string, innovationRole: (p.innovation_role ?? null) as InnovationRole };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = _req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const idea = await findIdeaById(id);
  if (!idea) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

  const currentVote = await supabaseAdmin
    .from('innovation_votes')
    .select('value')
    .eq('idea_id', id)
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({ ...idea, user_vote: currentVote.data?.value ?? null });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const idea = await findIdeaById(id);
  if (!idea) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  if (!(await canEdit(idea, ctx.userId, ctx.innovationRole)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dto = await req.json() as UpdateIdeaDto;
  await updateIdea(id, dto);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const idea = await findIdeaById(id);
  if (!idea) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  if (!(await canDelete(idea, ctx.userId, ctx.innovationRole)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await deleteIdea(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/innovation/ideas/
git commit -m "feat(innovation): add ideas list/create/CRUD route handlers"
```

---

## Task 9: Route Handlers — Actions (vote, comments, evaluate, advance)

**Files:**
- Create: `src/app/api/innovation/ideas/[id]/vote/route.ts`
- Create: `src/app/api/innovation/ideas/[id]/comments/route.ts`
- Create: `src/app/api/innovation/ideas/[id]/evaluate/route.ts`
- Create: `src/app/api/innovation/ideas/[id]/advance/route.ts`

- [ ] **Step 1: Create vote/route.ts**

```typescript
// src/app/api/innovation/ideas/[id]/vote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { vote } from '@/lib/innovation/services/votingService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { value } = await req.json() as { value: 1 | -1 };
  if (value !== 1 && value !== -1) return NextResponse.json({ error: 'value 1 veya -1 olmalı' }, { status: 400 });

  const result = await vote({ ideaId: id, userId: user.id, value });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Create comments/route.ts**

```typescript
// src/app/api/innovation/ideas/[id]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findCommentsByIdea, createComment } from '@/lib/innovation/repositories/commentsRepo';
import type { CreateCommentDto } from '@/lib/innovation/types';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const comments = await findCommentsByIdea(id);
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dto = await req.json() as CreateCommentDto;
  if (!dto.body?.trim()) return NextResponse.json({ error: 'Yorum boş olamaz' }, { status: 400 });

  const comment = await createComment({ ideaId: id, authorId: user.id, dto });
  return NextResponse.json(comment, { status: 201 });
}
```

- [ ] **Step 3: Create evaluate/route.ts**

```typescript
// src/app/api/innovation/ideas/[id]/evaluate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { saveEvaluation } from '@/lib/innovation/services/evaluationService';
import type { CreateEvaluationDto, InnovationRole } from '@/lib/innovation/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('auth_profiles').select('innovation_role').eq('id', user.id).single();
  const role = (profile?.innovation_role ?? null) as InnovationRole;

  const { data: idea } = await supabaseAdmin
    .from('innovation_ideas').select('stage_id').eq('id', id).single();
  if (!idea) return NextResponse.json({ error: 'Fikir bulunamadı' }, { status: 404 });

  const dto = await req.json() as CreateEvaluationDto;
  if (!dto.scores?.length) return NextResponse.json({ error: 'Puan listesi boş olamaz' }, { status: 400 });

  const result = await saveEvaluation({
    ideaId: id,
    evaluatorId: user.id,
    stageId: idea.stage_id,
    role,
    dto,
  });
  return NextResponse.json(result, { status: 201 });
}
```

- [ ] **Step 4: Create advance/route.ts**

```typescript
// src/app/api/innovation/ideas/[id]/advance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { advanceStage } from '@/lib/innovation/services/ideasService';
import type { AdvanceStageDto, InnovationRole } from '@/lib/innovation/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('auth_profiles').select('innovation_role').eq('id', user.id).single();
  const role = (profile?.innovation_role ?? null) as InnovationRole;
  if (role !== 'innovation_admin') return NextResponse.json({ error: 'Sadece innovation_admin stage ilerletebilir' }, { status: 403 });

  const dto = await req.json() as AdvanceStageDto;
  await advanceStage({ ideaId: id, userId: user.id, dto });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/innovation/ideas/[id]/
git commit -m "feat(innovation): add vote, comments, evaluate, advance route handlers"
```

---

## Task 10: Dashboard Page

**Files:**
- Create: `src/app/(app)/innovation/page.tsx`

- [ ] **Step 1: Create Dashboard page**

```tsx
// src/app/(app)/innovation/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, TrendingUp, Clock, CheckCircle2, ArrowRight, Loader2, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { supabase } from "@/lib/supabase";
import type { InnovationStats } from "@/lib/innovation/types";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

const STAGE_ACTIVITY_LABEL: Record<string, string> = {
  new_idea: "yeni fikir gönderdi",
  stage_change: "fikri aşama ilerletti →",
  evaluation: "fikri değerlendirdi",
};

export default function InnovationDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<InnovationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/innovation/stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setStats(await res.json());
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const totalStageCount = (stats?.by_stage ?? []).reduce((s, b) => s + b.count, 0) || 1;

  const statCards = [
    { label: "Toplam Fikir", value: stats?.total_ideas ?? 0, icon: Lightbulb, color: "#3B82F6" },
    { label: "Bu Ay Gelen", value: stats?.this_month ?? 0, icon: TrendingUp, color: "#8B5CF6" },
    { label: "Değerlendirmede", value: stats?.under_review ?? 0, icon: Clock, color: "#D97706" },
    { label: "Uygulanan", value: stats?.implemented ?? 0, icon: CheckCircle2, color: "#059669" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fikir Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organizasyonunuzun inovasyon pipeline'ı</p>
        </div>
        <Link
          href="/innovation/pipeline"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <span>Pipeline</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-lg border border-gray-200 p-5 relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 w-1 h-full"
                style={{ background: card.color }}
              />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: card.color + "1a" }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Stage Dağılımı</h2>
        <div className="space-y-3">
          {(stats?.by_stage ?? []).map((s) => (
            <div key={s.stage_id} className="flex items-center gap-3">
              <div className="w-28 text-sm text-gray-600 truncate">{s.stage_name}</div>
              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((s.count / totalStageCount) * 100)}%`,
                    background: s.stage_color,
                  }}
                />
              </div>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: s.stage_color }}
              >
                {s.count}
              </div>
            </div>
          ))}
          {!(stats?.by_stage?.length) && (
            <p className="text-sm text-gray-400 italic">Henüz fikir bulunmuyor.</p>
          )}
        </div>
      </div>

      {/* Bottom 2-col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Ideas */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">En Çok Oy Alan Fikirler</h2>
            <Link href="/innovation/pipeline?sort=votes" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Tümü <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {(stats?.top_ideas ?? []).map((idea, i) => (
              <Link
                key={idea.id}
                href={`/innovation/pipeline?open=${idea.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                    {idea.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs text-gray-400">{idea.idea_number}</span>
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: idea.stage_color + "22", color: idea.stage_color }}
                    >
                      {idea.stage_name}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: idea.vote_count >= 0 ? "#059669" : "#DC2626" }}>
                    {idea.vote_count >= 0 ? "↑" : "↓"}{Math.abs(idea.vote_count)}
                  </p>
                  <p className="text-xs text-gray-400">⭐ {idea.composite_score}</p>
                </div>
              </Link>
            ))}
            {!(stats?.top_ideas?.length) && (
              <p className="text-sm text-gray-400 italic">Henüz oy kullanılmamış.</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Son Aktivite</h2>
          <div className="space-y-3">
            {(stats?.recent_activity ?? []).map((act, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background:
                      act.type === "new_idea" ? "#DBEAFE" :
                      act.type === "stage_change" ? "#F3E8FF" : "#D1FAE5",
                  }}
                >
                  <span className="text-xs">
                    {act.type === "new_idea" ? "💡" : act.type === "stage_change" ? "→" : "⭐"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">{act.actor_name}</span>
                    {" "}{STAGE_ACTIVITY_LABEL[act.type]}
                    {act.detail && <span className="font-semibold"> {act.detail}</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{act.idea_number} — {act.idea_title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: tr })}
                  </p>
                </div>
              </div>
            ))}
            {!(stats?.recent_activity?.length) && (
              <p className="text-sm text-gray-400 italic">Henüz aktivite yok.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/innovation/page.tsx
git commit -m "feat(innovation): add Dashboard page"
```

---

## Task 11: Pipeline Page

**Files:**
- Create: `src/app/(app)/innovation/pipeline/page.tsx`

- [ ] **Step 1: Create Pipeline page**

```tsx
// src/app/(app)/innovation/pipeline/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Search, X, ChevronUp, ChevronDown,
  Loader2, MessageCircle, Star, ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";
import type { InnovationIdea, InnovationStage, InnovationRole } from "@/lib/innovation/types";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

// ── Idea Card ─────────────────────────────────────────────────────────────────

function IdeaCard({
  idea,
  onOpen,
  userRole,
}: {
  idea: InnovationIdea;
  onOpen: (idea: InnovationIdea) => void;
  userRole: InnovationRole;
}) {
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
              <span className="text-xs text-gray-400">
                {idea.submitter.name}
              </span>
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
          <div className="flex items-center gap-1 text-sm font-bold" style={{ color: idea.vote_count >= 0 ? "#059669" : "#DC2626" }}>
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

// ── Detail Slide-Over ─────────────────────────────────────────────────────────

function DetailSlideOver({
  idea,
  onClose,
  token,
  userRole,
  userId,
  onVote,
}: {
  idea: InnovationIdea;
  onClose: () => void;
  token: string;
  userRole: InnovationRole;
  userId: string;
  onVote: (ideaId: string, newCount: number, userVote: number | null) => void;
}) {
  const [detail, setDetail] = useState<InnovationIdea | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [advanceReason, setAdvanceReason] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/innovation/ideas/${idea.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDetail(await res.json());
    }
    load();
  }, [idea.id, token]);

  async function handleVote(value: 1 | -1) {
    const res = await fetch(`/api/innovation/ideas/${idea.id}/vote`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (res.ok) {
      const { newCount, action } = await res.json();
      const userVote = action === "removed" ? null : value;
      onVote(idea.id, newCount, userVote);
      setDetail((d) => d ? { ...d, vote_count: newCount, user_vote: userVote } : d);
    }
  }

  async function handleComment() {
    if (!comment.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/innovation/ideas/${idea.id}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment }),
    });
    if (res.ok) {
      const newComment = await res.json();
      setDetail((d) => d ? { ...d, comments: [...(d.comments ?? []), newComment], comment_count: (d.comment_count ?? 0) + 1 } : d);
      setComment("");
    }
    setSubmitting(false);
  }

  async function handleAdvance() {
    if (!advanceReason.trim()) return;
    setAdvancing(true);
    const res = await fetch(`/api/innovation/ideas/${idea.id}/advance`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: advanceReason }),
    });
    if (res.ok) {
      const refreshed = await fetch(`/api/innovation/ideas/${idea.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (refreshed.ok) setDetail(await refreshed.json());
      setAdvanceReason("");
    }
    setAdvancing(false);
  }

  const d = detail ?? idea;
  const stages = d.stage ? [d.stage] : [];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200">
          <div className="flex-1 min-w-0 pr-3">
            <span className="font-mono text-xs text-gray-400">{d.idea_number}</span>
            <h2 className="text-base font-bold text-gray-900 mt-1">{d.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Stage progress */}
          {d.stage && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Aşama</p>
              <div className="flex items-center gap-2">
                <div
                  className="px-3 py-1.5 rounded-full text-sm font-semibold"
                  style={{ background: d.stage.color + "22", color: d.stage.color }}
                >
                  {d.stage.name}
                </div>
                {d.stage.order_index < 5 && (
                  <span className="text-xs text-gray-400">Sonraki: aşama {d.stage.order_index + 1}</span>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {d.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Açıklama</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{d.description}</p>
            </div>
          )}

          {/* Score + Vote */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Kompozit Puan</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{d.composite_score || "—"}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Oyunuz</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleVote(1)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors"
                  style={d.user_vote === 1 ? { background: "#059669", color: "#fff", borderColor: "#059669" } : { borderColor: "#E5E7EB", color: "#6B7280" }}
                >
                  <ChevronUp className="w-4 h-4" />
                  {d.vote_count >= 0 ? d.vote_count : 0}
                </button>
                <button
                  onClick={() => handleVote(-1)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors"
                  style={d.user_vote === -1 ? { background: "#DC2626", color: "#fff", borderColor: "#DC2626" } : { borderColor: "#E5E7EB", color: "#6B7280" }}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Evaluations */}
          {(d.evaluations?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Değerlendirmeler ({d.evaluations!.length})
              </p>
              <div className="space-y-2">
                {d.evaluations!.map((ev) => (
                  <div key={ev.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">{ev.evaluator?.name ?? "Bilinmiyor"}</span>
                      <span className="text-sm font-bold text-blue-600">{ev.total_score} puan</span>
                    </div>
                    {ev.notes && <p className="text-xs text-gray-500 mt-1">{ev.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin: advance stage */}
          {userRole === "innovation_admin" && (
            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Stage İlerlet</p>
              <input
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
                placeholder="İlerleme nedeni..."
                className="w-full text-sm border border-purple-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-purple-400 mb-2"
              />
              <button
                onClick={handleAdvance}
                disabled={advancing || !advanceReason.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Sonraki Aşamaya İlerlet
              </button>
            </div>
          )}

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Yorumlar ({d.comment_count ?? 0})
            </p>
            <div className="space-y-3">
              {(d.comments ?? []).filter((c) => !c.parent_id).map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                    {c.author?.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-gray-700">{c.author?.name ?? "Bilinmiyor"}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{c.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: tr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Add comment */}
            <div className="mt-3 flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()}
                placeholder="Yorum ekle..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={handleComment}
                disabled={submitting || !comment.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gönder"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── New Idea Modal ────────────────────────────────────────────────────────────

function NewIdeaModal({ onClose, onCreated, token }: { onClose: () => void; onCreated: () => void; token: string }) {
  const [form, setForm] = useState({ title: "", description: "", category: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!form.title.trim()) { setError("Başlık zorunludur"); return; }
    setSubmitting(true);
    const res = await fetch("/api/innovation/ideas", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      onCreated();
    } else {
      const d = await res.json();
      setError(d.error ?? "Hata oluştu");
    }
    setSubmitting(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="text-base font-bold text-gray-900">Yeni Fikir Gönder</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
          </div>
          <div className="p-5 space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Başlık *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Fikrinizi kısaca özetleyin"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
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
          </div>
          <div className="flex gap-3 p-5 border-t">
            <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Gönder
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InnovationPipeline() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();

  const [token, setToken] = useState("");
  const [ideas, setIdeas] = useState<InnovationIdea[]>([]);
  const [stages, setStages] = useState<InnovationStage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<InnovationIdea | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [userRole, setUserRole] = useState<InnovationRole>(null);

  const [filters, setFilters] = useState({
    stage: searchParams.get("stage") ?? "",
    search: "",
    sort: (searchParams.get("sort") ?? "date") as "date" | "score" | "votes",
  });

  const loadIdeas = useCallback(async (tok: string, f: typeof filters) => {
    const params = new URLSearchParams();
    if (f.stage) params.set("stage", f.stage);
    if (f.search) params.set("search", f.search);
    params.set("sort", f.sort);

    const res = await fetch(`/api/innovation/ideas?${params}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (res.ok) {
      const data = await res.json();
      setIdeas(data.ideas);
      setTotal(data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);

      const [stagesRes, statsRes] = await Promise.all([
        fetch("/api/innovation/stages", { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch("/api/innovation/stats", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ]);

      if (stagesRes.ok) setStages(await stagesRes.json());
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setUserRole(statsData.user_role ?? null);
      }

      await loadIdeas(session.access_token, filters);

      // Auto-open if ?open= param
      const openId = searchParams.get("open");
      if (openId) {
        const res = await fetch(`/api/innovation/ideas/${openId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) setSelectedIdea(await res.json());
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (token) loadIdeas(token, filters);
  }, [filters, token, loadIdeas]);

  function handleVote(ideaId: string, newCount: number, userVote: number | null) {
    setIdeas((prev) =>
      prev.map((i) => (i.id === ideaId ? { ...i, vote_count: newCount, user_vote: userVote } : i))
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">İnovasyon Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} fikir</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Fikir Ekle
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        {/* Stage tabs */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilters((f) => ({ ...f, stage: "" }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !filters.stage ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Tümü
          </button>
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilters((f) => ({ ...f, stage: f.stage === s.id ? "" : s.id }))}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={
                filters.stage === s.id
                  ? { background: s.color, color: "#fff" }
                  : { color: "#6B7280" }
              }
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Ara..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-44"
          />
        </div>

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as "date" | "score" | "votes" }))}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
        >
          <option value="date">Tarih</option>
          <option value="votes">Oy</option>
          <option value="score">Puan</option>
        </select>
      </div>

      {/* Ideas List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : ideas.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm italic">Henüz fikir bulunmuyor.</p>
          <button
            onClick={() => setShowNewModal(true)}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            İlk fikri siz gönderin
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onOpen={setSelectedIdea}
              userRole={userRole}
            />
          ))}
        </div>
      )}

      {/* Detail Slide-Over */}
      {selectedIdea && (
        <DetailSlideOver
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          token={token}
          userRole={userRole}
          userId={user?.id ?? ""}
          onVote={handleVote}
        />
      )}

      {/* New Idea Modal */}
      {showNewModal && (
        <NewIdeaModal
          onClose={() => setShowNewModal(false)}
          token={token}
          onCreated={() => {
            setShowNewModal(false);
            loadIdeas(token, filters);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/innovation/pipeline/page.tsx
git commit -m "feat(innovation): add Pipeline page"
```

---

## Task 12: Sidebar Integration

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Lightbulb import to Sidebar.tsx**

In [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx), find the lucide-react imports and add `Lightbulb`:

```typescript
import {
  LayoutDashboard, FolderKanban, CheckSquare, Briefcase, Clock,
  Users, BarChart3, Settings, User, ChevronLeft,
  ChevronRight, ShieldCheck, HeadphonesIcon,
  AlertCircle, GitPullRequest, LifeBuoy, Ticket,
  SlidersHorizontal, ClipboardList, ChevronDown, Wallet,
  Globe, Building2, MonitorCheck, ClipboardCheck,
  Lightbulb,  // ← ekle
} from "lucide-react";
```

- [ ] **Step 2: Add innovation section to navSections**

In [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx), find `navSections` array and add the innovation section after the `itsm` section:

```typescript
  {
    id: "innovation",
    label: "İnovasyon",
    icon: Lightbulb,
    defaultOpen: false,
    items: [
      { href: "/innovation",          icon: LayoutDashboard, label: "Dashboard"   },
      { href: "/innovation/pipeline", icon: Lightbulb,       label: "Pipeline"    },
    ],
  },
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(innovation): add Innovation section to sidebar"
```

---

## Task 13: Fix commentsRepo & Final Build

commentsRepo'daki RPC çağrısı (var olmayan `_increment_comment_count`) temizlenmeli.

**Files:**
- Modify: `src/lib/innovation/repositories/commentsRepo.ts`

- [ ] **Step 1: Fix createComment — remove broken RPC call**

`createComment` fonksiyonunu şu şekilde değiştir (Task 5'teki hatalı RPC kısmını kaldır):

```typescript
export async function createComment(params: {
  ideaId: string;
  authorId: string;
  dto: CreateCommentDto;
}): Promise<IdeaComment> {
  const { data, error } = await supabaseAdmin
    .from('innovation_comments')
    .insert({
      id: crypto.randomUUID(),
      idea_id: params.ideaId,
      author_id: params.authorId,
      parent_id: params.dto.parent_id ?? null,
      body: params.dto.body,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // comment_count cache güncelle
  const { count } = await supabaseAdmin
    .from('innovation_comments')
    .select('id', { count: 'exact', head: true })
    .eq('idea_id', params.ideaId);
  await supabaseAdmin
    .from('innovation_ideas')
    .update({ comment_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq('id', params.ideaId);

  return data as unknown as IdeaComment;
}
```

- [ ] **Step 2: Run full build**

```bash
npm run build
```

Beklenen: Build başarıyla tamamlanır, type error yok.

- [ ] **Step 3: Final commit**

```bash
git add src/lib/innovation/repositories/commentsRepo.ts
git commit -m "fix(innovation): remove non-existent RPC call in commentsRepo"
```

---

## Özet — Tüm Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `supabase/innovation-module.sql` | 10 tablo + RLS + seed data |
| `src/lib/innovation/types/index.ts` | TypeScript interface'leri |
| `src/lib/innovation/repositories/stagesRepo.ts` | Stage sorguları |
| `src/lib/innovation/repositories/ideasRepo.ts` | Fikir CRUD + history |
| `src/lib/innovation/repositories/votesRepo.ts` | Oylama sorguları |
| `src/lib/innovation/repositories/commentsRepo.ts` | Yorum sorguları |
| `src/lib/innovation/repositories/evaluationsRepo.ts` | Değerlendirme sorguları |
| `src/lib/innovation/services/ideasService.ts` | Fikir iş mantığı |
| `src/lib/innovation/services/votingService.ts` | Oylama iş mantığı |
| `src/lib/innovation/services/evaluationService.ts` | Değerlendirme iş mantığı |
| `src/app/api/innovation/stats/route.ts` | Dashboard stats |
| `src/app/api/innovation/stages/route.ts` | Stage listesi |
| `src/app/api/innovation/ideas/route.ts` | Fikir listesi + oluştur |
| `src/app/api/innovation/ideas/[id]/route.ts` | Fikir CRUD |
| `src/app/api/innovation/ideas/[id]/vote/route.ts` | Oylama |
| `src/app/api/innovation/ideas/[id]/comments/route.ts` | Yorumlar |
| `src/app/api/innovation/ideas/[id]/evaluate/route.ts` | Değerlendirme |
| `src/app/api/innovation/ideas/[id]/advance/route.ts` | Stage ilerletme |
| `src/app/(app)/innovation/page.tsx` | Dashboard sayfası |
| `src/app/(app)/innovation/pipeline/page.tsx` | Pipeline sayfası |
| `src/components/layout/Sidebar.tsx` | Sidebar güncellemesi |
