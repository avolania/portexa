"use client";

import { X, Calendar, Clock, User, Tag, Link2, MessageSquare, CheckSquare, Plus, Save, RotateCcw } from "lucide-react";
import type { Task, WaterfallPhase, IssueType, Priority, TaskStatus, Subtask } from "@/types";
import { ISSUE_TYPE_META } from "@/types";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import { useProjectStore } from "@/store/useProjectStore";
import { useTeamStore } from "@/store/useTeamStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useState, useEffect, useMemo } from "react";
import AttachmentSection from "@/components/ui/AttachmentSection";
import type { Attachment } from "@/types";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low",      label: "Düşük" },
  { value: "medium",   label: "Orta" },
  { value: "high",     label: "Yüksek" },
  { value: "critical", label: "Kritik" },
];

const WATERFALL_PHASES: { value: WaterfallPhase; label: string }[] = [
  { value: "requirements", label: "Gereksinimler" },
  { value: "design",       label: "Tasarım" },
  { value: "development",  label: "Geliştirme" },
  { value: "testing",      label: "Test" },
  { value: "deployment",   label: "Dağıtım" },
];

interface Props {
  taskId: string;
  onClose: () => void;
}

export default function TaskDetailPanel({ taskId, onClose }: Props) {
  const task = useProjectStore((s) => s.tasks.find((t) => t.id === taskId));
  const { updateTask, projects } = useProjectStore();
  const teamMembers = useTeamStore((s) => s.members);
  const profiles = useAuthStore((s) => s.profiles);

  // Projeye atanmış üyeler
  const project = projects.find((p) => p.id === task?.projectId);
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

  const resolveName = (id?: string) => {
    if (!id) return null;
    const tm = teamMembers.find((m) => m.id === id);
    if (tm) return tm.name;
    const prof = Object.values(profiles).find((p) => p.id === id);
    return prof?.name ?? null;
  };

  // Form state — tüm düzenlenebilir alanlar
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    priority: "medium" as Priority,
    assigneeId: "",
    startDate: "",
    dueDate: "",
    estimatedHours: "",
    storyPoints: "",
    sprint: "",
    phase: "requirements" as WaterfallPhase,
    tags: "",
    issueType: "task" as IssueType,
    subtasks: [] as Subtask[],
  });
  const [isDirty, setIsDirty] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");

  // Task açılınca formu senkronize et
  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId ?? "",
        startDate: task.startDate ?? "",
        dueDate: task.dueDate ?? "",
        estimatedHours: task.estimatedHours?.toString() ?? "",
        storyPoints: task.storyPoints?.toString() ?? "",
        sprint: task.sprint?.toString() ?? "",
        phase: task.phase ?? "requirements",
        tags: task.tags.join(", "),
        issueType: task.issueType ?? "task",
        subtasks: task.subtasks,
      });
      setIsDirty(false);
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null;

  const isAgile = project?.projectType === "agile";

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    updateTask(task.id, {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      assigneeId: form.assigneeId || undefined,
      startDate: form.startDate || undefined,
      dueDate: form.dueDate || undefined,
      estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
      storyPoints: form.storyPoints ? Number(form.storyPoints) : undefined,
      sprint: form.sprint ? Number(form.sprint) : undefined,
      phase: !isAgile ? form.phase : undefined,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      issueType: form.issueType,
      subtasks: form.subtasks,
    });
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleSubtaskToggle = (subtaskId: string) => {
    const updated = form.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    setForm((f) => ({ ...f, subtasks: updated }));
    setIsDirty(true);
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    const updated = [...form.subtasks, { id: crypto.randomUUID(), title: newSubtask.trim(), completed: false }];
    setForm((f) => ({ ...f, subtasks: updated }));
    setIsDirty(true);
    setNewSubtask("");
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";
  const labelCls = "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block";

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {isDirty && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Kaydedilmemiş değişiklik
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Issue type */}
          <div>
            <label className={labelCls}>Tür</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(ISSUE_TYPE_META) as [IssueType, typeof ISSUE_TYPE_META[IssueType]][]).map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => update("issueType", type)}
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
            <label className={labelCls}>Başlık *</label>
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className={`${inputCls} font-semibold text-base`}
              placeholder="Görev başlığı"
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Açıklama</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              placeholder="Açıklama ekle..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Durum</label>
              <select value={form.status} onChange={(e) => update("status", e.target.value)} className={inputCls}>
                <option value="todo">Yapılacak</option>
                <option value="in_progress">Devam Ediyor</option>
                <option value="review">İncelemede</option>
                <option value="done">Tamamlandı</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Öncelik</label>
              <select value={form.priority} onChange={(e) => update("priority", e.target.value)} className={inputCls}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Agile / Waterfall */}
          {isAgile ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Sprint</label>
                <input type="number" min={1} value={form.sprint} onChange={(e) => update("sprint", e.target.value)} className={inputCls} placeholder="1" />
              </div>
              <div>
                <label className={labelCls}>Story Points</label>
                <input type="number" min={0} value={form.storyPoints} onChange={(e) => update("storyPoints", e.target.value)} className={inputCls} placeholder="0" />
              </div>
            </div>
          ) : (
            <div>
              <label className={labelCls}>Faz</label>
              <select value={form.phase} onChange={(e) => update("phase", e.target.value)} className={inputCls}>
                {WATERFALL_PHASES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          )}

          {/* Assignee */}
          <div>
            <label className={labelCls}>
              <User className="w-3.5 h-3.5 inline mr-1" />Atanan Kişi
            </label>
            <select value={form.assigneeId} onChange={(e) => update("assigneeId", e.target.value)} className={inputCls}>
              <option value="">— Seçilmedi —</option>
              {assignableMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {form.assigneeId && (
              <div className="flex items-center gap-2 mt-2">
                <Avatar name={resolveName(form.assigneeId) ?? "?"} size="sm" />
                <span className="text-sm text-gray-700">{resolveName(form.assigneeId)}</span>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                <Calendar className="w-3.5 h-3.5 inline mr-1" />Başlangıç
              </label>
              <input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                <Calendar className="w-3.5 h-3.5 inline mr-1" />Bitiş
              </label>
              <input type="date" value={form.dueDate} onChange={(e) => update("dueDate", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Hours */}
          <div>
            <label className={labelCls}>
              <Clock className="w-3.5 h-3.5 inline mr-1" />Tahmini Süre (saat)
            </label>
            <input type="number" min={0} value={form.estimatedHours} onChange={(e) => update("estimatedHours", e.target.value)} placeholder="0" className={inputCls} />
          </div>

          {/* Tags */}
          <div>
            <label className={labelCls}>
              <Tag className="w-3.5 h-3.5 inline mr-1" />Etiketler
            </label>
            <input
              value={form.tags}
              onChange={(e) => update("tags", e.target.value)}
              placeholder="frontend, api, design  (virgülle ayırın)"
              className={inputCls}
            />
          </div>

          {/* Subtasks */}
          <div>
            <p className={labelCls}>
              <CheckSquare className="w-3.5 h-3.5 inline mr-1" />
              Alt Görevler ({form.subtasks.filter((s) => s.completed).length}/{form.subtasks.length})
            </p>
            {form.subtasks.length > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${(form.subtasks.filter((s) => s.completed).length / form.subtasks.length) * 100}%` }}
                />
              </div>
            )}
            <div className="space-y-2 mb-3">
              {form.subtasks.map((subtask) => (
                <label key={subtask.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => handleSubtaskToggle(subtask.id)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                  />
                  <span className={`text-sm ${subtask.completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {subtask.title}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Alt görev ekle..."
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                className={`flex-1 ${inputCls}`}
              />
              <button onClick={handleAddSubtask} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dependencies */}
          {task.dependencies.length > 0 && (
            <div>
              <p className={labelCls}><Link2 className="w-3.5 h-3.5 inline mr-1" />Bağımlılıklar</p>
              <div className="flex flex-wrap gap-1">
                {task.dependencies.map((dep) => (
                  <span key={dep} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{dep}</span>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          <AttachmentSection
            attachments={task.attachments}
            onAdd={(att: Attachment) => updateTask(task.id, { attachments: [...task.attachments, att] })}
            onRemove={(id) => updateTask(task.id, { attachments: task.attachments.filter((a) => a.id !== id) })}
          />

          {/* Comments */}
          <div>
            <p className={labelCls}><MessageSquare className="w-3.5 h-3.5 inline mr-1" />Yorumlar</p>
            {task.comments.length === 0 ? (
              <p className="text-sm text-gray-400">Henüz yorum yapılmamış.</p>
            ) : (
              <div className="space-y-3">
                {task.comments.map((comment) => {
                  const name = resolveName(comment.authorId) ?? comment.authorId;
                  return (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar name={name} size="sm" className="flex-shrink-0 mt-0.5" />
                      <div className="flex-1 bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-700 mb-1">{name}</p>
                        <p className="text-sm text-gray-600">{comment.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Yorum ekle..."
                className={`flex-1 ${inputCls}`}
              />
              <button className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                Gönder
              </button>
            </div>
          </div>
        </div>

        {/* Footer — Kaydet / İptal */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex gap-3">
          <button
            onClick={handleCancel}
            disabled={!isDirty}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || !form.title.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
