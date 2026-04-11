import type { GovernanceItem } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete } from "@/lib/db";

export async function loadGovernanceItems(): Promise<GovernanceItem[]> {
  return dbLoadAll<GovernanceItem>("governance_items");
}

export async function createGovernanceItem(item: GovernanceItem, orgId: string): Promise<void> {
  const normalized: GovernanceItem = { ...item, updatedAt: item.updatedAt ?? item.createdAt };
  await dbUpsert("governance_items", item.id, normalized, orgId);
}

export async function updateGovernanceItem(
  id: string,
  patch: Partial<GovernanceItem>,
  current: GovernanceItem[]
): Promise<GovernanceItem | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  const updated: GovernanceItem = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await dbUpsert("governance_items", id, updated);
  return updated;
}

export async function deleteGovernanceItem(id: string): Promise<void> {
  await dbDelete("governance_items", id);
}

export async function resetGovernanceItems(items: GovernanceItem[], orgId: string): Promise<void> {
  await Promise.all(items.map((i) => dbUpsert("governance_items", i.id, i, orgId)));
}
