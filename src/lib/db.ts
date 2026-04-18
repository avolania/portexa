import { supabase } from "./supabase";
import type { User, Organization } from "@/types";

// ─── Generic helpers ──────────────────────────────────────────────────────────

/** H-2: orgId verilirse DB'de org_id kolonu üzerinden filtreler (full table scan önlenir). */
export async function dbLoadAll<T>(table: string, orgId?: string): Promise<T[]> {
  let query = supabase.from(table).select("data");
  if (orgId) query = query.eq("org_id", orgId);
  const { data, error } = await query;
  if (error) {
    console.error(`[db] load ${table}:`, error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => row.data as T);
}

export async function dbLoadOne<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await supabase.from(table).select("data").eq("id", id).single();
  if (error || !data) return null;
  return data.data as T;
}

export async function dbUpsert(table: string, id: string, data: unknown, orgId?: string): Promise<void> {
  const row = orgId ? { id, data, org_id: orgId } : { id, data };
  const { error } = await supabase.from(table).upsert([row], { defaultToNull: false });
  if (error) {
    console.error(`[db] upsert ${table}:`, error.message);
    throw new Error(error.message);
  }
}

/**
 * H-4: Optimistik kilit — sadece data->>'version' == expectedVersion ise günceller.
 * Dönen { updated: false } eş zamanlı yazma çakışmasını gösterir.
 */
export async function dbConditionalUpdate(
  table: string,
  id: string,
  data: unknown,
  orgId: string,
  expectedVersion: number,
): Promise<{ updated: boolean }> {
  const { count, error } = await supabase
    .from(table)
    .update({ data, org_id: orgId }, { count: 'exact' })
    .eq("id", id)
    .filter("data->>'version'", "eq", String(expectedVersion));
  if (error) {
    console.error(`[db] conditionalUpdate ${table}:`, error.message);
    throw new Error(error.message);
  }
  return { updated: (count ?? 0) > 0 };
}

/** H-5: JSONB alanlarına göre tek kayıt filtreler — full table scan yerine indexed sorgu. */
export async function dbFindOneByJsonb<T>(
  table: string,
  filters: Record<string, string>,
): Promise<T | null> {
  let query = supabase.from(table).select("data");
  for (const [key, value] of Object.entries(filters)) {
    query = query.filter(`data->>'${key}'`, "eq", value);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data) return null;
  return data.data as T;
}

/**
 * M-4: Tek seferde birden fazla satırı upsert eder — N+1 yerine tek istek.
 * Her öğe { id, data, org_id? } şeklinde olmalıdır.
 */
export async function dbBatchUpsert(
  table: string,
  rows: Array<{ id: string; data: unknown; org_id?: string }>,
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { defaultToNull: false });
  if (error) {
    console.error(`[db] batchUpsert ${table}:`, error.message);
    throw new Error(error.message);
  }
}

// ─── Ticket notes & events (P1 — ayrı tablolar) ──────────────────────────────

export type TicketType = 'incident' | 'service-request' | 'change-request';
export type NoteType   = 'work_note' | 'comment';

/** Ayrı nota tablosuna tek kayıt ekler. */
export async function dbInsertNote<T extends { id: string; createdAt: string }>(
  ticketId: string,
  ticketType: TicketType,
  noteType: NoteType,
  orgId: string,
  data: T,
): Promise<void> {
  const { error } = await supabase.from('itsm_ticket_notes').insert([{
    id: data.id,
    ticket_id: ticketId,
    ticket_type: ticketType,
    note_type: noteType,
    org_id: orgId,
    data,
    created_at: data.createdAt,
  }]);
  if (error) {
    console.error('[db] insertNote:', error.message);
    throw new Error(error.message);
  }
}

/** Ayrı event tablosuna tek kayıt ekler. */
export async function dbInsertEvent<T extends { id: string; timestamp: string }>(
  ticketId: string,
  ticketType: TicketType,
  orgId: string,
  data: T,
): Promise<void> {
  const { error } = await supabase.from('itsm_ticket_events').insert([{
    id: data.id,
    ticket_id: ticketId,
    ticket_type: ticketType,
    org_id: orgId,
    data,
    created_at: data.timestamp,
  }]);
  if (error) {
    console.error('[db] insertEvent:', error.message);
    throw new Error(error.message);
  }
}

/** Bir ticket'ın tüm notlarını ve yorumlarını yükler (eski→yeni sıralı). */
export async function dbLoadNotes<T = unknown>(
  ticketId: string,
  orgId: string,
): Promise<{ noteType: NoteType; data: T }[]> {
  const { data, error } = await supabase
    .from('itsm_ticket_notes')
    .select('note_type, data')
    .eq('ticket_id', ticketId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[db] loadNotes:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({ noteType: r.note_type as NoteType, data: r.data as T }));
}

/** Bir ticket'ın tüm timeline event'larını yükler (eski→yeni sıralı). */
export async function dbLoadEvents<T = unknown>(
  ticketId: string,
  orgId: string,
): Promise<T[]> {
  const { data, error } = await supabase
    .from('itsm_ticket_events')
    .select('data')
    .eq('ticket_id', ticketId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[db] loadEvents:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => r.data as T);
}

// ─── P7/P8: Filtered load with DB-side predicates ────────────────────────────

/**
 * P7: Kapalı ticket'ları varsayılan olarak hariç tutar.
 * P8: Basit scalar alanları DB tarafında filtreler, JS yükünü düşürür.
 */
export async function dbLoadFiltered<T>(
  table: string,
  orgId: string,
  opts: {
    excludeStates?: string[];  // P7 — bu state'leri dışla (örn. ['Closed'])
    scalarFilters?: Record<string, string>; // P8 — data->>'field' = value
  } = {},
): Promise<T[]> {
  let query = supabase.from(table).select('data');
  if (orgId) query = query.eq('org_id', orgId);

  for (const state of opts.excludeStates ?? []) {
    query = query.filter('data->>state', 'neq', state);
  }
  for (const [key, val] of Object.entries(opts.scalarFilters ?? {})) {
    query = query.filter(`data->>${key}`, 'eq', val);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`[db] loadFiltered ${table}:`, error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => r.data as T);
}

export async function dbDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    console.error(`[db] delete ${table}:`, error.message);
    throw new Error(error.message);
  }
}

// ─── Auth profiles (keyed by userId) ─────────────────────────────────────────

/** P3: org_id dedicated kolonu üzerinden filtreler — index kullanır, sequential scan yok. */
export async function dbLoadProfiles(orgId?: string): Promise<Record<string, User>> {
  let query = supabase.from("auth_profiles").select("id, data");
  if (orgId) query = query.eq("org_id", orgId);
  const { data, error } = await query;
  if (error) {
    console.error("[db] load auth_profiles:", error.message);
    throw new Error(error.message);
  }
  const result: Record<string, User> = {};
  for (const row of data ?? []) {
    result[row.id] = row.data as User;
  }
  return result;
}

export async function dbLoadProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from("auth_profiles").select("data").eq("id", userId).single();
  if (error || !data) return null;
  return data.data as User;
}

export async function dbUpsertProfile(userId: string, data: unknown): Promise<void> {
  const orgId = (data as Record<string, unknown>)?.orgId as string | undefined;
  const row = orgId ? { id: userId, data, org_id: orgId } : { id: userId, data };
  const { error } = await supabase.from("auth_profiles").upsert([row], { defaultToNull: false });
  if (error) {
    console.error("[db] upsert auth_profiles:", error.message);
    throw new Error(error.message);
  }
}

// E-posta ile kullanıcı bul ve orgId'yi güncelle (security definer RPC ile RLS bypass)
export async function dbAssignUserToOrg(email: string, newOrgId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("assign_user_to_org", {
    p_email: email,
    p_org_id: newOrgId,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; error?: string };
  return result;
}

// ─── Organizations ────────────────────────────────────────────────────────────

export async function dbLoadAllOrgs(): Promise<Organization[]> {
  const { data, error } = await supabase.from("organizations").select("data");
  if (error) {
    console.error("[db] load organizations:", error.message);
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => row.data as Organization);
}

export async function dbLoadOrg(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase.from("organizations").select("data").eq("id", orgId).maybeSingle();
  if (error) {
    console.error("[db] load organization:", error.message);
    throw new Error(error.message);
  }
  if (!data) return null;
  return data.data as Organization;
}

export async function dbUpsertOrg(orgId: string, org: Organization): Promise<void> {
  const { error } = await supabase.from("organizations").upsert([{ id: orgId, data: org }], { defaultToNull: false });
  if (error) {
    console.error("[db] upsert organization:", error.message);
    throw new Error(error.message);
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const BUCKET = "project-files";

export async function dbUploadFile(orgId: string, path: string, file: File): Promise<void> {
  const fullPath = `${orgId}/${path}`;
  const { error } = await supabase.storage.from(BUCKET).upload(fullPath, file, { upsert: true });
  if (error) throw new Error(error.message);
}

export async function dbGetFileUrl(orgId: string, path: string): Promise<string> {
  const fullPath = `${orgId}/${path}`;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
  return data.publicUrl;
}

export async function dbDeleteFile(orgId: string, path: string): Promise<void> {
  const fullPath = `${orgId}/${path}`;
  const { error } = await supabase.storage.from(BUCKET).remove([fullPath]);
  if (error) {
    console.error("[db] delete file:", error.message);
    throw new Error(error.message);
  }
}
