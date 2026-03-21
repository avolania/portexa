"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { ProjectStatusBadge, PriorityBadge } from "@/components/ui/Badge";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import WaterfallBoard from "@/components/kanban/WaterfallBoard";
import GovernancePanel from "@/components/governance/GovernancePanel";
import NewTaskModal from "@/components/tasks/NewTaskModal";
import { ArrowLeft, Calendar, Users, DollarSign, Settings, Zap, GitMerge, Download, LayoutList, Shield, Plus, Database, UserPlus, Trash2, Search, X, ClipboardList, CheckCircle2, Circle, Clock, Save } from "lucide-react";
import Link from "next/link";
import { exportProjectPlan } from "@/lib/exportExcel";
import { useTeamStore } from "@/store/useTeamStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ROLE_META } from "@/lib/permissions";
import Avatar from "@/components/ui/Avatar";
import * as XLSX from "xlsx";
import type { Project, Task, TeamMember, User, PhasePlanEntry, ProjectPhase } from "@/types";
import { DEFAULT_PHASES } from "@/components/kanban/WaterfallBoard";

export default function ProjeDetayPage() {
  const params = useParams();
  const { projects, getProjectTasks, updateProject } = useProjectStore();
  const { members: teamMembers, assignProject, unassignProject } = useTeamStore();
  const profiles = useAuthStore((s) => s.profiles);
  const project = projects.find((p) => p.id === params.id);
  const [activeTab, setActiveTab] = useState<"tasks" | "governance" | "team" | "plan" | "data">("tasks");
  const [showNewTask, setShowNewTask] = useState(false);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Proje bulunamadı</h2>
        <Link href="/projeler" className="text-indigo-600 hover:underline text-sm">
          Projeler listesine dön
        </Link>
      </div>
    );
  }

  const budgetPct = project.budget && project.budgetUsed
    ? Math.round((project.budgetUsed / project.budget) * 100)
    : null;

  const isAgile = project.projectType === "agile";

  const handleExport = () => {
    const tasks = getProjectTasks(project.id);
    exportProjectPlan(project, tasks);
  };

  // Projedeki üyeleri ekipten veya profillerden çöz
  const resolveManagerName = () => {
    const tm = teamMembers.find((m) => m.id === project.managerId || m.email === project.managerId);
    if (tm) return tm.name;
    const prof = Object.values(profiles).find((p) => p.id === project.managerId);
    return prof?.name ?? "—";
  };

  const handleAddMember = (memberId: string) => {
    if (project.members.includes(memberId)) return;
    updateProject(project.id, { members: [...project.members, memberId] });
    // teamStore'da da güncelle
    const tm = teamMembers.find((m) => m.id === memberId);
    if (tm) assignProject(memberId, project.id);
  };

  const handleRemoveMember = (memberId: string) => {
    updateProject(project.id, { members: project.members.filter((id) => id !== memberId) });
    const tm = teamMembers.find((m) => m.id === memberId);
    if (tm) unassignProject(memberId, project.id);
  };

  return (
    <div className="max-w-full space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/projeler" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isAgile
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-cyan-50 text-cyan-700 border-cyan-200"
            }`}>
              {isAgile ? <Zap className="w-3 h-3" /> : <GitMerge className="w-3 h-3" />}
              {isAgile ? "Agile" : "Waterfall"}
            </div>
          </div>
          {project.description && (
            <p className="text-sm text-gray-500">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
            Ayarlar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card py-3">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium">Bitiş Tarihi</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {new Date(project.endDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>

        <div className="card py-3">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Ekip</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">{project.members.length} üye</div>
          <div className="text-xs text-gray-400 mt-0.5">PM: {resolveManagerName()}</div>
        </div>

        <div className="card py-3">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <span className="text-xs font-medium">İlerleme</span>
          </div>
          <div className="text-sm font-semibold text-gray-900 mb-1.5">{project.progress}%</div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${project.progress}%` }} />
          </div>
        </div>

        {budgetPct !== null ? (
          <div className="card py-3">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Bütçe</span>
            </div>
            <div className={`text-sm font-semibold mb-1.5 ${budgetPct > 85 ? "text-red-600" : "text-gray-900"}`}>
              {budgetPct}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-full rounded-full ${budgetPct > 90 ? "bg-red-500" : budgetPct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="card py-3">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              {isAgile ? <Zap className="w-4 h-4" /> : <GitMerge className="w-4 h-4" />}
              <span className="text-xs font-medium">{isAgile ? "Sprint" : "Metot"}</span>
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {isAgile ? `Sprint ${project.currentSprint ?? 1}` : "Şelale Modeli"}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {isAgile ? "Scrum / Kanban" : "Faz bazlı akış"}
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      {project.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {project.tags.map((tag) => (
            <span key={tag} className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 flex items-center justify-between">
        <div className="flex gap-1">
          {([
            { id: "tasks",      label: "Görevler",      icon: LayoutList },
            { id: "governance", label: "Yönetişim",     icon: Shield },
            { id: "team",       label: "Ekip",          icon: Users },
            ...(!isAgile ? [{ id: "plan" as const, label: "Plan", icon: ClipboardList }] : []),
            { id: "data",       label: "Veri Yönetimi", icon: Database },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "tasks" && (
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors mb-px"
          >
            <Plus className="w-4 h-4" />
            Görev Ekle
          </button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === "tasks" && (
        isAgile ? (
          <KanbanBoard projectId={project.id} currentSprint={project.currentSprint} />
        ) : (
          <WaterfallBoard projectId={project.id} />
        )
      )}

      {activeTab === "governance" && <GovernancePanel projectId={project.id} />}

      {activeTab === "team" && (
        <TeamTab
          project={project}
          teamMembers={teamMembers}
          profiles={profiles}
          onAdd={handleAddMember}
          onRemove={handleRemoveMember}
        />
      )}

      {activeTab === "plan" && (
        <PlanTab project={project} onUpdate={(phasePlan) => updateProject(project.id, { phasePlan })} />
      )}

      {activeTab === "data" && <DataTab project={project} />}

      {showNewTask && (
        <NewTaskModal
          projectId={project.id}
          isAgile={isAgile}
          currentSprint={project.currentSprint}
          onClose={() => setShowNewTask(false)}
        />
      )}
    </div>
  );
}

// ─── Team Tab ────────────────────────────────────────────────────────────────

function TeamTab({
  project,
  teamMembers,
  profiles,
  onAdd,
  onRemove,
}: {
  project: Project;
  teamMembers: TeamMember[];
  profiles: Record<string, User>;
  onAdd: (memberId: string) => void;
  onRemove: (memberId: string) => void;
}) {
  const [search, setSearch] = useState("");

  // Projedeki mevcut üyeleri çöz: önce teamStore, yoksa profiles
  const currentMembers = project.members.map((id) => {
    const tm = teamMembers.find((m) => m.id === id);
    if (tm) return { id: tm.id, name: tm.name, email: tm.email, role: tm.role, title: tm.title };
    const prof = Object.values(profiles).find((p) => p.id === id);
    if (prof) return { id: prof.id, name: prof.name, email: prof.email, role: prof.role, title: prof.title };
    return null;
  }).filter(Boolean) as { id: string; name: string; email: string; role: NonNullable<TeamMember["role"]>; title?: string }[];

  // Eklenebilecek üyeler: teamStore'da olup projede olmayan
  const available = teamMembers.filter(
    (m) => !project.members.includes(m.id)
  );

  const filteredAvailable = available.filter((m) => {
    const q = search.toLowerCase();
    return (
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.title ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Sol: Mevcut ekip */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Projedeki Ekip
            <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{currentMembers.length}</span>
          </h3>
        </div>

        {currentMembers.length === 0 ? (
          <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Henüz ekip üyesi eklenmemiş.</p>
            <p className="text-xs mt-1">Sağ panelden üye seçin.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentMembers.map((m) => {
              const meta = ROLE_META[m.role];
              return (
                <div key={m.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <Avatar name={m.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{m.name}</div>
                    <div className="text-xs text-gray-400 truncate">{m.email}</div>
                    {m.title && <div className="text-xs text-gray-400 truncate">{m.title}</div>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                  <button
                    onClick={() => onRemove(m.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Projeden çıkar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sağ: Eklenebilecek üyeler */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Eklenebilecek Üyeler
          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{available.length}</span>
        </h3>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, e-posta veya unvan ara..."
            className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {available.length === 0 ? (
          <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Tüm ekip üyeleri projede.</p>
          </div>
        ) : filteredAvailable.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Eşleşen üye bulunamadı.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAvailable.map((m) => {
              const meta = ROLE_META[m.role];
              return (
                <div key={m.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-200 transition-colors">
                  <Avatar name={m.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{m.name}</div>
                    <div className="text-xs text-gray-400 truncate">{m.email}</div>
                    {m.title && <div className="text-xs text-gray-400 truncate">{m.title}</div>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                  <button
                    onClick={() => onAdd(m.id)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Ekle
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Plan Tab ────────────────────────────────────────────────────────────────

function PlanTab({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: (phasePlan: Partial<Record<string, PhasePlanEntry>>) => void;
}) {
  const { getProjectTasks, updateProject } = useProjectStore();
  const allTasks = getProjectTasks(project.id);

  // ── Faz listesi state ──────────────────────────────────────────────────────
  const [phases, setPhases] = useState<ProjectPhase[]>(
    project.phases ?? DEFAULT_PHASES.map((p) => ({ id: p.id, label: p.label, icon: p.icon }))
  );
  const [phasesDirty, setPhasesDirty] = useState(false);

  // ── Plan entries state ─────────────────────────────────────────────────────
  const [form, setForm] = useState<Partial<Record<string, PhasePlanEntry>>>(
    project.phasePlan ?? {}
  );
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const anyDirty = dirty || phasesDirty;

  const setField = (phaseId: string, field: keyof PhasePlanEntry, value: string) => {
    setForm((prev) => ({
      ...prev,
      [phaseId]: { ...(prev[phaseId] ?? {}), [field]: value },
    }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = () => {
    // Faz listesi değiştiyse kaydet
    if (phasesDirty) {
      updateProject(project.id, { phases });
      setPhasesDirty(false);
    }
    // Plan girişlerini kaydet
    onUpdate(form);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setPhases(project.phases ?? DEFAULT_PHASES.map((p) => ({ id: p.id, label: p.label, icon: p.icon })));
    setForm(project.phasePlan ?? {});
    setDirty(false);
    setPhasesDirty(false);
    setSaved(false);
  };

  // ── Faz düzenleme helpers ──────────────────────────────────────────────────
  const updatePhase = (idx: number, field: keyof ProjectPhase, value: string) => {
    setPhases((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
    setPhasesDirty(true);
    setSaved(false);
  };

  const movePhase = (idx: number, dir: -1 | 1) => {
    const next = [...phases];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setPhases(next);
    setPhasesDirty(true);
    setSaved(false);
  };

  const removePhase = (idx: number) => {
    setPhases((prev) => prev.filter((_, i) => i !== idx));
    setPhasesDirty(true);
    setSaved(false);
  };

  const addPhase = () => {
    const id = `phase_${Date.now().toString(36)}`;
    setPhases((prev) => [...prev, { id, label: "Yeni Faz", icon: "📌" }]);
    setPhasesDirty(true);
    setSaved(false);
  };

  return (
    <div className="space-y-6">

      {/* ── Faz yapılandırması ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Fazları Düzenle</h3>
            <p className="text-xs text-gray-500 mt-0.5">Faz adlarını değiştirin, sıralayin, ekleyin veya silin.</p>
          </div>
          <button
            onClick={addPhase}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
          >
            <Plus className="w-3.5 h-3.5" />
            Faz Ekle
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {phases.map((phase, idx) => (
            <div key={phase.id} className="flex items-center gap-3 px-4 py-2.5">
              {/* Icon input */}
              <input
                type="text"
                value={phase.icon ?? ""}
                onChange={(e) => updatePhase(idx, "icon", e.target.value)}
                className="w-12 text-center text-lg border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                title="Emoji ikonu"
                maxLength={4}
              />
              {/* Label input */}
              <input
                type="text"
                value={phase.label}
                onChange={(e) => updatePhase(idx, "label", e.target.value)}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-medium"
              />
              {/* Up / Down */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => movePhase(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-25 rounded"
                  title="Yukarı taşı"
                >
                  ▲
                </button>
                <button
                  onClick={() => movePhase(idx, 1)}
                  disabled={idx === phases.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-25 rounded"
                  title="Aşağı taşı"
                >
                  ▼
                </button>
              </div>
              {/* Delete */}
              <button
                onClick={() => removePhase(idx)}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Fazı sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {phases.length === 0 && (
            <div className="text-center py-6 text-sm text-gray-400">
              Hiç faz yok. "Faz Ekle" ile ekleyin.
            </div>
          )}
        </div>
      </div>

      {/* ── Plan girişleri ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Faz Planı</h3>
            <p className="text-xs text-gray-500 mt-0.5">Her faz için tarih aralığı, sorumlu ve notları düzenleyin.</p>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Kaydedildi
              </span>
            )}
            {anyDirty && (
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Kaydedilmemiş değişiklik
              </span>
            )}
            <button
              onClick={handleReset}
              disabled={!anyDirty}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={!anyDirty}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              Kaydet
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {phases.map((phase) => {
            const phaseTasks = allTasks.filter((t) => t.phase === phase.id);
            const doneTasks = phaseTasks.filter((t) => t.status === "done");
            const entry = form[phase.id] ?? {};
            const phaseStatus =
              phaseTasks.length === 0 ? "empty"
              : doneTasks.length === phaseTasks.length ? "completed"
              : "active";

            return (
              <div key={phase.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                  <span className="text-lg">{phase.icon ?? "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{phase.label}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {phaseTasks.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {doneTasks.length}/{phaseTasks.length} tamamlandı
                      </span>
                    )}
                    {phaseStatus === "completed" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {phaseStatus === "active"    && <Clock className="w-4 h-4 text-amber-500" />}
                    {phaseStatus === "empty"     && <Circle className="w-4 h-4 text-gray-300" />}
                  </div>
                </div>

                <div className="bg-white px-4 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Başlangıç Tarihi</label>
                    <input
                      type="date"
                      value={entry.startDate ?? ""}
                      onChange={(e) => setField(phase.id, "startDate", e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={entry.endDate ?? ""}
                      onChange={(e) => setField(phase.id, "endDate", e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sorumlu</label>
                    <input
                      type="text"
                      value={entry.owner ?? ""}
                      onChange={(e) => setField(phase.id, "owner", e.target.value)}
                      placeholder="Sorumlu adı..."
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Notlar</label>
                    <input
                      type="text"
                      value={entry.notes ?? ""}
                      onChange={(e) => setField(phase.id, "notes", e.target.value)}
                      placeholder="Kısa not..."
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Data Tab ────────────────────────────────────────────────────────────────


const TASK_TEMPLATE_HEADERS = [
  "title", "description", "issueType", "priority", "status",
  "assigneeId", "startDate", "dueDate", "estimatedHours", "storyPoints", "sprint", "phase", "tags",
];

const EXAMPLE_ROW_AGILE = [
  "Örnek Görev", "Açıklama", "task", "medium", "todo",
  "1", "2026-04-01", "2026-04-10", "8", "5", "3", "", "frontend,api",
];

const EXAMPLE_ROW_WATERFALL = [
  "Örnek Görev", "Açıklama", "task", "medium", "todo",
  "1", "2026-04-01", "2026-04-10", "8", "", "", "development", "backend",
];

function DataTab({ project }: { project: Project }) {
  const { addTask, getProjectTasks } = useProjectStore();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);

  function downloadTemplate() {
    const isAgile = project.projectType === "agile";
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      TASK_TEMPLATE_HEADERS,
      isAgile ? EXAMPLE_ROW_AGILE : EXAMPLE_ROW_WATERFALL,
    ]);
    ws["!cols"] = TASK_TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, "Görevler");
    XLSX.writeFile(wb, `${project.name}_Görev_Şablonu.xlsx`);
  }

  function downloadExport() {
    exportProjectPlan(project, getProjectTasks(project.id));
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        let success = 0;
        const errors: string[] = [];

        rows.forEach((row, i) => {
          const title = String(row.title ?? "").trim();
          if (!title) {
            errors.push(`Satır ${i + 2}: "title" alanı boş`);
            return;
          }
          addTask({
            id: crypto.randomUUID(),
            projectId: project.id,
            title,
            description: row.description || undefined,
            issueType: (row.issueType as Task["issueType"]) || "task",
            priority: (row.priority as Task["priority"]) || "medium",
            status: (row.status as Task["status"]) || "todo",
            assigneeId: row.assigneeId || undefined,
            startDate: row.startDate || undefined,
            dueDate: row.dueDate || undefined,
            estimatedHours: row.estimatedHours ? Number(row.estimatedHours) : undefined,
            loggedHours: 0,
            storyPoints: row.storyPoints ? Number(row.storyPoints) : undefined,
            sprint: row.sprint ? Number(row.sprint) : undefined,
            phase: (row.phase as Task["phase"]) || undefined,
            tags: row.tags ? String(row.tags).split(",").map((t) => t.trim()).filter(Boolean) : [],
            subtasks: [],
            dependencies: [],
            attachments: [],
            comments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            order: 0,
          });
          success++;
        });

        setImportResult({ success, errors });
      } catch {
        setImportResult({ success: 0, errors: ["Dosya okunamadı. Geçerli bir Excel dosyası yükleyin."] });
      } finally {
        setImporting(false);
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const tasks = getProjectTasks(project.id);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Toplam Görev", value: tasks.length },
          { label: "Tamamlanan", value: tasks.filter((t) => t.status === "done").length },
          { label: "Devam Eden", value: tasks.filter((t) => t.status === "in_progress").length },
        ].map((s) => (
          <div key={s.label} className="card text-center py-4">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Export */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Dışa Aktar</h3>
        <p className="text-xs text-gray-500 mb-4">Proje planı, ekip ve maliyet verilerini Excel olarak indirin.</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={downloadExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Proje Planı & Maliyetler (.xlsx)
          </button>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Görev Şablonunu İndir
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">İçe Aktar</h3>
        <p className="text-xs text-gray-500 mb-4">
          Excel dosyasından toplu görev yükleyin. Önce şablonu indirip doldurun.
        </p>

        <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl py-8 px-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors group">
          <Database className="w-8 h-8 text-gray-300 group-hover:text-indigo-400 mb-2 transition-colors" />
          <span className="text-sm font-medium text-gray-600 group-hover:text-indigo-600">Excel dosyası seçin</span>
          <span className="text-xs text-gray-400 mt-1">.xlsx veya .xls</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
            disabled={importing}
          />
        </label>

        {importing && (
          <div className="mt-3 flex items-center gap-2 text-sm text-indigo-600">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            İçe aktarılıyor...
          </div>
        )}

        {importResult && (
          <div className="mt-4 space-y-2">
            {importResult.success > 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                ✓ {importResult.success} görev başarıyla eklendi.
              </div>
            )}
            {importResult.errors.map((err, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                ⚠ {err}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Column guide */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Sütun Rehberi</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Sütun</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Zorunlu</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Geçerli Değerler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { col: "title",          req: "Evet", vals: "Herhangi bir metin" },
                { col: "issueType",      req: "Hayır", vals: "epic, story, task, bug, subtask, improvement, test" },
                { col: "priority",       req: "Hayır", vals: "low, medium, high, critical" },
                { col: "status",         req: "Hayır", vals: "todo, in_progress, review, done" },
                { col: "assigneeId",     req: "Hayır", vals: "1, 2, 3, 4 (üye ID)" },
                { col: "startDate",      req: "Hayır", vals: "YYYY-MM-DD" },
                { col: "dueDate",        req: "Hayır", vals: "YYYY-MM-DD" },
                { col: "estimatedHours", req: "Hayır", vals: "Sayı" },
                { col: "storyPoints",    req: "Hayır", vals: "Sayı (Agile)" },
                { col: "sprint",         req: "Hayır", vals: "Sayı (Agile)" },
                { col: "phase",          req: "Hayır", vals: "requirements, design, development, testing, deployment (Waterfall)" },
                { col: "tags",           req: "Hayır", vals: "Virgülle ayrılmış etiketler" },
              ].map((r) => (
                <tr key={r.col} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-indigo-700">{r.col}</td>
                  <td className="px-3 py-2">{r.req === "Evet" ? <span className="text-red-600 font-semibold">Evet</span> : <span className="text-gray-400">Hayır</span>}</td>
                  <td className="px-3 py-2 text-gray-500">{r.vals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
