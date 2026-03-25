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
  load: () => Promise<void>;
  addEntry: (entry: ActivityEntry) => void;
  updateEntry: (id: string, data: Partial<ActivityEntry>) => void;
  deleteEntry: (id: string) => void;
  submitEntry: (id: string) => void;
  approveEntry: (id: string, reviewerId: string) => void;
  rejectEntry: (id: string, reviewerId: string, note?: string) => void;
  reset: (entries?: ActivityEntry[]) => void;
}

export const useActivityStore = create<ActivityState>()((set) => ({
  entries: [],

  load: async () => {
    const entries = await loadActivities();
    set({ entries });
  },

  reset: (entries = []) => {
    set({ entries });
    resetActivities(entries);
  },

  addEntry: (entry) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ entries: [entry, ...s.entries] }));
    createActivity(entry, orgId);
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

  deleteEntry: (id) => {
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    deleteActivity(id);
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
