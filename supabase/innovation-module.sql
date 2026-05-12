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
  submitter_id      TEXT NOT NULL REFERENCES auth_profiles(id) ON DELETE CASCADE,
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
    OR (submitter_id = auth.uid()::text)
  );
CREATE POLICY "ideas_insert" ON innovation_ideas FOR INSERT TO authenticated
  WITH CHECK (submitter_id = auth.uid()::text);
CREATE POLICY "ideas_update" ON innovation_ideas FOR UPDATE TO authenticated
  USING (
    submitter_id = auth.uid()::text
    OR (SELECT innovation_role FROM auth_profiles WHERE id = auth.uid()::text) = 'innovation_admin'
  );
CREATE POLICY "ideas_delete" ON innovation_ideas FOR DELETE TO authenticated
  USING (
    (submitter_id = auth.uid()::text AND status = 'draft')
    OR (SELECT innovation_role FROM auth_profiles WHERE id = auth.uid()::text) = 'innovation_admin'
  );

-- ── 4. innovation_votes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS innovation_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id    UUID NOT NULL REFERENCES innovation_ideas(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES auth_profiles(id) ON DELETE CASCADE,
  value      SMALLINT NOT NULL CHECK (value IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(idea_id, user_id)
);

ALTER TABLE innovation_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_select" ON innovation_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "votes_insert" ON innovation_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "votes_update" ON innovation_votes FOR UPDATE TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "votes_delete" ON innovation_votes FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

-- ── 5. innovation_comments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS innovation_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id    UUID NOT NULL REFERENCES innovation_ideas(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES auth_profiles(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES innovation_comments(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE innovation_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON innovation_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON innovation_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid()::text);

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
  evaluator_id TEXT NOT NULL REFERENCES auth_profiles(id) ON DELETE CASCADE,
  stage_id     UUID NOT NULL REFERENCES innovation_stages(id),
  notes        TEXT NOT NULL DEFAULT '',
  total_score  NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE innovation_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evals_select" ON innovation_evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "evals_insert" ON innovation_evaluations FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid()::text
    AND (SELECT innovation_role FROM auth_profiles WHERE id = auth.uid()::text) IN ('innovation_evaluator','innovation_admin')
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
  created_by TEXT REFERENCES auth_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE innovation_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_select" ON innovation_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_insert" ON innovation_tags FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid()::text);

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
  changed_by    TEXT NOT NULL REFERENCES auth_profiles(id),
  reason        TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE innovation_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history_select" ON innovation_stage_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "history_insert" ON innovation_stage_history FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid()::text);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_innovation_ideas_org_id      ON innovation_ideas(org_id);
CREATE INDEX IF NOT EXISTS idx_innovation_ideas_stage_id    ON innovation_ideas(stage_id);
CREATE INDEX IF NOT EXISTS idx_innovation_ideas_status      ON innovation_ideas(status);
CREATE INDEX IF NOT EXISTS idx_innovation_ideas_created_at  ON innovation_ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_innovation_votes_idea_id     ON innovation_votes(idea_id);
CREATE INDEX IF NOT EXISTS idx_innovation_comments_idea_id  ON innovation_comments(idea_id);
CREATE INDEX IF NOT EXISTS idx_innovation_evals_idea_id     ON innovation_evaluations(idea_id);
CREATE INDEX IF NOT EXISTS idx_innovation_history_idea_id   ON innovation_stage_history(idea_id);

-- ── Seed: stages ──────────────────────────────────────────────────────────────
INSERT INTO innovation_stages (id, order_index, name, description, color, min_score_to_advance, required_evaluations) VALUES
  ('11111111-0001-0000-0000-000000000000', 1, 'Fikir',            'Ham fikir gönderimi',               '#6B7280', 0,  0),
  ('11111111-0002-0000-0000-000000000000', 2, 'Ön Değerlendirme', 'İlk eleme ve puanlama',             '#3B82F6', 40, 2),
  ('11111111-0003-0000-0000-000000000000', 3, 'Detaylı Analiz',   'Fizibilite ve etki analizi',        '#8B5CF6', 60, 3),
  ('11111111-0004-0000-0000-000000000000', 4, 'Pilot',            'Küçük ölçekli test ve doğrulama',   '#D97706', 70, 2),
  ('11111111-0005-0000-0000-000000000000', 5, 'Uygulama',         'Tam ölçekli hayata geçirme',        '#059669', 0,  0)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: evaluation criteria ─────────────────────────────────────────────────
INSERT INTO innovation_evaluation_criteria (id, name, description, weight, max_score, order_index) VALUES
  ('22222222-0001-0000-0000-000000000000', 'Etki',          'İş süreçlerine veya müşterilere etkisi', 0.40, 10, 1),
  ('22222222-0002-0000-0000-000000000000', 'Fizibilite',    'Teknik ve kaynak uygulanabilirliği',     0.30, 10, 2),
  ('22222222-0003-0000-0000-000000000000', 'Özgünlük',      'Yenilikçilik ve farklılaşma derecesi',   0.20, 10, 3),
  ('22222222-0004-0000-0000-000000000000', 'Uygulama Hızı', 'Ne kadar hızlı hayata geçirilebilir',   0.10, 10, 4)
ON CONFLICT (id) DO NOTHING;
