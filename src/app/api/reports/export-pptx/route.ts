import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import type { Report, ReportStatus, Project, Task, GovernanceItem } from "@/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const RAG_LABEL: Record<ReportStatus, string> = {
  green: "Yolunda",
  amber: "Dikkat",
  red:   "Risk",
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

function footer(slide: ReturnType<PptxGenJS["addSlide"]>, pptx: PptxGenJS, projectName: string, report: Report) {
  slide.addShape(pptx.ShapeType.line, { x: 0.3, y: 7.1, w: 9.4, h: 0, line: { color: "e5e7eb", width: 0.5 } });
  slide.addText(`${projectName} · ${formatPeriod(report.period, report.type)}`, { x: 0.3, y: 7.2, w: 5, h: 0.25, fontSize: 8, color: "9ca3af" });
  slide.addText("Pixanto PPM", { x: 4.8, y: 7.2, w: 2, h: 0.25, fontSize: 8, color: "9ca3af", align: "center" });
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

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  const NAVY   = "1a2d5a";
  const INDIGO = "4f46e5";
  const WHITE  = "FFFFFF";
  const LIGHT  = "f8fafc";
  const GRAY   = "6b7280";
  const statusColor = report.status === "green" ? "10b981" : report.status === "amber" ? "f59e0b" : "ef4444";
  const projStatusColor = stats.status === "at_risk" ? "ef4444" : stats.status === "completed" ? "3b82f6" : "10b981";

  // ── Kapak ──────────────────────────────────────────────────────────────────
  const s1 = pptx.addSlide();
  s1.background = { color: NAVY };
  s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.08, fill: { color: INDIGO } });
  s1.addText(projectName, { x: 0.5, y: 1.8, w: "89%", h: 1.0, fontSize: 36, bold: true, color: WHITE, align: "center" });
  s1.addText(report.title, { x: 0.5, y: 2.9, w: "89%", h: 0.6, fontSize: 20, color: "c7d2fe", align: "center" });
  s1.addText(formatPeriod(report.period, report.type), { x: 0.5, y: 3.55, w: "89%", h: 0.4, fontSize: 14, color: "a5b4fc", align: "center" });
  s1.addText(new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
    { x: 0.5, y: 3.95, w: "89%", h: 0.35, fontSize: 11, color: "818cf8", align: "center" });
  s1.addShape(pptx.ShapeType.roundRect, { x: 3.8, y: 4.45, w: 2.4, h: 0.55, fill: { color: statusColor }, line: { color: statusColor }, rectRadius: 0.1 });
  s1.addText(RAG_LABEL[report.status], { x: 3.8, y: 4.45, w: 2.4, h: 0.55, fontSize: 13, bold: true, color: WHITE, align: "center" });
  s1.addText("Pixanto PPM Platform", { x: 0.3, y: 7.1, w: 3, h: 0.3, fontSize: 9, color: "6366f1" });

  // ── Proje Özeti ────────────────────────────────────────────────────────────
  const s2 = pptx.addSlide();
  s2.background = { color: LIGHT };
  s2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.08, fill: { color: INDIGO } });
  s2.addText("Proje Özeti", { x: 0.3, y: 0.25, w: 4, h: 0.5, fontSize: 22, bold: true, color: NAVY });
  s2.addShape(pptx.ShapeType.line, { x: 0.3, y: 0.82, w: 9.4, h: 0, line: { color: "e5e7eb", width: 1 } });

  const cards = [
    { label: "İlerleme",   value: `%${stats.progress}`,   color: INDIGO },
    { label: "Tamamlanan", value: String(stats.done),      color: "10b981" },
    { label: "Devam Eden", value: String(stats.inProg),    color: INDIGO },
    { label: "Bekleyen",   value: String(stats.todo),      color: GRAY },
    { label: "Açık Risk",  value: String(stats.openRisks), color: stats.openRisks > 0 ? "ef4444" : "10b981" },
    { label: "Durum",
      value: stats.status === "active" ? "Aktif" : stats.status === "at_risk" ? "⚠ Risk" : stats.status === "completed" ? "Tamam" : "Bekl.",
      color: projStatusColor },
  ];
  cards.forEach((c, i) => {
    const x = 0.3 + i * 1.6;
    s2.addShape(pptx.ShapeType.roundRect, { x, y: 0.95, w: 1.5, h: 1.1, fill: { color: WHITE }, line: { color: "e5e7eb" }, rectRadius: 0.08 });
    s2.addText(c.label, { x, y: 1.0, w: 1.5, h: 0.3, fontSize: 9, color: GRAY, align: "center" });
    s2.addText(c.value, { x, y: 1.35, w: 1.5, h: 0.5, fontSize: 22, bold: true, color: c.color, align: "center" });
  });

  // İlerleme barı
  s2.addShape(pptx.ShapeType.roundRect, { x: 0.3, y: 2.2, w: 9.4, h: 0.75, fill: { color: WHITE }, line: { color: "e5e7eb" }, rectRadius: 0.08 });
  s2.addText("Tamamlanma Oranı", { x: 0.5, y: 2.28, w: 3, h: 0.28, fontSize: 10, bold: true, color: NAVY });
  s2.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 2.62, w: 8.8, h: 0.22, fill: { color: "e5e7eb" }, line: { color: "e5e7eb" }, rectRadius: 0.05 });
  const bw = Math.max(0.2, (8.8 * stats.progress) / 100);
  const barColor = stats.status === "at_risk" ? "ef4444" : INDIGO;
  s2.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 2.62, w: bw, h: 0.22, fill: { color: barColor }, line: { color: barColor }, rectRadius: 0.05 });
  s2.addText(`%${stats.progress}`, { x: 9.1, y: 2.58, w: 0.6, h: 0.3, fontSize: 11, bold: true, color: NAVY, align: "right" });

  if (stats.budget && stats.budget > 0) {
    const bp = Math.round(((stats.budgetUsed ?? 0) / stats.budget) * 100);
    const bc = bp > 90 ? "ef4444" : bp > 75 ? "f59e0b" : "10b981";
    s2.addShape(pptx.ShapeType.roundRect, { x: 0.3, y: 3.1, w: 9.4, h: 0.9, fill: { color: WHITE }, line: { color: "e5e7eb" }, rectRadius: 0.08 });
    s2.addText("Bütçe Kullanımı", { x: 0.5, y: 3.18, w: 3, h: 0.28, fontSize: 10, bold: true, color: NAVY });
    s2.addText(`${(stats.budgetUsed ?? 0).toLocaleString("tr-TR")} ₺ / ${stats.budget.toLocaleString("tr-TR")} ₺`,
      { x: 0.5, y: 3.46, w: 6, h: 0.22, fontSize: 9, color: GRAY });
    s2.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 3.72, w: 8.3, h: 0.2, fill: { color: "e5e7eb" }, line: { color: "e5e7eb" }, rectRadius: 0.05 });
    s2.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 3.72, w: Math.max(0.2, (8.3 * Math.min(bp, 100)) / 100), h: 0.2,
      fill: { color: bc }, line: { color: bc }, rectRadius: 0.05 });
    s2.addText(`%${bp}`, { x: 8.7, y: 3.68, w: 0.9, h: 0.28, fontSize: 13, bold: true, color: bc, align: "right" });
  }
  footer(s2, pptx, projectName, report);

  // ── Sections ────────────────────────────────────────────────────────────────
  for (const section of report.sections) {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: INDIGO } });
    s.addShape(pptx.ShapeType.rect, { x: 0.08, y: 0, w: "100%", h: 0.2, fill: { color: LIGHT } });
    s.addText(section.label, { x: 0.3, y: 0.28, w: 9, h: 0.55, fontSize: 20, bold: true, color: NAVY });
    s.addShape(pptx.ShapeType.line, { x: 0.3, y: 0.9, w: 9.4, h: 0, line: { color: "e5e7eb", width: 1 } });

    const lines = (section.content || "—").split("\n").filter(Boolean);
    s.addText(
      lines.map((line) => ({
        text: line,
        options: { paraSpaceAfter: 5 },
      })),
      { x: 0.3, y: 1.05, w: 9.4, h: 5.7, fontSize: 13, color: "374151", valign: "top", wrap: true }
    );
    footer(s, pptx, projectName, report);
  }

  const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(report.title)}.pptx"`,
    },
  });
}
