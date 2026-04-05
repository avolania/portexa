"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutGrid, List, CalendarRange, Plus, TrendingUp,
  TrendingDown, AlertTriangle, CheckCircle2, Clock,
  DollarSign, Users, Target, Filter,
} from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { ProjectStatusBadge, PriorityBadge } from "@/components/ui/Badge";
import type { Project } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_SORT: Record<string, number> = { at_risk: 0, active: 1, on_hold: 2, completed: 3 };

function pct(used?: number, total?: number) {
  if (!total || !used) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function daysLeft(endDate: string) {
  return Math.round((new Date(endDate).getTime() - Date.now()) / 86400000);
}

function healthColor(project: Project) {
  if (project.status === "at_risk") return "bg-red-500";
  if (project.status === "on_hold") return "bg-gray-400";
  if (project.status === "completed") return "bg-emerald-500";
  const budget = pct(project.budgetUsed, project.budget);
  if (budget > 90) return "bg-amber-500";
  return "bg-emerald-500";
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ projects }: { projects: Project[] }) {
  const tasks = useProjectStore((s) => s.tasks);
  const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0);
  const usedBudget = projects.reduce((s, p) => s + (p.budgetUsed ?? 0), 0);
  const avgProgress = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    : 0;
  const atRisk = projects.filter((p) => p.status === "at_risk").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  const cards = [
    {
      label: "Toplam Proje", value: projects.length,
      icon: Target, color: "text-indigo-600", bg: "bg-indigo-50",
    },
    {
      label: "Risk Altında", value: atRisk,
      icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50",
    },
    {
      label: "Ort. İlerleme", value: `%${avgProgress}`,
      icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50",
    },
    {
      label: "Tamamlanan Görev", value: doneTasks,
      icon: CheckCircle2, color: "text-teal-600", bg: "bg-teal-50",
    },
    {
      label: "Toplam Bütçe",
      value: totalBudget > 0 ? `${(totalBudget / 1000).toFixed(0)}K ₺` : "—",
      icon: DollarSign, color: "text-violet-600", bg: "bg-violet-50",
    },
    {
      label: "Bütçe Kullanım",
      value: totalBudget > 0 ? `%${pct(usedBudget, totalBudget)}` : "—",
      icon: usedBudget / (totalBudget || 1) > 0.9 ? TrendingDown : TrendingUp,
      color: usedBudget / (totalBudget || 1) > 0.9 ? "text-red-600" : "text-emerald-600",
      bg: usedBudget / (totalBudget || 1) > 0.9 ? "bg-red-50" : "bg-emerald-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
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
  );
}

// ─── Card View ────────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  const allTasks = useProjectStore((s) => s.tasks);
  const tasks = allTasks.filter((t) => t.projectId === project.id);
  const done = tasks.filter((t) => t.status === "done").length;
  const days = daysLeft(project.endDate);
  const budgetPct = pct(project.budgetUsed, project.budget);
  const health = healthColor(project);

  return (
    <Link href={`/projeler/${project.id}`}>
      <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group h-full flex flex-col">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${health}`} />
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
              {project.name}
            </h3>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>

        {project.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description}</p>
        )}

        {/* Progress */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>İlerleme</span>
            <span className="font-medium text-gray-700">%{project.progress}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          <PriorityBadge priority={project.priority} />
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {project.projectType === "agile" ? "Agile" : "Waterfall"}
          </span>
        </div>

        {/* Stats row */}
        <div className="mt-auto grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 text-center">
          <div>
            <div className="text-sm font-semibold text-gray-900">{done}/{tasks.length}</div>
            <div className="text-xs text-gray-400">Görev</div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${budgetPct > 90 ? "text-red-600" : "text-gray-900"}`}>
              {project.budget ? `%${budgetPct}` : "—"}
            </div>
            <div className="text-xs text-gray-400">Bütçe</div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${days < 0 ? "text-red-600" : days < 7 ? "text-amber-600" : "text-gray-900"}`}>
              {days < 0 ? `${Math.abs(days)}g geç` : days === 0 ? "Bugün" : `${days}g`}
            </div>
            <div className="text-xs text-gray-400">Kalan</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Table View ───────────────────────────────────────────────────────────────

function TableView({ projects }: { projects: Project[] }) {
  const allTasks = useProjectStore((s) => s.tasks);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {["Proje", "Durum", "Öncelik", "İlerleme", "Görevler", "Bütçe", "Bitiş", "Tür"].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {projects.map((p) => {
            const tasks = allTasks.filter((t) => t.projectId === p.id);
            const done = tasks.filter((t) => t.status === "done").length;
            const budgetPct = pct(p.budgetUsed, p.budget);
            const days = daysLeft(p.endDate);
            return (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/projeler/${p.id}`} className="flex items-center gap-2 group">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${healthColor(p)}`} />
                    <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">
                      {p.name}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3"><ProjectStatusBadge status={p.status} /></td>
                <td className="px-4 py-3"><PriorityBadge priority={p.priority} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 w-8">%{p.progress}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{done}/{tasks.length}</td>
                <td className="px-4 py-3">
                  {p.budget ? (
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm ${budgetPct > 90 ? "text-red-600 font-medium" : "text-gray-600"}`}>
                        %{budgetPct}
                      </span>
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${budgetPct > 90 ? "bg-red-500" : budgetPct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${budgetPct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm ${days < 0 ? "text-red-600 font-medium" : days < 7 ? "text-amber-600" : "text-gray-600"}`}>
                    {days < 0 ? `${Math.abs(days)}g geç` : new Date(p.endDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {p.projectType === "agile" ? "Agile" : "Waterfall"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Timeline View ────────────────────────────────────────────────────────────

function TimelineView({ projects }: { projects: Project[] }) {
  const sorted = [...projects].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  if (sorted.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
      <CalendarRange className="w-10 h-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm">Proje bulunamadı.</p>
    </div>
  );

  const minDate = new Date(Math.min(...sorted.map((p) => new Date(p.startDate).getTime())));
  const maxDate = new Date(Math.max(...sorted.map((p) => new Date(p.endDate).getTime())));
  minDate.setDate(1);
  maxDate.setMonth(maxDate.getMonth() + 1, 0);
  const totalDays = (maxDate.getTime() - minDate.getTime()) / 86400000;

  // Month headers
  const months: { label: string; left: number; width: number }[] = [];
  const cur = new Date(minDate);
  while (cur <= maxDate) {
    const start = Math.max(0, (cur.getTime() - minDate.getTime()) / 86400000);
    const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const endDay = Math.min(totalDays, (end.getTime() - minDate.getTime()) / 86400000);
    months.push({
      label: cur.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }),
      left: (start / totalDays) * 100,
      width: ((endDay - start) / totalDays) * 100,
    });
    cur.setMonth(cur.getMonth() + 1, 1);
  }

  const todayLeft = ((Date.now() - minDate.getTime()) / 86400000 / totalDays) * 100;

  const STATUS_COLOR: Record<string, string> = {
    active: "bg-indigo-500",
    at_risk: "bg-red-500",
    on_hold: "bg-gray-400",
    completed: "bg-emerald-500",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex">
        {/* Left labels */}
        <div className="w-48 flex-shrink-0 border-r border-gray-100">
          <div className="h-10 border-b border-gray-100 bg-gray-50" />
          {sorted.map((p) => (
            <div key={p.id} className="h-12 flex items-center px-4 border-b border-gray-50">
              <Link href={`/projeler/${p.id}`} className="text-sm font-medium text-gray-800 truncate hover:text-indigo-600 transition-colors">
                {p.name}
              </Link>
            </div>
          ))}
        </div>

        {/* Timeline area */}
        <div className="flex-1 overflow-x-auto">
          <div className="relative min-w-[600px]">
            {/* Month headers */}
            <div className="h-10 bg-gray-50 border-b border-gray-100 relative">
              {months.map((m) => (
                <div
                  key={m.label}
                  className="absolute top-0 h-full flex items-center justify-center text-xs text-gray-500 font-medium border-r border-gray-100"
                  style={{ left: `${m.left}%`, width: `${m.width}%` }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Rows */}
            {sorted.map((p) => {
              const left = ((new Date(p.startDate).getTime() - minDate.getTime()) / 86400000 / totalDays) * 100;
              const width = ((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / 86400000 / totalDays) * 100;
              const color = STATUS_COLOR[p.status] ?? "bg-indigo-400";
              return (
                <div key={p.id} className="h-12 relative border-b border-gray-50 flex items-center">
                  {/* Grid lines */}
                  {months.map((m) => (
                    <div
                      key={m.label}
                      className="absolute top-0 h-full border-r border-gray-100"
                      style={{ left: `${m.left + m.width}%` }}
                    />
                  ))}
                  {/* Bar */}
                  <div
                    className={`absolute h-7 ${color} rounded-lg flex items-center px-2 shadow-sm`}
                    style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(1, width)}%` }}
                    title={`${p.name} — %${p.progress}`}
                  >
                    {/* Progress overlay */}
                    <div
                      className="absolute left-0 top-0 h-full bg-white/20 rounded-lg"
                      style={{ width: `${p.progress}%` }}
                    />
                    <span className="text-white text-xs font-medium truncate relative z-10">
                      %{p.progress}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Today line */}
            {todayLeft >= 0 && todayLeft <= 100 && (
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
                style={{ left: `${todayLeft}%` }}
              >
                <div className="absolute -top-0 left-1 text-xs text-red-600 font-medium bg-white px-1">Bugün</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-4">
        {[
          { color: "bg-indigo-500", label: "Aktif" },
          { color: "bg-red-500", label: "Risk Altında" },
          { color: "bg-amber-500", label: "Beklemede" },
          { color: "bg-emerald-500", label: "Tamamlandı" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <div className={`w-3 h-3 rounded ${l.color}`} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "table" | "timeline";
type StatusFilter = "all" | "active" | "at_risk" | "on_hold" | "completed";

export default function PortfolyoPage() {
  const { projects } = useProjectStore();
  const [view, setView] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "agile" | "waterfall">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return projects
      .filter((p) => statusFilter === "all" || p.status === statusFilter)
      .filter((p) => typeFilter === "all" || p.projectType === typeFilter)
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9));
  }, [projects, statusFilter, typeFilter, search]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portföy Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length} proje · {projects.filter((p) => p.status === "active").length} aktif
          </p>
        </div>
        <Link
          href="/projeler/yeni"
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Yeni Proje</span>
        </Link>
      </div>

      {/* Summary */}
      <SummaryBar projects={projects} />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Proje ara..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto scrollbar-none">
          {(["all", "active", "at_risk", "on_hold", "completed"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                statusFilter === s ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {s === "all" ? "Tümü" : s === "active" ? "Aktif" : s === "at_risk" ? "Risk" : s === "on_hold" ? "Beklemede" : "Tamamlandı"}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["all", "agile", "waterfall"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                typeFilter === t ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t === "all" ? "Tür: Tümü" : t === "agile" ? "Agile" : "Waterfall"}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg sm:ml-auto self-end sm:self-auto">
          <button onClick={() => setView("grid")} title="Kart Görünümü"
            className={`p-1.5 rounded-md transition-all ${view === "grid" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500"}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setView("table")} title="Tablo Görünümü"
            className={`p-1.5 rounded-md transition-all ${view === "table" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500"}`}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setView("timeline")} title="Zaman Çizelgesi"
            className={`p-1.5 rounded-md transition-all ${view === "timeline" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500"}`}>
            <CalendarRange className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Result count */}
      {filtered.length !== projects.length && (
        <p className="text-sm text-gray-500">{filtered.length} proje gösteriliyor</p>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Eşleşen proje bulunamadı.</p>
        </div>
      )}

      {/* Views */}
      {view === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
      {view === "table" && filtered.length > 0 && <TableView projects={filtered} />}
      {view === "timeline" && <TimelineView projects={filtered} />}
    </div>
  );
}
