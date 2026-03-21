"use client";

import { useState } from "react";
import {
  CheckCircle2, Circle, Clock, ChevronRight, Plus, BarChart2, List,
  FlagTriangleRight, X,
} from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { useTeamStore } from "@/store/useTeamStore";
import { useAuthStore } from "@/store/useAuthStore";
import type { Task, ProjectPhase } from "@/types";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import GanttChart from "@/components/gantt/GanttChart";
import NewTaskModal from "@/components/tasks/NewTaskModal";
import { cn } from "@/lib/utils";

// Varsayılan fazlar (proje özel faz tanımlamadıysa kullanılır)
export const DEFAULT_PHASES: ProjectPhase[] = [
  { id: "requirements", label: "Gereksinimler", icon: "📋" },
  { id: "design",       label: "Tasarım",       icon: "🎨" },
  { id: "development",  label: "Geliştirme",    icon: "⚙️" },
  { id: "testing",      label: "Test",           icon: "🧪" },
  { id: "deployment",   label: "Dağıtım",        icon: "🚀" },
];

// Geriye dönük uyumluluk için alias
export const PHASES = DEFAULT_PHASES;

// Her faz ID'sine karşılık gelen stil (bilinmeyen ID'ler için fallback var)
const PHASE_STYLES: Record<string, { color: string; bg: string; border: string; headerBg: string; description: string }> = {
  requirements: { color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200", headerBg: "bg-violet-100", description: "Kapsam, gereksinim analizi ve onay" },
  design:       { color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",   headerBg: "bg-blue-100",   description: "Mimari, UI/UX ve teknik tasarım" },
  development:  { color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200",  headerBg: "bg-amber-100",  description: "Kodlama ve entegrasyon" },
  testing:      { color: "text-orange-700", bg: "bg-orange-50",  border: "border-orange-200", headerBg: "bg-orange-100", description: "QA, entegrasyon ve kullanıcı testleri" },
  deployment:   { color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200",headerBg: "bg-emerald-100",description: "Canlıya alma ve yayın" },
};
const DEFAULT_STYLE = { color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200", headerBg: "bg-indigo-100", description: "" };

function resolvePhaseStyle(id: string) {
  return PHASE_STYLES[id] ?? DEFAULT_STYLE;
}

function getPhaseStatus(tasks: Task[]): "empty" | "active" | "completed" {
  if (tasks.length === 0) return "empty";
  if (tasks.every((t) => t.status === "done")) return "completed";
  return "active";
}

// ─── Kapanış adımı ekleme modal ───────────────────────────────────────────────

function ClosureModal({
  phase,
  projectId,
  onClose,
}: {
  phase: ProjectPhase & { color: string; bg: string; border: string; headerBg: string };
  projectId: string;
  onClose: () => void;
}) {
  const { addTask } = useProjectStore();
  const [title, setTitle] = useState(`${phase.label} Faz Kapanış Onayı`);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const handleAdd = () => {
    if (!title.trim()) return;
    const task: Task = {
      id: crypto.randomUUID(),
      projectId,
      title: title.trim(),
      description: notes.trim() || undefined,
      issueType: "task",
      status: "todo",
      priority: "high",
      phase: phase.id,
      dueDate: dueDate || undefined,
      tags: ["kapanış"],
      subtasks: [],
      dependencies: [],
      attachments: [],
      comments: [],
      loggedHours: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: 999,
    };
    addTask(task);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FlagTriangleRight className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-gray-900">Kapanış Adımı Ekle</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`px-3 py-2 rounded-lg mb-4 text-sm font-medium ${phase.bg} ${phase.color}`}>
          {phase.icon} {phase.label} Fazı
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Tarih</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Kapanış kriterleri, onay gereksinimleri..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50">
            İptal
          </button>
          <button
            onClick={handleAdd}
            disabled={!title.trim()}
            className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
}

export default function WaterfallBoard({ projectId }: Props) {
  const { tasks: allStoreTasks, projects, addTask } = useProjectStore();
  const teamMembers = useTeamStore((s) => s.members);
  const profiles = useAuthStore((s) => s.profiles);

  const user = useAuthStore((s) => s.user);

  const project = projects.find((p) => p.id === projectId);
  const effectivePhases: (ProjectPhase & ReturnType<typeof resolvePhaseStyle>)[] = (
    project?.phases ?? DEFAULT_PHASES
  ).map((p) => ({ ...p, ...resolvePhaseStyle(p.id) }));

  const isMemberOnly = user?.role === "member";
  const allTasks = allStoreTasks
    .filter((t) => t.projectId === projectId)
    .filter((t) => !isMemberOnly || t.assigneeId === user?.id);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [view, setView] = useState<"phases" | "gantt">("phases");
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set((project?.phases ?? DEFAULT_PHASES).map((p) => p.id))
  );
  const [addingTaskPhase, setAddingTaskPhase] = useState<string | null>(null);
  const [closurePhase, setClosurePhase] = useState<(ProjectPhase & ReturnType<typeof resolvePhaseStyle>) | null>(null);

  const resolveName = (id?: string) => {
    if (!id) return null;
    const tm = teamMembers.find((m) => m.id === id);
    if (tm) return tm.name;
    const prof = Object.values(profiles).find((p) => p.id === id);
    return prof?.name ?? null;
  };

  const togglePhase = (phase: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      next.has(phase) ? next.delete(phase) : next.add(phase);
      return next;
    });
  };

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const currentPhaseIdx = effectivePhases.findIndex((p) => {
    const pt = allTasks.filter((t) => t.phase === p.id);
    return pt.length > 0 && !pt.every((t) => t.status === "done");
  });

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView("phases")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", view === "phases" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}
        >
          <List className="w-4 h-4" /> Faz Görünümü
        </button>
        <button
          onClick={() => setView("gantt")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", view === "gantt" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}
        >
          <BarChart2 className="w-4 h-4" /> Gantt Şeması
        </button>
      </div>

      {isMemberOnly && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <span className="font-medium">Yalnızca size atanmış görevler gösteriliyor.</span>
        </div>
      )}

      {view === "gantt" && (
        <div className="card overflow-hidden">
          <GanttChart tasks={allTasks} />
        </div>
      )}

      {view === "phases" && (
        <>
          {/* Progress header */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-700">Proje Süreci</div>
              <div className="text-sm text-gray-500">{doneTasks}/{totalTasks} görev tamamlandı</div>
            </div>
            <div className="flex items-center gap-1 mb-4">
              {effectivePhases.map((phase, idx) => {
                const phaseTasks = allTasks.filter((t) => t.phase === phase.id);
                const status = getPhaseStatus(phaseTasks);
                const isCurrent = idx === currentPhaseIdx;
                return (
                  <div key={phase.id} className="flex items-center flex-1">
                    <div className={cn(
                      "flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium",
                      status === "completed" ? "bg-emerald-100 text-emerald-700" :
                      isCurrent ? "bg-indigo-100 text-indigo-700" :
                      "bg-gray-100 text-gray-500"
                    )}>
                      <span>{phase.icon ?? "📌"}</span>
                      <span className="hidden sm:inline truncate">{phase.label}</span>
                      {status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                    </div>
                    {idx < effectivePhases.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${overallPct}%` }} />
            </div>
          </div>

          {/* Phase cards */}
          <div className="space-y-3">
            {effectivePhases.map((phase) => {
              const phaseTasks = allTasks.filter((t) => t.phase === phase.id);
              const phaseStatus = getPhaseStatus(phaseTasks);
              const isExpanded = expandedPhases.has(phase.id);
              const donePhaseTasks = phaseTasks.filter((t) => t.status === "done").length;
              const closureTasks = phaseTasks.filter((t) => t.tags.includes("kapanış"));

              return (
                <div
                  key={phase.id}
                  className={cn(
                    "border rounded-xl overflow-hidden transition-all",
                    phaseStatus === "completed" ? "border-emerald-200" : phase.border
                  )}
                >
                  {/* Phase header */}
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                      phaseStatus === "completed" ? "bg-emerald-50" : phase.headerBg
                    )}
                    onClick={() => togglePhase(phase.id)}
                  >
                    <span className="text-xl">{phase.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-semibold", phaseStatus === "completed" ? "text-emerald-700" : phase.color)}>
                          {phase.label}
                        </span>
                        {phaseStatus === "completed" && (
                          <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">Tamamlandı</span>
                        )}
                        {phaseStatus === "active" && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> Devam Ediyor
                          </span>
                        )}
                        {closureTasks.length > 0 && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <FlagTriangleRight className="w-3 h-3" /> Kapanış adımı var
                          </span>
                        )}
                      </div>
                      {phase.description && <div className="text-xs text-gray-500 mt-0.5">{phase.description}</div>}
                    </div>
                    <div className="flex items-center gap-3 ml-auto">
                      {phaseTasks.length > 0 && (
                        <>
                          <div className="text-xs text-gray-500">{donePhaseTasks}/{phaseTasks.length} görev</div>
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={cn("h-full rounded-full", phaseStatus === "completed" ? "bg-emerald-500" : "bg-indigo-500")}
                              style={{ width: `${(donePhaseTasks / phaseTasks.length) * 100}%` }}
                            />
                          </div>
                        </>
                      )}
                      <ChevronRight className={cn("w-4 h-4 text-gray-400 transition-transform", isExpanded && "rotate-90")} />
                    </div>
                  </button>

                  {/* Phase tasks */}
                  {isExpanded && (
                    <div className="p-3 space-y-2 bg-white">
                      {phaseTasks.length === 0 ? (
                        <div className="text-center py-4 text-sm text-gray-400">Bu fazda henüz görev yok.</div>
                      ) : (
                        phaseTasks.map((task) => (
                          <WaterfallTaskRow
                            key={task.id}
                            task={task}
                            resolveName={resolveName}
                            onClick={() => setSelectedTaskId(task.id)}
                          />
                        ))
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setAddingTaskPhase(phase.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-dashed border-gray-200 hover:border-indigo-300"
                        >
                          <Plus className="w-3.5 h-3.5" /> Görev Ekle
                        </button>
                        <button
                          onClick={() => setClosurePhase(phase)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-dashed border-gray-200 hover:border-indigo-300"
                          title="Kapanış adımı ekle"
                        >
                          <FlagTriangleRight className="w-3.5 h-3.5" /> Kapanış Adımı
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedTaskId && (
        <TaskDetailPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}

      {addingTaskPhase && (
        <NewTaskModal
          projectId={projectId}
          isAgile={false}
          defaultPhase={addingTaskPhase ?? undefined}
          onClose={() => setAddingTaskPhase(null)}
        />
      )}

      {closurePhase && (
        <ClosureModal
          phase={closurePhase}
          projectId={projectId}
          onClose={() => setClosurePhase(null)}
        />
      )}
    </div>
  );
}

function WaterfallTaskRow({
  task,
  resolveName,
  onClick,
}: {
  task: Task;
  resolveName: (id?: string) => string | null;
  onClick: () => void;
}) {
  const isDone = task.status === "done";
  const isClosure = task.tags.includes("kapanış");

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
        isDone ? "bg-emerald-50 border-emerald-100" :
        isClosure ? "bg-indigo-50 border-indigo-200" :
        "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
      )}
    >
      {isClosure ? (
        <FlagTriangleRight className={cn("w-5 h-5 flex-shrink-0", isDone ? "text-emerald-500" : "text-indigo-400")} />
      ) : isDone ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-medium truncate", isDone ? "line-through text-gray-400" : isClosure ? "text-indigo-700" : "text-gray-900")}>
          {task.title}
        </div>
        {task.dueDate && (
          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} />
        {task.assigneeId && (
          <Avatar name={resolveName(task.assigneeId) ?? "?"} size="sm" />
        )}
      </div>
    </div>
  );
}
