"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Clock, XCircle, AlertTriangle, ArrowRight, Paperclip, FileText, Image, FileArchive, File, X as XIcon } from "lucide-react";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useWorkflowInstanceStore } from "@/store/useWorkflowInstanceStore";
import { useAuthStore } from "@/store/useAuthStore";
import WorkflowProgress from "@/components/itsm/WorkflowProgress";
import { ServiceRequestClosureCode } from "@/lib/itsm/types/service-request.types";
import { ServiceRequestState } from "@/lib/itsm/types/enums";
import { ITSM_PRIORITY_MAP, SR_STATE_MAP, APPROVAL_STATE_MAP } from "@/lib/itsm/ui-maps";
import { isValidSRTransition } from "@/lib/itsm/types/service-request.types";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import type { Attachment } from "@/types";
import TicketTimeline from "@/components/itsm/TicketTimeline";

type Tab = "details" | "worknotes" | "comments" | "timeline" | "attachments";

// ─── SLA Widget ───────────────────────────────────────────────────────────────

function SLASRWidget({ sla }: { sla: { fulfillmentDeadline: string; slaBreached: boolean } }) {
  const ms = new Date(sla.fulfillmentDeadline).getTime() - Date.now();
  const h  = Math.floor(Math.abs(ms) / 3_600_000);
  const m  = Math.floor((Math.abs(ms) % 3_600_000) / 60_000);
  const over = ms < 0 || sla.slaBreached;
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> SLA Durumu</h3>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Karşılama Süresi</span>
        {over
          ? <span className="flex items-center gap-1 text-sm text-red-600 font-medium"><XCircle className="w-3.5 h-3.5" /> {h}s {m}d önce geçti</span>
          : <span className={cn("flex items-center gap-1 text-sm font-medium", h < 4 ? "text-amber-600" : "text-emerald-600")}>
              {h < 4 ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {h}s {m}d kaldı
            </span>
        }
      </div>
      <div className="text-xs text-gray-400 mt-1">Son: {format(new Date(sla.fulfillmentDeadline), "dd MMM HH:mm", { locale: tr })}</div>
    </div>
  );
}

// ─── Action Panel ─────────────────────────────────────────────────────────────

function SRActionPanel({ srId, state, approvalRequired }: { srId: string; state: ServiceRequestState; approvalRequired: boolean }) {
  const { submit, approve, reject, fulfill, close } = useServiceRequestStore();
  const [showFulfill, setShowFulfill] = useState(false);
  const [showReject, setShowReject]   = useState(false);
  const [fulfillNotes, setFulfillNotes] = useState("");
  const [fulfillCode, setFulfillCode]   = useState(ServiceRequestClosureCode.FULFILLED);
  const [rejectComment, setRejectComment] = useState("");
  const [saving, setSaving] = useState(false);

  const can = (to: ServiceRequestState) => isValidSRTransition(state, to);
  const terminal = [ServiceRequestState.CLOSED, ServiceRequestState.REJECTED, ServiceRequestState.CANCELLED].includes(state);
  if (terminal) return null;

  const doSubmit = async () => { setSaving(true); await submit(srId); setSaving(false); };
  const doApprove = async () => { setSaving(true); await approve(srId, {}); setSaving(false); };
  const doClose = async () => { setSaving(true); await close(srId); setSaving(false); };

  const doFulfill = async () => {
    if (!fulfillNotes.trim()) return;
    setSaving(true);
    await fulfill(srId, { fulfillmentNotes: fulfillNotes, closureCode: fulfillCode });
    setSaving(false);
    setShowFulfill(false);
  };

  const doReject = async () => {
    if (!rejectComment.trim()) return;
    setSaving(true);
    await reject(srId, { comments: rejectComment });
    setSaving(false);
    setShowReject(false);
  };

  return (
    <div className="card space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">İşlemler</h3>

      {can(ServiceRequestState.SUBMITTED) && (
        <button onClick={doSubmit} disabled={saving} className="btn-primary w-full text-sm">İlet</button>
      )}
      {can(ServiceRequestState.APPROVED) && !approvalRequired && (
        <button onClick={doApprove} disabled={saving} className="btn-primary w-full text-sm">Onayla</button>
      )}
      {state === ServiceRequestState.PENDING_APPROVAL && (
        <>
          <button onClick={doApprove} disabled={saving} className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">Onayla</button>
          <button onClick={() => setShowReject(true)} className="btn-secondary w-full text-sm">Reddet</button>
        </>
      )}
      {can(ServiceRequestState.FULFILLED) && (
        <button onClick={() => setShowFulfill(true)} className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">Karşıla</button>
      )}
      {can(ServiceRequestState.CLOSED) && (
        <button onClick={doClose} disabled={saving} className="btn-secondary w-full text-sm">Kapat</button>
      )}

      {showFulfill && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Karşılama Kodu</label>
            <select className="input w-full text-sm" value={fulfillCode} onChange={(e) => setFulfillCode(e.target.value as ServiceRequestClosureCode)}>
              {Object.values(ServiceRequestClosureCode).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Karşılama Notu *</label>
            <textarea className="input w-full text-sm min-h-[60px] resize-none" value={fulfillNotes} onChange={(e) => setFulfillNotes(e.target.value)} placeholder="Nasıl karşılandığını açıklayın..." />
          </div>
          <div className="flex gap-2">
            <button onClick={doFulfill} disabled={saving || !fulfillNotes.trim()} className="btn-primary text-sm flex-1">Onayla</button>
            <button onClick={() => setShowFulfill(false)} className="btn-secondary text-sm">İptal</button>
          </div>
        </div>
      )}

      {showReject && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Red Gerekçesi *</label>
            <textarea className="input w-full text-sm min-h-[60px] resize-none" value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} placeholder="Neden reddedildi?" />
          </div>
          <div className="flex gap-2">
            <button onClick={doReject} disabled={saving || !rejectComment.trim()} className="w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">Reddet</button>
            <button onClick={() => setShowReject(false)} className="btn-secondary text-sm">İptal</button>
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

export default function ServiceRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { serviceRequests, addWorkNote, addComment, addAttachment, removeAttachment, approve, reject } = useServiceRequestStore();
  const { load: loadInstances } = useWorkflowInstanceStore();
  const sr = serviceRequests.find((s) => s.id === id);

  const [tab, setTab]             = useState<Tab>("details");
  const [noteText, setNoteText]   = useState("");
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving]       = useState(false);

  if (!sr) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center text-gray-400">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3" />
        <p>Servis talebi bulunamadı.</p>
        <Link href="/itsm/service-requests" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">Listeye dön</Link>
      </div>
    );
  }

  const stateInfo    = SR_STATE_MAP[sr.state];
  const priorityInfo = ITSM_PRIORITY_MAP[sr.priority];
  const approvalInfo = APPROVAL_STATE_MAP[sr.approvalState];

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

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "details",     label: "Detaylar" },
    { key: "attachments", label: "Ekler",           count: (sr.attachments ?? []).length },
    { key: "worknotes",   label: "İş Notları",      count: sr.workNotes.length },
    { key: "comments",    label: "Yorumlar",         count: sr.comments.length  },
    { key: "timeline",    label: "Zaman Çizelgesi",  count: sr.timeline.length  },
  ];

  const isTerminal = [ServiceRequestState.CLOSED, ServiceRequestState.REJECTED, ServiceRequestState.CANCELLED].includes(sr.state);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/itsm" className="hover:text-indigo-600">ITSM</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/itsm/service-requests" className="hover:text-indigo-600">Servis Talepleri</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="font-mono text-gray-700">{sr.number}</span>
      </div>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="font-mono text-sm text-gray-400">{sr.number}</span>
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", stateInfo.badge)}>{stateInfo.label}</span>
              <span className={cn("flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium", priorityInfo.badge)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", priorityInfo.dot)} />
                {priorityInfo.label}
              </span>
              {sr.approvalRequired && (
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", approvalInfo.badge)}>{approvalInfo.label}</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{sr.shortDescription}</h1>
            {sr.requestType && (
              <div className="text-xs text-gray-500 mt-1">{sr.requestType} {sr.category && `/ ${sr.category}`}</div>
            )}
          </div>
          <div className="text-xs text-gray-400 text-right flex-shrink-0">
            <div>{format(new Date(sr.createdAt), "dd MMM yyyy HH:mm", { locale: tr })}</div>
            <div className="mt-1 text-gray-300">güncellendi {formatDistanceToNow(new Date(sr.updatedAt), { addSuffix: true, locale: tr })}</div>
          </div>
        </div>
      </div>

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
              {sr.description && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Açıklama</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{sr.description}</p>
                </div>
              )}
              {sr.justification && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Gerekçe</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{sr.justification}</p>
                </div>
              )}
              {sr.fulfillmentNotes && (
                <div className="card border-emerald-200 bg-emerald-50">
                  <h3 className="text-sm font-semibold text-emerald-800 mb-2">Karşılama Notu</h3>
                  <p className="text-sm text-emerald-700">{sr.fulfillmentNotes}</p>
                </div>
              )}
              {sr.approvers.length > 0 && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Onaylayıcılar</h3>
                  <div className="space-y-2">
                    {sr.approvers.map((a) => (
                      <div key={a.approverId} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{a.approverName}</span>
                        <div className="flex items-center gap-2">
                          {a.decidedAt && <span className="text-xs text-gray-400">{format(new Date(a.decidedAt), "dd MMM HH:mm", { locale: tr })}</span>}
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                            a.approvalState === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                            {a.approvalState}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Attachments */}
          {tab === "attachments" && (
            <TicketAttachments
              attachments={sr.attachments ?? []}
              onAdd={(file) => addAttachment(sr.id, file)}
              onRemove={(aid) => removeAttachment(sr.id, aid)}
            />
          )}

          {/* Tab: Work Notes */}
          {tab === "worknotes" && (
            <div className="space-y-4">
              {!isTerminal && (
                <div className="card">
                  <textarea className="input w-full min-h-[80px] resize-none text-sm" placeholder="İş notu ekle..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <div className="flex justify-end mt-2">
                    <button onClick={submitNote} disabled={saving || !noteText.trim()} className="btn-primary text-sm">Not Ekle</button>
                  </div>
                </div>
              )}
              {sr.workNotes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Henüz iş notu yok.</p>
              ) : (
                [...sr.workNotes].reverse().map((note) => (
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
              {!isTerminal && (
                <div className="card">
                  <textarea className="input w-full min-h-[80px] resize-none text-sm" placeholder="Yorum ekle..." value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                  <div className="flex justify-end mt-2">
                    <button onClick={submitComment} disabled={saving || !commentText.trim()} className="btn-primary text-sm">Yorum Ekle</button>
                  </div>
                </div>
              )}
              {sr.comments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Henüz yorum yok.</p>
              ) : (
                [...sr.comments].reverse().map((c) => (
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
          {tab === "timeline" && <TicketTimeline timeline={sr.timeline} />}
        </div>

        {/* Right 1/3 */}
        <div className="space-y-4">
          <SRActionPanel srId={sr.id} state={sr.state} approvalRequired={sr.approvalRequired} />
          {sr.approvalRequired && (
            <WorkflowProgress
              ticketType="service_request"
              ticketId={sr.id}
              onApproved={() => approve(sr.id, {})}
              onRejected={(comment) => reject(sr.id, { comments: comment ?? "" })}
            />
          )}
          {!isTerminal && <SLASRWidget sla={sr.sla} />}
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Bilgiler</h3>
            {[
              { label: "Talep Eden",   value: sr.requestedById },
              { label: "İçin",         value: sr.requestedForId },
              { label: "Atanan",       value: sr.assignedToId ?? "—" },
              { label: "Etki",         value: sr.impact.replace(/^\d-/, "") },
              { label: "Aciliyet",     value: sr.urgency.replace(/^\d-/, "") },
              { label: "Karşılanma",   value: sr.fulfilledAt ? format(new Date(sr.fulfilledAt), "dd MMM yyyy", { locale: tr }) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-gray-500 flex-shrink-0">{label}</span>
                <span className="text-gray-900 text-right truncate max-w-[140px]" title={value}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
