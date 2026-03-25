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
  load: () => Promise<void>;
  addReport: (report: Report) => void;
  updateReport: (id: string, data: Partial<Report>) => void;
  updateSection: (reportId: string, sectionId: string, content: string) => void;
  deleteReport: (id: string) => void;
  getByType: (type: ReportType) => Report[];
  reset: (reports: Report[]) => void;
}

export const useReportStore = create<ReportState>()((set, get) => ({
  reports: [],

  load: async () => {
    const reports = await loadReports();
    set({ reports });
  },

  reset: (reports) => {
    set({ reports });
    resetReports(reports);
  },

  addReport: (report) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ reports: [report, ...s.reports] }));
    createReport(report, orgId);
  },

  updateReport: (id, patch) =>
    set((s) => {
      updateReport(id, patch, s.reports).then((updated) => {
        if (updated)
          set((s2) => ({ reports: s2.reports.map((r) => (r.id === id ? updated : r)) }));
      });
      return {
        reports: s.reports.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
        ),
      };
    }),

  updateSection: (reportId, sectionId, content) =>
    set((s) => {
      updateReportSection(reportId, sectionId, content, s.reports).then((updated) => {
        if (updated)
          set((s2) => ({
            reports: s2.reports.map((r) => (r.id === reportId ? updated : r)),
          }));
      });
      return {
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
      };
    }),

  deleteReport: (id) => {
    set((s) => ({ reports: s.reports.filter((r) => r.id !== id) }));
    deleteReport(id);
  },

  getByType: (type) => get().reports.filter((r) => r.type === type),
}));
