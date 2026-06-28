export type SupplierStatus = 'prospect' | 'pending' | 'approved' | 'conditional' | 'suspended' | 'inactive';
export type RiskTier = 'low' | 'medium' | 'high';
export type DocStatus = 'requested' | 'uploaded' | 'in_review' | 'approved' | 'rejected' | 'expiring' | 'expired';
export type DocumentType =
  | 'gfsi_certificate'
  | 'haccp_plan'
  | 'allergen_statement'
  | 'kosher_cert'
  | 'halal_cert'
  | 'organic_cert'
  | 'non_gmo'
  | 'letter_of_guarantee'
  | 'coi'
  | 'business_license'
  | 'food_safety_plan'
  | 'third_party_audit'
  | 'other';

export interface Supplier {
  id: string;
  org_id: string;
  legal_name: string;
  display_name: string;
  status: SupplierStatus;
  risk_tier: RiskTier;
  categories: string[];
  primary_contact: Record<string, string>;
  portal_enabled: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierSite {
  id: string;
  supplier_id: string;
  name: string;
  address: Record<string, string>;
  country: string;
  gfsi_certified: boolean;
  gfsi_scheme: string | null;
  created_at: string;
}

export interface ComplianceDocument {
  id: string;
  org_id: string;
  supplier_id: string;
  site_id: string | null;
  type: DocumentType;
  title: string;
  file_ref: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  status: DocStatus;
  issue_date: string | null;
  expiry_date: string | null;
  reviewer_id: string | null;
  review_notes: string;
  linked_spec_ids: string[];
  version: number;
  uploaded_by: { type: 'internal' | 'supplier'; userId: string } | null;
  created_at: string;
  updated_at: string;
}

export interface QualificationProgram {
  id: string;
  supplier_id: string;
  org_id: string;
  required_doc_types: DocumentType[];
  status: 'in_progress' | 'complete' | 'blocked';
  completion_pct: number;
  created_at: string;
  updated_at: string;
}

export interface QualificationStep {
  id: string;
  program_id: string;
  title: string;
  description: string;
  order_index: number;
  status: 'pending' | 'in_progress' | 'complete' | 'blocked';
  completed_at: string | null;
  completed_by: string | null;
}

export interface CreateSupplierDto {
  legal_name: string;
  display_name: string;
  status?: SupplierStatus;
  risk_tier?: RiskTier;
  categories?: string[];
  primary_contact?: Record<string, string>;
  notes?: string;
}

export interface UpdateSupplierDto {
  legal_name?: string;
  display_name?: string;
  status?: SupplierStatus;
  risk_tier?: RiskTier;
  categories?: string[];
  primary_contact?: Record<string, string>;
  portal_enabled?: boolean;
  notes?: string;
}

export interface CreateDocumentDto {
  supplier_id: string;
  site_id?: string;
  type: DocumentType;
  title: string;
  expiry_date?: string;
  issue_date?: string;
}

export interface ReviewDocumentDto {
  decision: 'approve' | 'reject';
  notes?: string;
}

export interface AuditReadinessReport {
  total_suppliers: number;
  approved_suppliers: number;
  expired_docs: number;
  expiring_docs: number;
  missing_docs: number;
  by_supplier: Array<{
    supplier_id: string;
    supplier_name: string;
    expired: number;
    expiring: number;
    missing: number;
  }>;
}

// ─── Specification Management (Faz 2) ─────────────────────────────────────

export type SpecType = 'raw_material' | 'finished_good' | 'packaging';
export type SpecStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'superseded' | 'archived';

export const AB_ALLERGENS = [
  'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk',
  'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs',
] as const;
export type Allergen = typeof AB_ALLERGENS[number];
export type AllergenStatus = 'contains' | 'may_contain' | 'free';
export type AllergenMatrix = Partial<Record<Allergen, AllergenStatus>>;

export interface AttributeField {
  label: string;
  target?: string | number;
  min?: number;
  max?: number;
  unit?: string;
  method?: string;
}
export type AttributeSet = Record<string, AttributeField>;

export interface MicroSpec {
  organism: string;
  limit: string;
  method: string;
}

export interface NutritionalPanel {
  serving_size?: string;
  energy_kcal?: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  sugar_g?: number;
  fibre_g?: number;
  salt_g?: number;
  sodium_mg?: number;
  [key: string]: number | string | undefined;
}

export interface ShelfLife {
  value: number;
  unit: 'day' | 'month' | 'year';
}

export interface Specification {
  id: string;
  org_id: string;
  type: SpecType;
  name: string;
  code: string;
  status: SpecStatus;
  version: number;
  supplier_id: string | null;
  co_authored_with_supplier: boolean;
  organoleptic: AttributeSet;
  physical_chemical: AttributeSet;
  microbiological: MicroSpec[];
  nutritional: NutritionalPanel | null;
  allergens: AllergenMatrix;
  shelf_life: ShelfLife | null;
  storage_conditions: string | null;
  labeling_regulatory: AttributeSet;
  linked_finished_good_ids: string[];
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_by: string | null;
  published_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SpecChange {
  id: string;
  spec_id: string;
  version: number;
  changed_by: string;
  changed_at: string;
  summary: string;
  diff: Record<string, { from: unknown; to: unknown }>;
}

export interface ImpactReview {
  id: string;
  trigger_spec_id: string;
  affected_spec_id: string;
  triggered_at: string;
  triggered_by: string;
  status: 'open' | 'reviewed' | 'dismissed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string;
}

export interface CreateSpecDto {
  type: SpecType;
  name: string;
  code: string;
  supplier_id?: string;
  co_authored_with_supplier?: boolean;
  organoleptic?: AttributeSet;
  physical_chemical?: AttributeSet;
  microbiological?: MicroSpec[];
  nutritional?: NutritionalPanel;
  allergens?: AllergenMatrix;
  shelf_life?: ShelfLife;
  storage_conditions?: string;
  labeling_regulatory?: AttributeSet;
  linked_finished_good_ids?: string[];
}

export interface UpdateSpecDto {
  name?: string;
  code?: string;
  supplier_id?: string | null;
  co_authored_with_supplier?: boolean;
  organoleptic?: AttributeSet;
  physical_chemical?: AttributeSet;
  microbiological?: MicroSpec[];
  nutritional?: NutritionalPanel | null;
  allergens?: AllergenMatrix;
  shelf_life?: ShelfLife | null;
  storage_conditions?: string | null;
  labeling_regulatory?: AttributeSet;
  linked_finished_good_ids?: string[];
  change_summary?: string;
}

// ─── SQM – Phase 3 ────────────────────────────────────────────────────────────

export type LotDisposition = 'pending' | 'accepted' | 'rejected' | 'on_hold' | 'conditional';
export type CoaStatus = 'submitted' | 'auto_checked' | 'conforming' | 'nonconforming' | 'manual_review';
export type NcrState = 'open' | 'investigating' | 'disposition_pending' | 'disposition_approved' | 'capa_linked' | 'closed' | 'rejected';
export type CapaState = 'draft' | 'in_progress' | 'verification' | 'effectiveness_check' | 'approved' | 'closed';
export type NcrSource = 'coa_auto' | 'incoming_inspection' | 'manual' | 'audit';
export type NcrDisposition = 'use_as_is' | 'rework' | 'return' | 'scrap' | 'concession';

export interface Lot {
  id: string; org_id: string; supplier_id: string; spec_id: string | null;
  lot_number: string; po_number: string | null;
  received_date: string;
  quantity_value: number | null; quantity_unit: string | null;
  disposition: LotDisposition; notes: string;
  created_by: string; created_at: string; updated_at: string;
}

export interface COAFlag {
  attribute_key: string; spec_limit: string; reported_value: string; result: 'pass' | 'fail';
}

export interface COA {
  id: string; org_id: string; lot_id: string; supplier_id: string; spec_id: string | null;
  file_ref: string | null; file_name: string | null;
  submitted_by: { type: 'internal' | 'supplier'; userId: string } | null;
  status: CoaStatus;
  comparison_overall: 'pass' | 'fail' | 'partial' | null;
  comparison_flags: COAFlag[];
  generated_ncr_id: string | null;
  ai_extracted: boolean;
  created_at: string; updated_at: string;
}

export interface COAResult {
  id: string; coa_id: string; attribute_key: string; reported_value: string; unit: string | null;
}

export interface NCR {
  id: string; org_id: string; source: NcrSource; supplier_id: string;
  lot_id: string | null; coa_id: string | null; spec_id: string | null;
  ncr_number: string; category: string; severity: 'minor' | 'major' | 'critical';
  description: string; state: NcrState; disposition: NcrDisposition | null;
  assignee_id: string | null;
  cost_recovery_amount: number | null; cost_recovery_currency: string; cost_recovery_status: string;
  created_by: string; created_at: string; updated_at: string;
}

export interface CAPA {
  id: string; org_id: string; ncr_id: string | null; capa_number: string;
  type: 'corrective' | 'preventive' | 'both';
  root_cause: string | null; root_cause_method: '5why' | 'fishbone' | '8d' | null;
  state: CapaState; owner_id: string; due_date: string;
  approved_by: string | null; approved_at: string | null;
  created_by: string; created_at: string; updated_at: string;
}

export interface CAPAAction {
  id: string; capa_id: string; description: string; owner_id: string;
  due_date: string; status: 'open' | 'done' | 'verified';
}

export interface Scorecard {
  id: string; org_id: string; supplier_id: string; period: string;
  on_time_delivery_pct: number | null; quality_acceptance_rate: number | null;
  doc_compliance_pct: number | null; ncr_count: number;
  ncr_rate_per_lot: number | null; capa_closure_on_time_pct: number | null;
  avg_capa_close_days: number | null;
  rating: 'A' | 'B' | 'C' | 'D' | null; trend: 'up' | 'flat' | 'down' | null;
  notes: string; created_at: string; updated_at: string;
}

export interface CreateLotDto {
  supplier_id: string; spec_id?: string; lot_number: string; po_number?: string;
  received_date: string; quantity_value?: number; quantity_unit?: string; notes?: string;
}

export interface CreateNcrDto {
  source: NcrSource; supplier_id: string; lot_id?: string; coa_id?: string; spec_id?: string;
  category?: string; severity: 'minor' | 'major' | 'critical'; description: string; assignee_id?: string;
}

export interface CreateCapaDto {
  ncr_id?: string; type: 'corrective' | 'preventive' | 'both';
  root_cause?: string; root_cause_method?: '5why' | 'fishbone' | '8d';
  owner_id: string; due_date: string;
  actions?: Array<{ description: string; owner_id: string; due_date: string }>;
}

// ─── Supplier Portal – Phase 4 ────────────────────────────────────────────────

export type SupplierPortalRole = 'viewer' | 'uploader' | 'responder';

export interface SupplierUser {
  id: string;
  org_id: string;
  supplier_id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role: SupplierPortalRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierInvite {
  id: string;
  org_id: string;
  supplier_id: string;
  email: string;
  name: string;
  role: SupplierPortalRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  invited_by: string;
  created_at: string;
}

export interface NcrResponse {
  id: string;
  ncr_id: string;
  supplier_user_id: string;
  response_text: string;
  attachments: Array<{ name: string; ref: string }>;
  created_at: string;
}

export interface CreateInviteDto {
  supplier_id: string;
  email: string;
  name: string;
  role: SupplierPortalRole;
}
