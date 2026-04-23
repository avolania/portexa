"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus, Search, ClipboardList, Clock, XCircle, AlertTriangle,
  CheckCircle, Paperclip, X as XIcon, PanelLeftClose, PanelLeftOpen,
  ArrowLeft, ChevronDown, File, FileText, FileArchive, Image as ImageIcon,
  UserCheck,
} from "lucide-react";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkflowInstanceStore } from "@/store/useWorkflowInstanceStore";
import { ServiceRequestState, Impact, Urgency, ApprovalState } from "@/lib/itsm/types/enums";
import { ServiceRequestClosureCode, isValidSRTransition } from "@/lib/itsm/types/service-request.types";
import { ITSM_PRIORITY_MAP, SR_STATE_MAP, APPROVAL_STATE_MAP } from "@/lib/itsm/ui-maps";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import type { CreateServiceRequestDto } from "@/lib/itsm/types/service-request.types";
import type { Attachment } from "@/types";
import TicketTimeline from "@/components/itsm/TicketTimeline";
import TicketTasks from "@/components/itsm/TicketTasks";
import { ListPagination } from "@/components/ui/ListPagination";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATE_FILTERS = [
  { value: "all",                                label: "Tümü"          },
  { value: ServiceRequestState.DRAFT,            label: "Taslak"        },
  { value: ServiceRequestState.SUBMITTED,        label: "İletildi"      },
  { value: ServiceRequestState.PENDING_APPROVAL, label: "Onay Bekliyor" },
  { value: ServiceRequestState.APPROVED,         label: "Onaylandı"     },
  { value: ServiceRequestState.IN_PROGRESS,      label: "İşlemde"       },
  { value: ServiceRequestState.FULFILLED,        label: "Karşılandı"    },
  { value: ServiceRequestState.CLOSED,           label: "Kapandı"       },
  { value: ServiceRequestState.REJECTED,         label: "Reddedildi"    },
];

const TERMINAL_STATES = [
  ServiceRequestState.CLOSED,
  ServiceRequestState.REJECTED,
  ServiceRequestState.CANCELLED,
];

const SR_STEPS: { state: ServiceRequestState; label: string }[] = [
  { state: ServiceRequestState.DRAFT,            label: "Taslak"   },
  { state: ServiceRequestState.SUBMITTED,        label: "İletildi" },
  { state: ServiceRequestState.PENDING_APPROVAL, label: "Onay"     },
  { state: ServiceRequestState.APPROVED,         label: "Onaylandı"},
  { state: ServiceRequestState.IN_PROGRESS,      label: "İşlemde"  },
  { state: ServiceRequestState.FULFILLED,        label: "Karşılandı"},
  { state: ServiceRequestState.CLOSED,           label: "Kapandı"  },
];

const TRANSITION_LABEL: Partial<Record<ServiceRequestState, string>> = {
  [ServiceRequestState.SUBMITTED]:        "İlet",
  [ServiceRequestState.APPROVED]:         "Onayla",
  [ServiceRequestState.REJECTED]:         "Reddet",
  [ServiceRequestState.IN_PROGRESS]:      "İşleme Al",
  [ServiceRequestState.PENDING]:          "Bekletmeye Al",
  [ServiceRequestState.FULFILLED]:        "Karşıla",
  [ServiceRequestState.CLOSED]:           "Kapat",
  [ServiceRequestState.CANCELLED]:        "İptal Et",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-blue-500" />;
  if (type.includes("zip") || type.includes("rar")) return <FileArchive className="w-4 h-4 text-amber-500" />;
  if (type.includes("pdf") || type.includes("document")) return <FileText className="w-4 h-4 text-red-500" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

// ─── New SR Modal ─────────────────────────────────────────────────────────────

function NewSRModal({ onClose }: { onClose: () => void }) {
  const { create, addAttachment, load } = useServiceRequestStore();
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    shortDescription: "",
    description: "",
    requestType: "",
    category: "",
    justification: "",
    impact: Impact.LOW as Impact,
    urgency: Urgency.LOW as Urgency,
    approvalRequired: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shortDescription.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const dto: CreateServiceRequestDto = {
        requestedForId: user?.id ?? "",
        requestedById: user?.id ?? "",
        requestType: form.requestType || "Genel",
        category: form.category || "Genel",
        impact: form.impact,
        urgency: form.urgency,
        shortDescription: form.shortDescription,
        description: form.description,
        justification: form.justification || undefined,
        approvalRequired: form.approvalRequired,
      };
      const sr = await create(dto);
      if (sr && pendingFiles.length > 0) {
        for (const file of pendingFiles) await addAttachment(sr.id, file);
      }
      if (sr) {
        try { await load(); } catch (_) { /* non-fatal */ }
      }
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const f = (k: string, v: string | boolean) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Yeni Servis Talebi</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kısa Açıklama *</label>
            <input className="input w-full" placeholder="Talep özeti..." value={form.shortDescription} onChange={(e) => f("shortDescription", e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Detaylı Açıklama</label>
            <textarea className="input w-full min-h-[80px] resize-none" placeholder="Talep detayları..." value={form.description} onChange={(e) => f("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Talep Tipi</label>
              <input className="input w-full" placeholder="Yazılım, Donanım..." value={form.requestType} onChange={(e) => f("requestType", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <input className="input w-full" placeholder="IT, İK..." value={form.category} onChange={(e) => f("category", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Etki</label>
              <select className="input w-full" value={form.impact} onChange={(e) => f("impact", e.target.value)}>
                <option value={Impact.HIGH}>Yüksek</option>
                <option value={Impact.MEDIUM}>Orta</option>
                <option value={Impact.LOW}>Düşük</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aciliyet</label>
              <select className="input w-full" value={form.urgency} onChange={(e) => f("urgency", e.target.value)}>
                <option value={Urgency.HIGH}>Yüksek</option>
                <option value={Urgency.MEDIUM}>Orta</option>
                <option value={Urgency.LOW}>Düşük</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gerekçe</label>
            <textarea className="input w-full min-h-[60px] resize-none" placeholder="Neden bu talep gerekli?" value={form.justification} onChange={(e) => f("justification", e.target.value)} />
          </div>
          {/* approvalRequired config'den otomatik belirleniyor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ekler</label>
            {pendingFiles.length > 0 && (
              <div className="space-y-1 mb-2">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded border border-gray-200 text-sm">
                    <span className="flex-1 truncate text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{formatBytes(file.size)}</span>
                    <button type="button" onClick={() => setPendingFiles((pf) => pf.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="relative flex items-center gap-2 px-3 py-2 w-full border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-colors cursor-pointer overflow-hidden">
              <Paperclip className="w-4 h-4" /> Dosya ekle
              <input type="file" multiple className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                onChange={(e) => { if (e.target.files) setPendingFiles((pf) => [...pf, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
            </label>
          </div>
          {saveError && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 break-words">
              <span className="font-semibold">Hata: </span>{saveError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">İptal</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Kaydediliyor..." : "Oluştur"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Fulfillment Stepper ──────────────────────────────────────────────────────

function SRStepper({ state }: { state: ServiceRequestState }) {
  const isTerminal = TERMINAL_STATES.includes(state);
  if (state === ServiceRequestState.REJECTED) {
    return (
      <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center gap-2 flex-shrink-0">
        <XCircle className="w-4 h-4 text-red-500" />
        <span className="text-xs font-semibold text-red-600">Bu talep reddedildi</span>
      </div>
    );
  }
  if (state === ServiceRequestState.CANCELLED) {
    return (
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
        <XCircle className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-semibold text-gray-500">Bu talep iptal edildi</span>
      </div>
    );
  }

  const currentIdx = SR_STEPS.findIndex((s) => s.state === state);
  return (
    <div className="flex items-center px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex-shrink-0">
      {SR_STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.state} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium",
                done ? "bg-emerald-500 text-white" : active ? "bg-indigo-600 text-white ring-2 ring-indigo-200 ring-offset-1" : "bg-gray-200 text-gray-400"
              )}>
                {done ? <CheckCircle className="w-3 h-3" /> : <span>{i + 1}</span>}
              </div>
              <span className={cn("text-[9px] mt-0.5 hidden sm:block whitespace-nowrap",
                done ? "text-emerald-600" : active ? "text-indigo-700 font-semibold" : "text-gray-400"
              )}>{step.label}</span>
            </div>
            {i < SR_STEPS.length - 1 && (
              <div className={cn("h-px flex-1 mx-1 mb-3", done ? "bg-emerald-400" : "bg-gray-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Attachments ─────────────────────────────────────────────────────────────

function SRAttachments({ attachments, onAdd, onRemove }: {
  attachments: Attachment[];
  onAdd: (file: File) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try { for (const file of Array.from(files)) await onAdd(file); }
    catch (err) { setUploadError(err instanceof Error ? err.message : String(err)); }
    finally { setUploading(false); }
  }

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 group">
              <div className="shrink-0">{fileIcon(att.type)}</div>
              <div className="flex-1 min-w-0">
                <a href={att.url} target="_blank" rel="noopener noreferrer" download={att.name}
                  className="text-sm font-medium text-gray-800 hover:text-indigo-600 truncate block">{att.name}</a>
                <div className="text-xs text-gray-400 flex gap-1.5 mt-0.5">
                  <span>{formatBytes(att.size)}</span><span>·</span>
                  <span>{att.uploadedBy}</span><span>·</span>
                  <span>{new Date(att.uploadedAt).toLocaleDateString("tr-TR")}</span>
                </div>
              </div>
              <button onClick={() => onRemove(att.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {uploadError && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{uploadError}</div>}
      <label className={cn("relative flex items-center gap-2 px-3 py-2 w-full border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-colors overflow-hidden", uploading ? "opacity-50 pointer-events-none" : "cursor-pointer")}>
        <Paperclip className="w-4 h-4" />
        {uploading ? "Yükleniyor..." : "Dosya ekle"}
        <input type="file" multiple className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </label>
    </div>
  );
}

// ─── SR Detail Panel ──────────────────────────────────────────────────────────

type Tab = "details" | "approvals" | "tasks" | "worknotes" | "comments" | "timeline" | "attachments";

function SRDetail({ srId, onClose }: { srId: string; onClose?: () => void }) {
  const { serviceRequests, submit, approve, reject, fulfill, close, changeState, addWorkNote, addComment, addAttachment, removeAttachment, addTask, updateTask, deleteTask,
          loadTicketActivity, activeWorkNotes, activeComments, activeEvents, activeTicketId } = useServiceRequestStore();
  const { profiles, user } = useAuthStore();
  const { getForTicket, decide, load: loadInstances } = useWorkflowInstanceStore();
  const sr = serviceRequests.find((s) => s.id === srId);

  useEffect(() => { loadInstances(); }, [loadInstances]);
  useEffect(() => {
    if (srId && srId !== activeTicketId) loadTicketActivity(srId);
  }, [srId]);

  const [tab, setTab] = useState<Tab>("details");
  const [noteText, setNoteText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showStateMenu, setShowStateMenu] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [pendingState, setPendingState] = useState<ServiceRequestState | null>(null);
  const [fulfillNotes, setFulfillNotes] = useState("");
  const [fulfillCode, setFulfillCode] = useState(ServiceRequestClosureCode.FULFILLED);
  const [rejectComment, setRejectComment] = useState("");

  if (!sr) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
        <ClipboardList className="w-10 h-10" />
        <p className="text-sm">Talep bulunamadı.</p>
      </div>
    );
  }

  const stateInfo    = SR_STATE_MAP[sr.state];
  const priorityInfo = ITSM_PRIORITY_MAP[sr.priority];
  const approvalInfo = APPROVAL_STATE_MAP[sr.approvalState];
  const isTerminal   = TERMINAL_STATES.includes(sr.state);

  const ALL_SR_STATES = Object.values(ServiceRequestState);
  const validTransitions = ALL_SR_STATES.filter((s) => s !== sr.state && isValidSRTransition(sr.state, s));

  const handleTransition = async (targetState: ServiceRequestState) => {
    setShowStateMenu(false);
    setTransitionError(null);
    if (targetState === ServiceRequestState.FULFILLED || targetState === ServiceRequestState.REJECTED) {
      setPendingState(targetState);
      return;
    }
    setSaving(true);
    try {
      if (targetState === ServiceRequestState.SUBMITTED) {
        await submit(sr.id);
      } else if (targetState === ServiceRequestState.APPROVED) {
        // Aktif workflow instance varsa önce decide() çağır
        const instance = getForTicket('service_request', sr.id);
        if (instance) {
          const currentStep = instance.steps[instance.currentStepIndex];
          if (currentStep) {
            const result = await decide(instance.id, currentStep.stepDefId, 'approved');
            // Tüm workflow tamamlandıysa SR'ı da approve et
            if (result?.instanceCompleted && result.outcome === 'approved') {
              await approve(sr.id, {});
            }
          }
        } else {
          // Workflow yoksa direkt approve
          await approve(sr.id, {});
        }
      } else if (targetState === ServiceRequestState.CLOSED) {
        await close(sr.id);
      } else {
        // IN_PROGRESS, PENDING, CANCELLED ve diğer geçişler
        await changeState(sr.id, targetState);
      }
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const doFulfill = async () => {
    if (!fulfillNotes.trim()) return;
    setSaving(true);
    await fulfill(sr.id, { fulfillmentNotes: fulfillNotes, closureCode: fulfillCode });
    setSaving(false);
    setPendingState(null);
    setFulfillNotes("");
  };

  const doReject = async () => {
    if (!rejectComment.trim()) return;
    setSaving(true);
    await reject(sr.id, { comments: rejectComment });
    setSaving(false);
    setPendingState(null);
    setRejectComment("");
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    await addWorkNote(sr.id, { content: noteText });
    setNoteText("");
    setSaving(false);
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSaving(true);
    await addComment(sr.id, { content: commentText });
    setCommentText("");
    setSaving(false);
  };

  const now = Date.now();
  const slaMs = new Date(sr.sla.fulfillmentDeadline).getTime() - now;
  const slaH = Math.floor(Math.abs(slaMs) / 3_600_000);
  const slaM = Math.floor((Math.abs(slaMs) % 3_600_000) / 60_000);
  const slaOver = slaMs < 0 || sr.sla.slaBreached;

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "details",     label: "Detaylar"   },
    { key: "approvals",   label: "Onaylar",   count: sr.approvers.length },
    { key: "tasks",       label: "Görevler",  count: (sr.tasks ?? []).length },
    { key: "attachments", label: "Ekler",     count: (sr.attachments ?? []).length },
    { key: "worknotes",   label: "İş Notları", count: activeWorkNotes.length },
    { key: "comments",    label: "Yorumlar",  count: activeComments.length  },
    { key: "timeline",    label: "Zaman",     count: activeEvents.length    },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-start gap-2">
          {onClose && (
            <button onClick={onClose} className="shrink-0 p-1.5 rounded hover:bg-gray-100 mt-0.5">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", priorityInfo.badge)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", priorityInfo.dot)} />
                {priorityInfo.label}
              </span>
              <span className="font-mono text-xs text-gray-400">{sr.number}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", stateInfo.badge)}>{stateInfo.label}</span>
              {sr.approvalRequired && (
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", approvalInfo.badge)}>{approvalInfo.label}</span>
              )}
            </div>
            <h2 className="text-sm font-semibold text-gray-900 leading-snug">{sr.shortDescription}</h2>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
              {sr.requestType && <span>{sr.requestType} {sr.category && `/ ${sr.category}`}</span>}
              <span>{format(new Date(sr.createdAt), "dd MMM yyyy HH:mm", { locale: tr })}</span>
              <span>güncellendi {formatDistanceToNow(new Date(sr.updatedAt), { addSuffix: true, locale: tr })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <SRStepper state={sr.state} />

      {/* Pending Approval Banner */}
      {sr.approvers.some((a) => a.approvalState === ApprovalState.REQUESTED) && (
        <div className="mx-4 mt-2 flex items-start gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 flex-shrink-0">
          <UserCheck className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-amber-800">Onay Bekleniyor: </span>
            {sr.approvers
              .filter((a) => a.approvalState === ApprovalState.REQUESTED)
              .map((a, i) => (
                <span key={a.approverId}>
                  {i > 0 && <span className="text-amber-400">, </span>}
                  <span className="text-xs font-medium text-amber-800">{a.approverName}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex border-b border-gray-200 px-4 bg-white flex-shrink-0 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                  tab === t.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                )}>
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Details */}
            {tab === "details" && (
              <div className="space-y-3">
                {sr.description && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-600 mb-1.5">Açıklama</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{sr.description}</p>
                  </div>
                )}
                {sr.justification && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-600 mb-1.5">Gerekçe</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{sr.justification}</p>
                  </div>
                )}
                {sr.fulfillmentNotes && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <h3 className="text-xs font-semibold text-emerald-700 mb-1.5">Karşılama Notu</h3>
                    <p className="text-sm text-emerald-700">{sr.fulfillmentNotes}</p>
                  </div>
                )}
                {/* Info grid */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Talep Bilgileri</h3>
                  </div>
                  <div className="grid grid-cols-2">
                    {[
                      ["Numara", sr.number],
                      ["Tip", sr.requestType],
                      ["Kategori", sr.category],
                      ["Etki", sr.impact.replace(/^\d-/, "")],
                      ["Aciliyet", sr.urgency.replace(/^\d-/, "")],
                      ["Atanan", sr.assignedToId ? (profiles[sr.assignedToId]?.name ?? sr.assignedToId) : "—"],
                      ["Grup", sr.assignmentGroupName ?? "—"],
                      ["Karşılanma", sr.fulfilledAt ? format(new Date(sr.fulfilledAt), "dd MMM yyyy", { locale: tr }) : "—"],
                    ].map(([label, value], i) => (
                      <div key={label} className={cn("px-3 py-2 border-b border-gray-100 text-xs", i % 2 === 0 ? "border-r border-gray-100" : "")}>
                        <div className="text-gray-400 font-medium uppercase tracking-wider mb-0.5 text-[10px]">{label}</div>
                        <div className="text-gray-800 font-medium">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Approvals */}
            {tab === "approvals" && (() => {
              const wfInstance = getForTicket('service_request', sr.id);
              const currentStep = wfInstance ? wfInstance.steps[wfInstance.currentStepIndex] : null;
              const canDecide = currentStep && sr.state === ServiceRequestState.PENDING_APPROVAL;
              return (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">Onay Süreci</h3>
                {sr.approvers.length === 0 && !wfInstance ? (
                  <p className="text-sm text-gray-400 text-center py-8">Onaylayıcı atanmamış.</p>
                ) : (
                  <div className="flex gap-3 flex-wrap">
                    {sr.approvers.map((a, i) => {
                      const isApproved = a.approvalState === "Approved";
                      const isPending  = a.approvalState !== "Approved" && a.approvalState !== "Rejected";
                      return (
                        <div key={i} className={cn("bg-white rounded-lg border p-4 min-w-[180px]",
                          isApproved ? "border-emerald-200" : isPending ? "border-amber-200" : "border-red-200"
                        )}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                              isApproved ? "bg-emerald-100 text-emerald-700" : isPending ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                            )}>
                              {isApproved ? "✓" : isPending ? "?" : "✗"}
                            </div>
                            <span className={cn("text-xs font-semibold",
                              isApproved ? "text-emerald-700" : isPending ? "text-amber-700" : "text-red-700"
                            )}>{a.approvalState}</span>
                          </div>
                          <div className="text-sm font-semibold text-gray-800">{a.approverName}</div>
                          {a.decidedAt && (
                            <div className="text-xs text-gray-400 mt-1">{format(new Date(a.decidedAt), "dd MMM HH:mm", { locale: tr })}</div>
                          )}
                          {a.comments && (
                            <p className="text-xs text-gray-500 mt-2 italic">"{a.comments}"</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {canDecide && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                    <p className="text-xs font-semibold text-amber-800">Bu talep onay bekliyor. Kararınızı bildirin:</p>
                    <div className="flex gap-2">
                      <button
                        disabled={saving}
                        onClick={async () => {
                          setSaving(true);
                          try {
                            let shouldApprove = true;
                            try {
                              const result = await decide(wfInstance!.id, currentStep!.stepDefId, 'approved');
                              // Multi-step: more steps remain, don't approve SR yet
                              if (result && result.stepCompleted && !result.instanceCompleted) {
                                shouldApprove = false;
                              }
                            } catch {
                              // Workflow DB error — fall through to direct approve
                            }
                            if (shouldApprove) await approve(sr.id, {});
                          } finally { setSaving(false); }
                        }}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                      >
                        ✓ Onayla
                      </button>
                      <button
                        disabled={saving}
                        onClick={async () => {
                          setSaving(true);
                          try {
                            try {
                              await decide(wfInstance!.id, currentStep!.stepDefId, 'rejected');
                            } catch {
                              // Workflow DB error — fall through to direct reject
                            }
                            await reject(sr.id, { comments: 'Onay reddedildi.' });
                          } finally { setSaving(false); }
                        }}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        ✗ Reddet
                      </button>
                    </div>
                  </div>
                )}
                {sr.approvalRequired && !canDecide && sr.state === ServiceRequestState.PENDING_APPROVAL && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-800">Bu talep için onay gereklidir. Tüm onaylar tamamlanmadan karşılama süreci başlamaz.</p>
                  </div>
                )}
              </div>
              );
            })()}

            {/* Tasks */}
            {tab === "tasks" && (
              <TicketTasks
                tasks={sr.tasks ?? []}
                onAdd={(task) => addTask(sr.id, task)}
                onUpdate={(taskId, patch) => updateTask(sr.id, taskId, patch)}
                onDelete={(taskId) => deleteTask(sr.id, taskId)}
                readonly={isTerminal}
              />
            )}

            {/* Attachments */}
            {tab === "attachments" && (
              <SRAttachments
                attachments={sr.attachments ?? []}
                onAdd={(file) => addAttachment(sr.id, file)}
                onRemove={(aid) => removeAttachment(sr.id, aid)}
              />
            )}

            {/* Work Notes */}
            {tab === "worknotes" && (
              <div className="space-y-3">
                {!isTerminal && (
                  <div className="p-3 border border-gray-200 rounded-lg">
                    <textarea className="input w-full min-h-[72px] resize-none text-sm" placeholder="İş notu ekle..."
                      value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                    <div className="flex justify-end mt-2">
                      <button onClick={submitNote} disabled={saving || !noteText.trim()} className="btn-primary text-xs">Not Ekle</button>
                    </div>
                  </div>
                )}
                {activeWorkNotes.length === 0
                  ? <p className="text-sm text-gray-400 text-center py-6">Henüz iş notu yok.</p>
                  : [...activeWorkNotes].reverse().map((note) => (
                    <div key={note.id} className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-800">{note.authorName}</span>
                        <span className="text-xs text-gray-400">{format(new Date(note.createdAt), "dd MMM HH:mm", { locale: tr })}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Comments */}
            {tab === "comments" && (
              <div className="space-y-3">
                {!isTerminal && (
                  <div className="p-3 border border-gray-200 rounded-lg">
                    <textarea className="input w-full min-h-[72px] resize-none text-sm" placeholder="Yorum ekle..."
                      value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                    <div className="flex justify-end mt-2">
                      <button onClick={submitComment} disabled={saving || !commentText.trim()} className="btn-primary text-xs">Yorum Ekle</button>
                    </div>
                  </div>
                )}
                {activeComments.length === 0
                  ? <p className="text-sm text-gray-400 text-center py-6">Henüz yorum yok.</p>
                  : [...activeComments].reverse().map((c) => (
                    <div key={c.id} className="p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-800">{c.authorName}</span>
                        <span className="text-xs text-gray-400">{format(new Date(c.createdAt), "dd MMM HH:mm", { locale: tr })}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Timeline */}
            {tab === "timeline" && <TicketTimeline timeline={activeEvents} />}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-52 border-l border-gray-200 bg-white flex-shrink-0 overflow-y-auto p-3 space-y-4">
          {/* İşlemler */}
          {!isTerminal && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</p>
              <div className="relative">
                <button onClick={() => setShowStateMenu(!showStateMenu)} disabled={saving}
                  className="w-full flex items-center justify-between gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  Durum Değiştir
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showStateMenu && "rotate-180")} />
                </button>
                {showStateMenu && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    {validTransitions.map((s) => (
                      <button key={s} onClick={() => handleTransition(s)}
                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                        {TRANSITION_LABEL[s] ?? s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Transition error */}
              {transitionError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 break-words">
                  <span className="font-semibold">Hata: </span>{transitionError}
                </div>
              )}

              {/* Fulfill form */}
              {pendingState === ServiceRequestState.FULFILLED && (
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
                  <p className="text-xs font-medium text-emerald-800">Karşılama</p>
                  <select className="input w-full text-xs" value={fulfillCode} onChange={(e) => setFulfillCode(e.target.value as ServiceRequestClosureCode)}>
                    {Object.values(ServiceRequestClosureCode).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <textarea className="input w-full text-xs min-h-[60px] resize-none" placeholder="Karşılama notu *"
                    value={fulfillNotes} onChange={(e) => setFulfillNotes(e.target.value)} />
                  <div className="flex gap-1.5">
                    <button onClick={doFulfill} disabled={saving || !fulfillNotes.trim()} className="btn-primary text-xs flex-1">Onayla</button>
                    <button onClick={() => setPendingState(null)} className="btn-secondary text-xs">İptal</button>
                  </div>
                </div>
              )}

              {/* Reject form */}
              {pendingState === ServiceRequestState.REJECTED && (
                <div className="p-2.5 bg-red-50 rounded-lg border border-red-200 space-y-2">
                  <p className="text-xs font-medium text-red-700">Red Gerekçesi</p>
                  <textarea className="input w-full text-xs min-h-[60px] resize-none" placeholder="Neden reddedildi? *"
                    value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
                  <div className="flex gap-1.5">
                    <button onClick={doReject} disabled={saving || !rejectComment.trim()}
                      className="flex-1 px-2 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50">Reddet</button>
                    <button onClick={() => setPendingState(null)} className="btn-secondary text-xs">İptal</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SLA */}
          {!isTerminal && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> SLA
              </p>
              <div className="flex items-center justify-between py-1 text-xs">
                <span className="text-gray-500">Karşılama</span>
                {slaOver
                  ? <span className="text-red-600 font-medium flex items-center gap-0.5"><XCircle className="w-3 h-3" /> İhlal</span>
                  : <span className={cn("font-medium flex items-center gap-0.5", slaH < 4 ? "text-amber-600" : "text-emerald-600")}>
                      <Clock className="w-3 h-3" /> {slaH}s{slaM}d
                    </span>
                }
              </div>
              <div className="text-[10px] text-gray-400">Son: {format(new Date(sr.sla.fulfillmentDeadline), "dd MMM HH:mm", { locale: tr })}</div>
            </div>
          )}

          {/* Bilgiler */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hızlı Bilgi</p>
            {[
              { label: "Talep Eden", value: sr.requestedById ? (profiles[sr.requestedById]?.name ?? sr.requestedById) : "—" },
              { label: "Etki",       value: sr.impact.replace(/^\d-/, "")   },
              { label: "Aciliyet",   value: sr.urgency.replace(/^\d-/, "")  },
              { label: "Atanan",     value: sr.assignedToId ? (profiles[sr.assignedToId]?.name ?? "—") : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-1 text-xs">
                <span className="text-gray-400 shrink-0">{label}</span>
                <span className="text-gray-700 text-right font-medium truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServiceRequestsPage() {
  const { serviceRequests, loading } = useServiceRequestStore();

  const [stateFilter, setStateFilter]     = useState("all");
  const [search, setSearch]               = useState("");
  const [sortBy, setSortBy]               = useState<"updated" | "priority">("updated");
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [showNew, setShowNew]             = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [currentPage, setCurrentPage]     = useState(0);

  useEffect(() => { setCurrentPage(0); }, [stateFilter, search, sortBy]);

  const stateCounts = serviceRequests.reduce<Record<string, number>>((acc, sr) => {
    acc[sr.state] = (acc[sr.state] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = useMemo(() => serviceRequests
    .filter((sr) => {
      if (stateFilter !== "all" && sr.state !== stateFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!sr.shortDescription.toLowerCase().includes(q) && !sr.number.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [serviceRequests, stateFilter, search, sortBy]);

  const paginated = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filtered, currentPage],
  );

  const handleSelect = (id: string) => { setSelectedId(id); setMobileShowDetail(true); };
  const handleClose  = () => { setMobileShowDetail(false); setSelectedId(null); };

  return (
    <div className={cn(
      "flex overflow-hidden bg-gray-100 rounded-lg border border-gray-200",
      "-m-3 md:-m-6 -mb-20 md:-mb-6 h-[calc(100vh-3.5rem)]"
    )}>
      {/* Left panel */}
      <div className={cn(
        "flex flex-col bg-white border-r border-gray-200 transition-all duration-200 overflow-hidden flex-shrink-0",
        listCollapsed ? "w-0" : "w-72",
        mobileShowDetail ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 flex-shrink-0">
          <h1 className="text-sm font-semibold text-gray-900 flex-1">Servis Talepleri</h1>
          <button onClick={() => setShowNew(true)} className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors" title="Yeni Talep">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setListCollapsed(true)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors hidden md:flex" title="Gizle">
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
              placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* State filter */}
        <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {STATE_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setStateFilter(f.value)}
                className={cn("px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap",
                  stateFilter === f.value ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}>
                {f.label}
                {f.value !== "all" && stateCounts[f.value] ? (
                  <span className="ml-1 opacity-70">{stateCounts[f.value]}</span>
                ) : f.value === "all" ? (
                  <span className="ml-1 opacity-70">{serviceRequests.length}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
              <ClipboardList className="w-8 h-8" />
              <p className="text-xs">Talep bulunamadı</p>
            </div>
          ) : (
            paginated.map((sr) => {
              const stateInfo    = SR_STATE_MAP[sr.state];
              const priorityInfo = ITSM_PRIORITY_MAP[sr.priority];
              const selected     = selectedId === sr.id;
              // Mini fulfillment progress
              const stepIdx   = SR_STEPS.findIndex((s) => s.state === sr.state);
              const doneCount = Math.max(0, stepIdx);
              return (
                <button
                  key={sr.id}
                  onClick={() => handleSelect(sr.id)}
                  className={cn(
                    "w-full text-left px-3 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50",
                    selected && "bg-indigo-50 border-l-2 border-l-indigo-500"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", priorityInfo.dot)} />
                    <span className="font-mono text-[10px] text-gray-400 flex-1">{sr.number}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", stateInfo.badge)}>{stateInfo.label}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{sr.shortDescription}</p>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                    {sr.requestType && <span>{sr.requestType}</span>}
                    <span className="ml-auto">{formatDistanceToNow(new Date(sr.updatedAt), { addSuffix: true, locale: tr })}</span>
                  </div>
                  {/* Mini progress */}
                  <div className="flex gap-0.5 mt-2">
                    {SR_STEPS.map((step, i) => (
                      <div key={step.state} className={cn("flex-1 h-1 rounded-sm",
                        i < doneCount ? "bg-emerald-500" : i === doneCount ? "bg-indigo-400" : "bg-gray-200"
                      )} />
                    ))}
                  </div>
                </button>
              );
            })
          )}
        </div>
        <ListPagination
          currentPage={currentPage}
          totalCount={filtered.length}
          pageSize={PAGE_SIZE}
          onChange={setCurrentPage}
        />
      </div>

      {/* Collapse toggle */}
      {listCollapsed && (
        <button onClick={() => setListCollapsed(false)}
          className="hidden md:flex flex-col items-center justify-center w-8 bg-white border-r border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors gap-1">
          <PanelLeftOpen className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Right panel */}
      <div className={cn("flex-1 min-w-0 overflow-hidden", !mobileShowDetail && selectedId === null ? "hidden md:flex" : "flex")}>
        {selectedId ? (
          <div className="w-full h-full">
            <SRDetail key={selectedId} srId={selectedId} onClose={mobileShowDetail ? handleClose : undefined} />
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center w-full h-full text-gray-400 gap-3">
            <ClipboardList className="w-12 h-12 opacity-30" />
            <p className="text-sm">Listeden bir talep seçin</p>
            <button onClick={() => setShowNew(true)} className="mt-2 btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Yeni Talep
            </button>
          </div>
        )}
      </div>

      {showNew && <NewSRModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
