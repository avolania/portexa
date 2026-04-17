"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, AlertTriangle, Calendar, ArrowRight, Paperclip, FileText, Image, FileArchive, File, X as XIcon, UserCheck } from "lucide-react";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { useWorkflowInstanceStore } from "@/store/useWorkflowInstanceStore";
import WorkflowProgress from "@/components/itsm/WorkflowProgress";
import { ChangeRequestState, ChangeCloseCode, ApprovalState } from "@/lib/itsm/types/enums";
import { ITSM_PRIORITY_MAP, CR_STATE_MAP, CHANGE_TYPE_MAP, CHANGE_RISK_MAP, APPROVAL_STATE_MAP } from "@/lib/itsm/ui-maps";
import { isValidCRTransition } from "@/lib/itsm/types/change-request.types";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import type { Attachment } from "@/types";
import TicketTimeline from "@/components/itsm/TicketTimeline";
import TicketTasks from "@/components/itsm/TicketTasks";

type Tab = "details" | "worknotes" | "comments" | "timeline" | "attachments" | "tasks";

// ─── State machine steps ──────────────────────────────────────────────────────

const CR_STEPS: { state: ChangeRequestState; label: string }[] = [
  { state: ChangeRequestState.PENDING_APPROVAL, label: "Onay"      },
  { state: ChangeRequestState.SCHEDULED,        label: "Planlandı" },
  { state: ChangeRequestState.IMPLEMENT,        label: "Uygulama"  },
  { state: ChangeRequestState.REVIEW,           label: "İnceleme"  },
  { state: ChangeRequestState.CLOSED,           label: "Kapandı"   },
];

function CRProgress({ state }: { state: ChangeRequestState }) {
  const cancelled = state === ChangeRequestState.CANCELLED;
  if (cancelled) return (
    <div className="card">
      <p className="text-sm text-gray-500 text-center py-2">Bu değişiklik talebi iptal edildi.</p>
    </div>
  );
  const activeIdx = CR_STEPS.findIndex((s) => s.state === state);
  return (
    <div className="card">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {CR_STEPS.map((step, i) => {
          const done    = i < activeIdx;
          const current = i === activeIdx;
          return (
            <div key={step.state} className="flex items-center flex-shrink-0">
              <div className={cn("flex flex-col items-center gap-1")}>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                  done    ? "bg-indigo-600 border-indigo-600 text-white" :
                  current ? "bg-white border-indigo-600 text-indigo-600" :
                            "bg-white border-gray-200 text-gray-400"
                )}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={cn("text-xs whitespace-nowrap", current ? "text-indigo-600 font-medium" : "text-gray-400")}>
                  {step.label}
                </span>
              </div>
              {i < CR_STEPS.length - 1 && (
                <div className={cn("h-0.5 w-6 mx-1 mb-4 flex-shrink-0", done ? "bg-indigo-600" : "bg-gray-200")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Action Panel ─────────────────────────────────────────────────────────────

function CRActionPanel({ crId, state }: { crId: string; state: ChangeRequestState }) {
  const { transition, close } = useChangeRequestStore();
  const [showClose, setShowClose] = useState(false);
  const [closeCode, setCloseCode] = useState(ChangeCloseCode.SUCCESSFUL);
  const [closeNotes, setCloseNotes] = useState("");
  const [saving, setSaving]       = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const terminal = [ChangeRequestState.CLOSED, ChangeRequestState.CANCELLED].includes(state);
  if (terminal) return null;

  const can = (to: ChangeRequestState) => isValidCRTransition(state, to);

  const doTransition = async (to: ChangeRequestState) => {
    setActionError(null);
    setSaving(true);
    try { await transition(crId, to); }
    catch (e) { setActionError(e instanceof Error ? e.message : "İşlem başarısız oldu."); }
    finally { setSaving(false); }
  };

  const doClose = async () => {
    if (!closeNotes.trim()) return;
    setActionError(null);
    setSaving(true);
    try {
      await close(crId, { closeCode, closureNotes: closeNotes });
      setShowClose(false);
    }
    catch (e) { setActionError(e instanceof Error ? e.message : "Kapatma başarısız oldu."); }
    finally { setSaving(false); }
  };

  // Determine next logical state — PENDING_APPROVAL workflow tarafından yönetilir
  const NEXT_STATE: Partial<Record<ChangeRequestState, ChangeRequestState>> = {
    [ChangeRequestState.SCHEDULED]: ChangeRequestState.IMPLEMENT,
    [ChangeRequestState.IMPLEMENT]: ChangeRequestState.REVIEW,
  };
  const nextState = NEXT_STATE[state];

  const NEXT_LABEL: Partial<Record<ChangeRequestState, string>> = {
    [ChangeRequestState.SCHEDULED]: "Uygulamaya Başla",
    [ChangeRequestState.IMPLEMENT]: "İncelemeye Al",
  };

  return (
    <div className="card space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">İşlemler</h3>

      {actionError && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{actionError}</div>
      )}

      {/* PENDING_APPROVAL: workflow bileşeni halleder, buton yok */}
      {state === ChangeRequestState.PENDING_APPROVAL && (
        <p className="text-xs text-gray-500 text-center py-1">Onay akışı devam ediyor.</p>
      )}

      {nextState && can(nextState) && (
        <button onClick={() => doTransition(nextState)} disabled={saving} className="btn-primary w-full text-sm">
          {NEXT_LABEL[state]}
        </button>
      )}

      {/* REVIEW state: close */}
      {state === ChangeRequestState.REVIEW && can(ChangeRequestState.CLOSED) && (
        <button onClick={() => setShowClose(true)} className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">Kapat</button>
      )}

      {/* Cancel: SCHEDULED ve sonrasında manuel iptal */}
      {can(ChangeRequestState.CANCELLED) && state !== ChangeRequestState.PENDING_APPROVAL && (
        <button onClick={() => doTransition(ChangeRequestState.CANCELLED)} disabled={saving} className="btn-secondary w-full text-sm text-red-600 hover:text-red-700">İptal Et</button>
      )}

      {showClose && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kapatma Kodu</label>
            <select className="input w-full text-sm" value={closeCode} onChange={(e) => setCloseCode(e.target.value as ChangeCloseCode)}>
              {Object.values(ChangeCloseCode).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kapanış Notu *</label>
            <textarea className="input w-full text-sm min-h-[60px] resize-none" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Değişikliğin sonucu..." />
          </div>
          <div className="flex gap-2">
            <button onClick={doClose} disabled={saving || !closeNotes.trim()} className="btn-primary text-sm flex-1">Kapat</button>
            <button onClick={() => setShowClose(false)} className="btn-secondary text-sm">İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attachments ─────────────────────────────────────────────────────────────

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />;
  if (type.includes("zip") || type.includes("rar") || type.includes("archive")) return <FileArchive className="w-4 h-4 text-amber-500" />;
  if (type.includes("pdf") || type.includes("document") || type.includes("word")) return <FileText className="w-4 h-4 text-red-500" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TicketAttachments({
  attachments,
  onAdd,
  onRemove,
}: {
  attachments: Attachment[];
  onAdd: (file: File) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      await onAdd(file);
    }
    setUploading(false);
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">
          Ekler {attachments.length > 0 && `(${attachments.length})`}
        </span>
      </div>
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 group">
              <div className="shrink-0">{fileIcon(att.type)}</div>
              <div className="flex-1 min-w-0">
                <a href={att.url} target="_blank" rel="noopener noreferrer" download={att.name}
                  className="text-sm font-medium text-gray-800 hover:text-indigo-600 truncate block">
                  {att.name}
                </a>
                <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                  <span>{formatBytes(att.size)}</span>
                  <span>·</span>
                  <span>{att.uploadedBy}</span>
                  <span>·</span>
                  <span>{new Date(att.uploadedAt).toLocaleDateString("tr-TR")}</span>
                </div>
              </div>
              {att.type.startsWith("image/") && (
                <img src={att.url} alt={att.name} className="w-10 h-10 object-cover rounded border border-gray-200 shrink-0" />
              )}
              <button onClick={() => onRemove(att.id)}
                className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Kaldır">
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-3 py-2 w-full border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-colors disabled:opacity-50"
      >
        <Paperclip className="w-4 h-4" />
        {uploading ? "Yükleniyor..." : "Dosya ekle"}
      </button>
      <input ref={fileInputRef} type="file" multiple className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChangeRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { changeRequests, addWorkNote, addComment, addAttachment, removeAttachment, transition, addTask, updateTask, deleteTask,
          loadTicketActivity, activeWorkNotes, activeComments, activeEvents, activeTicketId } = useChangeRequestStore();
  const { instances } = useWorkflowInstanceStore();
  const cr = changeRequests.find((c) => c.id === id);

  useEffect(() => {
    if (id && id !== activeTicketId) {
      loadTicketActivity(id);
    }
  }, [id]);

  const [tab, setTab]             = useState<Tab>("details");
  const [noteText, setNoteText]   = useState("");
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving]       = useState(false);

  if (!cr) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center text-gray-400">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3" />
        <p>Değişiklik talebi bulunamadı.</p>
        <Link href="/itsm/change-requests" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">Listeye dön</Link>
      </div>
    );
  }

  const stateInfo    = CR_STATE_MAP[cr.state];
  const priorityInfo = ITSM_PRIORITY_MAP[cr.priority];
  const typeInfo     = CHANGE_TYPE_MAP[cr.type];
  const riskInfo     = CHANGE_RISK_MAP[cr.risk];
  const approvalInfo = APPROVAL_STATE_MAP[cr.approvalState];

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

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "details",     label: "Detaylar" },
    { key: "tasks",       label: "Görevler",         count: (cr.tasks ?? []).length },
    { key: "attachments", label: "Ekler",            count: (cr.attachments ?? []).length },
    { key: "worknotes",   label: "İş Notları",       count: activeWorkNotes.length },
    { key: "comments",    label: "Yorumlar",          count: activeComments.length  },
    { key: "timeline",    label: "Zaman Çizelgesi",   count: activeEvents.length  },
  ];

  const terminal = [ChangeRequestState.CLOSED, ChangeRequestState.CANCELLED].includes(cr.state);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/itsm" className="hover:text-indigo-600">ITSM</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/itsm/change-requests" className="hover:text-indigo-600">Değişiklik Talepleri</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="font-mono text-gray-700">{cr.number}</span>
      </div>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-sm text-gray-400">{cr.number}</span>
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", stateInfo.badge)}>{stateInfo.label}</span>
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", typeInfo.badge)}>{typeInfo.label}</span>
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", riskInfo.badge)}>Risk: {riskInfo.label}</span>
              <span className={cn("flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium", priorityInfo.badge)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", priorityInfo.dot)} />{priorityInfo.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{cr.shortDescription}</h1>
            {cr.category && <div className="text-xs text-gray-500 mt-1">{cr.category}</div>}
          </div>
          <div className="text-xs text-gray-400 text-right flex-shrink-0">
            <div>{format(new Date(cr.createdAt), "dd MMM yyyy HH:mm", { locale: tr })}</div>
            <div className="mt-1 text-gray-300">güncellendi {formatDistanceToNow(new Date(cr.updatedAt), { addSuffix: true, locale: tr })}</div>
          </div>
        </div>
      </div>

      {/* Progress stepper */}
      <CRProgress state={cr.state} />

      {/* Pending Approval Banner */}
      {cr.approvers.some((a) => a.approvalState === ApprovalState.REQUESTED) && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <UserCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Onay Bekleniyor</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {cr.approvers
                .filter((a) => a.approvalState === ApprovalState.REQUESTED)
                .map((a) => (
                  <span key={a.approverId} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {a.approverName}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex gap-1 -mb-px">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    tab === t.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700")}>
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{t.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab: Details */}
          {tab === "details" && (
            <div className="space-y-4">
              {cr.description && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Açıklama</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{cr.description}</p>
                </div>
              )}
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Gerekçe</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{cr.justification}</p>
              </div>
              {cr.implementationPlan && cr.implementationPlan !== "—" && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Uygulama Planı</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{cr.implementationPlan}</p>
                </div>
              )}
              {cr.backoutPlan && cr.backoutPlan !== "—" && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Geri Alma Planı</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{cr.backoutPlan}</p>
                </div>
              )}
              {cr.testPlan && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Test Planı</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{cr.testPlan}</p>
                </div>
              )}
              {cr.closureNotes && (
                <div className="card border-emerald-200 bg-emerald-50">
                  <h3 className="text-sm font-semibold text-emerald-800 mb-2">Kapanış Notu</h3>
                  <p className="text-sm text-emerald-700">{cr.closureNotes}</p>
                </div>
              )}
              {cr.approvers.length > 0 && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Onaylayıcılar</h3>
                  <div className="space-y-2">
                    {cr.approvers.map((a) => (
                      <div key={a.approverId} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{a.approverName}</span>
                        <div className="flex items-center gap-2">
                          {a.decidedAt && <span className="text-xs text-gray-400">{format(new Date(a.decidedAt), "dd MMM HH:mm", { locale: tr })}</span>}
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                            a.approvalState === ApprovalState.APPROVED  ? "bg-emerald-100 text-emerald-700" :
                            a.approvalState === ApprovalState.REJECTED  ? "bg-red-100 text-red-700" :
                                                                          "bg-amber-100 text-amber-700")}>
                            {a.approvalState === ApprovalState.REQUESTED ? "Bekliyor" :
                             a.approvalState === ApprovalState.APPROVED  ? "Onaylandı" :
                             a.approvalState === ApprovalState.REJECTED  ? "Reddedildi" : a.approvalState}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Tasks */}
          {tab === "tasks" && (
            <TicketTasks
              tasks={cr.tasks ?? []}
              onAdd={(task) => addTask(cr.id, task)}
              onUpdate={(taskId, patch) => updateTask(cr.id, taskId, patch)}
              onDelete={(taskId) => deleteTask(cr.id, taskId)}
              readonly={terminal}
            />
          )}

          {/* Tab: Attachments */}
          {tab === "attachments" && (
            <TicketAttachments
              attachments={cr.attachments ?? []}
              onAdd={(file) => addAttachment(cr.id, file)}
              onRemove={(aid) => removeAttachment(cr.id, aid)}
            />
          )}

          {/* Tab: Work Notes */}
          {tab === "worknotes" && (
            <div className="space-y-4">
              {!terminal && (
                <div className="card">
                  <textarea className="input w-full min-h-[80px] resize-none text-sm" placeholder="İş notu ekle..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <div className="flex justify-end mt-2">
                    <button onClick={submitNote} disabled={saving || !noteText.trim()} className="btn-primary text-sm">Not Ekle</button>
                  </div>
                </div>
              )}
              {activeWorkNotes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Henüz iş notu yok.</p>
              ) : (
                [...activeWorkNotes].reverse().map((note) => (
                  <div key={note.id} className="card bg-amber-50 border-amber-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">{note.authorName}</span>
                      <span className="text-xs text-gray-400">{format(new Date(note.createdAt), "dd MMM HH:mm", { locale: tr })}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab: Comments */}
          {tab === "comments" && (
            <div className="space-y-4">
              {!terminal && (
                <div className="card">
                  <textarea className="input w-full min-h-[80px] resize-none text-sm" placeholder="Yorum ekle..." value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                  <div className="flex justify-end mt-2">
                    <button onClick={submitComment} disabled={saving || !commentText.trim()} className="btn-primary text-sm">Yorum Ekle</button>
                  </div>
                </div>
              )}
              {activeComments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Henüz yorum yok.</p>
              ) : (
                [...activeComments].reverse().map((c) => (
                  <div key={c.id} className="card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">{c.authorName}</span>
                      <span className="text-xs text-gray-400">{format(new Date(c.createdAt), "dd MMM HH:mm", { locale: tr })}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab: Timeline */}
          {tab === "timeline" && <TicketTimeline timeline={activeEvents} />}
        </div>

        {/* Right 1/3 */}
        <div className="space-y-4">
          <CRActionPanel crId={cr.id} state={cr.state} />
          <WorkflowProgress
            ticketType="change_request"
            ticketId={cr.id}
            onApproved={() => transition(cr.id, ChangeRequestState.SCHEDULED)}
            onRejected={() => transition(cr.id, ChangeRequestState.CANCELLED)}
          />
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Bilgiler</h3>
            {[
              { label: "Talep Eden",       value: cr.requestedById },
              { label: "Değişiklik Mgr.",  value: cr.changeManagerId },
              { label: "Atanan",           value: cr.assignedToId ?? "—" },
              { label: "Onay Durumu",      value: approvalInfo.label },
              { label: "İlişkili Incident", value: cr.relatedIncidentIds.length > 0 ? cr.relatedIncidentIds.join(", ") : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-gray-500 flex-shrink-0">{label}</span>
                <span className="text-gray-900 text-right truncate max-w-[140px]" title={value}>{value}</span>
              </div>
            ))}
          </div>
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Tarihler</h3>
            {[
              { label: "Planlanan Başlangıç", value: format(new Date(cr.plannedStartDate), "dd MMM yyyy", { locale: tr }) },
              { label: "Planlanan Bitiş",     value: format(new Date(cr.plannedEndDate),   "dd MMM yyyy", { locale: tr }) },
              { label: "Gerçek Başlangıç",    value: cr.actualStartDate ? format(new Date(cr.actualStartDate), "dd MMM yyyy", { locale: tr }) : "—" },
              { label: "Gerçek Bitiş",        value: cr.actualEndDate   ? format(new Date(cr.actualEndDate),   "dd MMM yyyy", { locale: tr }) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-gray-500 flex-shrink-0 flex items-center gap-1"><Calendar className="w-3 h-3" />{label}</span>
                <span className="text-gray-900 text-right text-xs">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
