-- Specifications
CREATE TABLE IF NOT EXISTS qms_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('raw_material','finished_good','packaging')),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_review','approved','published','superseded','archived')),
  version INT NOT NULL DEFAULT 1,
  supplier_id UUID REFERENCES qms_suppliers(id),
  co_authored_with_supplier BOOLEAN NOT NULL DEFAULT false,
  -- F&B attribute groups stored as JSONB
  organoleptic JSONB NOT NULL DEFAULT '{}',
  physical_chemical JSONB NOT NULL DEFAULT '{}',
  microbiological JSONB NOT NULL DEFAULT '[]',
  nutritional JSONB,
  allergens JSONB NOT NULL DEFAULT '{}',
  shelf_life JSONB,              -- { value: number, unit: 'day'|'month'|'year' }
  storage_conditions TEXT,
  labeling_regulatory JSONB NOT NULL DEFAULT '{}',
  -- Relations
  linked_finished_good_ids TEXT[] NOT NULL DEFAULT '{}',
  -- Approval
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  published_by TEXT,
  published_at TIMESTAMPTZ,
  -- Timestamps
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qms_specifications_org_id_idx ON qms_specifications(org_id);
CREATE INDEX IF NOT EXISTS qms_specifications_status_idx ON qms_specifications(status);
CREATE INDEX IF NOT EXISTS qms_specifications_type_idx ON qms_specifications(type);

-- Spec change log (version history)
CREATE TABLE IF NOT EXISTS qms_spec_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id UUID NOT NULL REFERENCES qms_specifications(id) ON DELETE CASCADE,
  version INT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  summary TEXT NOT NULL DEFAULT '',
  diff JSONB NOT NULL DEFAULT '{}'   -- { field: { from, to } }
);

CREATE INDEX IF NOT EXISTS qms_spec_changes_spec_id_idx ON qms_spec_changes(spec_id);

-- Impact review tasks (when a raw_material spec changes, linked finished goods need review)
CREATE TABLE IF NOT EXISTS qms_impact_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_spec_id UUID NOT NULL REFERENCES qms_specifications(id) ON DELETE CASCADE,
  affected_spec_id UUID NOT NULL REFERENCES qms_specifications(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  triggered_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT DEFAULT ''
);
