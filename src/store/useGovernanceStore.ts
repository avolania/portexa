import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GovernanceItem, GovernanceCategory, GovernanceStatus } from "@/types";

interface GovernanceState {
  items: GovernanceItem[];
  reset: (items: GovernanceItem[]) => void;
  addItem: (item: GovernanceItem) => void;
  updateItem: (id: string, data: Partial<GovernanceItem>) => void;
  deleteItem: (id: string) => void;
  getProjectItems: (projectId: string, category?: GovernanceCategory) => GovernanceItem[];
}

export const useGovernanceStore = create<GovernanceState>()(
  persist(
    (set, get) => ({
      items: [],
      reset: (items) => set({ items }),
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      updateItem: (id, data) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, ...data } : i)),
        })),
      deleteItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      getProjectItems: (projectId, category) =>
        get().items.filter(
          (i) => i.projectId === projectId && (!category || i.category === category)
        ),
    }),
    { name: "governance-storage", skipHydration: true, partialize: (state) => ({ items: state.items }) }
  )
);

export const GOVERNANCE_STATUS_META: Record<GovernanceStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: "Taslak",     color: "text-gray-600",   bg: "bg-gray-100" },
  pending:   { label: "Bekliyor",   color: "text-amber-700",  bg: "bg-amber-100" },
  approved:  { label: "Onaylandı",  color: "text-emerald-700", bg: "bg-emerald-100" },
  rejected:  { label: "Reddedildi", color: "text-red-700",    bg: "bg-red-100" },
  closed:    { label: "Kapatıldı",  color: "text-gray-500",   bg: "bg-gray-100" },
  open:      { label: "Açık",       color: "text-blue-700",   bg: "bg-blue-100" },
  mitigated: { label: "Azaltıldı",  color: "text-cyan-700",   bg: "bg-cyan-100" },
  scheduled: { label: "Planlandı",  color: "text-violet-700", bg: "bg-violet-100" },
  completed: { label: "Tamamlandı", color: "text-emerald-700", bg: "bg-emerald-100" },
};
