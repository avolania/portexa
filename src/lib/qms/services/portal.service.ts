import type { SupplierUser, SupplierInvite, NcrResponse, CreateInviteDto } from '../types';
import * as portalRepo from '../repositories/supplierPortal.repo';
import { findNcrs, findNcrById } from '../repositories/ncr.repo';
import { findDocuments } from '../repositories/document.repo';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { COA, Scorecard } from '../types';

// ─── Invite management ───────────────────────────────────────────────────────

export async function sendInvite(
  orgId: string,
  userId: string,
  dto: CreateInviteDto
): Promise<SupplierInvite> {
  const invite = await portalRepo.createInvite(orgId, userId, dto);
  // Future: send email with invite link
  return invite;
}

export async function acceptInvite(
  token: string,
  authUserId: string
): Promise<SupplierUser> {
  return portalRepo.acceptInvite(token, authUserId);
}

// ─── Portal dashboard ─────────────────────────────────────────────────────────

export interface PortalDashboard {
  ncrs: Awaited<ReturnType<typeof findNcrs>>;
  pendingCoas: COA[];
  complianceDocs: Awaited<ReturnType<typeof findDocuments>>;
  scorecard: Scorecard | null;
}

export async function getPortalDashboard(
  supplierUser: SupplierUser
): Promise<PortalDashboard> {
  const { org_id: orgId, supplier_id: supplierId } = supplierUser;

  // NCRs: open/investigating/disposition_pending/capa_linked states
  const allNcrs = await findNcrs(orgId, { supplierId });
  const activeStates = ['open', 'investigating', 'disposition_pending', 'capa_linked'];
  const ncrs = allNcrs.filter(n => activeStates.includes(n.state));

  // Pending COAs: status 'submitted'
  const { data: coaData } = await supabaseAdmin
    .from('qms_coas')
    .select('*')
    .eq('org_id', orgId)
    .eq('supplier_id', supplierId)
    .eq('status', 'submitted')
    .order('created_at', { ascending: false });
  const pendingCoas = (coaData ?? []) as COA[];

  // Compliance docs: expired or expiring
  const complianceDocs = await findDocuments(orgId, {
    supplierId,
    status: 'expiring',
  });
  const expiredDocs = await findDocuments(orgId, {
    supplierId,
    status: 'expired',
  });
  const allComplianceDocs = [...complianceDocs, ...expiredDocs];

  // Latest scorecard
  const { data: scorecardData } = await supabaseAdmin
    .from('qms_scorecards')
    .select('*')
    .eq('org_id', orgId)
    .eq('supplier_id', supplierId)
    .order('period', { ascending: false })
    .limit(1)
    .single();
  const scorecard = scorecardData as Scorecard | null;

  return {
    ncrs,
    pendingCoas,
    complianceDocs: allComplianceDocs,
    scorecard,
  };
}

// ─── NCR response ─────────────────────────────────────────────────────────────

export async function respondToNcr(
  ncrId: string,
  supplierUser: SupplierUser,
  responseText: string,
  attachments?: Array<{ name: string; ref: string }>
): Promise<NcrResponse> {
  // Validate supplier owns the NCR
  const ncr = await findNcrById(ncrId);
  if (!ncr) throw new Error('NCR bulunamadı');
  if (ncr.supplier_id !== supplierUser.supplier_id) {
    throw new Error('Bu NCR\'a erişim yetkiniz yok');
  }
  if (supplierUser.role === 'viewer') {
    throw new Error('Görüntüleyici rolü yanıt ekleyemez');
  }

  return portalRepo.addNcrResponse(ncrId, supplierUser.id, responseText, attachments);
}
