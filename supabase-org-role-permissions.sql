-- org_role_permissions: per-org overrides for system role permission sets.
-- One row per org. data = { "pm": ["project.view", ...], "viewer": [...] }
-- Only roles that differ from the static default are stored.
CREATE TABLE IF NOT EXISTS org_role_permissions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     uuid NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id)
);

ALTER TABLE org_role_permissions ENABLE ROW LEVEL SECURITY;

-- Only the service_role (used by supabaseAdmin) can access this table.
CREATE POLICY "service_role_only" ON org_role_permissions
  USING (auth.role() = 'service_role');
