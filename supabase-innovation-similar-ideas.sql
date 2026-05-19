-- supabase-innovation-similar-ideas.sql
CREATE INDEX IF NOT EXISTS innovation_ideas_title_fts_idx
  ON innovation_ideas
  USING gin(to_tsvector('turkish', title));
