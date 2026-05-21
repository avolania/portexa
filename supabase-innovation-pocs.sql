-- supabase-innovation-pocs.sql

CREATE TABLE innovation_pocs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL,
  idea_id      UUID NOT NULL REFERENCES innovation_ideas(id) ON DELETE CASCADE,
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
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_id     UUID NOT NULL REFERENCES innovation_pocs(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES auth_profiles(id),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_innovation_poc_updates_poc_id ON innovation_poc_updates(poc_id);
