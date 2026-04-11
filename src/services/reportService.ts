import type { Report } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete } from "@/lib/db";

export async function loadReports(): Promise<Report[]> {
  return dbLoadAll<Report>("reports");
}

export async function createReport(report: Report, orgId: string): Promise<void> {
  await dbUpsert("reports", report.id, report, orgId);
}

export async function updateReport(
  id: string,
  patch: Partial<Report>,
  current: Report[]
): Promise<Report | null> {
  const existing = current.find((r) => r.id === id);
  if (!existing) return null;
  const updated: Report = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await dbUpsert("reports", id, updated);
  return updated;
}

export async function updateReportSection(
  reportId: string,
  sectionId: string,
  content: string,
  current: Report[]
): Promise<Report | null> {
  const existing = current.find((r) => r.id === reportId);
  if (!existing) return null;
  const updated: Report = {
    ...existing,
    updatedAt: new Date().toISOString(),
    sections: existing.sections.map((s) =>
      s.id === sectionId ? { ...s, content } : s
    ),
  };
  await dbUpsert("reports", reportId, updated);
  return updated;
}

export async function deleteReport(id: string): Promise<void> {
  await dbDelete("reports", id);
}

export async function resetReports(reports: Report[], orgId: string): Promise<void> {
  await Promise.all(reports.map((r) => dbUpsert("reports", r.id, r, orgId)));
}
