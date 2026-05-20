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
