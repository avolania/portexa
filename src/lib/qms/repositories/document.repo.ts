import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  ComplianceDocument,
  CreateDocumentDto,
  AuditReadinessReport,
} from '@/lib/qms/types';

export async function findDocuments(
  orgId: string,
  filters?: {
    supplierId?: string;
    type?: string;
    status?: string;
    expiringWithin?: number;
  }
): Promise<ComplianceDocument[]> {
  let query = supabaseAdmin
    .from('qms_compliance_documents')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (filters?.supplierId) {
    query = query.eq('supplier_id', filters.supplierId);
  }

  if (filters?.type) {
    query = query.eq('type', filters.type);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.expiringWithin !== undefined) {
    const today = new Date().toISOString().split('T')[0];
    const future = new Date();
    future.setDate(future.getDate() + filters.expiringWithin);
    const futureStr = future.toISOString().split('T')[0];
    query = query.gte('expiry_date', today).lte('expiry_date', futureStr);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ComplianceDocument[];
}

export async function findDocumentById(id: string): Promise<ComplianceDocument | null> {
  const { data, error } = await supabaseAdmin
    .from('qms_compliance_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as ComplianceDocument;
}

export async function findDocumentsBySupplier(supplierId: string): Promise<ComplianceDocument[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_compliance_documents')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ComplianceDocument[];
}

export async function createDocument(
  orgId: string,
  dto: CreateDocumentDto & {
    uploaded_by?: { type: 'internal' | 'supplier'; userId: string };
  }
): Promise<ComplianceDocument> {
  const { data, error } = await supabaseAdmin
    .from('qms_compliance_documents')
    .insert({
      org_id: orgId,
      supplier_id: dto.supplier_id,
      site_id: dto.site_id ?? null,
      type: dto.type,
      title: dto.title,
      expiry_date: dto.expiry_date ?? null,
      issue_date: dto.issue_date ?? null,
      status: 'requested',
      uploaded_by: dto.uploaded_by ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ComplianceDocument;
}

export async function updateDocument(
  id: string,
  updates: Partial<ComplianceDocument> & { updated_at: string }
): Promise<ComplianceDocument> {
  const { data, error } = await supabaseAdmin
    .from('qms_compliance_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ComplianceDocument;
}

export async function findExpiringDocuments(
  orgId: string,
  daysAhead: number
): Promise<ComplianceDocument[]> {
  const today = new Date().toISOString().split('T')[0];
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);
  const futureStr = future.toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('qms_compliance_documents')
    .select('*')
    .eq('org_id', orgId)
    .gte('expiry_date', today)
    .lte('expiry_date', futureStr)
    .order('expiry_date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ComplianceDocument[];
}

export async function getAuditReadiness(orgId: string): Promise<AuditReadinessReport> {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
  const thirtyDaysAhead = new Date();
  thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
  const thirtyDaysAheadStr = thirtyDaysAhead.toISOString().split('T')[0];

  // Total suppliers
  const { count: totalSuppliers } = await supabaseAdmin
    .from('qms_suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  // Approved suppliers
  const { count: approvedSuppliers } = await supabaseAdmin
    .from('qms_suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'approved');

  // Expired docs
  const { count: expiredDocs } = await supabaseAdmin
    .from('qms_compliance_documents')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .or(`status.eq.expired,expiry_date.lt.${today}`);

  // Expiring docs (within 30 days, not yet expired)
  const { count: expiringDocs } = await supabaseAdmin
    .from('qms_compliance_documents')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('expiry_date', today)
    .lte('expiry_date', thirtyDaysAheadStr);

  // Missing docs (requested more than 30 days ago)
  const { count: missingDocs } = await supabaseAdmin
    .from('qms_compliance_documents')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'requested')
    .lt('created_at', thirtyDaysAgoStr);

  // By supplier breakdown
  const { data: allDocs } = await supabaseAdmin
    .from('qms_compliance_documents')
    .select('supplier_id, status, expiry_date, created_at')
    .eq('org_id', orgId);

  const { data: allSuppliers } = await supabaseAdmin
    .from('qms_suppliers')
    .select('id, display_name')
    .eq('org_id', orgId);

  const supplierMap = new Map<string, string>();
  for (const s of allSuppliers ?? []) {
    supplierMap.set(s.id, s.display_name);
  }

  const supplierStats = new Map<
    string,
    { expired: number; expiring: number; missing: number }
  >();

  for (const doc of allDocs ?? []) {
    if (!supplierStats.has(doc.supplier_id)) {
      supplierStats.set(doc.supplier_id, { expired: 0, expiring: 0, missing: 0 });
    }
    const stats = supplierStats.get(doc.supplier_id)!;

    const isExpired =
      doc.status === 'expired' || (doc.expiry_date && doc.expiry_date < today);
    const isExpiring =
      !isExpired &&
      doc.expiry_date &&
      doc.expiry_date >= today &&
      doc.expiry_date <= thirtyDaysAheadStr;
    const isMissing =
      doc.status === 'requested' && doc.created_at < thirtyDaysAgoStr;

    if (isExpired) stats.expired++;
    if (isExpiring) stats.expiring++;
    if (isMissing) stats.missing++;
  }

  const bySupplier = Array.from(supplierStats.entries()).map(([supplierId, counts]) => ({
    supplier_id: supplierId,
    supplier_name: supplierMap.get(supplierId) ?? supplierId,
    ...counts,
  }));

  return {
    total_suppliers: totalSuppliers ?? 0,
    approved_suppliers: approvedSuppliers ?? 0,
    expired_docs: expiredDocs ?? 0,
    expiring_docs: expiringDocs ?? 0,
    missing_docs: missingDocs ?? 0,
    by_supplier: bySupplier,
  };
}
