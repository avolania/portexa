-- supabase-innovation-permissions.sql
-- Adds per-role permission configuration to innovation_role_definitions.

ALTER TABLE innovation_role_definitions
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]';
