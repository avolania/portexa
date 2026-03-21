"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, ChevronRight, Plus, Lock, BarChart2, List } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import type { Task, WaterfallPhase } from "@/types";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import GanttChart from "@/components/gantt/GanttChart";
import { cn } from "@/lib/utils";

const PHASES: {
  id: WaterfallPhase;
  label: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  headerBg: string;
}[] = [
  {
    id: "requirements",
    label: "Gereksinimler",
    description: "Kapsam, gereksinim analizi ve onay",
    icon: "📋",
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
    headerBg: "bg-violet-100",
  },
  {
    id: "design",
    label: "Tasarım",
    description: "Mimari, UI/UX ve teknik tasarım",
    icon: "🎨",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    headerBg: "bg-blue-100",
  },
  {
    id: "development",
    label: "Geliştirme",
    description: "Kodlama ve entegrasyon",
    icon: "⚙️",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    headerBg: "bg-amber-100",
  },
  {
    id: "testing",
    label: "Test",
    description: "QA, entegrasyon ve kullanıcı testleri",
    icon: "🧪",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    headerBg: "bg-orange-100",
  },
  {
    id: "deployment",
    label: "Dağıtım",
    description: "Canlıya alma ve yayın",
    icon: "🚀",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    headerBg: "bg-emerald-100",
  },
];

function getPhaseStatus(tasks: Task[]): "locked" | "active" | "completed" {
  if (tasks.length === 0) return "locked";
  if (tasks.every((t) => t.status === "done")) return "completed";
  return "active";
}

function isPhaseLocked(phaseIdx: number, allTasks: Task[]): boolean {
  if (phaseIdx === 0) return false;
  const prevPhase = PHASES[phaseIdx - 1];
  const prevTasks = allTasks.filter((t) => t.phase === prevPhase.id);
  if (prevTasks.length === 0) return true;
  return !prevTasks.every((t) => t.status === "done");
}

interface Props {
  projectId: string;
}

export default function WaterfallBoard({ projectId }: Props) {
  const { getProjectTasks, addTask } = useProjectStore();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [view, setView] = useState<"phases" | "gantt">("phases");
  const [expandedPhases, setExpandedPhases] = useState<Set<WaterfallPhase>>(
    new Set(["requirements", "design", "development", "testing", "deployment"])
  );

  const allTasks = getProjectTasks(projectId);


  const togglePhase = (phase: WaterfallPhase) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      next.has(phase) ? next.delete(phase) : next.add(phase);
      return next;
    });
  };

  const handleAddTask = (phase: WaterfallPhase, locked: boolean) => {
    if (locked) return;
    const title = prompt("Görev başlığı:");
    if (!title) return;
    const task: Task = {
      id: crypto.randomUUID(),
      projectId,
      title,
      status: "todo",
      priority: "medium",
      phase,
      tags: [],
      subtasks: [],
      dependencies: [],
      attachments: [],
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: 0,
    };
    addTask(task);
  };

  // Overall progress
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Current active phase
  const currentPhaseIdx = PHASES.findIndex((p) => {
    const pTasks = allTasks.filter((t) => t.phase === p.id);
    return pTasks.length > 0 && !pTasks.every((t) => t.status === "done");
  });

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView("phases")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", view === "phases" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}
        >
          <List className="w-4 h-4" />
          Faz Görünümü
        </button>
        <button
          onClick={() => setView("gantt")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", view === "gantt" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}
        >
          <BarChart2 className="w-4 h-4" />
          Gantt Şeması
        </button>
      </div>

      {/* Gantt view */}
      {view === "gantt" && (
        <div className="card overflow-hidden">
          <GanttChart tasks={allTasks} />
        </div>
      )}

      {view === "phases" && <>
      {/* Progress header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-gray-700">Proje Süreci</div>
          <div className="text-sm text-gray-500">{doneTasks}/{totalTasks} görev tamamlandı</div>
        </div>

        {/* Phase steps */}
        <div className="flex items-center gap-1 mb-4">
          {PHASES.map((phase, idx) => {
            const phaseTasks = allTasks.filter((t) => t.phase === phase.id);
            const status = getPhaseStatus(phaseTasks);
            const isCurrent = idx === currentPhaseIdx;
            const locked = isPhaseLocked(idx, allTasks) && phaseTasks.length === 0;

            return (
              <div key={phase.id} className="flex items-center flex-1">
                <div className={cn(
                  "flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium",
                  status === "completed" ? "bg-emerald-100 text-emerald-700" :
                  isCurrent ? "bg-indigo-100 text-indigo-700" :
                  locked ? "bg-gray-50 text-gray-400" :
                  "bg-gray-100 text-gray-500"
                )}>
                  <span>{phase.icon}</span>
                  <span className="hidden sm:inline truncate">{phase.label}</span>
                  {status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                </div>
                {idx < PHASES.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Phase cards */}
      <div className="space-y-3">
        {PHASES.map((phase, idx) => {
          const phaseTasks = allTasks.filter((t) => t.phase === phase.id);
          const phaseStatus = getPhaseStatus(phaseTasks);
          const locked = isPhaseLocked(idx, allTasks) && phaseTasks.length === 0;
          const isExpanded = expandedPhases.has(phase.id);
          const donePhaseTasks = phaseTasks.filter((t) => t.status === "done").length;

          return (
            <div
              key={phase.id}
              className={cn(
                "border rounded-xl overflow-hidden transition-all",
                phaseStatus === "completed" ? "border-emerald-200" :
                locked ? "border-gray-200 opacity-60" :
                phase.border
              )}
            >
              {/* Phase header */}
              <button
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  phaseStatus === "completed" ? "bg-emerald-50" :
                  locked ? "bg-gray-50" :
                  phase.headerBg
                )}
                onClick={() => togglePhase(phase.id)}
              >
                <span className="text-xl">{phase.icon}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-semibold",
                      phaseStatus === "completed" ? "text-emerald-700" :
                      locked ? "text-gray-400" :
                      phase.color
                    )}>
                      {phase.label}
                    </span>
                    {phaseStatus === "completed" && (
                      <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">Tamamlandı</span>
                    )}
                    {locked && (
                      <span className="text-xs bg-gray-300 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Kilitli
                      </span>
                    )}
                    {!locked && phaseStatus === "active" && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        Devam Ediyor
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{phase.description}</div>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  {phaseTasks.length > 0 && (
                    <div className="text-xs text-gray-500">
                      {donePhaseTasks}/{phaseTasks.length} görev
                    </div>
                  )}
                  {phaseTasks.length > 0 && (
                    <div className="w-16 bg-gray-200 rounded-full h-1.5">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          phaseStatus === "completed" ? "bg-emerald-500" : "bg-indigo-500"
                        )}
                        style={{ width: `${phaseTasks.length > 0 ? (donePhaseTasks / phaseTasks.length) * 100 : 0}%` }}
                      />
                    </div>
                  )}
                  <ChevronRight className={cn("w-4 h-4 text-gray-400 transition-transform", isExpanded && "rotate-90")} />
                </div>
              </button>

              {/* Phase tasks */}
              {isExpanded && (
                <div className={cn("p-3 space-y-2", locked ? "bg-gray-50" : "bg-white")}>
                  {phaseTasks.length === 0 ? (
                    <div className="text-center py-6">
                      {locked ? (
                        <div className="text-xs text-gray-400 flex flex-col items-center gap-1">
                          <Lock className="w-5 h-5" />
                          Önceki faz tamamlanmadan bu faza görev eklenemez.
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddTask(phase.id, locked)}
                          className="text-xs text-gray-400 hover:text-gray-600 flex flex-col items-center gap-1 mx-auto"
                        >
                          <Plus className="w-5 h-5" />
                          Bu faza ilk görevi ekle
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {phaseTasks.map((task) => (
                        <WaterfallTaskRow
                          key={task.id}
                          task={task}
                          onClick={() => setSelectedTaskId(task.id)}
                        />
                      ))}
                      {!locked && (
                        <button
                          onClick={() => handleAddTask(phase.id, locked)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-dashed border-gray-200"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Görev ekle
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      </>}

      {selectedTaskId && (
        <TaskDetailPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
    </div>
  );
}

function WaterfallTaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const MEMBERS: Record<string, string> = {
    "1": "Ahmet Yılmaz",
    "2": "Ayşe Kara",
    "3": "Mehmet Demir",
    "4": "Zeynep Çelik",
  };

  const isDone = task.status === "done";

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
        isDone ? "bg-emerald-50 border-emerald-100" : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
      )}
    >
      {isDone ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-medium truncate", isDone ? "line-through text-gray-400" : "text-gray-900")}>
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
        {task.assigneeId && <Avatar name={MEMBERS[task.assigneeId] || "U"} size="sm" />}
      </div>
    </div>
  );
}
