import { create } from "zustand";
import type { ActivityEntry } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  loadActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  submitActivity,
  approveActivity,
  rejectActivity,
  resetActivities,
} from "@/services/activityService";

interface ActivityState {
  entries: ActivityEntry[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  addEntry: (entry: ActivityEntry) => Promise<void>;
  updateEntry: (id: string, data: Partial<ActivityEntry>) => void;
  deleteEntry: (id: string) => Promise<void>;
  submitEntry: (id: string) => void;
  approveEntry: (id: string, reviewerId: string) => void;
  rejectEntry: (id: string, reviewerId: string, note?: string) => void;
  reset: (entries?: ActivityEntry[]) => void;
}

export const useActivityStore = create<ActivityState>()((set, get) => ({
  entries: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const entries = await loadActivities();
      set({ entries, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Yüklenemedi" });
    }
  },

  reset: (entries = []) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set({ entries });
    resetActivities(entries, orgId);
  },

  addEntry: async (entry) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ entries: [entry, ...s.entries] }));
    try {
      await createActivity(entry, orgId);
    } catch (err) {
      set((s) => ({ entries: s.entries.filter((e) => e.id !== entry.id) }));
      throw err;
    }
  },

  updateEntry: (id, patch) =>
    set((s) => {
      updateActivity(id, patch, s.entries).then((updated) => {
        if (updated)
          set((s2) => ({ entries: s2.entries.map((e) => (e.id === id ? updated : e)) }));
      });
      return {
        entries: s.entries.map((e) =>
          e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
        ),
      };
    }),

  deleteEntry: async (id) => {
    const rollback = get().entries.find((e) => e.id === id);
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    try {
      await deleteActivity(id);
    } catch (err) {
      if (rollback) set((s) => ({ entries: [...s.entries, rollback] }));
      throw err;
    }
  },

  submitEntry: (id) =>
    set((s) => {
      submitActivity(id, s.entries).then((updated) => {
        if (updated)
          set((s2) => ({ entries: s2.entries.map((e) => (e.id === id ? updated : e)) }));
      });
      return {
        entries: s.entries.map((e) =>
          e.id === id
            ? { ...e, status: "submitted" as const, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            : e
        ),
      };
    }),

  approveEntry: (id, reviewerId) =>
    set((s) => {
      approveActivity(id, reviewerId, s.entries).then((updated) => {
        if (updated)
          set((s2) => ({ entries: s2.entries.map((e) => (e.id === id ? updated : e)) }));
      });
      const now = new Date().toISOString();
      return {
        entries: s.entries.map((e) =>
          e.id === id
            ? { ...e, status: "approved" as const, reviewedBy: reviewerId, reviewedAt: now, updatedAt: now }
            : e
        ),
      };
    }),

  rejectEntry: (id, reviewerId, note) =>
    set((s) => {
      rejectActivity(id, reviewerId, s.entries, note).then((updated) => {
        if (updated)
          set((s2) => ({ entries: s2.entries.map((e) => (e.id === id ? updated : e)) }));
      });
      const now = new Date().toISOString();
      return {
        entries: s.entries.map((e) =>
          e.id === id
            ? { ...e, status: "rejected" as const, reviewedBy: reviewerId, reviewedAt: now, rejectionNote: note, updatedAt: now }
            : e
        ),
      };
    }),
}));
