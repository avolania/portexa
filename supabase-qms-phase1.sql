-- QMS Phase 1 Migration
-- Compliance Management module for Pixanto PPM

-- ─── Suppliers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qms_suppliers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT        NOT NULL,
  legal_name       TEXT        NOT NULL,
  display_name     TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'prospect'
                               CHECK (status IN ('prospect','pending','approved','conditional','suspended','inactive')),
  risk_tier        TEXT        NOT NULL DEFAULT 'medium'
                               CHECK (risk_tier IN ('low','medium','high')),
  categories       TEXT[]      DEFAULT '{}',
  primary_contact  JSONB       DEFAULT '{}',
  portal_enabled   BOOLEAN     DEFAULT false,
  notes            TEXT        DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Supplier Sites ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qms_supplier_sites (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID        NOT NULL REFERENCES qms_suppliers(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  address         JSONB       DEFAULT '{}',
  country         TEXT        DEFAULT '',
  gfsi_certified  BOOLEAN     DEFAULT false,
  gfsi_scheme     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Compliance Documents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qms_compliance_documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT        NOT NULL,
  supplier_id      UUID        NOT NULL REFERENCES qms_suppliers(id) ON DELETE CASCADE,
  site_id          UUID        REFERENCES qms_supplier_sites(id),
  type             TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  file_ref         TEXT,
  file_name        TEXT,
  file_size_bytes  BIGINT,
  status           TEXT        NOT NULL DEFAULT 'requested'
                               CHECK (status IN ('requested','uploaded','in_review','approved','rejected','expiring','expired')),
  issue_date       DATE,
  expiry_date      DATE,
  reviewer_id      TEXT,
  review_notes     TEXT        DEFAULT '',
  linked_spec_ids  TEXT[]      DEFAULT '{}',
  version          INT         DEFAULT 1,
  uploaded_by      JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Qualification Programs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qms_qualification_programs (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id          UUID        NOT NULL REFERENCES qms_suppliers(id) ON DELETE CASCADE,
  org_id               TEXT        NOT NULL,
  required_doc_types   TEXT[]      DEFAULT '{}',
  status               TEXT        NOT NULL DEFAULT 'in_progress'
                                   CHECK (status IN ('in_progress','complete','blocked')),
  completion_pct       INT         DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Qualification Steps ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qms_qualification_steps (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   UUID        NOT NULL REFERENCES qms_qualification_programs(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT        DEFAULT '',
  order_index  INT         NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','in_progress','complete','blocked')),
  completed_at TIMESTAMPTZ,
  completed_by TEXT
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_qms_suppliers_org_id
  ON qms_suppliers(org_id);

CREATE INDEX IF NOT EXISTS idx_qms_compliance_documents_org_id
  ON qms_compliance_documents(org_id);

CREATE INDEX IF NOT EXISTS idx_qms_compliance_documents_supplier_id
  ON qms_compliance_documents(supplier_id);

CREATE INDEX IF NOT EXISTS idx_qms_compliance_documents_expiry_date
  ON qms_compliance_documents(expiry_date);

CREATE INDEX IF NOT EXISTS idx_qms_supplier_sites_supplier_id
  ON qms_supplier_sites(supplier_id);

CREATE INDEX IF NOT EXISTS idx_qms_qualification_programs_supplier_id
  ON qms_qualification_programs(supplier_id);

CREATE INDEX IF NOT EXISTS idx_qms_qualification_programs_org_id
  ON qms_qualification_programs(org_id);
