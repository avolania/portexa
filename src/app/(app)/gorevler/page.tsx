"use client";

import { useState } from "react";
import { Search, Filter } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import type { Task } from "@/types";

const MEMBERS: Record<string, string> = {
  "1": "Ahmet Yılmaz",
  "2": "Ayşe Kara",
  "3": "Mehmet Demir",
  "4": "Zeynep Çelik",
};

const PROJECTS: Record<string, string> = {
  "1": "E-Ticaret Platformu",
  "2": "Mobil Uygulama Redesign",
  "3": "CRM Entegrasyonu",
};

export default function GorevlerPage() {
  const { tasks, projects } = useProjectStore();
  const [search, setSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const filtered = tasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Görevler</h1>
        <p className="text-sm text-gray-500 mt-1">Tüm projelerden {tasks.length} görev</p>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Görev ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Görev</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proje</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Durum</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Öncelik</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Atanan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Bitiş</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((task) => (
              <tr
                key={task.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedTaskId(task.id)}
              >
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{task.title}</div>
                  {task.tags.length > 0 && (
                    <div className="flex gap-1 mt-0.5">
                      {task.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {projects.find((p) => p.id === task.projectId)?.name ?? task.projectId}
                </td>
                <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                <td className="px-4 py-3">
                  {task.assigneeId ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={MEMBERS[task.assigneeId] || "U"} size="sm" />
                      <span className="text-sm text-gray-700">{MEMBERS[task.assigneeId]}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString("tr-TR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTaskId && (
        <TaskDetailPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
    </div>
  );
}
