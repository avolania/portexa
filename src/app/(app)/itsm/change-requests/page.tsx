"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus, Search, GitPullRequest, Calendar, CheckCircle,
  Paperclip, X as XIcon, PanelLeftClose, PanelLeftOpen,
  ArrowLeft, ChevronDown, File, FileText, FileArchive, Image as ImageIcon,
  ArrowRight, UserCheck,
} from "lucide-react";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { useWorkflowInstanceStore } from "@/store/useWorkflowInstanceStore";
import { useAuthStore } from "@/store/useAuthStore";
import WorkflowProgress from "@/components/itsm/WorkflowProgress";
import { ChangeRequestState, ChangeType, ChangeRisk, Impact, ChangeCloseCode, SapModule, SapCategory, ApprovalState } from "@/lib/itsm/types/enums";
import { isValidCRTransition } from "@/lib/itsm/types/change-request.types";
import { ITSM_PRIORITY_MAP, CR_STATE_MAP, CHANGE_TYPE_MAP, CHANGE_RISK_MAP, APPROVAL_STATE_MAP } from "@/lib/itsm/ui-maps";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import type { CreateChangeRequestDto } from "@/lib/itsm/types/change-request.types";
import type { Attachment } from "@/types";
import TicketTimeline from "@/components/itsm/TicketTimeline";
import TicketTasks from "@/components/itsm/TicketTasks";
import { ListPagination } from "@/components/ui/ListPagination";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;


const STATE_FILTERS = [
  { value: "all",                                label: "Tümü"          },
  { value: ChangeRequestState.PENDING_APPROVAL,  label: "Onay Bekliyor" },
  { value: ChangeRequestState.SCHEDULED,         label: "Planlandı"     },
  { value: ChangeRequestState.IMPLEMENT,         label: "Uygulama"      },
  { value: ChangeRequestState.REVIEW,            label: "İnceleme"      },
  { value: ChangeRequestState.CLOSED,            label: "Kapandı"       },
  { value: ChangeRequestState.CANCELLED,         label: "İptal"         },
];

const CR_STEPS: { state: ChangeRequestState; label: string }[] = [
  { state: ChangeRequestState.PENDING_APPROVAL, label: "Onay"      },
  { state: ChangeRequestState.SCHEDULED,        label: "Planlandı" },
  { state: ChangeRequestState.IMPLEMENT,        label: "Uygulama"  },
  { state: ChangeRequestState.REVIEW,           label: "İnceleme"  },
  { state: ChangeRequestState.CLOSED,           label: "Kapandı"   },
];

const RISK_DOT: Record<ChangeRisk, string> = {
  [ChangeRisk.CRITICAL]: "bg-red-500",
  [ChangeRisk.HIGH]:     "bg-orange-500",
  [ChangeRisk.MODERATE]: "bg-amber-500",
  [ChangeRisk.LOW]:      "bg-emerald-500",
};

const TRANSITION_LABEL: Partial<Record<ChangeRequestState, string>> = {
  [ChangeRequestState.SCHEDULED]:  "Uygulamaya Başla",
  [ChangeRequestState.IMPLEMENT]:  "İncelemeye Al",
  [ChangeRequestState.REVIEW]:     "Kapat",
  [ChangeRequestState.CANCELLED]:  "İptal Et",
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

// ─── New CR Modal ─────────────────────────────────────────────────────────────

function NewCRModal({ onClose }: { onClose: () => void }) {
  const { create, addAttachment } = useChangeRequestStore();
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    shortDescription: "", description: "", justification: "", category: "",
    sapCategory: "", sapModule: "",
    type: ChangeType.NORMAL as ChangeType,
    risk: ChangeRisk.MODERATE as ChangeRisk,
    impact: Impact.MEDIUM as Impact,
    plannedStartDate: "", plannedEndDate: "",
    implementationPlan: "", backoutPlan: "", testPlan: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shortDescription.trim() || !form.plannedStartDate || !form.plannedEndDate) return;
    setSaveError(null);
    setSaving(true);
    try {
      const dto: CreateChangeRequestDto = {
        requestedById: user?.id ?? "", changeManagerId: user?.id ?? "",
        type: form.type, category: form.category || "Genel",
        sapCategory: form.sapCategory || undefined, sapModule: form.sapModule || undefined,
        risk: form.risk, impact: form.impact,
        shortDescription: form.shortDescription, description: form.description,
        justification: form.justification,
        plannedStartDate: new Date(form.plannedStartDate + "T00:00:00").toISOString(),
        plannedEndDate: new Date(form.plannedEndDate + "T23:59:59").toISOString(),
        implementationPlan: form.implementationPlan || "—",
        backoutPlan: form.backoutPlan || "—",
        testPlan: form.testPlan || undefined,
      };
      const cr = await create(dto);
      if (cr && pendingFiles.length > 0) {
        for (const file of pendingFiles) await addAttachment(cr.id, file);
      }
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Kayıt sırasında hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const f = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Yeni Değişiklik Talebi</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kısa Açıklama *</label>
            <input className="input w-full" placeholder="Değişiklik özeti..." value={form.shortDescription} onChange={(e) => f("shortDescription", e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Detaylı Açıklama</label>
            <textarea className="input w-full min-h-[70px] resize-none" placeholder="Değişikliğin kapsamı..." value={form.description} onChange={(e) => f("description", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gerekçe *</label>
            <textarea className="input w-full min-h-[60px] resize-none" placeholder="Neden bu değişiklik gerekli?" value={form.justification} onChange={(e) => f("justification", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tip</label>
              <select className="input w-full" value={form.type} onChange={(e) => f("type", e.target.value)}>
                <option value={ChangeType.STANDARD}>Standart</option>
                <option value={ChangeType.NORMAL}>Normal</option>
                <option value={ChangeType.EMERGENCY}>Acil</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Risk</label>
              <select className="input w-full" value={form.risk} onChange={(e) => f("risk", e.target.value)}>
                <option value={ChangeRisk.CRITICAL}>Kritik</option>
                <option value={ChangeRisk.HIGH}>Yüksek</option>
                <option value={ChangeRisk.MODERATE}>Orta</option>
                <option value={ChangeRisk.LOW}>Düşük</option>
              </select>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <input className="input w-full" placeholder="Ağ, Sunucu..." value={form.category} onChange={(e) => f("category", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SAP Kategorisi</label>
              <select className="input w-full" value={form.sapCategory} onChange={(e) => f("sapCategory", e.target.value)}>
                <option value="">— Seçin (opsiyonel)</option>
                {Object.values(SapCategory).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SAP Modülü</label>
              <select className="input w-full" value={form.sapModule} onChange={(e) => f("sapModule", e.target.value)}>
                <option value="">— Seçin (opsiyonel)</option>
                {Object.values(SapModule).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planlanan Başlangıç *</label>
              <input type="date" className="input w-full" value={form.plannedStartDate} onChange={(e) => f("plannedStartDate", e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planlanan Bitiş *</label>
              <input type="date" className="input w-full" value={form.plannedEndDate} onChange={(e) => f("plannedEndDate", e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uygulama Planı</label>
            <textarea className="input w-full min-h-[60px] resize-none" placeholder="Adım adım uygulama planı..." value={form.implementationPlan} onChange={(e) => f("implementationPlan", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Geri Alma Planı</label>
            <textarea className="input w-full min-h-[60px] resize-none" placeholder="Sorun olursa nasıl geri alınacak?" value={form.backoutPlan} onChange={(e) => f("backoutPlan", e.target.value)} />
          </div>
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
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 w-full border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-colors">
              <Paperclip className="w-4 h-4" /> Dosya ekle
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden"
              onChange={(e) => { if (e.target.files) setPendingFiles((pf) => [...pf, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
          </div>
          {saveError && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{saveError}</div>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">İptal</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Kaydediliyor..." : "Oluştur"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CR Stepper ───────────────────────────────────────────────────────────────

function CRStepper({ state }: { state: ChangeRequestState }) {
  if (state === ChangeRequestState.CANCELLED) {
    return (
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-500">Bu değişiklik talebi iptal edildi</span>
      </div>
    );
  }
  const currentIdx = CR_STEPS.findIndex((s) => s.state === state);

  return (
    <div className="flex items-center px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex-shrink-0">
      {CR_STEPS.map((step, i) => {
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
            {i < CR_STEPS.length - 1 && (
              <div className={cn("h-px flex-1 mx-1 mb-3", done ? "bg-emerald-400" : "bg-gray-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Attachments ─────────────────────────────────────────────────────────────

function CRAttachments({ attachments, onAdd, onRemove }: {
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

// ─── CR Detail Panel ──────────────────────────────────────────────────────────

type Tab = "details" | "approvals" | "plans" | "tasks" | "worknotes" | "comments" | "timeline" | "attachments";

function CRDetail({ crId, onClose }: { crId: string; onClose?: () => void }) {
  const { changeRequests, transition, close, approve, addWorkNote, addComment, addAttachment, removeAttachment, addTask, updateTask, deleteTask,
          loadTicketActivity, activeWorkNotes, activeComments, activeEvents, activeTicketId } = useChangeRequestStore();
  const { instances } = useWorkflowInstanceStore();
  const { profiles } = useAuthStore();
  const cr = changeRequests.find((c) => c.id === crId);

  useEffect(() => {
    if (crId && crId !== activeTicketId) loadTicketActivity(crId);
  }, [crId]);

  const [tab, setTab] = useState<Tab>("details");
  const [noteText, setNoteText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showStateMenu, setShowStateMenu] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [closeCode, setCloseCode] = useState(ChangeCloseCode.SUCCESSFUL);
  const [closeNotes, setCloseNotes] = useState("");

  if (!cr) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
        <GitPullRequest className="w-10 h-10" />
        <p className="text-sm">Değişiklik talebi bulunamadı.</p>
      </div>
    );
  }

  const stateInfo    = CR_STATE_MAP[cr.state];
  const typeInfo     = CHANGE_TYPE_MAP[cr.type];
  const riskInfo     = CHANGE_RISK_MAP[cr.risk];
  const priorityInfo = ITSM_PRIORITY_MAP[cr.priority];
  const isTerminal   = [ChangeRequestState.CLOSED, ChangeRequestState.CANCELLED].includes(cr.state);

  const ALL_CR_STATES = Object.values(ChangeRequestState);
  const validTransitions = ALL_CR_STATES.filter((s) => s !== cr.state && isValidCRTransition(cr.state, s));

  const handleTransition = async (targetState: ChangeRequestState) => {
    setShowStateMenu(false);
    if (targetState === ChangeRequestState.CLOSED) {
      setShowClose(true);
      return;
    }
    setActionError(null);
    setSaving(true);
    try { await transition(cr.id, targetState); }
    catch (e) { setActionError(e instanceof Error ? e.message : "İşlem başarısız."); }
    finally { setSaving(false); }
  };

  const doClose = async () => {
    if (!closeNotes.trim()) return;
    setActionError(null);
    setSaving(true);
    try {
      await close(cr.id, { closeCode, closureNotes: closeNotes });
      setShowClose(false);
      setCloseNotes("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Kapatma başarısız.");
    } finally {
      setSaving(false);
    }
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    await addWorkNote(cr.id, { content: noteText });
    setNoteText("");
    setSaving(false);
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSaving(true);
    await addComment(cr.id, { content: commentText });
    setCommentText("");
    setSaving(false);
  };

  const hasWorkflow = instances.some((i) => i.ticketId === cr.id);
  const approvalCount = cr.approvers.length || (hasWorkflow ? 1 : 0);
  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "details",   label: "Detaylar"    },
    { key: "approvals", label: "Onaylar",    count: approvalCount > 0 ? approvalCount : undefined },
    { key: "plans",     label: "Planlar"     },
    { key: "tasks",       label: "Görevler",   count: (cr.tasks ?? []).length },
    { key: "attachments", label: "Ekler",      count: (cr.attachments ?? []).length },
    { key: "worknotes",   label: "İş Notları", count: activeWorkNotes.length },
    { key: "comments",    label: "Yorumlar",   count: activeComments.length  },
    { key: "timeline",    label: "Zaman",      count: activeEvents.length    },
  ];

  // CAB vote counts
  const cabApproved = cr.approvers.filter((a) => a.approvalState === "Approved").length;
  const cabTotal    = cr.approvers.length;

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
              <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", typeInfo.badge)}>{typeInfo.label}</span>
              <span className="font-mono text-xs text-gray-400">{cr.number}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", stateInfo.badge)}>{stateInfo.label}</span>
              <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", riskInfo.badge)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", RISK_DOT[cr.risk])} />
                Risk: {riskInfo.label}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-gray-900 leading-snug">{cr.shortDescription}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(cr.plannedStartDate), "dd MMM HH:mm", { locale: tr })}
                <ArrowRight className="w-2.5 h-2.5" />
                {format(new Date(cr.plannedEndDate), "dd MMM HH:mm", { locale: tr })}
              </span>
              <span>güncellendi {formatDistanceToNow(new Date(cr.updatedAt), { addSuffix: true, locale: tr })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <CRStepper state={cr.state} />

      {/* Pending Approval Banner */}
      {cr.approvers.some((a) => a.approvalState === ApprovalState.REQUESTED) && (
        <div className="mx-4 mt-2 flex items-start gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 flex-shrink-0">
          <UserCheck className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-amber-800">Onay Bekleniyor: </span>
            {cr.approvers
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
                {cr.description && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-600 mb-1.5">Açıklama</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{cr.description}</p>
                  </div>
                )}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-600 mb-1.5">Gerekçe</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{cr.justification}</p>
                </div>
                {cr.closureNotes && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <h3 className="text-xs font-semibold text-emerald-700 mb-1.5">Kapatma Notu</h3>
                    <p className="text-sm text-emerald-700">{cr.closureNotes}</p>
                  </div>
                )}
                {/* Field grid */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Değişiklik Bilgileri</h3>
                  </div>
                  <div className="grid grid-cols-2">
                    {[
                      ["Numara",     cr.number],
                      ["Tip",        typeInfo.label],
                      ["Risk",       riskInfo.label],
                      ["Kategori",   cr.category],
                      ["SAP Modülü", cr.sapModule ?? "—"],
                      ["Etki",       cr.impact.replace(/^\d-/, "")],
                      ["Atanan",     cr.assignedToId ? (profiles[cr.assignedToId]?.name ?? cr.assignedToId) : "—"],
                      ["Grup",       cr.assignmentGroupName ?? "—"],
                      ["Başlangıç",  format(new Date(cr.plannedStartDate), "dd MMM yyyy HH:mm", { locale: tr })],
                      ["Bitiş",      format(new Date(cr.plannedEndDate),   "dd MMM yyyy HH:mm", { locale: tr })],
                    ].map(([label, value], i) => (
                      <div key={label} className={cn("px-3 py-2 border-b border-gray-100 text-xs", i % 2 === 0 ? "border-r border-gray-100" : "")}>
                        <div className="text-gray-400 font-medium uppercase tracking-wider mb-0.5 text-[10px]">{label}</div>
                        <div className="text-gray-800 font-medium">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Related incidents */}
                {cr.relatedIncidentIds.length > 0 && (
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-600 mb-2">İlişkili Incident'lar</h3>
                    <div className="flex flex-wrap gap-2">
                      {cr.relatedIncidentIds.map((id) => (
                        <span key={id} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-mono">{id}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Approvals */}
            {tab === "approvals" && (
              <div className="space-y-4">
                <WorkflowProgress
                  ticketType="change_request"
                  ticketId={cr.id}
                  onApproved={() => transition(cr.id, ChangeRequestState.SCHEDULED)}
                  onRejected={() => transition(cr.id, ChangeRequestState.CANCELLED)}
                />
                {cr.approvers.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Onaylayıcılar</h3>
                      <span className={cn("text-xs font-semibold font-mono", cabApproved === cabTotal ? "text-emerald-600" : "text-amber-600")}>
                        {cabApproved}/{cabTotal} onay
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {cr.approvers.map((a, idx) => {
                        const isApproved = a.approvalState === ApprovalState.APPROVED;
                        const isRejected = a.approvalState === ApprovalState.REJECTED;
                        const isPending  = !isApproved && !isRejected;
                        return (
                          <div key={a.approverId} className="flex items-center gap-3 px-3 py-2.5">
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                              isApproved ? "bg-emerald-100 text-emerald-700" : isRejected ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {idx + 1}
                            </div>
                            <span className="flex-1 text-sm text-gray-800 font-medium">{a.approverName}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {a.decidedAt && (
                                <span className="text-xs text-gray-400">{format(new Date(a.decidedAt), "dd MMM HH:mm", { locale: tr })}</span>
                              )}
                              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                                isApproved ? "bg-emerald-100 text-emerald-700" : isRejected ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                              )}>
                                {isApproved ? "Onaylandı" : isRejected ? "Reddedildi" : "Bekliyor"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {cr.approvers.length === 0 && !hasWorkflow && (
                  <div className="text-center py-10 text-gray-400">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Bu CR için henüz onay akışı başlatılmamış.</p>
                  </div>
                )}
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-800">
                    {cr.type === ChangeType.EMERGENCY
                      ? "Acil değişiklik — ECAB (acil CAB) onayı gereklidir."
                      : cr.type === ChangeType.STANDARD
                      ? "Standart değişiklik — ön onaylı, CAB incelemesi gerekmeyebilir."
                      : "Normal değişiklik — tüm CAB üyelerinin onayı gereklidir."}
                  </p>
                </div>
              </div>
            )}

            {/* Plans */}
            {tab === "plans" && (
              <div className="space-y-4">
                {/* Planned window */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-6">
                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Planlanan Başlangıç</div>
                    <div className="text-sm font-bold text-gray-800 font-mono">{format(new Date(cr.plannedStartDate), "dd MMM yyyy HH:mm", { locale: tr })}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Planlanan Bitiş</div>
                    <div className="text-sm font-bold text-gray-800 font-mono">{format(new Date(cr.plannedEndDate), "dd MMM yyyy HH:mm", { locale: tr })}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Implementation Plan */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="text-base">🔧</span> Uygulama Planı
                    </h4>
                    {cr.implementationPlan === "—" || !cr.implementationPlan ? (
                      <p className="text-xs text-gray-400 text-center py-4">Plan girilmemiş.</p>
                    ) : (
                      <div className="space-y-2">
                        {cr.implementationPlan.split("\n").filter(Boolean).map((line, i) => (
                          <div key={i} className="flex gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                            <span className="text-sm text-gray-700 leading-snug">{line.replace(/^\d+\.\s*/, "")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rollback Plan */}
                  <div className="bg-white rounded-lg border border-red-200 p-4">
                    <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="text-base">🔙</span> Geri Alma Planı
                    </h4>
                    {cr.backoutPlan === "—" || !cr.backoutPlan ? (
                      <p className="text-xs text-gray-400 text-center py-4">Plan girilmemiş.</p>
                    ) : (
                      <div className="space-y-2">
                        {cr.backoutPlan.split("\n").filter(Boolean).map((line, i) => (
                          <div key={i} className="flex gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                            <span className="text-sm text-gray-700 leading-snug">{line.replace(/^\d+\.\s*/, "")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {cr.testPlan && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Test Planı</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{cr.testPlan}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tasks */}
            {tab === "tasks" && (
              <TicketTasks
                tasks={cr.tasks ?? []}
                onAdd={(task) => addTask(cr.id, task)}
                onUpdate={(taskId, patch) => updateTask(cr.id, taskId, patch)}
                onDelete={(taskId) => deleteTask(cr.id, taskId)}
                readonly={isTerminal}
              />
            )}

            {/* Attachments */}
            {tab === "attachments" && (
              <CRAttachments
                attachments={cr.attachments ?? []}
                onAdd={(file) => addAttachment(cr.id, file)}
                onRemove={(aid) => removeAttachment(cr.id, aid)}
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
              {actionError && <div className="px-2 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{actionError}</div>}
              {cr.state === ChangeRequestState.PENDING_APPROVAL ? (
                <p className="text-xs text-gray-500 text-center py-1 bg-amber-50 rounded border border-amber-100">Onay akışı devam ediyor</p>
              ) : (
                <div className="relative">
                  <button onClick={() => setShowStateMenu(!showStateMenu)} disabled={saving}
                    className="w-full flex items-center justify-between gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    Durum Değiştir
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showStateMenu && "rotate-180")} />
                  </button>
                  {showStateMenu && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                      {validTransitions.filter((s) => s !== ChangeRequestState.PENDING_APPROVAL).map((s) => (
                        <button key={s} onClick={() => handleTransition(s)}
                          className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                          {TRANSITION_LABEL[s] ?? s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Close form */}
              {showClose && (
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  <p className="text-xs font-medium text-gray-700">Kapatma</p>
                  <select className="input w-full text-xs" value={closeCode} onChange={(e) => setCloseCode(e.target.value as ChangeCloseCode)}>
                    {Object.values(ChangeCloseCode).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <textarea className="input w-full text-xs min-h-[60px] resize-none" placeholder="Kapatma notu *"
                    value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
                  <div className="flex gap-1.5">
                    <button onClick={doClose} disabled={saving || !closeNotes.trim()} className="btn-primary text-xs flex-1">Kapat</button>
                    <button onClick={() => setShowClose(false)} className="btn-secondary text-xs">İptal</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Onaylar özet */}
          {cabTotal > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Onaylar</p>
              <div className="flex gap-1.5 flex-wrap">
                {cr.approvers.map((a, i) => {
                  const isApproved = a.approvalState === "Approved";
                  const isPending  = a.approvalState !== "Approved" && a.approvalState !== "Rejected";
                  return (
                    <div key={i} title={`${a.approverName}: ${a.approvalState}`}
                      className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold",
                        isApproved ? "bg-emerald-100 text-emerald-700" : isPending ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      )}>
                      {isApproved ? "✓" : isPending ? "?" : "✗"}
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-gray-500">{cabApproved}/{cabTotal} onay</div>
            </div>
          )}

          {/* Bilgiler */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bilgiler</p>
            {[
              { label: "Tip",    value: typeInfo.label },
              { label: "Risk",   value: riskInfo.label },
              { label: "Etki",   value: cr.impact.replace(/^\d-/, "") },
              { label: "Atanan", value: cr.assignedToId ? (profiles[cr.assignedToId]?.name ?? "—") : "—" },
              { label: "Grup",   value: cr.assignmentGroupName ?? "—" },
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

export default function ChangeRequestsPage() {
  const { changeRequests, loading } = useChangeRequestStore();

  const [stateFilter, setStateFilter]     = useState("all");
  const [search, setSearch]               = useState("");
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [showNew, setShowNew]             = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [currentPage, setCurrentPage]     = useState(0);

  useEffect(() => { setCurrentPage(0); }, [stateFilter, search]);

  const stateCounts = changeRequests.reduce<Record<string, number>>((acc, cr) => {
    acc[cr.state] = (acc[cr.state] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = useMemo(() => changeRequests
    .filter((cr) => {
      if (stateFilter !== "all" && cr.state !== stateFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!cr.shortDescription.toLowerCase().includes(q) && !cr.number.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [changeRequests, stateFilter, search]);

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
          <h1 className="text-sm font-semibold text-gray-900 flex-1">Değişiklik Talepleri</h1>
          <button onClick={() => setShowNew(true)} className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors" title="Yeni CR">
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
                  <span className="ml-1 opacity-70">{changeRequests.length}</span>
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
              <GitPullRequest className="w-8 h-8" />
              <p className="text-xs">Talep bulunamadı</p>
            </div>
          ) : (
            paginated.map((cr) => {
              const stateInfo = CR_STATE_MAP[cr.state];
              const typeInfo  = CHANGE_TYPE_MAP[cr.type];
              const selected  = selectedId === cr.id;
              const cabApproved = cr.approvers.filter((a) => a.approvalState === "Approved").length;
              const cabTotal    = cr.approvers.length;
              const stepIdx     = CR_STEPS.findIndex((s) => s.state === cr.state);
              const doneCount   = Math.max(0, stepIdx);
              return (
                <button
                  key={cr.id}
                  onClick={() => handleSelect(cr.id)}
                  className={cn(
                    "w-full text-left px-3 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50",
                    selected && "bg-indigo-50 border-l-2 border-l-indigo-500"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", typeInfo.badge)}>{typeInfo.label}</span>
                    <span className="font-mono text-[10px] text-gray-400 flex-1">{cr.number}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", stateInfo.badge)}>{stateInfo.label}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{cr.shortDescription}</p>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full", RISK_DOT[cr.risk])} />
                      {CHANGE_RISK_MAP[cr.risk].label}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {format(new Date(cr.plannedStartDate), "dd MMM", { locale: tr })}
                    </span>
                  </div>
                  {/* CAB mini avatars */}
                  {cabTotal > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="flex gap-0.5">
                        {cr.approvers.slice(0, 5).map((a, i) => {
                          const ok = a.approvalState === "Approved";
                          const pending = a.approvalState !== "Approved" && a.approvalState !== "Rejected";
                          return (
                            <div key={i} className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold",
                              ok ? "bg-emerald-100 text-emerald-700" : pending ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                            )}>
                              {ok ? "✓" : pending ? "?" : "✗"}
                            </div>
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-gray-400">{cabApproved}/{cabTotal} CAB</span>
                    </div>
                  )}
                  {/* Mini progress */}
                  <div className="flex gap-0.5 mt-2">
                    {CR_STEPS.map((step, i) => (
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
            <CRDetail key={selectedId} crId={selectedId} onClose={mobileShowDetail ? handleClose : undefined} />
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center w-full h-full text-gray-400 gap-3">
            <GitPullRequest className="w-12 h-12 opacity-30" />
            <p className="text-sm">Listeden bir değişiklik talebi seçin</p>
            <button onClick={() => setShowNew(true)} className="mt-2 btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Yeni CR
            </button>
          </div>
        )}
      </div>

      {showNew && <NewCRModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
