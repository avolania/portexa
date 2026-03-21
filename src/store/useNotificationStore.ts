import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Notification } from "@/types";

interface NotificationState {
  notifications: Notification[];
  reset: (notifications: Notification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Notification) => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      reset: (notifications) => set({ notifications }),
      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
        })),
      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    { name: "notification-storage", partialize: (state) => ({ notifications: state.notifications }) }
  )
);
