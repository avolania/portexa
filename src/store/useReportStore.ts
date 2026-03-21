import { create } from "zustand";
import type { Report, ReportType } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete } from "@/lib/db";

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
    const reports = await dbLoadAll<Report>("reports");
    set({ reports });
  },

  reset: (reports) => {
    set({ reports });
    reports.forEach((r) => dbUpsert("reports", r.id, r));
  },

  addReport: (report) => {
    set((s) => ({ reports: [report, ...s.reports] }));
    dbUpsert("reports", report.id, report);
  },

  updateReport: (id, data) =>
    set((s) => {
      const reports = s.reports.map((r) =>
        r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r
      );
      const updated = reports.find((r) => r.id === id);
      if (updated) dbUpsert("reports", id, updated);
      return { reports };
    }),

  updateSection: (reportId, sectionId, content) =>
    set((s) => {
      const reports = s.reports.map((r) =>
        r.id === reportId
          ? {
              ...r,
              updatedAt: new Date().toISOString(),
              sections: r.sections.map((sec) =>
                sec.id === sectionId ? { ...sec, content } : sec
              ),
            }
          : r
      );
      const updated = reports.find((r) => r.id === reportId);
      if (updated) dbUpsert("reports", reportId, updated);
      return { reports };
    }),

  deleteReport: (id) => {
    set((s) => ({ reports: s.reports.filter((r) => r.id !== id) }));
    dbDelete("reports", id);
  },

  getByType: (type) => get().reports.filter((r) => r.type === type),
}));
