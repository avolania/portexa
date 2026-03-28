import { supabase } from "./supabase";
import type { User } from "@/types";

// ─── Generic helpers ──────────────────────────────────────────────────────────

export async function dbLoadAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("data");
  if (error) { console.error(`[db] load ${table}:`, error.message); return []; }
  return (data ?? []).map((row) => row.data as T);
}

export async function dbUpsert(table: string, id: string, data: unknown, orgId?: string): Promise<void> {
  const row = orgId ? { id, data, org_id: orgId } : { id, data };
  const { error } = await supabase.from(table).upsert([row], { defaultToNull: false });
  if (error) console.error(`[db] upsert ${table}:`, error.message);
}

export async function dbDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) console.error(`[db] delete ${table}:`, error.message);
}

// ─── Auth profiles (keyed by userId) ─────────────────────────────────────────

export async function dbLoadProfiles(): Promise<Record<string, User>> {
  const { data, error } = await supabase.from("auth_profiles").select("id, data");
  if (error) { console.error("[db] load auth_profiles:", error.message); return {}; }
  const result: Record<string, User> = {};
  for (const row of data ?? []) result[row.id] = row.data as User;
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
