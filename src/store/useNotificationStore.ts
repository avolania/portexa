import { create } from "zustand";
import type { Notification } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  loadNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  resetNotifications,
} from "@/services/notificationService";

interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  reset: (notifications: Notification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Notification) => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const notifications = await loadNotifications();
      set({ notifications, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Yüklenemedi" });
    }
  },

  reset: (notifications) => {
    set({ notifications });
    resetNotifications(notifications);
  },

  markAsRead: (id) =>
    set((s) => {
      markNotificationRead(id, s.notifications).then((updated) => {
        if (updated)
          set((s2) => ({
            notifications: s2.notifications.map((n) => (n.id === id ? updated : n)),
          }));
      });
      return {
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      };
    }),

  markAllAsRead: () =>
    set((s) => {
      markAllNotificationsRead(s.notifications).then((updated) => {
        set({ notifications: updated });
      });
      return { notifications: s.notifications.map((n) => ({ ...n, read: true })) };
    }),

  addNotification: (notification) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ notifications: [notification, ...s.notifications] }));
    createNotification(notification, orgId);
  },

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
