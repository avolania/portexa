"use client";

import { useState, useCallback } from "react";
import {
  Plus, ArrowLeft, Printer, Trash2, CheckCircle2,
  Circle, AlertCircle, ChevronDown, Calendar, FileText,
  BarChart3, Users, LayoutDashboard, ListOrdered,
  TrendingUp, DollarSign, Target, Activity,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useReportStore } from "@/store/useReportStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useGovernanceStore } from "@/store/useGovernanceStore";
import { useAuthStore } from "@/store/useAuthStore";
import type { Report, ReportSection, ReportStatus, ReportType } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatPeriod(period: string, type: ReportType): string {
  if (type === "weekly" && period.includes("W")) {
    const [year, w] = period.split("-W");
    return `${year} / ${w}. Hafta`;
  }
  if (type === "steerco" && period.match(/\d{4}-\d{2}/)) {
    const [year, month] = period.split("-");
    const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    return `${months[parseInt(month) - 1]} ${year}`;
  }
  return period;
}

// ─── Auto-populate helpers ────────────────────────────────────────────────────

function buildWeeklySections(
  projectId: string,
  period: string,
  projects: ReturnType<typeof useProjectStore.getState>["projects"],
  tasks: ReturnType<typeof useProjectStore.getState>["tasks"],
  govItems: ReturnType<typeof useGovernanceStore.getState>["items"],
  authorName: string
): ReportSection[] {
  const proj = projects.find((p) => p.id === projectId);
  const projTasks = tasks.filter((t) => t.projectId === projectId);
  const done = projTasks.filter((t) => t.status === "done");
  const inProg = projTasks.filter((t) => t.status === "in_progress");
  const overdue = projTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done"
  );
  const openRisks = govItems.filter(
    (g) => g.projectId === projectId && g.category === "risk" && g.status === "open"
  );
  const openIssues = govItems.filter(
    (g) => g.projectId === projectId && g.category === "issue" && g.status === "open"
  );

  return [
    {
      id: "summary",
      label: "Genel Durum Özeti",
      content: `Proje: ${proj?.name ?? "—"}\nDönem: ${formatPeriod(period, "weekly")}\nHazırlayan: ${authorName}\n\nBu hafta proje genel olarak ${proj?.status === "at_risk" ? "risk altında" : "plan dahilinde"} ilerlemiştir. Genel ilerleme: %${proj?.progress ?? 0}.`,
    },
    {
      id: "completed",
      label: "Bu Hafta Tamamlananlar",
      content:
        done.length > 0
          ? done.map((t) => `• ${t.title}`).join("\n")
          : "Bu hafta tamamlanan görev kaydedilmemiş.",
    },
    {
      id: "inprogress",
      label: "Devam Eden Çalışmalar",
      content:
        inProg.length > 0
          ? inProg.map((t) => `• ${t.title}${t.assigneeId ? "" : ""}`).join("\n")
          : "Devam eden görev bulunmuyor.",
    },
    {
      id: "nextweek",
      label: "Önümüzdeki Hafta Planı",
      content: "• \n• \n• ",
    },
    {
      id: "risks",
      label: "Risk ve Sorunlar",
      content: [
        openRisks.length > 0
          ? "Açık Riskler:\n" + openRisks.map((r) => `• [${r.priority ?? "—"}] ${r.title}`).join("\n")
          : "Açık risk yok.",
        openIssues.length > 0
          ? "\nAçık Sorunlar:\n" + openIssues.map((i) => `• ${i.title}`).join("\n")
          : "\nAçık sorun yok.",
        overdue.length > 0
          ? "\nGeciken Görevler:\n" + overdue.map((t) => `• ${t.title} (Bitiş: ${t.dueDate})`).join("\n")
          : "",
      ].join(""),
    },
    {
      id: "budget",
      label: "Bütçe Durumu",
      content: proj?.budget
        ? `Toplam Bütçe: ${proj.budget.toLocaleString("tr-TR")} ₺\nHarcanan: ${(proj.budgetUsed ?? 0).toLocaleString("tr-TR")} ₺\nKalan: ${(proj.budget - (proj.budgetUsed ?? 0)).toLocaleString("tr-TR")} ₺`
        : "Bütçe bilgisi girilmemiş.",
    },
    {
      id: "notes",
      label: "Önemli Notlar / Gündem",
      content: "• \n• ",
    },
  ];
}

function buildSteercoSections(
  projectId: string,
  period: string,
  projects: ReturnType<typeof useProjectStore.getState>["projects"],
  tasks: ReturnType<typeof useProjectStore.getState>["tasks"],
  govItems: ReturnType<typeof useGovernanceStore.getState>["items"],
  authorName: string
): ReportSection[] {
  const proj = projects.find((p) => p.id === projectId);
  const projTasks = tasks.filter((t) => t.projectId === projectId);
  const done = projTasks.filter((t) => t.status === "done");
  const risks = govItems.filter((g) => g.projectId === projectId && g.category === "risk");
  const decisions = govItems.filter((g) => g.projectId === projectId && g.category === "decision");
  const changes = govItems.filter(
    (g) => g.projectId === projectId && g.category === "change" && g.status === "pending"
  );

  return [
    {
      id: "executive",
      label: "Yönetici Özeti",
      content: `Proje: ${proj?.name ?? "—"}\nDönem: ${formatPeriod(period, "steerco")}\nHazırlayan: ${authorName}\nTarih: ${new Date().toLocaleDateString("tr-TR")}\n\nProje ${proj?.status === "active" ? "aktif olarak" : proj?.status === "at_risk" ? "risk altında" : "planlandığı şekilde"} ilerlemektedir. Genel tamamlanma oranı %${proj?.progress ?? 0}'dir.`,
    },
    {
      id: "achievements",
      label: "Dönem Kazanımları",
      content:
        done.length > 0
          ? done.slice(-5).map((t) => `• ${t.title}`).join("\n")
          : "Bu dönemde kayıtlı kazanım bulunmuyor.",
    },
    {
      id: "milestones",
      label: "Milestone ve Deliverable Durumu",
      content: `Toplam Görev: ${projTasks.length}\nTamamlanan: ${done.length}\nDevam Eden: ${projTasks.filter((t) => t.status === "in_progress").length}\nBekleyen: ${projTasks.filter((t) => t.status === "todo").length}\n\nÖnemli Kilometre Taşları:\n• `,
    },
    {
      id: "budget",
      label: "Bütçe ve Kaynak Durumu",
      content: proj?.budget
        ? `Onaylı Bütçe: ${proj.budget.toLocaleString("tr-TR")} ₺\nGerçekleşen: ${(proj.budgetUsed ?? 0).toLocaleString("tr-TR")} ₺\nKullanım Oranı: %${proj.budget > 0 ? Math.round(((proj.budgetUsed ?? 0) / proj.budget) * 100) : 0}\n\nKaynak Notları:\n• `
        : "Bütçe bilgisi girilmemiş.\n\nKaynak Notları:\n• ",
    },
    {
      id: "risks",
      label: "Risk Yönetimi",
      content:
        risks.length > 0
          ? risks
              .map(
                (r) =>
                  `• [${r.priority ?? "—"} / ${r.status}] ${r.title}${r.mitigationPlan ? "\n  Önlem: " + r.mitigationPlan : ""}`
              )
              .join("\n")
          : "Kayıtlı risk bulunmuyor.",
    },
    {
      id: "decisions",
      label: "Karar Gerektiren Konular",
      content: [
        changes.length > 0
          ? "Bekleyen Değişiklik Talepleri:\n" + changes.map((c) => `• ${c.title}`).join("\n")
          : "Bekleyen değişiklik talebi yok.",
        decisions.length > 0
          ? "\nAlınan Kararlar:\n" + decisions.slice(-3).map((d) => `• ${d.title}`).join("\n")
          : "",
        "\n\nKomiteden Beklenen Kararlar:\n• ",
      ].join(""),
    },
    {
      id: "nextperiod",
      label: "Önümüzdeki Dönem Planı",
      content: "• \n• \n• ",
    },
    {
      id: "conclusion",
      label: "Sonuç ve Tavsiyeler",
      content: "• \n• ",
    },
  ];
}

function buildDashboardSections(
  projects: ReturnType<typeof useProjectStore.getState>["projects"],
  tasks: ReturnType<typeof useProjectStore.getState>["tasks"],
  govItems: ReturnType<typeof useGovernanceStore.getState>["items"],
  authorName: string,
  period: string
): ReportSection[] {
  const activeProjects = projects.filter((p) => p.status === "active");
  const atRisk = projects.filter((p) => p.status === "at_risk");
  const done = tasks.filter((t) => t.status === "done");
  const openRisks = govItems.filter((g) => g.category === "risk" && g.status === "open");

  return [
    {
      id: "portfolio",
      label: "Portföy Özeti",
      content: [
        `Hazırlayan: ${authorName}`,
        `Dönem: ${period}`,
        `Tarih: ${new Date().toLocaleDateString("tr-TR")}`,
        ``,
        `Toplam Proje: ${projects.length}`,
        `Aktif: ${activeProjects.length}`,
        `Risk Altında: ${atRisk.length}`,
        `Tamamlanan Görev: ${done.length} / ${tasks.length}`,
        ``,
        atRisk.length > 0
          ? "Risk Altındaki Projeler:\n" + atRisk.map((p) => `• ${p.name}`).join("\n")
          : "Risk altında proje yok.",
      ].join("\n"),
    },
    {
      id: "projects",
      label: "Proje Durumları",
      content:
        projects.length > 0
          ? projects
              .map(
                (p) =>
                  `• ${p.name} — %${p.progress} | ${
                    p.status === "active" ? "Aktif" : p.status === "at_risk" ? "⚠ Risk" : p.status === "completed" ? "Tamamlandı" : "Beklemede"
                  }`
              )
              .join("\n")
          : "Proje bulunamadı.",
    },
    {
      id: "budget",
      label: "Bütçe Özeti",
      content: (() => {
        const total = projects.reduce((s, p) => s + (p.budget ?? 0), 0);
        const used = projects.reduce((s, p) => s + (p.budgetUsed ?? 0), 0);
        return total > 0
          ? `Toplam Portföy Bütçesi: ${total.toLocaleString("tr-TR")} ₺\nToplam Harcanan: ${used.toLocaleString("tr-TR")} ₺\nKalan: ${(total - used).toLocaleString("tr-TR")} ₺\nKullanım Oranı: %${Math.round((used / total) * 100)}`
          : "Bütçe verisi girilmemiş.";
      })(),
    },
    {
      id: "risks",
      label: "Kritik Riskler",
      content:
        openRisks.length > 0
          ? openRisks
              .filter((r) => r.priority === "high" || r.priority === "critical")
              .map((r) => {
                const proj = projects.find((p) => p.id === r.projectId);
                return `• [${proj?.name ?? "?"}] ${r.title}`;
              })
              .join("\n") || "Kritik seviyeli açık risk yok."
          : "Açık risk yok.",
    },
    {
      id: "resources",
      label: "Kaynak ve Kapasite",
      content: "• \n• ",
    },
    {
      id: "targets",
      label: "Önümüzdeki Dönem Hedefleri",
      content: "• \n• \n• ",
    },
  ];
}

// ─── RAG Status ───────────────────────────────────────────────────────────────

const RAG_CONFIG: Record<ReportStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  green: { label: "Yeşil — Yolunda", color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle2 },
  amber: { label: "Sarı — Dikkat", color: "text-amber-700", bg: "bg-amber-100", icon: AlertCircle },
  red:   { label: "Kırmızı — Risk", color: "text-red-700", bg: "bg-red-100", icon: Circle },
};

function RAGSelector({ value, onChange }: { value: ReportStatus; onChange: (v: ReportStatus) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = RAG_CONFIG[value];
  const Icon = cfg.icon;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${cfg.bg} ${cfg.color} border border-current/20`}
      >
        <Icon className="w-4 h-4" />
        {cfg.label}
        <ChevronDown className="w-3.5 h-3.5 ml-1" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
          {(Object.keys(RAG_CONFIG) as ReportStatus[]).map((k) => {
            const c = RAG_CONFIG[k];
            const I = c.icon;
            return (
              <button
                key={k}
                onClick={() => { onChange(k); setOpen(false); }}
                className={`flex items-center gap-2 px-4 py-2 w-full text-sm hover:bg-gray-50 ${c.color}`}
              >
                <I className="w-4 h-4" /> {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Section Editor ───────────────────────────────────────────────────────────

function SectionEditor({
  section,
  onChange,
}: {
  section: ReportSection;
  onChange: (content: string) => void;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
        {section.label}
      </h3>
      <textarea
        value={section.content}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(3, (section.content.match(/\n/g) ?? []).length + 2)}
        className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-gray-50 hover:bg-white transition-colors leading-relaxed"
      />
    </div>
  );
}

// ─── Report Editor ────────────────────────────────────────────────────────────

function ReportEditor({
  report,
  onBack,
}: {
  report: Report;
  onBack: () => void;
}) {
  const { updateReport, updateSection, deleteReport } = useReportStore();
  const { projects } = useProjectStore();
  const proj = projects.find((p) => p.id === report.projectId);

  const handlePrint = useCallback(() => window.print(), []);
  const handleDelete = useCallback(() => {
    if (confirm("Bu raporu silmek istediğinize emin misiniz?")) {
      deleteReport(report.id);
      onBack();
    }
  }, [deleteReport, report.id, onBack]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Raporlara Dön
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Sil
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Printer className="w-3.5 h-3.5" /> Yazdır / PDF
          </button>
        </div>
      </div>

      {/* Report card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 print:shadow-none print:border-none">
        {/* Header */}
        <div className="border-b border-gray-100 pb-6 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={report.title}
                onChange={(e) => updateReport(report.id, { title: e.target.value })}
                className="text-2xl font-bold text-gray-900 w-full border-none outline-none bg-transparent focus:bg-gray-50 rounded px-1 -ml-1"
              />
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {proj ? proj.name : "Tüm Portföy"}
                </span>
                <span>·</span>
                <span>{formatPeriod(report.period, report.type)}</span>
                <span>·</span>
                <span>{new Date(report.updatedAt).toLocaleDateString("tr-TR")}</span>
              </div>
            </div>
            <RAGSelector
              value={report.status}
              onChange={(status) => updateReport(report.id, { status })}
            />
          </div>
        </div>

        {/* Sections */}
        {report.sections.map((section) => (
          <SectionEditor
            key={section.id}
            section={section}
            onChange={(content) => updateSection(report.id, section.id, content)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Report List ──────────────────────────────────────────────────────────────

function ReportCard({
  report,
  onClick,
}: {
  report: Report;
  onClick: () => void;
}) {
  const { projects } = useProjectStore();
  const proj = projects.find((p) => p.id === report.projectId);
  const cfg = RAG_CONFIG[report.status];
  const Icon = cfg.icon;

  return (
    <button
      onClick={onClick}
      className="text-left w-full bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
            {report.title}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {proj?.name ?? "Tüm Portföy"} · {formatPeriod(report.period, report.type)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(report.updatedAt).toLocaleDateString("tr-TR", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} flex-shrink-0`}>
          <Icon className="w-3 h-3" /> {cfg.label.split(" — ")[0]}
        </span>
      </div>
    </button>
  );
}

// ─── New Report Modal ─────────────────────────────────────────────────────────

function NewReportModal({
  type,
  onClose,
  onCreate,
}: {
  type: ReportType;
  onClose: () => void;
  onCreate: (report: Report) => void;
}) {
  const { projects, tasks } = useProjectStore();
  const { items: govItems } = useGovernanceStore();
  const user = useAuthStore((s) => s.user);

  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [period, setPeriod] = useState(
    type === "weekly" ? isoWeek(new Date()) : currentMonth()
  );
  const [title, setTitle] = useState(() => {
    const proj = projects.find((p) => p.id === (projects[0]?.id ?? ""));
    if (type === "weekly") return `Haftalık Statü — ${proj?.name ?? ""}`;
    if (type === "steerco") return `Steerco Raporu — ${proj?.name ?? ""}`;
    return "Dashboard Raporu";
  });

  const handleCreate = () => {
    const authorName = user?.name ?? "—";
    let sections;
    if (type === "weekly") {
      sections = buildWeeklySections(projectId, period, projects, tasks, govItems, authorName);
    } else if (type === "steerco") {
      sections = buildSteercoSections(projectId, period, projects, tasks, govItems, authorName);
    } else {
      sections = buildDashboardSections(projects, tasks, govItems, authorName, period);
    }

    const report: Report = {
      id: crypto.randomUUID(),
      type,
      projectId: type !== "dashboard" ? projectId : undefined,
      title,
      period,
      status: "green",
      sections,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onCreate(report);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-5">
          {type === "weekly" ? "Haftalık Statü Raporu" : type === "steerco" ? "Aylık Steerco Raporu" : "Dashboard Raporu"} Oluştur
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rapor Başlığı</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {type !== "dashboard" && projects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proje</label>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  const proj = projects.find((p) => p.id === e.target.value);
                  if (type === "weekly") setTitle(`Haftalık Statü — ${proj?.name ?? ""}`);
                  if (type === "steerco") setTitle(`Steerco Raporu — ${proj?.name ?? ""}`);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {type === "weekly" ? "Hafta" : type === "steerco" ? "Ay" : "Dönem"}
            </label>
            {type === "weekly" ? (
              <input
                type="week"
                value={period.replace("-W", "-W")}
                onChange={(e) => setPeriod(e.target.value.replace("W", "W"))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            ) : type === "steerco" ? (
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            ) : (
              <input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="örn. 2025-Q2"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
          >
            Oluştur
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard View ───────────────────────────────────────────────────────────

const PIE_COLORS = ["#6366f1", "#ef4444", "#f59e0b", "#10b981"];
const STATUS_LABELS: Record<string, string> = {
  active: "Aktif", at_risk: "Risk", on_hold: "Beklemede", completed: "Tamamlandı",
};

function DashboardView() {
  const projects = useProjectStore((s) => s.projects);
  const tasks = useProjectStore((s) => s.tasks);
  const govItems = useGovernanceStore((s) => s.items);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const inProgTasks = tasks.filter((t) => t.status === "in_progress").length;
  const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0);
  const usedBudget = projects.reduce((s, p) => s + (p.budgetUsed ?? 0), 0);
  const openRisks = govItems.filter((g) => g.category === "risk" && g.status === "open").length;
  const openIssues = govItems.filter((g) => g.category === "issue" && g.status === "open").length;

  // Pie: proje durum dağılımı
  const pieData = ["active", "at_risk", "on_hold", "completed"].map((s) => ({
    name: STATUS_LABELS[s],
    value: projects.filter((p) => p.status === s).length,
  })).filter((d) => d.value > 0);

  // Bar: proje bazlı bütçe
  const budgetData = projects
    .filter((p) => p.budget)
    .slice(0, 8)
    .map((p) => ({
      name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name,
      Bütçe: p.budget ?? 0,
      Harcanan: p.budgetUsed ?? 0,
    }));

  // Bar: proje bazlı görev tamamlama
  const taskData = projects
    .filter((p) => tasks.some((t) => t.projectId === p.id))
    .slice(0, 8)
    .map((p) => {
      const pts = tasks.filter((t) => t.projectId === p.id);
      return {
        name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name,
        Tamamlanan: pts.filter((t) => t.status === "done").length,
        Devam: pts.filter((t) => t.status === "in_progress").length,
        Bekleyen: pts.filter((t) => t.status === "todo").length,
      };
    });

  const statCards = [
    { label: "Toplam Proje", value: projects.length, icon: Target, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Tamamlanan Görev", value: `${doneTasks}/${totalTasks}`, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Devam Eden Görev", value: inProgTasks, icon: Activity, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Bütçe Kullanımı", value: totalBudget ? `%${Math.round((usedBudget / totalBudget) * 100)}` : "—", icon: DollarSign, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Açık Risk", value: openRisks, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Açık Sorun", value: openIssues, icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className={`w-8 h-8 ${c.bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <div className="text-xl font-bold text-gray-900">{c.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Proje durum dağılımı */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Proje Durum Dağılımı</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                    dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">Proje bulunamadı.</p>
          )}
        </div>

        {/* Proje ilerleme barları */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Proje İlerleme Durumu</h3>
          {projects.length > 0 ? (
            <div className="space-y-3">
              {projects.slice(0, 6).map((p) => (
                <div key={p.id}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span className="truncate max-w-[180px]">{p.name}</span>
                    <span className="font-medium ml-2">%{p.progress}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        p.status === "at_risk" ? "bg-red-500" :
                        p.status === "completed" ? "bg-emerald-500" : "bg-indigo-500"
                      }`}
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">Proje bulunamadı.</p>
          )}
        </div>
      </div>

      {/* Görev dağılımı bar chart */}
      {taskData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Proje Bazlı Görev Dağılımı</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={taskData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Tamamlanan" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Devam" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Bekleyen" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bütçe bar chart */}
      {budgetData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Proje Bazlı Bütçe Durumu (₺)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={budgetData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => `${Number(v).toLocaleString("tr-TR")} ₺`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Bütçe" fill="#e0e7ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Harcanan" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Risk / Yönetişim özeti */}
      {(openRisks > 0 || openIssues > 0) && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Açık Risk ve Sorunlar</h3>
          <div className="space-y-2">
            {govItems
              .filter((g) => (g.category === "risk" || g.category === "issue") && g.status === "open")
              .slice(0, 8)
              .map((g) => {
                const proj = projects.find((p) => p.id === g.projectId);
                return (
                  <div key={g.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      g.category === "risk" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {g.category === "risk" ? "Risk" : "Sorun"}
                    </span>
                    <span className="text-sm text-gray-800 flex-1 truncate">{g.title}</span>
                    <span className="text-xs text-gray-400">{proj?.name ?? "—"}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Panel ────────────────────────────────────────────────────────────────

function TabPanel({
  type,
  icon,
  title,
  description,
}: {
  type: ReportType;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const { reports, addReport } = useReportStore();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dashView, setDashView] = useState<"visual" | "reports">("visual");

  const filtered = reports.filter((r) => r.type === type).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  const selectedReport = selected ? reports.find((r) => r.id === selected) ?? null : null;

  if (selectedReport) {
    return (
      <ReportEditor
        report={selectedReport}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Yeni Rapor
        </button>
      </div>

      {/* Dashboard alt-tab toggle */}
      {type === "dashboard" && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          <button
            onClick={() => setDashView("visual")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              dashView === "visual" ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard Görünümü
          </button>
          <button
            onClick={() => setDashView("reports")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              dashView === "reports" ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <ListOrdered className="w-4 h-4" /> Kayıtlı Raporlar
            {filtered.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full">{filtered.length}</span>
            )}
          </button>
        </div>
      )}

      {/* Dashboard visual view */}
      {type === "dashboard" && dashView === "visual" && <DashboardView />}

      {/* Report list */}
      {(type !== "dashboard" || dashView === "reports") && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Henüz rapor oluşturulmamış.</p>
              <button
                onClick={() => setShowNew(true)}
                className="mt-3 text-sm text-indigo-600 hover:underline"
              >
                İlk raporu oluştur →
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((r) => (
                <ReportCard key={r.id} report={r} onClick={() => setSelected(r.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {showNew && (
        <NewReportModal
          type={type}
          onClose={() => setShowNew(false)}
          onCreate={(report) => {
            addReport(report);
            setShowNew(false);
            setSelected(report.id);
          }}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  {
    key: "weekly" as ReportType,
    label: "Haftalık Statü",
    icon: <Calendar className="w-5 h-5" />,
    description: "Haftalık proje ilerleme ve durum raporu",
  },
  {
    key: "steerco" as ReportType,
    label: "Aylık Steerco",
    icon: <Users className="w-5 h-5" />,
    description: "Yönetim kurulu için aylık ilerleme raporu",
  },
  {
    key: "dashboard" as ReportType,
    label: "Dashboard Raporu",
    icon: <BarChart3 className="w-5 h-5" />,
    description: "Tüm portföy genel durum raporu",
  },
];

export default function RaporlarPage() {
  const [activeTab, setActiveTab] = useState<ReportType>("weekly");
  const active = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Raporlar</h1>
        <p className="text-sm text-gray-500 mt-1">
          Proje durumu, steerco ve portföy raporlarını oluşturun ve düzenleyin.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-white shadow-sm text-indigo-700"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <TabPanel
        key={activeTab}
        type={active.key}
        icon={active.icon}
        title={active.label}
        description={active.description}
      />
    </div>
  );
}
