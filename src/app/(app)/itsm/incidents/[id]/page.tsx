"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Clock, CheckCircle, XCircle, AlertTriangle,
  User, Tag, Calendar, ArrowRight, Paperclip, FileText, Image, FileArchive, File, X as XIcon,
  GitPullRequest, LifeBuoy,
} from "lucide-react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { IncidentState, IncidentResolutionCode, IncidentClosureCode, ChangeType, ChangeRisk, Impact, Urgency } from "@/lib/itsm/types/enums";
import { ITSM_PRIORITY_MAP, INCIDENT_STATE_MAP } from "@/lib/itsm/ui-maps";
import { isValidIncidentTransition } from "@/lib/itsm/types/incident.types";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import type { Attachment } from "@/types";
import TicketTimeline from "@/components/itsm/TicketTimeline";

type Tab = "details" | "worknotes" | "comments" | "timeline" | "attachments";

// ─── SLA Widget ───────────────────────────────────────────────────────────────

function SLAWidget({ sla }: { sla: { responseDeadline: string; resolutionDeadline: string; responseBreached: boolean; resolutionBreached: boolean; respondedAt?: string; pausedAt?: string } }) {
  const now = Date.now();
  const resMs = new Date(sla.resolutionDeadline).getTime() - now;
  const resH  = Math.floor(Math.abs(resMs) / 3_600_000);
  const resM  = Math.floor((Math.abs(resMs) % 3_600_000) / 60_000);

  const SLARow = ({ label, deadline, breached, responded }: { label: string; deadline: string; breached: boolean; responded?: boolean }) => {
    const ms = new Date(deadline).getTime() - now;
    const h  = Math.floor(Math.abs(ms) / 3_600_000);
    const m  = Math.floor((Math.abs(ms) % 3_600_000) / 60_000);
    const over = ms < 0 || breached;
    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
        <span className="text-sm text-gray-600">{label}</span>
        {responded ? (
          <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium"><CheckCircle className="w-3.5 h-3.5" /> Karşılandı</span>
        ) : over ? (
          <span className="flex items-center gap-1 text-sm text-red-600 font-medium"><XCircle className="w-3.5 h-3.5" /> {h}s {m}d önce</span>
        ) : (
          <span className={cn("flex items-center gap-1 text-sm font-medium", h < 2 ? "text-amber-600" : "text-emerald-600")}>
            {h < 2 ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {h}s {m}d kaldı
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" /> SLA Durumu
        {sla.pausedAt && <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">Duraklatıldı</span>}
      </h3>
      <SLARow label="Yanıt SLA"  deadline={sla.responseDeadline}   breached={sla.responseBreached}   responded={!!sla.respondedAt} />
      <SLARow label="Çözüm SLA"  deadline={sla.resolutionDeadline} breached={sla.resolutionBreached} />
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

function IncidentAttachments({
  attachments,
  onAdd,
  onRemove,
}: {
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
    try {
      for (const file of Array.from(files)) {
        await onAdd(file);
      }
    } catch (err) {
      console.error("[IncidentAttachments] upload error:", err);
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
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
      {uploadError && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{uploadError}</div>
      )}
      <label className={cn(
        "relative flex items-center gap-2 px-3 py-2 w-full border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-colors overflow-hidden",
        uploading ? "opacity-50 pointer-events-none" : "cursor-pointer"
      )}>
        <Paperclip className="w-4 h-4" />
        {uploading ? "Yükleniyor..." : "Dosya ekle"}
        <input type="file" multiple className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </label>
    </div>
  );
}

// ─── Action Panel ─────────────────────────────────────────────────────────────

function ActionPanel({ incidentId, state }: { incidentId: string; state: IncidentState }) {
  const { changeState, resolve, close, assign, incidents } = useIncidentStore();
  const { create: createCR } = useChangeRequestStore();
  const { create: createSR } = useServiceRequestStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const incident = incidents.find((i) => i.id === incidentId);

  const [showResolve, setShowResolve]   = useState(false);
  const [showClose, setShowClose]       = useState(false);
  const [showAssign, setShowAssign]     = useState(false);
  const [showConvert, setShowConvert]   = useState(false);
  const [resCode, setResCode]           = useState(IncidentResolutionCode.SOLVED_PERMANENTLY);
  const [resNotes, setResNotes]         = useState("");
  const [closeCode, setCloseCode]       = useState(IncidentClosureCode.SOLVED_PERMANENTLY);
  const [closeNotes, setCloseNotes]     = useState("");
  const [assignTo, setAssignTo]         = useState("");
  const [saving, setSaving]             = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const convertToCR = async () => {
    if (!incident || !user) return;
    setSaving(true);
    setConvertError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const cr = await createCR({
        requestedById:      user.id,
        changeManagerId:    user.id,
        type:               ChangeType.NORMAL,
        category:           incident.category,
        risk:               ChangeRisk.MODERATE,
        impact:             incident.impact as unknown as Impact,
        shortDescription:   incident.shortDescription,
        description:        incident.description,
        justification:        `Incident ${incident.number} üzerinden dönüştürüldü.`,
        plannedStartDate:     new Date(today + 'T00:00:00').toISOString(),
        plannedEndDate:       new Date(today + 'T23:59:59').toISOString(),
        implementationPlan:   '—',
        backoutPlan:          '—',
        relatedIncidentIds:   [incident.id],
        sourceIncidentNumber: incident.number,
      });
      if (cr) router.push(`/itsm/change-requests/${cr.id}`);
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Dönüştürme başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const convertToSR = async () => {
    if (!incident || !user) return;
    setSaving(true);
    setConvertError(null);
    try {
      const sr = await createSR({
        requestedForId:       user.id,
        requestedById:        user.id,
        requestType:          incident.category,
        category:             incident.category,
        shortDescription:     incident.shortDescription,
        description:          incident.description ?? '',
        impact:               incident.impact as unknown as Impact,
        urgency:              incident.urgency as unknown as Urgency,
        sourceIncidentNumber: incident.number,
      });
      if (sr) router.push(`/itsm/service-requests/${sr.id}`);
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Dönüştürme başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const canTransit = (to: IncidentState) => isValidIncidentTransition(state, to);

  const doState = async (to: IncidentState) => {
    setSaving(true);
    await changeState(incidentId, { state: to });
    setSaving(false);
  };

  const doResolve = async () => {
    if (!resNotes.trim()) return;
    setSaving(true);
    await resolve(incidentId, { resolutionCode: resCode, resolutionNotes: resNotes });
    setSaving(false);
    setShowResolve(false);
  };

  const doClose = async () => {
    if (!closeNotes.trim()) return;
    setSaving(true);
    await close(incidentId, { closureCode: closeCode, closureNotes: closeNotes });
    setSaving(false);
    setShowClose(false);
  };

  const doAssign = async () => {
    if (!assignTo.trim()) return;
    setSaving(true);
    await assign(incidentId, { assignedToId: assignTo });
    setSaving(false);
    setShowAssign(false);
  };

  if (state === IncidentState.CLOSED) return null;

  return (
    <div className="card space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">İşlemler</h3>

      {canTransit(IncidentState.IN_PROGRESS) && (
        <button onClick={() => doState(IncidentState.IN_PROGRESS)} disabled={saving}
          className="btn-primary w-full text-sm">İşleme Al</button>
      )}
      {canTransit(IncidentState.PENDING) && (
        <button onClick={() => doState(IncidentState.PENDING)} disabled={saving}
          className="btn-secondary w-full text-sm">Bekletmeye Al</button>
      )}
      {state === IncidentState.PENDING && canTransit(IncidentState.IN_PROGRESS) && (
        <button onClick={() => doState(IncidentState.IN_PROGRESS)} disabled={saving}
          className="btn-secondary w-full text-sm">Devam Et</button>
      )}
      {canTransit(IncidentState.RESOLVED) && (
        <button onClick={() => setShowResolve(true)} className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
          Çöz
        </button>
      )}
      {canTransit(IncidentState.CLOSED) && (
        <button onClick={() => setShowClose(true)} className="btn-secondary w-full text-sm">Kapat</button>
      )}
      <button onClick={() => setShowAssign(true)} className="btn-secondary w-full text-sm">Ata</button>

      {/* Dönüştür */}
      <div className="border-t border-gray-100 pt-2 mt-1">
        <button onClick={() => setShowConvert((v) => !v)} className="btn-secondary w-full text-sm text-indigo-600">
          Dönüştür...
        </button>
        {showConvert && (
          <div className="mt-2 space-y-1.5">
            {convertError && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{convertError}</div>
            )}
            <button onClick={convertToCR} disabled={saving}
              className="flex items-center gap-2 w-full px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50">
              <GitPullRequest className="w-3.5 h-3.5" /> CR'a Dönüştür
            </button>
            <button onClick={convertToSR} disabled={saving}
              className="flex items-center gap-2 w-full px-3 py-2 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-100 transition-colors disabled:opacity-50">
              <LifeBuoy className="w-3.5 h-3.5" /> SR'a Dönüştür
            </button>
          </div>
        )}
      </div>

      {/* Resolve form */}
      {showResolve && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Çözüm Kodu</label>
            <select className="input w-full text-sm" value={resCode} onChange={(e) => setResCode(e.target.value as IncidentResolutionCode)}>
              {Object.values(IncidentResolutionCode).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Çözüm Notları *</label>
            <textarea className="input w-full text-sm min-h-[60px] resize-none" value={resNotes} onChange={(e) => setResNotes(e.target.value)} placeholder="Nasıl çözüldüğünü açıklayın..." />
          </div>
          <div className="flex gap-2">
            <button onClick={doResolve} disabled={saving || !resNotes.trim()} className="btn-primary text-sm flex-1">Onayla</button>
            <button onClick={() => setShowResolve(false)} className="btn-secondary text-sm">İptal</button>
          </div>
        </div>
      )}

      {/* Close form */}
      {showClose && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kapatma Kodu</label>
            <select className="input w-full text-sm" value={closeCode} onChange={(e) => setCloseCode(e.target.value as IncidentClosureCode)}>
              {Object.values(IncidentClosureCode).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kapatma Notları *</label>
            <textarea className="input w-full text-sm min-h-[60px] resize-none" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Kapatma gerekçesi..." />
          </div>
          <div className="flex gap-2">
            <button onClick={doClose} disabled={saving || !closeNotes.trim()} className="btn-primary text-sm flex-1">Onayla</button>
            <button onClick={() => setShowClose(false)} className="btn-secondary text-sm">İptal</button>
          </div>
        </div>
      )}

      {/* Assign form */}
      {showAssign && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Atanacak Kişi ID</label>
            <input className="input w-full text-sm" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} placeholder="Kullanıcı ID'si..." />
          </div>
          <div className="flex gap-2">
            <button onClick={doAssign} disabled={saving || !assignTo.trim()} className="btn-primary text-sm flex-1">Ata</button>
            <button onClick={() => setShowAssign(false)} className="btn-secondary text-sm">İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { incidents, addWorkNote, addComment, addAttachment, removeAttachment,
          loadTicketActivity, activeWorkNotes, activeComments, activeEvents, activeTicketId } = useIncidentStore();
  const { profiles } = useAuthStore();
  const incident = incidents.find((i) => i.id === id);

  // P1: Sayfa yüklenince notları ve olayları ayrı tablodan çek
  useEffect(() => {
    if (id && id !== activeTicketId) {
      loadTicketActivity(id);
    }
  }, [id]);

  const [tab, setTab] = useState<Tab>("details");
  const [noteText, setNoteText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);

  if (!incident) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center text-gray-400">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3" />
        <p>Incident bulunamadı.</p>
        <Link href="/itsm/incidents" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">Listeye dön</Link>
      </div>
    );
  }

  const stateInfo    = INCIDENT_STATE_MAP[incident.state];
  const priorityInfo = ITSM_PRIORITY_MAP[incident.priority];

  const submitNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    await addWorkNote(incident.id, { content: noteText });
    setNoteText("");
    setSaving(false);
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSaving(true);
    await addComment(incident.id, { content: commentText });
    setCommentText("");
    setSaving(false);
  };

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "details",     label: "Detaylar"          },
    { key: "attachments", label: "Ekler", count: (incident.attachments ?? []).length },
    { key: "worknotes",   label: "İş Notları",  count: activeWorkNotes.length },
    { key: "comments",    label: "Yorumlar",    count: activeComments.length  },
    { key: "timeline",    label: "Zaman Çizelgesi", count: activeEvents.length },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/itsm" className="hover:text-indigo-600">ITSM</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/itsm/incidents" className="hover:text-indigo-600">Incident'lar</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="font-mono text-gray-700">{incident.number}</span>
      </div>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="font-mono text-sm text-gray-400">{incident.number}</span>
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", stateInfo.badge)}>{stateInfo.label}</span>
              <span className={cn("flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium", priorityInfo.badge)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", priorityInfo.dot)} />
                {priorityInfo.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{incident.shortDescription}</h1>
            {incident.category && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                <Tag className="w-3 h-3" /> {incident.category}
                {incident.subcategory && <> / {incident.subcategory}</>}
              </div>
            )}
          </div>
          <div className="text-xs text-gray-400 text-right flex-shrink-0">
            <div>{format(new Date(incident.createdAt), "dd MMM yyyy HH:mm", { locale: tr })}</div>
            <div className="mt-1 text-gray-300">güncellendi {formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true, locale: tr })}</div>
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
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    tab === t.key
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
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
              {incident.description && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Açıklama</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{incident.description}</p>
                </div>
              )}
              {incident.resolutionNotes && (
                <div className="card border-emerald-200 bg-emerald-50">
                  <h3 className="text-sm font-semibold text-emerald-800 mb-2">Çözüm</h3>
                  <p className="text-sm text-emerald-700">{incident.resolutionNotes}</p>
                </div>
              )}
              {incident.closureNotes && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Kapatma Notu</h3>
                  <p className="text-sm text-gray-700">{incident.closureNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Attachments */}
          {tab === "attachments" && (
            <IncidentAttachments
              attachments={incident.attachments ?? []}
              onAdd={(file) => addAttachment(incident.id, file)}
              onRemove={(aid) => removeAttachment(incident.id, aid)}
            />
          )}

          {/* Tab: Work Notes */}
          {tab === "worknotes" && (
            <div className="space-y-4">
              <div className="card">
                <textarea
                  className="input w-full min-h-[80px] resize-none text-sm"
                  placeholder="İş notu ekle (yalnızca ajanlara görünür)..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <div className="flex justify-end mt-2">
                  <button onClick={submitNote} disabled={saving || !noteText.trim()} className="btn-primary text-sm">
                    Not Ekle
                  </button>
                </div>
              </div>
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
              <div className="card">
                <textarea
                  className="input w-full min-h-[80px] resize-none text-sm"
                  placeholder="Yorum ekle (müşteriye görünür)..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <div className="flex justify-end mt-2">
                  <button onClick={submitComment} disabled={saving || !commentText.trim()} className="btn-primary text-sm">
                    Yorum Ekle
                  </button>
                </div>
              </div>
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
          <ActionPanel incidentId={incident.id} state={incident.state} />
          <SLAWidget sla={incident.sla} />

          {/* Info card */}
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Bilgiler</h3>
            {[
              { label: "Etki",         value: incident.impact.replace(/^\d-/, "") },
              { label: "Aciliyet",     value: incident.urgency.replace(/^\d-/, "") },
              { label: "Atanan",       value: incident.assignedToId ? (profiles[incident.assignedToId]?.name ?? incident.assignedToId) : "—" },
              { label: "Grup",         value: incident.assignmentGroupName ?? "—" },
              { label: "İlişkili CR",  value: incident.relatedCRId ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-gray-500 flex-shrink-0">{label}</span>
                <span className="text-gray-900 text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
