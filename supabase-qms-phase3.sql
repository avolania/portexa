-- Lots (incoming material / receiving records)
CREATE TABLE IF NOT EXISTS qms_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES qms_suppliers(id),
  spec_id UUID REFERENCES qms_specifications(id),
  lot_number TEXT NOT NULL,
  po_number TEXT,
  received_date DATE NOT NULL,
  quantity_value NUMERIC,
  quantity_unit TEXT,
  disposition TEXT NOT NULL DEFAULT 'pending'
    CHECK (disposition IN ('pending','accepted','rejected','on_hold','conditional')),
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qms_lots_org_id_idx ON qms_lots(org_id);
CREATE INDEX IF NOT EXISTS qms_lots_supplier_id_idx ON qms_lots(supplier_id);

-- COA (Certificate of Analysis)
CREATE TABLE IF NOT EXISTS qms_coas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  lot_id UUID NOT NULL REFERENCES qms_lots(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES qms_suppliers(id),
  spec_id UUID REFERENCES qms_specifications(id),
  file_ref TEXT,
  file_name TEXT,
  submitted_by JSONB,    -- { type: 'internal'|'supplier', userId: string }
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','auto_checked','conforming','nonconforming','manual_review')),
  comparison_overall TEXT CHECK (comparison_overall IN ('pass','fail','partial')),
  comparison_flags JSONB NOT NULL DEFAULT '[]',  -- COAFlag[]
  generated_ncr_id UUID,
  ai_extracted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qms_coas_org_id_idx ON qms_coas(org_id);
CREATE INDEX IF NOT EXISTS qms_coas_lot_id_idx ON qms_coas(lot_id);

-- COA individual test results
CREATE TABLE IF NOT EXISTS qms_coa_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coa_id UUID NOT NULL REFERENCES qms_coas(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL,
  reported_value TEXT NOT NULL,
  unit TEXT
);

-- NCR (Non-Conformance Report)
CREATE TABLE IF NOT EXISTS qms_ncrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('coa_auto','incoming_inspection','manual','audit')),
  supplier_id UUID NOT NULL REFERENCES qms_suppliers(id),
  lot_id UUID REFERENCES qms_lots(id),
  coa_id UUID REFERENCES qms_coas(id),
  spec_id UUID REFERENCES qms_specifications(id),
  ncr_number TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'quality',
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','major','critical')),
  description TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open'
    CHECK (state IN ('open','investigating','disposition_pending','disposition_approved','capa_linked','closed','rejected')),
  disposition TEXT CHECK (disposition IN ('use_as_is','rework','return','scrap','concession')),
  assignee_id TEXT,
  cost_recovery_amount NUMERIC,
  cost_recovery_currency TEXT DEFAULT 'USD',
  cost_recovery_status TEXT DEFAULT 'pending',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qms_ncrs_org_id_idx ON qms_ncrs(org_id);
CREATE INDEX IF NOT EXISTS qms_ncrs_supplier_id_idx ON qms_ncrs(supplier_id);
CREATE INDEX IF NOT EXISTS qms_ncrs_state_idx ON qms_ncrs(state);

-- CAPA (Corrective and Preventive Action)
CREATE TABLE IF NOT EXISTS qms_capas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  ncr_id UUID REFERENCES qms_ncrs(id),
  capa_number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'corrective' CHECK (type IN ('corrective','preventive','both')),
  root_cause TEXT,
  root_cause_method TEXT CHECK (root_cause_method IN ('5why','fishbone','8d')),
  state TEXT NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','in_progress','verification','effectiveness_check','approved','closed')),
  owner_id TEXT NOT NULL,
  due_date DATE NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qms_capas_org_id_idx ON qms_capas(org_id);
CREATE INDEX IF NOT EXISTS qms_capas_ncr_id_idx ON qms_capas(ncr_id);

-- CAPA action items
CREATE TABLE IF NOT EXISTS qms_capa_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_id UUID NOT NULL REFERENCES qms_capas(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','verified'))
);

-- Supplier scorecards
CREATE TABLE IF NOT EXISTS qms_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES qms_suppliers(id),
  period TEXT NOT NULL,   -- e.g. "2026-Q2"
  on_time_delivery_pct NUMERIC,
  quality_acceptance_rate NUMERIC,
  doc_compliance_pct NUMERIC,
  ncr_count INT DEFAULT 0,
  ncr_rate_per_lot NUMERIC,
  capa_closure_on_time_pct NUMERIC,
  avg_capa_close_days NUMERIC,
  rating TEXT CHECK (rating IN ('A','B','C','D')),
  trend TEXT CHECK (trend IN ('up','flat','down')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, supplier_id, period)
);

-- Sequence helpers for NCR/CAPA numbers
CREATE SEQUENCE IF NOT EXISTS qms_ncr_seq;
CREATE SEQUENCE IF NOT EXISTS qms_capa_seq;
