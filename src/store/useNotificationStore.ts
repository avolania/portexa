import { create } from "zustand";
import type { Notification } from "@/types";
import { dbLoadAll, dbUpsert } from "@/lib/db";

interface NotificationState {
  notifications: Notification[];
  load: () => Promise<void>;
  reset: (notifications: Notification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Notification) => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],

  load: async () => {
    const notifications = await dbLoadAll<Notification>("notifications");
    set({ notifications });
  },

  reset: (notifications) => {
    set({ notifications });
    notifications.forEach((n) => dbUpsert("notifications", n.id, n));
  },

  markAsRead: (id) =>
    set((s) => {
      const notifications = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      const updated = notifications.find((n) => n.id === id);
      if (updated) dbUpsert("notifications", id, updated);
      return { notifications };
    }),

  markAllAsRead: () =>
    set((s) => {
      const notifications = s.notifications.map((n) => ({ ...n, read: true }));
      notifications.forEach((n) => dbUpsert("notifications", n.id, n));
      return { notifications };
    }),

  addNotification: (notification) => {
    set((s) => ({ notifications: [notification, ...s.notifications] }));
    dbUpsert("notifications", notification.id, notification);
  },

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
