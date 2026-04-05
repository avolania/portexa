import { supabase } from "./supabase";
import type { User, Organization } from "@/types";

// ─── Generic helpers ──────────────────────────────────────────────────────────

export async function dbLoadAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("data");
  if (error) { console.error(`[db] load ${table}:`, error.message); return []; }
  return (data ?? []).map((row) => row.data as T);
}

export async function dbUpsert(table: string, id: string, data: unknown, orgId?: string): Promise<void> {
  const row = orgId ? { id, data, org_id: orgId } : { id, data };
  const { error } = await supabase.from(table).upsert([row], { defaultToNull: false });
  if (error) {
    console.error(`[db] upsert ${table}:`, error.message);
    throw new Error(error.message);
  }
}

export async function dbDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) console.error(`[db] delete ${table}:`, error.message);
}

// ─── Auth profiles (keyed by userId) ─────────────────────────────────────────

export async function dbLoadProfiles(orgId?: string): Promise<Record<string, User>> {
  const { data, error } = await supabase.from("auth_profiles").select("id, data");
  if (error) { console.error("[db] load auth_profiles:", error.message); return {}; }
  const result: Record<string, User> = {};
  for (const row of data ?? []) {
    const user = row.data as User;
    if (!orgId || user.orgId === orgId) result[row.id] = user;
  }
  return result;
}

export async function dbLoadProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from("auth_profiles").select("data").eq("id", userId).single();
  if (error || !data) return null;
  return data.data as User;
}

export async function dbUpsertProfile(userId: string, data: unknown): Promise<void> {
  const { error } = await supabase.from("auth_profiles").upsert([{ id: userId, data }], { defaultToNull: false });
  if (error) console.error("[db] upsert auth_profiles:", error.message);
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
  if (error) { console.error("[db] load organizations:", error.message); return []; }
  return (data ?? []).map((row) => row.data as Organization);
}

export async function dbLoadOrg(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase.from("organizations").select("data").eq("id", orgId).maybeSingle();
  if (error) { console.error("[db] load organization:", error.message); return null; }
  if (!data) return null;
  return data.data as Organization;
}

export async function dbUpsertOrg(orgId: string, org: Organization): Promise<void> {
  const { error } = await supabase.from("organizations").upsert([{ id: orgId, data: org }], { defaultToNull: false });
  if (error) console.error("[db] upsert organization:", error.message);
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const BUCKET = "project-files";

export async function dbUploadFile(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
}

export async function dbGetFileUrl(path: string): Promise<string> {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function dbDeleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error("[db] delete file:", error.message);
}
