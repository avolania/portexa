import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import type { Report, ReportStatus, Project, Task, GovernanceItem } from "@/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const RAG_LABEL: Record<ReportStatus, string> = {
  green: "Yolunda",
  amber: "Dikkat",
  red:   "Risk",
};

const RAG_RGB: Record<ReportStatus, [number, number, number]> = {
  green: [16, 185, 129],
  amber: [245, 158, 11],
  red:   [239, 68, 68],
};

function formatPeriod(period: string, type: string): string {
  if (type === "weekly" && period.includes("W")) {
    const [year, w] = period.split("-W");
    return `${year} / ${w}. Hafta`;
  }
  if (period.match(/\d{4}-\d{2}/)) {
    const [year, month] = period.split("-");
    const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    return `${months[parseInt(month) - 1]} ${year}`;
  }
  return period;
}

function slideFooter(pdf: jsPDF, projectName: string, report: Report, W: number, H: number, idx: number, total: number) {
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.3);
  pdf.line(14, H - 14, W - 14, H - 14);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(156, 163, 175);
  pdf.text(`${projectName} · ${formatPeriod(report.period, report.type)}`, 16, H - 7);
  pdf.text("Pixanto PPM", W / 2, H - 7, { align: "center" });
  if (idx > 0) pdf.text(`${idx} / ${total}`, W - 14, H - 7, { align: "right" });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rapor içeriği istemciden alınmaz — sadece hangi proje+dönem olduğu alınır
  const body = await req.json() as { projectId: string; period: string };
  const { projectId, period } = body;
  if (!projectId || !period) {
    return NextResponse.json({ error: "projectId ve period zorunludur" }, { status: 400 });
  }

  // Kullanıcının org_id'sini çek
  const { data: userProfile } = await supabaseAdmin
    .from("auth_profiles").select("org_id").eq("id", user.id).single();
  if (!userProfile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userOrgId = userProfile.org_id as string;

  // Projeyi çek ve org_id kontrolü yap
  const { data: projectRow } = await supabaseAdmin
    .from("projects").select("data, org_id").eq("id", projectId).single();
  if (!projectRow) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  if ((projectRow.org_id as string) !== userOrgId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const project = projectRow.data as Project;

  // Raporu DB'den çek (projectId + period eşleşmesi)
  const { data: reportRows } = await supabaseAdmin
    .from("reports")
    .select("data")
    .eq("org_id", userOrgId)
    .filter("data->>'projectId'", "eq", projectId)
    .filter("data->>'period'", "eq", period)
    .limit(1);
  const report = reportRows?.[0]?.data as Report | undefined;
  if (!report) return NextResponse.json({ error: "Rapor bulunamadı" }, { status: 404 });

  // İstatistikleri DB'den hesapla
  const [taskRows, govRows] = await Promise.all([
    supabaseAdmin.from("tasks").select("data").eq("org_id", userOrgId)
      .filter("data->>'projectId'", "eq", projectId),
    supabaseAdmin.from("governance_items").select("data").eq("org_id", userOrgId)
      .filter("data->>'projectId'", "eq", projectId),
  ]);

  const now = new Date();
  const tasks = ((taskRows.data ?? []).map((r) => r.data)) as Task[];
  const govItems = ((govRows.data ?? []).map((r) => r.data)) as GovernanceItem[];

  const projectName = project.name;
  const stats = {
    progress:   project.progress ?? 0,
    status:     project.status ?? "active",
    done:       tasks.filter((t) => t.status === "done").length,
    inProg:     tasks.filter((t) => t.status === "in_progress").length,
    todo:       tasks.filter((t) => t.status === "todo").length,
    overdue:    tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done").length,
    openRisks:  govItems.filter((g) => g.category === "risk"  && g.status === "open").length,
    openIssues: govItems.filter((g) => g.category === "issue" && g.status === "open").length,
    budget:     project.budget,
    budgetUsed: project.budgetUsed,
  };

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;
  const NAVY: [number, number, number]   = [26, 45, 90];
  const INDIGO: [number, number, number] = [79, 70, 229];
  const LIGHT: [number, number, number]  = [248, 250, 252];
  const [rS, gS, bS] = RAG_RGB[report.status];

  // ── Slide 1: Kapak ──────────────────────────────────────────────────────────
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, W, H, "F");
  pdf.setFillColor(...INDIGO);
  pdf.rect(0, 0, W, 4, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(36);
  pdf.setFont("helvetica", "bold");
  pdf.text(projectName, W / 2, 72, { align: "center", maxWidth: W - 40 });

  pdf.setFontSize(20);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(199, 210, 254);
  pdf.text(report.title, W / 2, 94, { align: "center", maxWidth: W - 40 });

  pdf.setFontSize(14);
  pdf.setTextColor(165, 180, 252);
  pdf.text(formatPeriod(report.period, report.type), W / 2, 112, { align: "center" });
  pdf.setFontSize(11);
  pdf.text(new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }), W / 2, 124, { align: "center" });

  pdf.setFillColor(rS, gS, bS);
  pdf.roundedRect(W / 2 - 28, 135, 56, 14, 7, 7, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text(RAG_LABEL[report.status], W / 2, 144, { align: "center" });

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(99, 102, 241);
  pdf.text("Pixanto PPM Platform", 14, H - 8);

  // ── Slide 2: Proje Özeti ────────────────────────────────────────────────────
  pdf.addPage();
  pdf.setFillColor(...LIGHT);
  pdf.rect(0, 0, W, H, "F");
  pdf.setFillColor(...INDIGO);
  pdf.rect(0, 0, W, 4, "F");

  pdf.setTextColor(...NAVY);
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.text("Proje Özeti", 16, 22);
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.5);
  pdf.line(16, 27, W - 16, 27);

  const card = (x: number, y: number, w: number, h: number, label: string, value: string, valueColor: [number, number, number]) => {
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x, y, w, h, 4, 4, "F");
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(107, 114, 128);
    pdf.text(label, x + w / 2, y + 10, { align: "center" });
    pdf.setFontSize(26);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...valueColor);
    pdf.text(value, x + w / 2, y + 26, { align: "center" });
  };

  const statusRgb: [number, number, number] = stats.status === "at_risk" ? [239, 68, 68] : stats.status === "completed" ? [59, 130, 246] : [16, 185, 129];

  card(16,  34, 52, 36, "İlerleme",   `%${stats.progress}`, INDIGO);
  card(74,  34, 52, 36, "Tamamlanan", `${stats.done}`,       [16, 185, 129]);
  card(132, 34, 52, 36, "Devam Eden", `${stats.inProg}`,     INDIGO);
  card(190, 34, 52, 36, "Bekleyen",   `${stats.todo}`,       [107, 114, 128]);
  card(248, 34, 52, 36, "Durum",
    stats.status === "active" ? "Aktif" : stats.status === "at_risk" ? "⚠ Risk" : stats.status === "completed" ? "Tamam" : "Bekl.",
    statusRgb);

  // İlerleme barı
  const barY = 82;
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(16, barY, W - 32, 22, 4, 4, "F");
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...NAVY);
  pdf.text("Tamamlanma Oranı", 22, barY + 8);
  pdf.setFillColor(229, 231, 235);
  pdf.roundedRect(22, barY + 12, W - 52, 6, 3, 3, "F");
  const barW = Math.max(6, ((W - 52) * stats.progress) / 100);
  const barRgb: [number, number, number] = stats.status === "at_risk" ? [239, 68, 68] : INDIGO;
  pdf.setFillColor(...barRgb);
  pdf.roundedRect(22, barY + 12, barW, 6, 3, 3, "F");
  pdf.setFontSize(10);
  pdf.setTextColor(...NAVY);
  pdf.text(`%${stats.progress}`, W - 24, barY + 18, { align: "right" });

  // Risk satırı
  const row2Y = 112;
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(16, row2Y, 88, 44, 4, 4, "F");
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...NAVY);
  pdf.text("Risk & Sorunlar", 22, row2Y + 10);
  [
    { label: "Açık Risk",     value: stats.openRisks,  bad: stats.openRisks > 0 },
    { label: "Açık Sorun",    value: stats.openIssues, bad: stats.openIssues > 0 },
    { label: "Geciken Görev", value: stats.overdue,    bad: stats.overdue > 0 },
  ].forEach((row, i) => {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(107, 114, 128);
    pdf.text(row.label, 22, row2Y + 20 + i * 10);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    const c: [number, number, number] = row.bad ? [239, 68, 68] : [16, 185, 129];
    pdf.setTextColor(...c);
    pdf.text(String(row.value), 96, row2Y + 20 + i * 10, { align: "right" });
  });

  if (stats.budget && stats.budget > 0) {
    const bp = Math.round(((stats.budgetUsed ?? 0) / stats.budget) * 100);
    const bc: [number, number, number] = bp > 90 ? [239, 68, 68] : bp > 75 ? [245, 158, 11] : [16, 185, 129];
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(112, row2Y, W - 128, 44, 4, 4, "F");
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...NAVY);
    pdf.text("Bütçe Kullanımı", 118, row2Y + 10);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(107, 114, 128);
    pdf.text(`${(stats.budgetUsed ?? 0).toLocaleString("tr-TR")} / ${stats.budget.toLocaleString("tr-TR")} TL`, 118, row2Y + 20);
    pdf.setFillColor(229, 231, 235);
    pdf.roundedRect(118, row2Y + 25, W - 148, 7, 3, 3, "F");
    pdf.setFillColor(...bc);
    pdf.roundedRect(118, row2Y + 25, Math.max(4, ((W - 148) * Math.min(bp, 100)) / 100), 7, 3, 3, "F");
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...bc);
    pdf.text(`%${bp}`, W - 24, row2Y + 40, { align: "right" });
  }

  slideFooter(pdf, projectName, report, W, H, 0, report.sections.length);

  // ── Sections ────────────────────────────────────────────────────────────────
  report.sections.forEach((section, idx) => {
    pdf.addPage();
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, W, H, "F");
    pdf.setFillColor(...INDIGO);
    pdf.rect(0, 0, 4, H, "F");
    pdf.setFillColor(...LIGHT);
    pdf.rect(4, 0, W - 4, 12, "F");

    pdf.setTextColor(...NAVY);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(section.label, 16, 22);

    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.5);
    pdf.line(16, 28, W - 16, 28);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.setTextColor(55, 65, 81);
    const lines = pdf.splitTextToSize(section.content || "—", W - 40);
    pdf.text(lines, 16, 40);

    slideFooter(pdf, projectName, report, W, H, idx + 1, report.sections.length);
  });

  const buffer = Buffer.from(pdf.output("arraybuffer"));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(report.title)}.pdf"`,
    },
  });
}
