import * as XLSX from "xlsx";
import type { Project, Task, GovernanceItem, GovernanceCategory } from "@/types";

const USERS: Record<string, string> = {
  "1": "Ahmet Yılmaz",
  "2": "Zeynep Kaya",
  "3": "Mehmet Demir",
  "4": "Ayşe Çelik",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "Yapılacak",
  in_progress: "Devam Ediyor",
  review: "İncelemede",
  done: "Tamamlandı",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

const PHASE_LABELS: Record<string, string> = {
  requirements: "Gereksinimler",
  design: "Tasarım",
  development: "Geliştirme",
  testing: "Test",
  deployment: "Dağıtım",
};

function autoWidth(ws: XLSX.WorkSheet, data: (string | number | null)[][]) {
  const colWidths = data[0]?.map((_, ci) =>
    Math.max(
      10,
      ...data.map((row) => String(row[ci] ?? "").length + 2)
    )
  ) ?? [];
  ws["!cols"] = colWidths.map((w) => ({ wch: Math.min(w, 50) }));
}

export function exportProjectPlan(project: Project, tasks: Task[]) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Project Plan
  const planHeaders = [
    "Görev ID", "Görev Adı", "Tür", "Faz", "Durum", "Öncelik",
    "Sorumlu", "Başlangıç", "Bitiş", "Tahmini Saat", "Kaydedilen Saat", "Hikaye Puanı",
  ];
  const planRows = tasks.map((t) => [
    t.id,
    t.title,
    t.issueType ?? "task",
    t.phase ? PHASE_LABELS[t.phase] : (t.sprint ? `Sprint ${t.sprint}` : "—"),
    STATUS_LABELS[t.status] ?? t.status,
    PRIORITY_LABELS[t.priority] ?? t.priority,
    t.assigneeId ? (USERS[t.assigneeId] ?? t.assigneeId) : "—",
    t.startDate ?? "—",
    t.dueDate ?? "—",
    t.estimatedHours ?? 0,
    t.loggedHours ?? 0,
    t.storyPoints ?? "—",
  ]);
  const planWs = XLSX.utils.aoa_to_sheet([planHeaders, ...planRows]);
  autoWidth(planWs, [planHeaders, ...planRows]);
  XLSX.utils.book_append_sheet(wb, planWs, "Proje Planı");

  // Sheet 2: Team
  const memberIds = [...new Set(tasks.map((t) => t.assigneeId).filter(Boolean) as string[])];
  const teamHeaders = ["Üye ID", "Ad Soyad", "Görev Sayısı", "Tamamlanan", "Devam Eden", "Toplam Tahmini Saat", "Toplam Kaydedilen Saat"];
  const teamRows = memberIds.map((id) => {
    const memberTasks = tasks.filter((t) => t.assigneeId === id);
    return [
      id,
      USERS[id] ?? id,
      memberTasks.length,
      memberTasks.filter((t) => t.status === "done").length,
      memberTasks.filter((t) => t.status === "in_progress").length,
      memberTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0),
      memberTasks.reduce((s, t) => s + (t.loggedHours ?? 0), 0),
    ];
  });
  const teamWs = XLSX.utils.aoa_to_sheet([teamHeaders, ...teamRows]);
  autoWidth(teamWs, [teamHeaders, ...teamRows]);
  XLSX.utils.book_append_sheet(wb, teamWs, "Ekip");

  // Sheet 3: Budget / Costs
  const costHeaders = ["Bütçe Kalemi", "Değer"];
  const costRows: (string | number)[][] = [
    ["Proje Adı", project.name],
    ["Toplam Bütçe (₺)", project.budget ?? 0],
    ["Harcanan (₺)", project.budgetUsed ?? 0],
    ["Kalan (₺)", (project.budget ?? 0) - (project.budgetUsed ?? 0)],
    ["Kullanım Oranı (%)", project.budget ? Math.round(((project.budgetUsed ?? 0) / project.budget) * 100) : 0],
    ["", ""],
    ["Toplam Tahmini İşgücü (Saat)", tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)],
    ["Toplam Kaydedilen (Saat)", tasks.reduce((s, t) => s + (t.loggedHours ?? 0), 0)],
  ];
  const costWs = XLSX.utils.aoa_to_sheet([costHeaders, ...costRows]);
  autoWidth(costWs, [costHeaders, ...costRows]);
  XLSX.utils.book_append_sheet(wb, costWs, "Maliyetler");

  const safeName = project.name.replace(/[/\\?*[\]]/g, "_");
  XLSX.writeFile(wb, `${safeName}_Proje_Plani.xlsx`);
}

const CATEGORY_LABELS: Record<GovernanceCategory, string> = {
  charter:  "Tüzük",
  meeting:  "Toplantı",
  risk:     "Risk",
  change:   "Değişiklik",
  issue:    "Sorun",
  decision: "Karar",
};

export function exportGovernance(projectName: string, items: GovernanceItem[]) {
  const wb = XLSX.utils.book_new();

  const headers = [
    "Kategori", "Başlık", "Açıklama", "Durum", "Öncelik", "Sorumlu", "Son Tarih",
    "Etki", "Olasılık", "Azaltma Planı",
    "Talep Eden", "Etki Değerlendirmesi",
    "Toplantı Tarihi", "Katılımcılar", "Toplantı Notları",
    "Karar Veren", "Gerekçe",
    "Oluşturulma",
  ];

  const rows = items.map((item) => [
    CATEGORY_LABELS[item.category] ?? item.category,
    item.title,
    item.description ?? "",
    item.status,
    item.priority ?? "",
    item.owner ?? "",
    item.dueDate ?? "",
    item.impact ?? "",
    item.probability ?? "",
    item.mitigationPlan ?? "",
    item.requestedBy ?? "",
    item.impactAssessment ?? "",
    item.meetingDate ?? "",
    item.attendees?.join(", ") ?? "",
    item.minutes ?? "",
    item.decidedBy ?? "",
    item.rationale ?? "",
    new Date(item.createdAt).toLocaleDateString("tr-TR"),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  autoWidth(ws, [headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Yönetişim");

  const safeName = projectName.replace(/[/\\?*[\]]/g, "_");
  XLSX.writeFile(wb, `${safeName}_Yönetişim.xlsx`);
}

export function getGovernanceTemplate(projectName: string) {
  const wb = XLSX.utils.book_new();
  const headers = [
    "category", "title", "description", "status", "priority", "owner", "dueDate",
    "impact", "probability", "mitigationPlan",
    "requestedBy", "impactAssessment",
    "meetingDate", "attendees", "minutes",
    "decidedBy", "rationale",
  ];
  const example: (string)[] = [
    "risk", "Örnek Risk", "Açıklama", "open", "high", "Sorumlu Adı", "2026-05-01",
    "high", "medium", "Azaltma planı buraya...",
    "", "",
    "", "", "",
    "", "",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, "Yönetişim");
  const safeName = projectName.replace(/[/\\?*[\]]/g, "_");
  XLSX.writeFile(wb, `${safeName}_Yönetişim_Şablonu.xlsx`);
}
