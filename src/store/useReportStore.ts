import { create } from "zustand";
import type { Report, ReportType } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  loadReports,
  createReport,
  updateReport,
  updateReportSection,
  deleteReport,
  resetReports,
} from "@/services/reportService";

interface ReportState {
  reports: Report[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  addReport: (report: Report) => Promise<void>;
  updateReport: (id: string, data: Partial<Report>) => Promise<void>;
  updateSection: (reportId: string, sectionId: string, content: string) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  getByType: (type: ReportType) => Report[];
  reset: (reports: Report[]) => void;
}

export const useReportStore = create<ReportState>()((set, get) => ({
  reports: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const reports = await loadReports();
      set({ reports, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Yüklenemedi" });
    }
  },

  reset: (reports) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set({ reports });
    resetReports(reports, orgId);
  },

  addReport: async (report) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ reports: [report, ...s.reports] }));
    try {
      await createReport(report, orgId);
    } catch (err) {
      set((s) => ({ reports: s.reports.filter((r) => r.id !== report.id) }));
      throw err;
    }
  },

  updateReport: async (id, patch) => {
    const rollback = get().reports.find((r) => r.id === id);
    set((s) => ({
      reports: s.reports.map((r) =>
        r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
      ),
    }));
    try {
      const updated = await updateReport(id, patch, get().reports);
      if (updated) set((s) => ({ reports: s.reports.map((r) => (r.id === id ? updated : r)) }));
    } catch (err) {
      if (rollback) set((s) => ({ reports: s.reports.map((r) => (r.id === id ? rollback : r)) }));
      throw err;
    }
  },

  updateSection: async (reportId, sectionId, content) => {
    const rollback = get().reports.find((r) => r.id === reportId);
    set((s) => ({
      reports: s.reports.map((r) =>
        r.id === reportId
          ? {
              ...r,
              updatedAt: new Date().toISOString(),
              sections: r.sections.map((sec) =>
                sec.id === sectionId ? { ...sec, content } : sec
              ),
            }
          : r
      ),
    }));
    try {
      const updated = await updateReportSection(reportId, sectionId, content, get().reports);
      if (updated) set((s) => ({ reports: s.reports.map((r) => (r.id === reportId ? updated : r)) }));
    } catch (err) {
      if (rollback) set((s) => ({ reports: s.reports.map((r) => (r.id === reportId ? rollback : r)) }));
      throw err;
    }
  },

  deleteReport: async (id) => {
    const rollback = get().reports.find((r) => r.id === id);
    set((s) => ({ reports: s.reports.filter((r) => r.id !== id) }));
    try {
      await deleteReport(id);
    } catch (err) {
      if (rollback) set((s) => ({ reports: [...s.reports, rollback] }));
      throw err;
    }
  },

  getByType: (type) => get().reports.filter((r) => r.type === type),
}));
