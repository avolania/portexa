"use client";

import { useState } from "react";
import { useRequestStore, REQUEST_TYPE_META, REQUEST_STATUS_META } from "@/store/useRequestStore";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";
import type {
  WorkflowRequest, RequestStatus, Priority,
  WorkflowTemplate, WorkflowStep, UserRole,
} from "@/types";
import { cn } from "@/lib/utils";

type TabFilter = "all" | "project_idea" | RequestStatus;
type MainView = "requests" | "workflows";

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  low:      { label: "Düşük",  color: "text-gray-500"   },
  medium:   { label: "Orta",   color: "text-amber-600"  },
  high:     { label: "Yüksek", color: "text-orange-600" },
  critical: { label: "Kritik", color: "text-red-600"    },
};

const ROLE_LABELS: Record<UserRole, string> = {
  system_admin: "Sistem Yöneticisi",
  admin:    "Admin",
  pm:       "Proje Yöneticisi",
  member:   "Üye",
  approver: "Onaylayıcı",
  viewer:   "İzleyici",
  end_user: "Son Kullanıcı",
};

// ─── New Request Modal ────────────────────────────────────────────────────────

function NewRequestModal({ onClose }: { onClose: () => void }) {
  const { addRequest } = useRequestStore();
  const { templates } = useWorkflowStore();
  const { user } = useAuthStore();
  const { projects } = useProjectStore();

  const [form, setForm] = useState({
    type: "general" as WorkflowRequest["type"],
    title: "",
    description: "",
    projectId: "",
    priority: "medium" as Priority,
    dueDate: "",
    estimatedBudget: "",
    templateId: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    const now = new Date().toISOString();
    const template = templates.find((t) => t.id === form.templateId);
    addRequest({
      id: crypto.randomUUID(),
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      projectId: form.projectId || undefined,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
      estimatedBudget: form.estimatedBudget ? Number(form.estimatedBudget) : undefined,
      templateId: template?.id,
      currentStepIndex: template ? 0 : undefined,
      stepHistory: [],
      requestedBy: user?.id ?? "",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">Yeni Talep Oluştur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Talep Türü</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as WorkflowRequest["type"] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(REQUEST_TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Öncelik</label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="critical">Kritik</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Başlık</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Talep başlığı..." required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detayları açıklayın..." rows={3} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          {form.type === "project_idea" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tahmini Bütçe (₺)</label>
              <input type="number" value={form.estimatedBudget} onChange={(e) => setForm((f) => ({ ...f, estimatedBudget: e.target.value }))}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proje</label>
              <select value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">— Seçiniz —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Son Tarih</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Onay Akışı</label>
              <select value={form.templateId} onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">— Akış seçin (isteğe bağlı) —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.steps.length} adım)</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">İptal</button>
            <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">Gönder</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Step Review Modal ────────────────────────────────────────────────────────

function StepReviewModal({
  request, stepLabel, action, onClose,
}: {
  request: WorkflowRequest;
  stepLabel: string;
  action: "approved" | "rejected";
  onClose: () => void;
}) {
  const { advanceStep } = useRequestStore();
  const { templates } = useWorkflowStore();
  const { user } = useAuthStore();
  const [note, setNote] = useState("");

  const template = templates.find((t) => t.id === request.templateId);
  const currentIdx = request.currentStepIndex ?? 0;
  const isLastStep = template ? currentIdx >= template.steps.length - 1 : true;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    advanceStep(
      request.id,
      { stepId: template?.steps[currentIdx]?.id ?? "", actorId: user?.id ?? "", action, note: note.trim() || undefined, timestamp: new Date().toISOString() },
      isLastStep,
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">
          {action === "approved" ? "✅" : "❌"} {stepLabel}
        </h2>
        <p className="text-sm text-gray-500">{request.title}</p>
        {isLastStep && action === "approved" && (
          <div className="text-xs bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">
            Son adım — talep onaylanmış sayılacak.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Not ekleyin (isteğe bağlı)..." rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">İptal</button>
            <button type="submit" className={cn("flex-1 py-2 rounded-xl text-sm font-medium text-white", action === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700")}>
              {action === "approved" ? "Onayla" : "Reddet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Convert to Project Modal ─────────────────────────────────────────────────

function ConvertModal({ request, onClose }: { request: WorkflowRequest; onClose: () => void }) {
  const { updateRequest } = useRequestStore();
  const { addProject } = useProjectStore();
  const { user } = useAuthStore();
  const [name, setName] = useState(request.title);

  function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const projectId = crypto.randomUUID();
    addProject({
      id: projectId,
      name: name.trim(),
      description: request.description,
      status: "active",
      priority: request.priority,
      projectType: "waterfall",
      startDate: now.slice(0, 10),
      endDate: "",
      progress: 0,
      budget: request.estimatedBudget,
      managerId: user?.id ?? "",
      members: [],
      tags: ["fikir-dönüşüm"],
      createdAt: now,
      updatedAt: now,
    });
    updateRequest(request.id, { convertedProjectId: projectId });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">🚀 Projeye Dönüştür</h2>
        <p className="text-sm text-gray-500">Bu fikir yeni bir proje olarak oluşturulacak.</p>
        <form onSubmit={handleConvert} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Proje Adı</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">İptal</button>
            <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">Projeyi Oluştur</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────

function RequestCard({ request }: { request: WorkflowRequest }) {
  const { user } = useAuthStore();
  const { projects } = useProjectStore();
  const { updateRequest } = useRequestStore();
  const { templates } = useWorkflowStore();
  const [stepReview, setStepReview] = useState<"approved" | "rejected" | null>(null);
  const [showConvert, setShowConvert] = useState(false);

  const typeMeta = REQUEST_TYPE_META[request.type];
  const statusMeta = REQUEST_STATUS_META[request.status];
  const priorityMeta = PRIORITY_META[request.priority];
  const project = projects.find((p) => p.id === request.projectId);
  const template = templates.find((t) => t.id === request.templateId);
  const currentStep = template ? template.steps[request.currentStepIndex ?? 0] : null;

  const canReview = user?.role === "admin" || user?.role === "pm" || user?.role === "approver";
  const isPending = request.status === "pending" || request.status === "in_review";
  const isApprovedIdea = request.type === "project_idea" && request.status === "approved" && !request.convertedProjectId;
  const isConverted = !!request.convertedProjectId;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
        {/* Top */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", typeMeta.bg, typeMeta.color)}>
              {typeMeta.icon} {typeMeta.label}
            </span>
            {project && <span className="text-xs text-gray-400 hidden sm:block">{project.name}</span>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isConverted && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Projeye Dönüştürüldü</span>
            )}
            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", statusMeta.bg, statusMeta.color)}>
              {statusMeta.label}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-2 text-sm font-semibold text-gray-900">{request.title}</h3>
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{request.description}</p>

        {/* Estimated budget */}
        {request.estimatedBudget && (
          <p className="mt-1 text-xs text-emerald-700 font-medium">
            Tahmini Bütçe: {request.estimatedBudget.toLocaleString("tr-TR")} ₺
          </p>
        )}

        {/* Workflow progress */}
        {template && (
          <div className="mt-3">
            <div className="flex items-center gap-1.5">
              {template.steps.map((step, i) => {
                const idx = request.currentStepIndex ?? 0;
                const history = request.stepHistory ?? [];
                const entry = history.find((h) => h.stepId === step.id);
                const isDone = entry?.action === "approved";
                const isRejected = entry?.action === "rejected";
                const isCurrent = i === idx && isPending;

                return (
                  <div key={step.id} className="flex items-center gap-1">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                      isDone ? "bg-emerald-500 text-white" :
                      isRejected ? "bg-red-500 text-white" :
                      isCurrent ? "bg-indigo-500 text-white ring-2 ring-indigo-300" :
                      "bg-gray-200 text-gray-500"
                    )} title={step.label}>
                      {isDone ? "✓" : isRejected ? "✕" : i + 1}
                    </div>
                    {i < template.steps.length - 1 && (
                      <div className={cn("h-0.5 w-4", isDone ? "bg-emerald-400" : "bg-gray-200")} />
                    )}
                  </div>
                );
              })}
              {currentStep && isPending && (
                <span className="ml-2 text-xs text-gray-500">
                  {currentStep.label} <span className="text-gray-400">({ROLE_LABELS[currentStep.approverRole]})</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
          <span className={cn("font-medium", priorityMeta.color)}>{priorityMeta.label}</span>
          {request.dueDate && <span>📅 {new Date(request.dueDate).toLocaleDateString("tr-TR")}</span>}
          <span>{new Date(request.createdAt).toLocaleDateString("tr-TR")}</span>
          {request.reviewNote && <span className="italic">Not: {request.reviewNote}</span>}
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {canReview && isPending && template && currentStep && (
            <>
              <button onClick={() => setStepReview("approved")}
                className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">
                ✓ {currentStep.label} Onayla
              </button>
              <button onClick={() => setStepReview("rejected")}
                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
                ✕ Reddet
              </button>
            </>
          )}
          {canReview && isPending && !template && (
            <>
              {request.status === "pending" && (
                <button onClick={() => updateRequest(request.id, { status: "in_review" })}
                  className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                  İncelemeye Al
                </button>
              )}
              <button onClick={() => setStepReview("approved")}
                className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">
                ✓ Onayla
              </button>
              <button onClick={() => setStepReview("rejected")}
                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
                ✕ Reddet
              </button>
            </>
          )}
          {isApprovedIdea && (
            <button onClick={() => setShowConvert(true)}
              className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 font-semibold">
              🚀 Projeye Dönüştür
            </button>
          )}
        </div>
      </div>

      {stepReview && (
        <StepReviewModal
          request={request}
          stepLabel={template && currentStep ? currentStep.label : stepReview === "approved" ? "Onayla" : "Reddet"}
          action={stepReview}
          onClose={() => setStepReview(null)}
        />
      )}
      {showConvert && <ConvertModal request={request} onClose={() => setShowConvert(false)} />}
    </>
  );
}

// ─── Workflow Templates View ──────────────────────────────────────────────────

const ROLE_OPTIONS: UserRole[] = ["admin", "pm", "approver", "member"];

function TemplateForm({ initial, onSave, onCancel }: {
  initial?: WorkflowTemplate;
  onSave: (t: WorkflowTemplate) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [steps, setSteps] = useState<WorkflowStep[]>(
    initial?.steps ?? [{ id: crypto.randomUUID(), label: "", approverRole: "pm", order: 0 }]
  );

  function addStep() {
    setSteps((s) => [...s, { id: crypto.randomUUID(), label: "", approverRole: "pm", order: s.length }]);
  }
  function removeStep(id: string) {
    setSteps((s) => s.filter((x) => x.id !== id).map((x, i) => ({ ...x, order: i })));
  }
  function updateStep(id: string, patch: Partial<WorkflowStep>) {
    setSteps((s) => s.map((x) => x.id === id ? { ...x, ...patch } : x));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || steps.some((s) => !s.label.trim())) return;
    const now = new Date().toISOString();
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      steps: steps.map((s, i) => ({ ...s, order: i })),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  }

  return (
    <form onSubmit={handleSave} className="bg-white rounded-xl border border-indigo-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">{initial ? "Şablonu Düzenle" : "Yeni Şablon"}</h3>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Şablon Adı</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Standart Onay Akışı" required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="İsteğe bağlı..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-600">Onay Adımları</label>
          <button type="button" onClick={addStep}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">+ Adım Ekle</button>
        </div>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <input value={step.label} onChange={(e) => updateStep(step.id, { label: e.target.value })}
                placeholder="Adım adı (ör: PM Onayı)" required
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={step.approverRole} onChange={(e) => updateStep(step.id, { approverRole: e.target.value as UserRole })}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              {steps.length > 1 && (
                <button type="button" onClick={() => removeStep(step.id)}
                  className="text-gray-400 hover:text-red-500 text-sm px-1">✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">İptal</button>
        <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">Kaydet</button>
      </div>
    </form>
  );
}

function WorkflowsView() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useWorkflowStore();
  const { requests } = useRequestStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Onay akışlarını tanımlayın ve taleplere atayın.</p>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
          + Yeni Şablon
        </button>
      </div>

      {creating && (
        <TemplateForm
          onSave={(t) => { addTemplate(t); setCreating(false); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {templates.length === 0 && !creating && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">⚙️</div>
          <p className="text-sm">Henüz onay akışı şablonu yok</p>
          <button onClick={() => setCreating(true)} className="mt-3 text-sm text-indigo-600 hover:underline">
            İlk şablonu oluştur
          </button>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((t) => {
          const usageCount = requests.filter((r) => r.templateId === t.id).length;
          return editing === t.id ? (
            <TemplateForm key={t.id} initial={t}
              onSave={(updated) => { updateTemplate(t.id, updated); setEditing(null); }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
                  {t.description && <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{usageCount} kullanım</span>
                  <button onClick={() => setEditing(t.id)} className="text-xs text-indigo-600 hover:underline">Düzenle</button>
                  <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-500 hover:underline">Sil</button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {t.steps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
                      <span className="text-xs text-gray-700 font-medium">{step.label}</span>
                      <span className="text-xs text-gray-400">({ROLE_LABELS[step.approverRole]})</span>
                    </div>
                    {i < t.steps.length - 1 && <span className="text-gray-300 text-sm">→</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { key: TabFilter; label: string }[] = [
  { key: "all",          label: "Tümü"          },
  { key: "project_idea", label: "Proje Fikirleri"},
  { key: "pending",      label: "Bekleyen"       },
  { key: "in_review",    label: "İncelemede"     },
  { key: "approved",     label: "Onaylanan"      },
  { key: "rejected",     label: "Reddedilen"     },
];

export default function TaleplerPage() {
  const { requests } = useRequestStore();
  const [view, setView] = useState<MainView>("requests");
  const [tab, setTab] = useState<TabFilter>("all");
  const [showNew, setShowNew] = useState(false);

  const filtered =
    tab === "all" ? requests :
    tab === "project_idea" ? requests.filter((r) => r.type === "project_idea") :
    requests.filter((r) => r.status === tab);

  const counts: Record<TabFilter, number> = {
    all:          requests.length,
    project_idea: requests.filter((r) => r.type === "project_idea").length,
    pending:      requests.filter((r) => r.status === "pending").length,
    in_review:    requests.filter((r) => r.status === "in_review").length,
    approved:     requests.filter((r) => r.status === "approved").length,
    rejected:     requests.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Talepler</h1>
          <p className="text-sm text-gray-500 mt-0.5">İş akışı talepleri ve onay yönetimi</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Yeni Talep
        </button>
      </div>

      {/* Main view tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([["requests", "📋 Talepler"], ["workflows", "⚙️ Onay Akışları"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
            {label}
          </button>
        ))}
      </div>

      {view === "workflows" ? (
        <WorkflowsView />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Bekleyen",    count: counts.pending,      color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200"  },
              { label: "İncelemede", count: counts.in_review,    color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200"   },
              { label: "Onaylanan",  count: counts.approved,     color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
              { label: "Proje Fikri",count: counts.project_idea, color: "text-yellow-600",  bg: "bg-yellow-50",  border: "border-yellow-200" },
            ].map((s) => (
              <div key={s.label} className={cn("rounded-xl border p-4", s.bg, s.border)}>
                <p className={cn("text-2xl font-bold", s.color)}>{s.count}</p>
                <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                {t.label}
                <span className={cn("ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                  tab === t.key ? "bg-indigo-100 text-indigo-700" : "bg-gray-200 text-gray-500")}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm">Bu kategoride talep bulunmuyor</p>
              <button onClick={() => setShowNew(true)} className="mt-3 text-sm text-indigo-600 hover:underline">
                Yeni talep oluştur
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((r) => <RequestCard key={r.id} request={r} />)}
            </div>
          )}
        </>
      )}

      {showNew && <NewRequestModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
