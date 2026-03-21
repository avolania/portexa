import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Report, ReportSection, ReportStatus, ReportType } from "@/types";

interface ReportState {
  reports: Report[];
  addReport: (report: Report) => void;
  updateReport: (id: string, data: Partial<Report>) => void;
  updateSection: (reportId: string, sectionId: string, content: string) => void;
  deleteReport: (id: string) => void;
  getByType: (type: ReportType) => Report[];
  reset: (reports: Report[]) => void;
}

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: [],
      addReport: (report) =>
        set((state) => ({ reports: [report, ...state.reports] })),
      updateReport: (id, data) =>
        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r
          ),
        })),
      updateSection: (reportId, sectionId, content) =>
        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === reportId
              ? {
                  ...r,
                  updatedAt: new Date().toISOString(),
                  sections: r.sections.map((s) =>
                    s.id === sectionId ? { ...s, content } : s
                  ),
                }
              : r
          ),
        })),
      deleteReport: (id) =>
        set((state) => ({ reports: state.reports.filter((r) => r.id !== id) })),
      getByType: (type) => get().reports.filter((r) => r.type === type),
      reset: (reports) => set({ reports }),
    }),
    { name: "report-storage", partialize: (state) => ({ reports: state.reports }) }
  )
);
