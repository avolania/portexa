import { create } from "zustand";
import type { GovernanceItem, GovernanceCategory, GovernanceStatus } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  loadGovernanceItems,
  createGovernanceItem,
  updateGovernanceItem,
  deleteGovernanceItem,
  resetGovernanceItems,
} from "@/services/governanceService";

interface GovernanceState {
  items: GovernanceItem[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  reset: (items: GovernanceItem[]) => void;
  addItem: (item: GovernanceItem) => Promise<void>;
  updateItem: (id: string, data: Partial<GovernanceItem>) => void;
  deleteItem: (id: string) => Promise<void>;
  getProjectItems: (projectId: string, category?: GovernanceCategory) => GovernanceItem[];
}

export const useGovernanceStore = create<GovernanceState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const items = await loadGovernanceItems();
      set({ items, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Yüklenemedi" });
    }
  },

  reset: (items) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set({ items });
    resetGovernanceItems(items, orgId);
  },

  addItem: async (item) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ items: [...s.items, item] }));
    try {
      await createGovernanceItem(item, orgId);
    } catch (err) {
      set((s) => ({ items: s.items.filter((i) => i.id !== item.id) }));
      throw err;
    }
  },

  updateItem: (id, patch) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => {
      updateGovernanceItem(id, patch, s.items, orgId).then((updated) => {
        if (updated) set((s2) => ({ items: s2.items.map((i) => (i.id === id ? updated : i)) }));
      });
      return { items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
    });
  },

  deleteItem: async (id) => {
    const rollback = get().items.find((i) => i.id === id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    try {
      await deleteGovernanceItem(id);
    } catch (err) {
      if (rollback) set((s) => ({ items: [...s.items, rollback] }));
      throw err;
    }
  },

  getProjectItems: (projectId, category) =>
    get().items.filter(
      (i) => i.projectId === projectId && (!category || i.category === category)
    ),
}));

export const GOVERNANCE_STATUS_META: Record<GovernanceStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: "Taslak",     color: "text-gray-600",    bg: "bg-gray-100"    },
  pending:   { label: "Bekliyor",   color: "text-amber-700",   bg: "bg-amber-100"   },
  approved:  { label: "Onaylandı",  color: "text-emerald-700", bg: "bg-emerald-100" },
  rejected:  { label: "Reddedildi", color: "text-red-700",     bg: "bg-red-100"     },
  closed:    { label: "Kapatıldı",  color: "text-gray-500",    bg: "bg-gray-100"    },
  open:      { label: "Açık",       color: "text-blue-700",    bg: "bg-blue-100"    },
  mitigated: { label: "Azaltıldı",  color: "text-cyan-700",    bg: "bg-cyan-100"    },
  scheduled: { label: "Planlandı",  color: "text-violet-700",  bg: "bg-violet-100"  },
  completed: { label: "Tamamlandı", color: "text-emerald-700", bg: "bg-emerald-100" },
};
