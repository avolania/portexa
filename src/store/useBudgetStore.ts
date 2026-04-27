import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "./useAuthStore";

export interface Expense {
  id:          string;
  projectId:   string;
  category:    string;
  description: string;
  amount:      number;
  date:        string; // YYYY-MM-DD
}

const TABLE = "budget_expenses";

interface BudgetState {
  expenses: Expense[];
  loading:  boolean;
  load:     () => Promise<void>;
  add:      (expense: Expense) => Promise<void>;
  remove:   (id: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetState>()((set, get) => ({
  expenses: [],
  loading:  false,

  load: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ loading: true });
    const { data, error } = await supabase
      .from(TABLE)
      .select("data")
      .eq("org_id", user.orgId);
    if (error) {
      console.error("[budget] load:", error.message);
      set({ loading: false });
      return;
    }
    set({ expenses: (data ?? []).map((r) => r.data as Expense), loading: false });
  },

  add: async (expense) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set((s) => ({ expenses: [expense, ...s.expenses] }));
    const { error } = await supabase
      .from(TABLE)
      .upsert([{ id: expense.id, org_id: user.orgId, data: expense }], { defaultToNull: false });
    if (error) {
      set((s) => ({ expenses: s.expenses.filter((e) => e.id !== expense.id) }));
      throw new Error(error.message);
    }
  },

  remove: async (id) => {
    const rollback = get().expenses.find((e) => e.id === id);
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      if (rollback) set((s) => ({ expenses: [rollback, ...s.expenses] }));
      throw new Error(error.message);
    }
  },
}));
