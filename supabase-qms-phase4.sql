-- Supplier portal user accounts (links a Supabase auth user to a supplier)
CREATE TABLE IF NOT EXISTS qms_supplier_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES qms_suppliers(id) ON DELETE CASCADE,
  auth_user_id TEXT NOT NULL UNIQUE,  -- Supabase auth.users.id
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','uploader','responder')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qms_supplier_users_org_idx ON qms_supplier_users(org_id);
CREATE INDEX IF NOT EXISTS qms_supplier_users_supplier_idx ON qms_supplier_users(supplier_id);
CREATE INDEX IF NOT EXISTS qms_supplier_users_auth_idx ON qms_supplier_users(auth_user_id);

-- Invite tokens for supplier user registration
CREATE TABLE IF NOT EXISTS qms_supplier_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES qms_suppliers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'uploader' CHECK (role IN ('viewer','uploader','responder')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  invited_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qms_supplier_invites_token_idx ON qms_supplier_invites(token);

-- NCR supplier responses
CREATE TABLE IF NOT EXISTS qms_ncr_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ncr_id UUID NOT NULL REFERENCES qms_ncrs(id) ON DELETE CASCADE,
  supplier_user_id UUID NOT NULL REFERENCES qms_supplier_users(id),
  response_text TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]',  -- [{ name, ref }]
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qms_ncr_responses_ncr_idx ON qms_ncr_responses(ncr_id);
