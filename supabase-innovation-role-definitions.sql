-- supabase-innovation-role-definitions.sql
-- Adds per-org customizable innovation role metadata + supports custom role creation.

-- Step 1: Create role definitions table
CREATE TABLE IF NOT EXISTS innovation_role_definitions (
  org_id      TEXT NOT NULL,
  role_key    TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT 'text-gray-700',
  bg          TEXT NOT NULL DEFAULT 'bg-gray-100',
  is_custom   BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  order_index INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, role_key)
);

-- Step 2: Drop the hardcoded CHECK constraint so custom role keys are allowed
ALTER TABLE innovation_user_roles
  DROP CONSTRAINT IF EXISTS innovation_user_roles_role_check;

-- Step 3: RLS (run after enabling RLS on the table if needed)
-- ALTER TABLE innovation_role_definitions ENABLE ROW LEVEL SECURITY;
-- Policy: only service-role key (used by supabaseAdmin) can read/write this table.
-- The API layer enforces settings.manage permission before touching this table.
