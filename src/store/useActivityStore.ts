import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActivityEntry } from "@/types";

interface ActivityState {
  entries: ActivityEntry[];
  addEntry: (entry: ActivityEntry) => void;
  updateEntry: (id: string, data: Partial<ActivityEntry>) => void;
  deleteEntry: (id: string) => void;
  submitEntry: (id: string) => void;
  approveEntry: (id: string, reviewerId: string) => void;
  rejectEntry: (id: string, reviewerId: string, note?: string) => void;
  reset: (entries?: ActivityEntry[]) => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (entry) =>
        set((s) => ({ entries: [entry, ...s.entries] })),

      updateEntry: (id, data) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e
          ),
        })),

      deleteEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      submitEntry: (id) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? { ...e, status: "submitted", submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
              : e
          ),
        })),

      approveEntry: (id, reviewerId) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? { ...e, status: "approved", reviewedBy: reviewerId, reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
              : e
          ),
        })),

      rejectEntry: (id, reviewerId, note) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? { ...e, status: "rejected", reviewedBy: reviewerId, reviewedAt: new Date().toISOString(), rejectionNote: note, updatedAt: new Date().toISOString() }
              : e
          ),
        })),

      reset: (entries = []) => set({ entries }),
    }),
    {
      name: "activity-storage",
      skipHydration: true,
    }
  )
);
