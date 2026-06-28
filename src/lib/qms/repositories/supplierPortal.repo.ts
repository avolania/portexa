import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { SupplierUser, SupplierInvite, NcrResponse, CreateInviteDto, SupplierPortalRole } from '../types';

// ─── Invite management ───────────────────────────────────────────────────────

export async function createInvite(
  orgId: string,
  userId: string,
  dto: CreateInviteDto
): Promise<SupplierInvite> {
  const { data, error } = await supabaseAdmin
    .from('qms_supplier_invites')
    .insert({
      org_id: orgId,
      supplier_id: dto.supplier_id,
      email: dto.email,
      name: dto.name,
      role: dto.role,
      invited_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SupplierInvite;
}

export async function findInviteByToken(token: string): Promise<SupplierInvite | null> {
  const { data, error } = await supabaseAdmin
    .from('qms_supplier_invites')
    .select('*')
    .eq('token', token)
    .single();

  if (error) return null;
  return data as SupplierInvite;
}

export async function findInvitesBySupplier(supplierId: string): Promise<SupplierInvite[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_supplier_invites')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierInvite[];
}

export async function acceptInvite(token: string, authUserId: string): Promise<SupplierUser> {
  // Tek atomik UPDATE: sadece accepted_at NULL olan daveti işaretle.
  // Eş zamanlı iki istek aynı daveti işaretlemeye çalışırsa
  // yalnızca biri satırı günceller; diğeri boş sonuç alır.
  const { data: invite, error: updateError } = await supabaseAdmin
    .from('qms_supplier_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .select()
    .single();

  if (updateError || !invite) {
    throw new Error('Davet zaten kullanılmış, süresi dolmuş veya geçersiz.');
  }

  // Davet atomik olarak kilitlendi — şimdi kullanıcı kaydını oluştur
  const { data: su, error: suError } = await supabaseAdmin
    .from('qms_supplier_users')
    .insert({
      org_id: invite.org_id,
      supplier_id: invite.supplier_id,
      auth_user_id: authUserId,
      name: invite.name,
      email: invite.email,
      role: invite.role,
      is_active: true,
    })
    .select()
    .single();

  if (suError) throw new Error(suError.message);
  return su as SupplierUser;
}

// ─── Supplier user management ─────────────────────────────────────────────────

export async function findSupplierUser(authUserId: string): Promise<SupplierUser | null> {
  const { data, error } = await supabaseAdmin
    .from('qms_supplier_users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();

  if (error) return null;
  return data as SupplierUser;
}

export async function findSupplierUsersBySupplier(supplierId: string): Promise<SupplierUser[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_supplier_users')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierUser[];
}

export async function findAllSupplierUsers(orgId: string): Promise<SupplierUser[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_supplier_users')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierUser[];
}

export async function updateSupplierUserRole(id: string, role: SupplierPortalRole): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_supplier_users')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deactivateSupplierUser(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_supplier_users')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function updateSupplierUser(
  id: string,
  updates: { role?: SupplierPortalRole; is_active?: boolean }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('qms_supplier_users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ─── NCR responses ────────────────────────────────────────────────────────────

export async function addNcrResponse(
  ncrId: string,
  supplierUserId: string,
  responseText: string,
  attachments?: Array<{ name: string; ref: string }>
): Promise<NcrResponse> {
  const { data, error } = await supabaseAdmin
    .from('qms_ncr_responses')
    .insert({
      ncr_id: ncrId,
      supplier_user_id: supplierUserId,
      response_text: responseText,
      attachments: attachments ?? [],
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as NcrResponse;
}

export async function getNcrResponses(ncrId: string): Promise<NcrResponse[]> {
  const { data, error } = await supabaseAdmin
    .from('qms_ncr_responses')
    .select('*')
    .eq('ncr_id', ncrId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as NcrResponse[];
}
