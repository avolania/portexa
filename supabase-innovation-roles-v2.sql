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
