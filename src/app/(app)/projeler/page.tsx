"use client";

import { useState } from "react";
import { Plus, Search, LayoutGrid, List, MoreHorizontal, Calendar, Users, Zap, GitMerge, CheckSquare } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ProjectStatusBadge, PriorityBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Link from "next/link";
import type { Project, ProjectStatus } from "@/types";
import NewProjectModal from "@/components/projects/NewProjectModal";
import PermissionGate from "@/components/auth/PermissionGate";

export default function ProjelerPage() {
  const { projects } = useProjectStore();
  const profiles = useAuthStore((s) => s.profiles);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showNewProject, setShowNewProject] = useState(false);

  const filtered = projects.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projeler</h1>
          <p className="text-sm text-gray-500 mt-1">{projects.length} proje</p>
        </div>
        <PermissionGate permission="project.create">
          <Button onClick={() => setShowNewProject(true)}>
            <Plus className="w-4 h-4" />
            Yeni Proje
          </Button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-52 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Proje ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {(["all", "active", "at_risk", "on_hold", "completed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {s === "all" ? "Tümü" : s === "active" ? "Aktif" : s === "at_risk" ? "Riskli" : s === "on_hold" ? "Beklemede" : "Tamamlandı"}
            </button>
          ))}
        </div>

        <div className="sm:ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1 self-end sm:self-auto">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Project Grid / List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-500">
              <div className="text-4xl mb-3">📁</div>
              <p className="text-base font-medium text-gray-700">Proje bulunamadı</p>
              <p className="text-sm mt-1">Farklı bir arama terimi deneyin veya filtreleyi temizleyin.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proje</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Tip</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Durum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Öncelik</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">İlerleme</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Bitiş</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">PM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/projeler/${project.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600">
                      {project.name}
                    </Link>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-1">
                      {project.tags.map((t) => <span key={t} className="bg-gray-100 px-1.5 py-0.5 rounded">{t}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                      project.projectType === "agile"
                        ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                        : "bg-cyan-50 text-cyan-600 border-cyan-200"
                    }`}>
                      {project.projectType === "agile" ? <Zap className="w-3 h-3" /> : <GitMerge className="w-3 h-3" />}
                      {project.projectType === "agile" ? "Agile" : "Waterfall"}
                    </span>
                  </td>
                  <td className="px-4 py-3"><ProjectStatusBadge status={project.status} /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><PriorityBadge priority={project.priority} /></td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-1.5">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${project.progress}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{project.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(project.endDate).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Avatar name={profiles[project.managerId]?.name ?? "PM"} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const profiles = useAuthStore((s) => s.profiles);
  const allTasks = useProjectStore((s) => s.tasks);

  const managerProfile = profiles[project.managerId];
  const managerName = managerProfile?.name ?? "";
  const managerInitials = managerName
    ? managerName.split(" ").filter(Boolean).map((n) => n[0].toUpperCase()).slice(0, 2).join("")
    : "PM";
  const managerFirstName = managerName ? managerName.split(" ")[0] : "Yönetici";

  const projectTasks = allTasks.filter((t) => t.projectId === project.id);
  const doneTasks = projectTasks.filter((t) => t.status === "done").length;
  const progress = projectTasks.length > 0
    ? Math.round((doneTasks / projectTasks.length) * 100)
    : project.progress;

  const budgetPct = project.budget && project.budgetUsed
    ? Math.round((project.budgetUsed / project.budget) * 100)
    : null;

  const endDate = project.endDate ? new Date(project.endDate) : null;
  const endDateStr = endDate && !isNaN(endDate.getTime())
    ? endDate.toLocaleDateString("tr-TR")
    : "—";

  return (
    <div className="card hover:shadow-md transition-shadow flex flex-col h-full">
      {/* Badges + menu */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ProjectStatusBadge status={project.status} />
          <PriorityBadge priority={project.priority} />
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
            project.projectType === "agile"
              ? "bg-indigo-50 text-indigo-600 border-indigo-200"
              : "bg-cyan-50 text-cyan-600 border-cyan-200"
          }`}>
            {project.projectType === "agile" ? <Zap className="w-3 h-3" /> : <GitMerge className="w-3 h-3" />}
            {project.projectType === "agile" ? "Agile" : "Waterfall"}
          </span>
        </div>
        {/* PM etiketi */}
        <span className="flex-shrink-0 inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2 py-0.5 text-xs font-semibold">
          <span className="w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">
            {managerInitials}
          </span>
          {managerFirstName}
        </span>
      </div>

      {/* Title + description — sabit yükseklik */}
      <div className="mb-4 min-h-[4rem]">
        <Link href={`/projeler/${project.id}`}>
          <h3 className="text-base font-semibold text-gray-900 hover:text-indigo-600 mb-1 line-clamp-1">{project.name}</h3>
        </Link>
        <p className="text-sm text-gray-400 line-clamp-2 min-h-[2.5rem]">
          {project.description || ""}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>İlerleme</span>
          <span className="font-medium text-gray-700">{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-full rounded-full transition-all ${project.status === "at_risk" ? "bg-red-500" : "bg-indigo-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Budget */}
      <div className="mb-3 min-h-[2rem]">
        {budgetPct !== null ? (
          <>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Bütçe</span>
              <span className={budgetPct > 85 ? "text-red-600 font-medium" : "font-medium text-gray-700"}>{budgetPct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className={`h-full rounded-full ${budgetPct > 90 ? "bg-red-500" : budgetPct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
          </>
        ) : null}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{endDateStr}</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{project.members.length} üye</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckSquare className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{doneTasks}/{projectTasks.length}</span>
        </div>
      </div>
    </div>
  );
}
