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
  updateEntry: (id: string, data: Partial<ActivityEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  submitEntry: (id: string) => Promise<void>;
  approveEntry: (id: string, reviewerId: string) => Promise<void>;
  rejectEntry: (id: string, reviewerId: string, note?: string) => Promise<void>;
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

  updateEntry: async (id, patch) => {
    const rollback = get().entries.find((e) => e.id === id);
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
      ),
    }));
    try {
      const updated = await updateActivity(id, patch, get().entries);
      if (updated) set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
    } catch (err) {
      if (rollback) set((s) => ({ entries: s.entries.map((e) => (e.id === id ? rollback : e)) }));
      throw err;
    }
  },

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

  submitEntry: async (id) => {
    const rollback = get().entries.find((e) => e.id === id);
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === id
          ? { ...e, status: "submitted" as const, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : e
      ),
    }));
    try {
      const updated = await submitActivity(id, get().entries);
      if (updated) set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
    } catch (err) {
      if (rollback) set((s) => ({ entries: s.entries.map((e) => (e.id === id ? rollback : e)) }));
      throw err;
    }
  },

  approveEntry: async (id, reviewerId) => {
    const rollback = get().entries.find((e) => e.id === id);
    const now = new Date().toISOString();
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === id
          ? { ...e, status: "approved" as const, reviewedBy: reviewerId, reviewedAt: now, updatedAt: now }
          : e
      ),
    }));
    try {
      const updated = await approveActivity(id, reviewerId, get().entries);
      if (updated) set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
    } catch (err) {
      if (rollback) set((s) => ({ entries: s.entries.map((e) => (e.id === id ? rollback : e)) }));
      throw err;
    }
  },

  rejectEntry: async (id, reviewerId, note) => {
    const rollback = get().entries.find((e) => e.id === id);
    const now = new Date().toISOString();
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === id
          ? { ...e, status: "rejected" as const, reviewedBy: reviewerId, reviewedAt: now, rejectionNote: note, updatedAt: now }
          : e
      ),
    }));
    try {
      const updated = await rejectActivity(id, reviewerId, get().entries, note);
      if (updated) set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
    } catch (err) {
      if (rollback) set((s) => ({ entries: s.entries.map((e) => (e.id === id ? rollback : e)) }));
      throw err;
    }
  },
}));
