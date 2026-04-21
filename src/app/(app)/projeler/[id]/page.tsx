"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { ProjectStatusBadge, PriorityBadge } from "@/components/ui/Badge";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import WaterfallBoard from "@/components/kanban/WaterfallBoard";
import GovernancePanel from "@/components/governance/GovernancePanel";
import NewTaskModal from "@/components/tasks/NewTaskModal";
import { ArrowLeft, Calendar, Users, DollarSign, Settings, Zap, GitMerge, Download, LayoutList, Shield, Plus, Database, UserPlus, Trash2, Search, X, ClipboardList, CheckCircle2, Circle, Clock, Save, Wallet, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { exportProjectPlan } from "@/lib/exportExcel";
import { useTeamStore } from "@/store/useTeamStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { DEFAULT_PROJECT_ROLES } from "@/services/settingsService";
import { ROLE_META } from "@/lib/permissions";
import Avatar from "@/components/ui/Avatar";
import * as XLSX from "xlsx";
import type { Project, Task, TeamMember, User, PhasePlanEntry, ProjectPhase } from "@/types";
import { DEFAULT_PHASES } from "@/components/kanban/WaterfallBoard";
import { CURRENCIES, formatCurrency as formatCurrencyLib } from "@/lib/currencies";

export default function ProjeDetayPage() {
  const params = useParams();
  const router = useRouter();
  const { projects, getProjectTasks, updateProject, deleteProject } = useProjectStore();
  const { members: teamMembers, assignProject, unassignProject } = useTeamStore();
  const profiles = useAuthStore((s) => s.profiles);
  const projectRoles = useSettingsStore((s) =>
    s.settings.projectRoles?.length ? s.settings.projectRoles : DEFAULT_PROJECT_ROLES
  );
  const project = projects.find((p) => p.id === params.id);
  const [activeTab, setActiveTab] = useState<"tasks" | "governance" | "team" | "plan" | "budget" | "data">("tasks");
  const [showNewTask, setShowNewTask] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

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

  const withSave = async (fn: () => Promise<void>) => {
    setSaveState("saving");
    try {
      await fn();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const handleSaveTeamMembers = async (
    newMembers: string[],
    memberRoles?: Record<string, string>,
    responsibilities?: import("@/types").ProjectResponsibility[],
    ownerId?: string,
  ) => {
    const added = newMembers.filter((id) => !project.members.includes(id));
    const removed = project.members.filter((id) => !newMembers.includes(id));
    // ownerId boş string → null (JSON'da açıkça null yaz, undefined olursa JSON'dan düşer)
    const ownerIdToSave: string | null = ownerId || null;
    await updateProject(project.id, { members: newMembers, memberRoles, responsibilities, ownerId: ownerIdToSave });
    added.forEach((id) => {
      const tm = teamMembers.find((m) => m.id === id);
      if (tm) assignProject(id, project.id);
    });
    removed.forEach((id) => {
      const tm = teamMembers.find((m) => m.id === id);
      if (tm) unassignProject(id, project.id);
    });
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
          {saveState === "saving" && (
            <span className="flex items-center gap-1.5 text-sm text-gray-500 animate-pulse">
              <Save className="w-4 h-4" /> Kaydediliyor...
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> Kaydedildi
            </span>
          )}
          {saveState === "error" && (
            <span className="flex items-center gap-1.5 text-sm text-red-600">
              Kaydedilemedi — tekrar deneyin
            </span>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
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
            { id: "budget",     label: "Bütçe",         icon: Wallet },
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
          projectRoles={projectRoles}
          onSave={handleSaveTeamMembers}
        />
      )}

      {activeTab === "plan" && (
        <PlanTab project={project} onUpdate={(phasePlan) => withSave(() => updateProject(project.id, { phasePlan }))} />
      )}

      {activeTab === "budget" && (
        <BudgetTab project={project} onUpdate={(patch) => withSave(() => updateProject(project.id, patch))} />
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

      {showSettings && (
        <ProjectSettingsModal
          project={project}
          onSave={async (patch) => { await updateProject(project.id, patch); }}
          onDelete={async () => { await deleteProject(project.id); router.push("/projeler"); }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ─── Project Settings Modal ───────────────────────────────────────────────────

function ProjectSettingsModal({
  project,
  onSave,
  onDelete,
  onClose,
}: {
  project: Project;
  onSave: (patch: Partial<Project>) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    priority: project.priority,
    startDate: project.startDate,
    endDate: project.endDate,
    tags: project.tags.join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    form.name !== project.name ||
    form.description !== (project.description ?? "") ||
    form.status !== project.status ||
    form.priority !== project.priority ||
    form.startDate !== project.startDate ||
    form.endDate !== project.endDate ||
    form.tags !== project.tags.join(", ");

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status as import("@/types").ProjectStatus,
        priority: form.priority as import("@/types").Priority,
        startDate: form.startDate,
        endDate: form.endDate,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      onClose();
    } catch {
      setError("Kaydedilemedi. Tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      setError("Silinemedi. Tekrar deneyin.");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all";
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-400" />
              <h2 className="text-base font-bold text-gray-900">Proje Ayarları</h2>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Proje Adı */}
            <div>
              <label className={labelCls}>Proje Adı *</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Proje adı..."
              />
            </div>

            {/* Açıklama */}
            <div>
              <label className={labelCls}>Açıklama</label>
              <textarea
                className={inputCls}
                rows={2}
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                placeholder="Proje açıklaması..."
              />
            </div>

            {/* Status & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Durum</label>
                <select
                  className={inputCls}
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as typeof form.status }))}
                >
                  <option value="active">Aktif</option>
                  <option value="on_hold">Beklemede</option>
                  <option value="at_risk">Riskli</option>
                  <option value="completed">Tamamlandı</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Öncelik</label>
                <select
                  className={inputCls}
                  value={form.priority}
                  onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value as typeof form.priority }))}
                >
                  <option value="low">Düşük</option>
                  <option value="medium">Orta</option>
                  <option value="high">Yüksek</option>
                  <option value="critical">Kritik</option>
                </select>
              </div>
            </div>

            {/* Tarihler */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Başlangıç Tarihi</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.startDate}
                  onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Bitiş Tarihi</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.endDate}
                  onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Etiketler */}
            <div>
              <label className={labelCls}>Etiketler (virgülle ayırın)</label>
              <input
                className={inputCls}
                value={form.tags}
                onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value }))}
                placeholder="web, react, api..."
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
            )}

            {/* Kaydet / İptal */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !dirty || !form.name.trim()}
                className="flex-1 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Kaydediliyor...</>
                ) : (
                  <><Save className="w-4 h-4" />Kaydet</>
                )}
              </button>
            </div>

            {/* Danger Zone */}
            <div className="border border-red-200 rounded-xl p-4 mt-2 bg-red-50/50">
              <h3 className="text-sm font-semibold text-red-700 mb-1">Tehlikeli Alan</h3>
              <p className="text-xs text-red-600 mb-3">
                Projeyi silmek tüm görevleri ve verileri kalıcı olarak siler.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 border border-red-300 bg-white rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Projeyi Sil
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-700">
                    Emin misiniz? Bu işlem geri alınamaz.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="flex-1 py-2 text-sm font-medium border border-gray-200 bg-white rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Vazgeç
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {deleting ? "Siliniyor..." : <><Trash2 className="w-3.5 h-3.5" />Evet, Sil</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Team Tab ────────────────────────────────────────────────────────────────

function TeamTab({
  project,
  teamMembers,
  profiles,
  projectRoles,
  onSave,
}: {
  project: Project;
  teamMembers: TeamMember[];
  profiles: Record<string, User>;
  projectRoles: string[];
  onSave: (
    members: string[],
    memberRoles: Record<string, string>,
    responsibilities: import("@/types").ProjectResponsibility[],
    ownerId: string,
  ) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [pendingMembers, setPendingMembers] = useState<string[]>(project.members);
  const [ownerId, setOwnerId] = useState<string>(project.ownerId ?? "");
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>(project.memberRoles ?? {});
  const [responsibilities, setResponsibilities] = useState<import("@/types").ProjectResponsibility[]>(
    project.responsibilities ?? []
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const membersChanged =
    pendingMembers.length !== project.members.length ||
    [...pendingMembers].sort().some((id, i) => [...project.members].sort()[i] !== id);
  const ownerChanged = ownerId !== (project.ownerId ?? "");
  const rolesChanged = JSON.stringify(memberRoles) !== JSON.stringify(project.memberRoles ?? {});
  const respChanged = JSON.stringify(responsibilities) !== JSON.stringify(project.responsibilities ?? []);
  const dirty = membersChanged || ownerChanged || rolesChanged || respChanged;

  const handleAdd = (memberId: string) => {
    if (pendingMembers.includes(memberId)) return;
    setPendingMembers((prev) => [...prev, memberId]);
  };

  const handleRemove = (memberId: string) => {
    setPendingMembers((prev) => prev.filter((id) => id !== memberId));
    setMemberRoles((prev) => { const next = { ...prev }; delete next[memberId]; return next; });
    setResponsibilities((prev) => prev.map((r) => r.assigneeId === memberId ? { ...r, assigneeId: "" } : r));
  };

  const setMemberRole = (memberId: string, role: string) => {
    setMemberRoles((prev) => ({ ...prev, [memberId]: role }));
  };

  const addResponsibility = () => {
    setResponsibilities((prev) => [
      ...prev,
      { id: `resp_${Date.now().toString(36)}`, area: "", assigneeId: "", notes: "" },
    ]);
  };

  const updateResp = (id: string, field: keyof import("@/types").ProjectResponsibility, value: string) => {
    setResponsibilities((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeResp = (id: string) => {
    setResponsibilities((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(pendingMembers, memberRoles, responsibilities, ownerId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Kaydedilemedi. Tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPendingMembers(project.members);
    setOwnerId(project.ownerId ?? "");
    setMemberRoles(project.memberRoles ?? {});
    setResponsibilities(project.responsibilities ?? []);
    setSaveError(null);
    setSaved(false);
  };

  const currentMembers = pendingMembers.map((id) => {
    const tm = teamMembers.find((m) => m.id === id);
    if (tm) return { id: tm.id, name: tm.name, email: tm.email, role: tm.role, title: tm.title };
    const prof = Object.values(profiles).find((p) => p.id === id);
    if (prof) return { id: prof.id, name: prof.name, email: prof.email, role: prof.role, title: prof.title };
    return null;
  }).filter(Boolean) as { id: string; name: string; email: string; role: NonNullable<TeamMember["role"]>; title?: string }[];

  const available = teamMembers.filter((m) => !pendingMembers.includes(m.id));
  const filteredAvailable = available.filter((m) => {
    const q = search.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.title ?? "").toLowerCase().includes(q);
  });

  const memberOptions = currentMembers.map((m) => ({ id: m.id, name: m.name }));

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {dirty && !saved && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Kaydedilmemiş değişiklik
            </span>
          )}
          {saved && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Kaydedildi
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1 text-xs font-medium text-white bg-red-500 px-3 py-1 rounded-lg">
              ⚠ {saveError}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCancel} disabled={!dirty || saving}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            İptal
          </button>
          <button onClick={handleSave} disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Kaydediliyor...</> : <><Save className="w-3.5 h-3.5" />Kaydet</>}
          </button>
        </div>
      </div>

      {/* Proje Sahibi */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Proje Sahibi</label>
          <select
            value={ownerId}
            onChange={(e) => { setOwnerId(e.target.value); setSaved(false); }}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">— Seçin</option>
            {currentMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        {ownerId && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Avatar name={currentMembers.find((m) => m.id === ownerId)?.name ?? ""} size="sm" />
            <div>
              <div className="text-sm font-medium text-gray-900">
                {currentMembers.find((m) => m.id === ownerId)?.name ?? ""}
              </div>
              <div className="text-xs text-indigo-600 font-medium">Proje Sahibi</div>
            </div>
          </div>
        )}
      </div>

      {/* Üye yönetimi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sol: Mevcut ekip + rol ataması */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Projedeki Ekip
            <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{currentMembers.length}</span>
          </h3>

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
                  <div key={m.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{m.name}</div>
                        <div className="text-xs text-gray-400 truncate">{m.email}</div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                      <button onClick={() => handleRemove(m.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0" title="Projeden çıkar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Proje rolü */}
                    <div className="flex items-center gap-2 pl-9">
                      <select
                        value={memberRoles[m.id] ?? ""}
                        onChange={(e) => setMemberRole(m.id, e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700"
                      >
                        <option value="">— Proje rolü seçin</option>
                        {projectRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
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
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim, e-posta veya unvan ara..."
              className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
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
            <div className="text-center py-8 text-gray-400"><p className="text-sm">Eşleşen üye bulunamadı.</p></div>
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
                    <button onClick={() => handleAdd(m.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0">
                      <UserPlus className="w-3.5 h-3.5" /> Ekle
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sorumluluk Listesi */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Sorumluluk Listesi</h3>
            <p className="text-xs text-gray-500 mt-0.5">Her alan için proje ekibinden sorumlu atayın.</p>
          </div>
          <button onClick={addResponsibility}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200">
            <Plus className="w-3.5 h-3.5" /> Ekle
          </button>
        </div>

        {responsibilities.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Henüz sorumluluk eklenmemiş.</p>
            <p className="text-xs mt-1">"Ekle" butonuyla başlayın.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Başlık satırı */}
            <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-gray-50/50">
              <div className="col-span-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Alan / Konu</div>
              <div className="col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sorumlu</div>
              <div className="col-span-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notlar</div>
              <div className="col-span-1" />
            </div>
            {responsibilities.map((resp) => (
              <div key={resp.id} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center">
                <div className="col-span-4">
                  <input
                    value={resp.area}
                    onChange={(e) => updateResp(resp.id, "area", e.target.value)}
                    placeholder="Ör. Test Yönetimi"
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div className="col-span-3">
                  <select
                    value={resp.assigneeId}
                    onChange={(e) => updateResp(resp.id, "assigneeId", e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">— Seçin</option>
                    {memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="col-span-4">
                  <input
                    value={resp.notes ?? ""}
                    onChange={(e) => updateResp(resp.id, "notes", e.target.value)}
                    placeholder="Kısa not..."
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button onClick={() => removeResp(resp.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
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
  onUpdate: (phasePlan: Partial<Record<string, PhasePlanEntry>>) => Promise<void>;
}) {
  const { getProjectTasks, updateProject } = useProjectStore();
  const { members: teamMembers } = useTeamStore();
  const profiles = useAuthStore((s) => s.profiles);
  const allTasks = getProjectTasks(project.id);

  // Proje üyelerini isimle listele
  const projectMembers = (project.members ?? []).map((memberId) => {
    const tm = teamMembers.find((m) => m.id === memberId);
    if (tm) return { id: memberId, name: tm.name };
    const prof = Object.values(profiles).find((p) => p.id === memberId);
    return { id: memberId, name: prof?.name ?? memberId };
  });

  // ── Faz listesi state ──────────────────────────────────────────────────────
  const [phases, setPhases] = useState<ProjectPhase[]>(
    project.phases ?? DEFAULT_PHASES.map((p) => ({ id: p.id, label: p.label, icon: p.icon }))
  );
  const [phasesDirty, setPhasesDirty] = useState(false);
  const [phasesSaving, setPhasesSaving] = useState(false);
  const [phasesSaved, setPhasesSaved] = useState(false);

  // ── Plan entries state ─────────────────────────────────────────────────────
  const [form, setForm] = useState<Partial<Record<string, PhasePlanEntry>>>(
    project.phasePlan ?? {}
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setPlanSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const setField = (phaseId: string, field: keyof PhasePlanEntry, value: string) => {
    setForm((prev) => ({
      ...prev,
      [phaseId]: { ...(prev[phaseId] ?? {}), [field]: value },
    }));
    setDirty(true);
    setSaved(false);
  };

  // Faz listesi kaydet
  const handleSavePhases = async () => {
    setPhasesSaving(true);
    await updateProject(project.id, { phases });
    setPhasesDirty(false);
    setPhasesSaving(false);
    setPhasesSaved(true);
    setTimeout(() => setPhasesSaved(false), 2500);
  };

  const handleResetPhases = () => {
    setPhases(project.phases ?? DEFAULT_PHASES.map((p) => ({ id: p.id, label: p.label, icon: p.icon })));
    setPhasesDirty(false);
    setPhasesSaved(false);
  };

  // Faz planı kaydet
  const handleSavePlan = async () => {
    setPlanSaving(true);
    await onUpdate(form);
    setDirty(false);
    setPlanSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleResetPlan = () => {
    setForm(project.phasePlan ?? {});
    setDirty(false);
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
            <p className="text-xs text-gray-500 mt-0.5">Faz adlarını değiştirin, sıralayın, ekleyin veya silin.</p>
          </div>
          <div className="flex items-center gap-2">
            {phasesSaved && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Kaydedildi
              </span>
            )}
            <button
              onClick={addPhase}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
            >
              <Plus className="w-3.5 h-3.5" />
              Faz Ekle
            </button>
            {phasesDirty && (
              <>
                <button
                  onClick={handleResetPhases}
                  disabled={phasesSaving}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  İptal
                </button>
                <button
                  onClick={handleSavePhases}
                  disabled={phasesSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5" />
                  {phasesSaving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </>
            )}
          </div>
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
            {dirty && (
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Kaydedilmemiş değişiklik
              </span>
            )}
            <button
              onClick={handleResetPlan}
              disabled={!dirty || saving}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              İptal
            </button>
            <button
              onClick={handleSavePlan}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Kaydediliyor..." : "Kaydet"}
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
                    <select
                      value={entry.owner ?? ""}
                      onChange={(e) => setField(phase.id, "owner", e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                    >
                      <option value="">— Seçin</option>
                      {projectMembers.map((m) => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
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

// ─── Budget Tab ──────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = ["İşgücü", "Yazılım", "Donanım", "Hizmet", "Diğer"];

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
}

function BudgetTab({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: (patch: Partial<Project>) => Promise<void>;
}) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editBudget, setEditBudget] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    budget: String(project.budget ?? ""),
    budgetUsed: String(project.budgetUsed ?? ""),
    currency: project.currency ?? "TRY",
  });
  const [form, setForm] = useState({
    description: "", category: EXPENSE_CATEGORIES[0], amount: "", date: new Date().toISOString().slice(0, 10),
  });

  const budget = project.budget ?? 0;
  const budgetUsed = project.budgetUsed ?? 0;
  const remaining = budget - budgetUsed;
  const pct = budget > 0 ? Math.round((budgetUsed / budget) * 100) : 0;

  const fmt = (n: number) => formatCurrencyLib(n, project.currency);

  const handleSaveBudget = async () => {
    await onUpdate({
      budget: Number(budgetForm.budget) || undefined,
      budgetUsed: Number(budgetForm.budgetUsed) || undefined,
      currency: budgetForm.currency,
    });
    setEditBudget(false);
  };

  const handleAddExpense = () => {
    if (!form.description.trim() || !form.amount) return;
    const amount = Number(form.amount);
    const newExpense: Expense = { id: crypto.randomUUID(), category: form.category, description: form.description.trim(), amount, date: form.date };
    setExpenses((prev) => [newExpense, ...prev]);
    // budgetUsed'ı otomatik artır
    onUpdate({ budgetUsed: budgetUsed + amount });
    setForm({ description: "", category: EXPENSE_CATEGORIES[0], amount: "", date: new Date().toISOString().slice(0, 10) });
    setShowAdd(false);
  };

  const handleDeleteExpense = (expense: Expense) => {
    setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
    onUpdate({ budgetUsed: Math.max(0, budgetUsed - expense.amount) });
  };

  return (
    <div className="space-y-6">
      {/* Özet kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-3">
            <Wallet className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Toplam Bütçe</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{budget > 0 ? fmt(budget) : "—"}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-3">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Harcanan</span>
          </div>
          <div className={`text-2xl font-bold ${pct > 90 ? "text-red-600" : pct > 75 ? "text-amber-600" : "text-gray-900"}`}>
            {budgetUsed > 0 ? fmt(budgetUsed) : "—"}
          </div>
          {budget > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{pct}% kullanıldı</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${pct > 90 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-3">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Kalan</span>
          </div>
          <div className={`text-2xl font-bold ${remaining < 0 ? "text-red-600" : "text-emerald-600"}`}>
            {budget > 0 ? fmt(remaining) : "—"}
          </div>
          {remaining < 0 && (
            <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
              <AlertTriangle className="w-3 h-3" /> Bütçe aşıldı
            </div>
          )}
        </div>
      </div>

      {/* Bütçe düzenleme */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Bütçe Bilgileri</h3>
          <button
            onClick={() => { setEditBudget(!editBudget); setBudgetForm({ budget: String(project.budget ?? ""), budgetUsed: String(project.budgetUsed ?? ""), currency: project.currency ?? "TRY" }); }}
            className="text-xs text-indigo-600 hover:underline"
          >
            {editBudget ? "İptal" : "Düzenle"}
          </button>
        </div>
        {editBudget ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Para Birimi</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                value={budgetForm.currency}
                onChange={(e) => setBudgetForm((s) => ({ ...s, currency: e.target.value }))}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Toplam Bütçe</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={budgetForm.budget}
                onChange={(e) => setBudgetForm((s) => ({ ...s, budget: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Harcanan</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={budgetForm.budgetUsed}
                onChange={(e) => setBudgetForm((s) => ({ ...s, budgetUsed: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="col-span-2 flex justify-end">
              <button onClick={handleSaveBudget} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                <Save className="w-4 h-4" /> Kaydet
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400 text-xs">Para Birimi</span>
              <div className="font-semibold text-gray-900 mt-0.5">{project.currency ?? "TRY"}</div>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Toplam Bütçe</span>
              <div className="font-semibold text-gray-900 mt-0.5">{budget > 0 ? fmt(budget) : "Tanımlanmamış"}</div>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Harcanan</span>
              <div className="font-semibold text-gray-900 mt-0.5">{budgetUsed > 0 ? fmt(budgetUsed) : "—"}</div>
            </div>
          </div>
        )}
      </div>

      {/* Giderler */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Gider Kayıtları</h3>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Gider Ekle
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="px-5 py-4 bg-indigo-50 border-b border-indigo-100 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                placeholder="Gider açıklaması..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kategori</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
              >
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tutar (₺)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tarih</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.date} onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
              />
            </div>
            <div className="col-span-2 md:col-span-4 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">İptal</button>
              <button onClick={handleAddExpense} disabled={!form.description.trim() || !form.amount}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                Ekle
              </button>
            </div>
          </div>
        )}

        {expenses.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Henüz gider kaydı yok.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Açıklama</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tutar</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-900">{e.description}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-medium px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">{e.category}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">{new Date(e.date).toLocaleDateString("tr-TR")}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900 text-right">{fmt(e.amount)}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => handleDeleteExpense(e)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-700">Toplam</td>
                <td className="px-5 py-3 text-sm font-bold text-gray-900 text-right">
                  {fmt(expenses.reduce((s, e) => s + e.amount, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          </div>
        )}
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
