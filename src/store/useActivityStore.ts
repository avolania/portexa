import { create } from "zustand";
import type { ActivityEntry } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete } from "@/lib/db";

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
    const entries = await dbLoadAll<ActivityEntry>("activity_entries");
    set({ entries });
  },

  reset: (entries = []) => {
    set({ entries });
    entries.forEach((e) => dbUpsert("activity_entries", e.id, e));
  },

  addEntry: (entry) => {
    set((s) => ({ entries: [entry, ...s.entries] }));
    dbUpsert("activity_entries", entry.id, entry);
  },

  updateEntry: (id, data) =>
    set((s) => {
      const entries = s.entries.map((e) =>
        e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e
      );
      const updated = entries.find((e) => e.id === id);
      if (updated) dbUpsert("activity_entries", id, updated);
      return { entries };
    }),

  deleteEntry: (id) => {
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    dbDelete("activity_entries", id);
  },

  submitEntry: (id) =>
    set((s) => {
      const entries = s.entries.map((e) =>
        e.id === id
          ? { ...e, status: "submitted" as const, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : e
      );
      const updated = entries.find((e) => e.id === id);
      if (updated) dbUpsert("activity_entries", id, updated);
      return { entries };
    }),

  approveEntry: (id, reviewerId) =>
    set((s) => {
      const now = new Date().toISOString();
      const entries = s.entries.map((e) =>
        e.id === id
          ? { ...e, status: "approved" as const, reviewedBy: reviewerId, reviewedAt: now, updatedAt: now }
          : e
      );
      const updated = entries.find((e) => e.id === id);
      if (updated) dbUpsert("activity_entries", id, updated);
      return { entries };
    }),

  rejectEntry: (id, reviewerId, note) =>
    set((s) => {
      const now = new Date().toISOString();
      const entries = s.entries.map((e) =>
        e.id === id
          ? { ...e, status: "rejected" as const, reviewedBy: reviewerId, reviewedAt: now, rejectionNote: note, updatedAt: now }
          : e
      );
      const updated = entries.find((e) => e.id === id);
      if (updated) dbUpsert("activity_entries", id, updated);
      return { entries };
    }),
}));
