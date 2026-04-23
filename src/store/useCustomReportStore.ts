import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "./useAuthStore";
import type { CustomReport } from "@/lib/itsm/types/custom-report.types";

const TABLE = "custom_reports";

interface CustomReportState {
  reports:  CustomReport[];
  loading:  boolean;
  load:     () => Promise<void>;
  save:     (report: CustomReport) => Promise<void>;
  remove:   (id: string) => Promise<void>;
}

export const useCustomReportStore = create<CustomReportState>()((set, get) => ({
  reports: [],
  loading: false,

  load: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ loading: true });
    const { data, error } = await supabase
      .from(TABLE)
      .select("data")
      .eq("org_id", user.orgId);
    if (error) { console.error("[customReports] load:", error.message); set({ loading: false }); return; }
    set({ reports: (data ?? []).map((r) => r.data as CustomReport), loading: false });
  },

  save: async (report) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { error } = await supabase
      .from(TABLE)
      .upsert([{ id: report.id, org_id: user.orgId, created_by: user.id, data: report }], { defaultToNull: false });
    if (error) { console.error("[customReports] save:", error.message); throw new Error(error.message); }
    const existing = get().reports.find((r) => r.id === report.id);
    if (existing) {
      set((s) => ({ reports: s.reports.map((r) => r.id === report.id ? report : r) }));
    } else {
      set((s) => ({ reports: [...s.reports, report] }));
    }
  },

  remove: async (id) => {
    const rollback = get().reports.find((r) => r.id === id);
    set((s) => ({ reports: s.reports.filter((r) => r.id !== id) }));
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      if (rollback) set((s) => ({ reports: [...s.reports, rollback] }));
      throw new Error(error.message);
    }
  },
}));
