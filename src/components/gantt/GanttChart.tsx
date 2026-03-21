"use client";

import { useMemo } from "react";
import type { Task, WaterfallPhase } from "@/types";

const PHASE_META: Record<WaterfallPhase, { label: string; color: string; bg: string }> = {
  requirements: { label: "Gereksinimler", color: "bg-violet-500", bg: "bg-violet-50" },
  design:        { label: "Tasarım",       color: "bg-blue-500",   bg: "bg-blue-50" },
  development:   { label: "Geliştirme",    color: "bg-indigo-500", bg: "bg-indigo-50" },
  testing:       { label: "Test",          color: "bg-amber-500",  bg: "bg-amber-50" },
  deployment:    { label: "Dağıtım",       color: "bg-emerald-500",bg: "bg-emerald-50" },
};

const PHASE_ORDER: WaterfallPhase[] = ["requirements", "design", "development", "testing", "deployment"];

interface Props {
  tasks: Task[];
}

function parseDate(str: string): Date {
  return new Date(str);
}

export default function GanttChart({ tasks }: Props) {
  const waterfallTasks = tasks.filter((t) => t.phase && t.startDate && t.dueDate);

  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (waterfallTasks.length === 0) {
      const now = new Date();
      return { minDate: now, maxDate: now, totalDays: 30 };
    }
    const starts = waterfallTasks.map((t) => parseDate(t.startDate!).getTime());
    const ends = waterfallTasks.map((t) => parseDate(t.dueDate!).getTime());
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    // align to start of month
    min.setDate(1);
    max.setDate(max.getDate() + 3);
    const diff = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24));
    return { minDate: min, maxDate: max, totalDays: Math.max(diff, 30) };
  }, [waterfallTasks]);

  const today = new Date();
  const todayOffset =
    today >= minDate && today <= maxDate
      ? ((today.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100
      : null;

  // Build month headers
  const monthHeaders = useMemo(() => {
    const headers: { label: string; width: number }[] = [];
    const cursor = new Date(minDate);
    cursor.setDate(1);
    while (cursor <= maxDate) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const effectiveEnd = monthEnd < maxDate ? monthEnd : maxDate;
      const effectiveStart = monthStart < minDate ? minDate : monthStart;
      const days =
        Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const widthPct = (days / totalDays) * 100;
      headers.push({
        label: cursor.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }),
        width: widthPct,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return headers;
  }, [minDate, maxDate, totalDays]);

  function getBar(task: Task) {
    if (!task.startDate || !task.dueDate) return null;
    const start = parseDate(task.startDate);
    const end = parseDate(task.dueDate);
    const left = ((start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
    const width =
      ((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100 + (1 / totalDays) * 100;
    return { left: Math.max(0, left), width: Math.min(width, 100 - Math.max(0, left)) };
  }

  const grouped = PHASE_ORDER.map((phase) => ({
    phase,
    tasks: waterfallTasks.filter((t) => t.phase === phase),
  })).filter((g) => g.tasks.length > 0);

  if (waterfallTasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Gantt şeması için görevlere başlangıç ve bitiş tarihi ekleyin.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header row */}
        <div className="flex border-b border-gray-200">
          <div className="w-52 shrink-0 px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Görev</div>
          <div className="flex-1 flex">
            {monthHeaders.map((h, i) => (
              <div
                key={i}
                className="text-center text-xs font-medium text-gray-500 py-2 border-l border-gray-100"
                style={{ width: `${h.width}%` }}
              >
                {h.label}
              </div>
            ))}
          </div>
        </div>

        {/* Phase groups */}
        {grouped.map(({ phase, tasks: phaseTasks }) => {
          const meta = PHASE_META[phase];
          return (
            <div key={phase}>
              {/* Phase label row */}
              <div className={`flex items-center ${meta.bg} border-b border-gray-100`}>
                <div className="w-52 shrink-0 px-3 py-1.5">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {meta.label}
                  </span>
                </div>
                <div className="flex-1 relative h-6" />
              </div>

              {/* Task rows */}
              {phaseTasks.map((task) => {
                const bar = getBar(task);
                const isDone = task.status === "done";
                return (
                  <div key={task.id} className="flex items-center border-b border-gray-50 hover:bg-gray-50 group">
                    <div className="w-52 shrink-0 px-3 py-2.5">
                      <div className="text-xs text-gray-700 truncate font-medium" title={task.title}>
                        {task.title}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {task.startDate && new Date(task.startDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                        {" – "}
                        {task.dueDate && new Date(task.dueDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                    <div className="flex-1 relative h-10 py-2">
                      {/* grid lines */}
                      {monthHeaders.map((h, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-gray-100"
                          style={{ left: `${monthHeaders.slice(0, i).reduce((s, m) => s + m.width, 0)}%` }}
                        />
                      ))}
                      {/* today line */}
                      {todayOffset !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                          style={{ left: `${todayOffset}%` }}
                        />
                      )}
                      {/* bar */}
                      {bar && (
                        <div
                          className={`absolute top-1 bottom-1 rounded-full ${meta.color} ${isDone ? "opacity-50" : "opacity-90"} flex items-center px-2 transition-opacity group-hover:opacity-100`}
                          style={{ left: `${bar.left}%`, width: `${bar.width}%`, minWidth: "4px" }}
                          title={task.title}
                        >
                          {bar.width > 8 && (
                            <span className="text-white text-xs truncate font-medium">{task.title}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Today legend */}
        {todayOffset !== null && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
            <div className="w-4 h-px bg-red-400" />
            <span>Bugün</span>
          </div>
        )}
      </div>
    </div>
  );
}
