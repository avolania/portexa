import type { ActivityEntry } from "@/types";
import { dbLoadAll, dbLoadFiltered, dbUpsert, dbDelete } from "@/lib/db";

export async function loadActivities(orgId?: string): Promise<ActivityEntry[]> {
  if (!orgId) return dbLoadAll<ActivityEntry>("activity_entries");
  return dbLoadFiltered<ActivityEntry>("activity_entries", orgId);
}

export async function createActivity(entry: ActivityEntry, orgId: string): Promise<void> {
  await dbUpsert("activity_entries", entry.id, entry, orgId);
}

export async function updateActivity(
  id: string,
  patch: Partial<ActivityEntry>,
  current: ActivityEntry[]
): Promise<ActivityEntry | null> {
  const existing = current.find((e) => e.id === id);
  if (!existing) return null;
  const updated: ActivityEntry = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await dbUpsert("activity_entries", id, updated);
  return updated;
}

export async function deleteActivity(id: string): Promise<void> {
  await dbDelete("activity_entries", id);
}

export async function submitActivity(
  id: string,
  current: ActivityEntry[]
): Promise<ActivityEntry | null> {
  return updateActivity(
    id,
    { status: "submitted", submittedAt: new Date().toISOString() },
    current
  );
}

export async function approveActivity(
  id: string,
  reviewerId: string,
  current: ActivityEntry[]
): Promise<ActivityEntry | null> {
  const now = new Date().toISOString();
  return updateActivity(id, { status: "approved", reviewedBy: reviewerId, reviewedAt: now }, current);
}

export async function rejectActivity(
  id: string,
  reviewerId: string,
  current: ActivityEntry[],
  note?: string
): Promise<ActivityEntry | null> {
  const now = new Date().toISOString();
  return updateActivity(
    id,
    { status: "rejected", reviewedBy: reviewerId, reviewedAt: now, rejectionNote: note },
    current
  );
}

export async function resetActivities(entries: ActivityEntry[], orgId: string): Promise<void> {
  await Promise.all(entries.map((e) => dbUpsert("activity_entries", e.id, e, orgId)));
}
