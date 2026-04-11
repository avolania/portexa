import type { Report } from "@/types";
import { supabase } from "@/lib/supabase";

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

// ─── PDF Export (server-side API route kullanır) ──────────────────────────────

export async function exportReportPDF(
  report: Report,
  projectName: string,
  stats: {
    progress: number;
    status: string;
    done: number;
    inProg: number;
    todo: number;
    openRisks: number;
    openIssues: number;
    overdue: number;
    budget?: number;
    budgetUsed?: number;
  }
): Promise<void> {
  const res = await fetch("/api/reports/export-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
    body: JSON.stringify({ report, projectName, stats }),
  });
  if (!res.ok) throw new Error("PDF oluşturulamadı");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.title}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PowerPoint Export (server-side API route kullanır) ──────────────────────

export async function exportReportPPTX(
  report: Report,
  projectName: string,
  stats: {
    progress: number;
    status: string;
    done: number;
    inProg: number;
    todo: number;
    openRisks: number;
    openIssues: number;
    overdue: number;
    budget?: number;
    budgetUsed?: number;
  }
): Promise<void> {
  const res = await fetch("/api/reports/export-pptx", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
    body: JSON.stringify({ report, projectName, stats }),
  });
  if (!res.ok) throw new Error("PPTX oluşturulamadı");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.title}.pptx`;
  a.click();
  URL.revokeObjectURL(url);
}

