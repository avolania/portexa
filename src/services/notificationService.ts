import type { Notification } from "@/types";
import { dbLoadAll, dbUpsert, dbBatchUpsert } from "@/lib/db";

export async function loadNotifications(): Promise<Notification[]> {
  return dbLoadAll<Notification>("notifications");
}

export async function createNotification(notification: Notification, orgId: string): Promise<void> {
  await dbUpsert("notifications", notification.id, notification, orgId);
}

export async function markNotificationRead(
  id: string,
  current: Notification[]
): Promise<Notification | null> {
  const existing = current.find((n) => n.id === id);
  if (!existing) return null;
  const updated: Notification = { ...existing, read: true };
  await dbUpsert("notifications", id, updated);
  return updated;
}

export async function markAllNotificationsRead(
  current: Notification[]
): Promise<Notification[]> {
  const updated = current.map((n) => ({ ...n, read: true }));
  // M-4: tek batch upsert — N+1 yerine tek DB isteği
  await dbBatchUpsert(
    "notifications",
    updated.map((n) => ({ id: n.id, data: n })),
  );
  return updated;
}

export async function resetNotifications(notifications: Notification[]): Promise<void> {
  await Promise.all(notifications.map((n) => dbUpsert("notifications", n.id, n)));
}
