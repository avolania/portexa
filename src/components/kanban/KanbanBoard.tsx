"use client";

import { useState } from "react";
import { Plus, Zap } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { useAuthStore } from "@/store/useAuthStore";
import type { Task, TaskStatus } from "@/types";
import KanbanCard from "./KanbanCard";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { cn } from "@/lib/utils";

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "todo", label: "Backlog", color: "bg-gray-100" },
  { id: "in_progress", label: "Sprint'te", color: "bg-blue-50" },
  { id: "review", label: "İncelemede", color: "bg-amber-50" },
  { id: "done", label: "Tamamlandı", color: "bg-emerald-50" },
];

const columnColors: Record<TaskStatus, string> = {
  todo: "border-gray-300",
  in_progress: "border-blue-300",
  review: "border-amber-300",
  done: "border-emerald-300",
};

const columnHeaderColors: Record<TaskStatus, string> = {
  todo: "text-gray-600",
  in_progress: "text-blue-600",
  review: "text-amber-600",
  done: "text-emerald-600",
};

interface Props {
  projectId: string;
  currentSprint?: number;
}

export default function KanbanBoard({ projectId, currentSprint }: Props) {
  const { getProjectTasks, moveTask, addTask } = useProjectStore();
  const user = useAuthStore((s) => s.user);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const allTasksRaw = getProjectTasks(projectId);
  const isMemberOnly = user?.role === "member";
  const allTasks = isMemberOnly
    ? allTasksRaw.filter((t) => t.assigneeId === user?.id)
    : allTasksRaw;

  const handleDragStart = (taskId: string) => setDraggedId(taskId);
  const handleDragOver = (e: React.DragEvent, col: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(col);
  };
  const handleDrop = (col: TaskStatus) => {
    if (draggedId) moveTask(draggedId, col);
    setDraggedId(null);
    setDragOverCol(null);
  };

  const handleAddTask = (status: TaskStatus) => {
    const title = prompt("Görev başlığı:");
    if (!title) return;
    const task: Task = {
      id: crypto.randomUUID(),
      projectId,
      title,
      status,
      priority: "medium",
      sprint: currentSprint,
      storyPoints: 0,
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

  // Sprint stats
  const sprintTasks = currentSprint
    ? allTasks.filter((t) => t.sprint === currentSprint)
    : allTasks;
  const sprintDone = sprintTasks.filter((t) => t.status === "done").length;
  const sprintPoints = sprintTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
  const sprintDonePoints = sprintTasks
    .filter((t) => t.status === "done")
    .reduce((acc, t) => acc + (t.storyPoints || 0), 0);

  return (
    <div className="space-y-4">
      {/* Sprint banner */}
      {currentSprint && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-indigo-900">Sprint {currentSprint}</span>
              <span className="text-xs text-indigo-600 ml-2">Devam Ediyor</span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="font-bold text-indigo-900">{sprintDone}/{sprintTasks.length}</div>
              <div className="text-xs text-indigo-500">Görev</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-indigo-900">{sprintDonePoints}/{sprintPoints}</div>
              <div className="text-xs text-indigo-500">Story Point</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-indigo-200 rounded-full h-2">
                <div
                  className="h-full bg-indigo-600 rounded-full"
                  style={{ width: `${sprintTasks.length > 0 ? (sprintDone / sprintTasks.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-indigo-600 font-medium">
                {sprintTasks.length > 0 ? Math.round((sprintDone / sprintTasks.length) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      )}

      {isMemberOnly && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <span className="font-medium">Yalnızca size atanmış görevler gösteriliyor.</span>
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-16rem)]">
        {COLUMNS.map((col) => {
          const colTasks = allTasks.filter((t) => t.status === col.id);
          const isDragOver = dragOverCol === col.id;
          const colPoints = colTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);

          return (
            <div
              key={col.id}
              className={cn(
                "flex-1 min-w-[280px] max-w-sm flex flex-col rounded-xl border-2 transition-colors duration-150",
                col.color,
                isDragOver ? columnColors[col.id] : "border-transparent"
              )}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDrop={() => handleDrop(col.id)}
              onDragLeave={() => setDragOverCol(null)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${columnHeaderColors[col.id]}`}>
                    {col.label}
                  </span>
                  <span className="w-5 h-5 bg-white rounded-full text-xs font-medium text-gray-600 flex items-center justify-center shadow-sm">
                    {colTasks.length}
                  </span>
                  {colPoints > 0 && (
                    <span className="text-xs text-gray-400">{colPoints} pt</span>
                  )}
                </div>
                <button
                  onClick={() => handleAddTask(col.id)}
                  className="p-1 hover:bg-white rounded-md transition-colors text-gray-400 hover:text-gray-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Tasks */}
              <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto">
                {colTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onDragStart={() => handleDragStart(task.id)}
                    onClick={() => setSelectedTaskId(task.id)}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="flex items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400">
                    Buraya sürükle
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTaskId && (
        <TaskDetailPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
    </div>
  );
}
