"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { useTeamStore } from "@/store/useTeamStore";
import { useAuthStore } from "@/store/useAuthStore";
import type { Task, Priority, TaskStatus, IssueType, WaterfallPhase } from "@/types";
import { ISSUE_TYPE_META } from "@/types";
import Button from "@/components/ui/Button";

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "low",      label: "Düşük",   color: "text-gray-500" },
  { value: "medium",   label: "Orta",    color: "text-amber-600" },
  { value: "high",     label: "Yüksek",  color: "text-orange-600" },
  { value: "critical", label: "Kritik",  color: "text-red-600" },
];

const WATERFALL_PHASES: { value: WaterfallPhase; label: string }[] = [
  { value: "requirements", label: "Gereksinimler" },
  { value: "design",       label: "Tasarım" },
  { value: "development",  label: "Geliştirme" },
  { value: "testing",      label: "Test" },
  { value: "deployment",   label: "Dağıtım" },
];

const ISSUE_TYPES = Object.entries(ISSUE_TYPE_META) as [IssueType, typeof ISSUE_TYPE_META[IssueType]][];

interface Props {
  projectId: string;
  isAgile: boolean;
  currentSprint?: number;
  defaultPhase?: WaterfallPhase;
  onClose: () => void;
}

export default function NewTaskModal({ projectId, isAgile, currentSprint, defaultPhase, onClose }: Props) {
  const { addTask, projects } = useProjectStore();
  const teamMembers = useTeamStore((s) => s.members);
  const profiles = useAuthStore((s) => s.profiles);

  // Projeye atanmış üyeleri çöz
  const project = projects.find((p) => p.id === projectId);
  const assignableMembers = useMemo(() => {
    if (!project) return [];
    return project.members.map((id) => {
      const tm = teamMembers.find((m) => m.id === id);
      if (tm) return { id: tm.id, name: tm.name };
      const prof = Object.values(profiles).find((p) => p.id === id);
      if (prof) return { id: prof.id, name: prof.name };
      return null;
    }).filter((m): m is { id: string; name: string } => m !== null);
  }, [project, teamMembers, profiles]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    issueType: "task" as IssueType,
    priority: "medium" as Priority,
    status: "todo" as TaskStatus,
    assigneeId: "",
    startDate: "",
    dueDate: "",
    estimatedHours: "",
    storyPoints: "",
    sprint: currentSprint ?? 1,
    phase: defaultPhase ?? ("requirements" as WaterfallPhase),
    tags: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Başlık zorunludur";
    if (form.dueDate && form.startDate && form.dueDate < form.startDate)
      e.dueDate = "Bitiş tarihi başlangıçtan önce olamaz";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const task: Task = {
      id: crypto.randomUUID(),
      projectId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      issueType: form.issueType,
      status: form.status,
      priority: form.priority,
      assigneeId: form.assigneeId || undefined,
      startDate: form.startDate || undefined,
      dueDate: form.dueDate || undefined,
      estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
      loggedHours: 0,
      storyPoints: isAgile && form.storyPoints ? Number(form.storyPoints) : undefined,
      sprint: isAgile ? form.sprint : undefined,
      phase: !isAgile ? form.phase : undefined,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      subtasks: [],
      dependencies: [],
      attachments: [],
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: 0,
    };
    addTask(task);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Yeni Görev</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* Issue type picker */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Tür</label>
            <div className="flex flex-wrap gap-2">
              {ISSUE_TYPES.map(([type, meta]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, issueType: type })}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    form.issueType === type
                      ? `${meta.bg} ${meta.color} border-current ring-1 ring-current`
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {meta.icon} {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Başlık <span className="text-red-500">*</span>
            </label>
            <input
              className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.title ? "border-red-400" : "border-gray-300"}`}
              placeholder="Görev başlığını girin..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700">Açıklama</label>
            <textarea
              rows={2}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="İsteğe bağlı açıklama..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Öncelik</label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Durum</label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
              >
                <option value="todo">Yapılacak</option>
                <option value="in_progress">Devam Ediyor</option>
                <option value="review">İncelemede</option>
                <option value="done">Tamamlandı</option>
              </select>
            </div>
          </div>

          {/* Agile: sprint + story points / Waterfall: phase */}
          {isAgile ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Sprint</label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.sprint}
                  onChange={(e) => setForm({ ...form, sprint: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Story Points</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0"
                  value={form.storyPoints}
                  onChange={(e) => setForm({ ...form, storyPoints: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-gray-700">Faz</label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.phase}
                onChange={(e) => setForm({ ...form, phase: e.target.value as WaterfallPhase })}
              >
                {WATERFALL_PHASES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Assignee */}
          <div>
            <label className="text-sm font-medium text-gray-700">Atanan Kişi</label>
            <select
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.assigneeId}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
            >
              <option value="">— Seçilmedi —</option>
              {assignableMembers.length === 0 ? (
                <option disabled value="">Projeye henüz ekip eklenmemiş</option>
              ) : (
                assignableMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))
              )}
            </select>
            {assignableMembers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Ekip eklemek için proje detayından Ekip sekmesini kullanın.</p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Başlangıç Tarihi</label>
              <input
                type="date"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Bitiş Tarihi</label>
              <input
                type="date"
                className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.dueDate ? "border-red-400" : "border-gray-300"}`}
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
              {errors.dueDate && <p className="text-xs text-red-500 mt-1">{errors.dueDate}</p>}
            </div>
          </div>

          {/* Hours */}
          <div>
            <label className="text-sm font-medium text-gray-700">Tahmini Süre (saat)</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0"
              value={form.estimatedHours}
              onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium text-gray-700">Etiketler</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="frontend, api, design  (virgülle ayırın)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button className="flex-1" onClick={handleSubmit}>Görevi Oluştur</Button>
        </div>
      </div>
    </div>
  );
}
