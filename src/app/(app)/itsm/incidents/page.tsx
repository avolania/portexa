"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, AlertCircle, Clock, XCircle, CheckCircle, AlertTriangle,
  Paperclip, X as XIcon, PanelLeftClose, PanelLeftOpen, ArrowLeft,
  Tag, ChevronDown, GitPullRequest, LifeBuoy,
  File, FileText, FileArchive, Image as ImageIcon,
} from "lucide-react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useITSMConfigStore } from "@/store/useITSMConfigStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { addIncidentAttachment } from "@/services/incidentService";
import {
  IncidentState, Priority, Impact, Urgency,
  IncidentResolutionCode, IncidentClosureCode,
  ChangeType, ChangeRisk,
} from "@/lib/itsm/types/enums";
import { ITSM_PRIORITY_MAP, INCIDENT_STATE_MAP } from "@/lib/itsm/ui-maps";
import { isValidIncidentTransition } from "@/lib/itsm/types/incident.types";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import type { CreateIncidentDto } from "@/lib/itsm/types/incident.types";
import type { Attachment } from "@/types";
import TicketTimeline from "@/components/itsm/TicketTimeline";
import { ListPagination } from "@/components/ui/ListPagination";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATE_FILTERS = [
  { value: "all",                     label: "Tümü"      },
  { value: IncidentState.NEW,         label: "Yeni"      },
  { value: IncidentState.ASSIGNED,    label: "Atandı"    },
  { value: IncidentState.IN_PROGRESS, label: "İşlemde"   },
  { value: IncidentState.PENDING,     label: "Beklemede" },
  { value: IncidentState.RESOLVED,    label: "Çözüldü"   },
  { value: IncidentState.CLOSED,      label: "Kapandı"   },
];

const PRIORITY_FILTERS = [
  { value: "all",             label: "Tümü" },
  { value: Priority.CRITICAL, label: "P1"   },
  { value: Priority.HIGH,     label: "P2"   },
  { value: Priority.MEDIUM,   label: "P3"   },
  { value: Priority.LOW,      label: "P4"   },
];

const STEPPER: { state: IncidentState; label: string }[] = [
  { state: IncidentState.NEW,         label: "Yeni"      },
  { state: IncidentState.ASSIGNED,    label: "Atandı"    },
  { state: IncidentState.IN_PROGRESS, label: "İşlemde"   },
  { state: IncidentState.PENDING,     label: "Bekleme"   },
  { state: IncidentState.RESOLVED,    label: "Çözüldü"   },
  { state: IncidentState.CLOSED,      label: "Kapandı"   },
];

const ALL_STATES = [
  IncidentState.NEW, IncidentState.ASSIGNED, IncidentState.IN_PROGRESS,
  IncidentState.PENDING, IncidentState.RESOLVED, IncidentState.CLOSED,
];

const TRANSITION_LABEL: Partial<Record<IncidentState, string>> = {
  [IncidentState.IN_PROGRESS]: "İşleme Al",
  [IncidentState.PENDING]:     "Bekletmeye Al",
  [IncidentState.ASSIGNED]:    "Atandı'ya Al",
  [IncidentState.RESOLVED]:    "Çöz",
  [IncidentState.CLOSED]:      "Kapat",
  [IncidentState.NEW]:         "Yeni'ye Al",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-blue-500" />;
  if (type.includes("zip") || type.includes("rar") || type.includes("archive")) return <FileArchive className="w-4 h-4 text-amber-500" />;
  if (type.includes("pdf") || type.includes("document") || type.includes("word")) return <FileText className="w-4 h-4 text-red-500" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── New Incident Modal ───────────────────────────────────────────────────────

function NewIncidentModal({ onClose }: { onClose: () => void }) {
  const { create } = useIncidentStore();
  const { user, profiles, loadProfiles } = useAuthStore();
  const { config, load: loadConfig } = useITSMConfigStore();
  const incidentCategories = config.categories.incidentCategories;
  const incidentGroups = config.groups.filter((g) => g.type === "all" || g.type === "incident");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    shortDescription: "",
    description: "",
    category: "",
    impact: Impact.MEDIUM as Impact,
    urgency: Urgency.MEDIUM as Urgency,
    callerId: user?.id ?? "",
    assignmentGroupId: "",
    assignedToId: "",
  });

  useEffect(() => {
    loadConfig();
    if (Object.keys(profiles).length === 0) loadProfiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGroupChange = (groupId: string) => {
    const group = incidentGroups.find((g) => g.id === groupId);
    const firstMember = group?.memberIds?.[0] ?? "";
    setForm((s) => ({ ...s, assignmentGroupId: groupId, assignedToId: firstMember }));
  };

  const selectedGroup = incidentGroups.find((g) => g.id === form.assignmentGroupId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shortDescription.trim() || !user) return;
    setSaveError(null);
    setSaving(true);
    try {
      const dto: CreateIncidentDto = {
        callerId:            form.callerId || (user?.id ?? ""),
        category:            form.category || "Genel",
        impact:              form.impact,
        urgency:             form.urgency,
        shortDescription:    form.shortDescription,
        description:         form.description,
        assignmentGroupId:   form.assignmentGroupId || undefined,
        assignmentGroupName: form.assignmentGroupId ? (incidentGroups.find((g) => g.id === form.assignmentGroupId)?.name) : undefined,
        assignedToId:        form.assignedToId || undefined,
      };
      const incident = await create(dto);
      if (incident && pendingFiles.length > 0) {
        let current = incident;
        for (const file of pendingFiles) {
          const updated = await addIncidentAttachment(incident.id, file, user.name, [current], user.orgId);
          if (updated) current = updated;
        }
        useIncidentStore.getState().load();
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
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Yeni Incident</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kısa Açıklama *</label>
            <input className="input w-full" placeholder="Incident'ı kısaca açıklayın"
              value={form.shortDescription} onChange={(e) => f("shortDescription", e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Detaylı Açıklama</label>
            <textarea className="input w-full min-h-[80px] resize-none" placeholder="Detaylar, adımlar, etki..."
              value={form.description} onChange={(e) => f("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select className="input w-full" value={form.category} onChange={(e) => f("category", e.target.value)}>
                <option value="">— Seçin —</option>
                {incidentCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Aciliyet</label>
              <select className="input w-full" value={form.urgency} onChange={(e) => f("urgency", e.target.value)}>
                <option value={Urgency.HIGH}>Yüksek</option>
                <option value={Urgency.MEDIUM}>Orta</option>
                <option value={Urgency.LOW}>Düşük</option>
              </select>
            </div>
          </div>
          {incidentGroups.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Atama Ekibi</label>
                <select className="input w-full" value={form.assignmentGroupId} onChange={(e) => handleGroupChange(e.target.value)}>
                  <option value="">— Seçin (opsiyonel) —</option>
                  {incidentGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Atanan Kişi</label>
                <select className="input w-full" value={form.assignedToId} onChange={(e) => f("assignedToId", e.target.value)}
                  disabled={!selectedGroup}>
                  <option value="">— Seçin —</option>
                  {(selectedGroup?.memberIds ?? []).map((uid) => {
                    const p = profiles[uid];
                    return <option key={uid} value={uid}>{p?.name ?? uid}</option>;
                  })}
                </select>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ekler</label>
            {pendingFiles.length > 0 && (
              <div className="space-y-1 mb-2">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded border border-gray-200 text-sm">
                    <span className="flex-1 truncate text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{formatBytes(file.size)}</span>
                    <button type="button" onClick={() => setPendingFiles((pf) => pf.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 shrink-0">
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="relative flex items-center gap-2 px-3 py-2 w-full border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-colors cursor-pointer overflow-hidden">
              <Paperclip className="w-4 h-4" />
              Dosya ekle
              <input type="file" multiple className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                onChange={(e) => { if (e.target.files) setPendingFiles((pf) => [...pf, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
            </label>
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

// ─── State Stepper ────────────────────────────────────────────────────────────

function StateStepper({ currentState }: { currentState: IncidentState }) {
  const currentIdx = STEPPER.findIndex((s) => s.state === currentState);
  return (
    <div className="flex items-center px-4 py-2.5 bg-gray-50 border-b border-gray-200">
      {STEPPER.map((step, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.state} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center min-w-0 shrink-0">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium",
                done   ? "bg-emerald-500 text-white"
                       : active ? "bg-indigo-600 text-white ring-2 ring-indigo-200 ring-offset-1"
                       : "bg-gray-200 text-gray-400"
              )}>
                {done ? <CheckCircle className="w-3 h-3" /> : <span>{i + 1}</span>}
              </div>
              <span className={cn(
                "text-[9px] mt-0.5 hidden sm:block whitespace-nowrap",
                done ? "text-emerald-600" : active ? "text-indigo-700 font-semibold" : "text-gray-400"
              )}>{step.label}</span>
            </div>
            {i < STEPPER.length - 1 && (
              <div className={cn("h-px flex-1 mx-1 mb-3", done ? "bg-emerald-400" : "bg-gray-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Attachments ─────────────────────────────────────────────────────────────

function IncidentAttachments({ attachments, onAdd, onRemove }: {
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
      for (const file of Array.from(files)) await onAdd(file);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
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
              <button onClick={() => onRemove(att.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Kaldır">
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

// ─── Incident Detail Panel ────────────────────────────────────────────────────

type Tab = "details" | "worknotes" | "comments" | "timeline" | "attachments";

function IncidentDetail({ incidentId, onClose }: { incidentId: string; onClose?: () => void }) {
  const { incidents, addWorkNote, addComment, addAttachment, removeAttachment, changeState, resolve, close, assign,
          loadTicketActivity, activeWorkNotes, activeComments, activeEvents, activeTicketId } = useIncidentStore();
  const { create: createCR } = useChangeRequestStore();
  const { create: createSR } = useServiceRequestStore();
  const { user, profiles } = useAuthStore();
  const { config } = useITSMConfigStore();
  const router = useRouter();

  const incident = incidents.find((i) => i.id === incidentId);

  useEffect(() => {
    if (incidentId && incidentId !== activeTicketId) {
      loadTicketActivity(incidentId);
    }
  }, [incidentId]);

  const [tab, setTab] = useState<Tab>("details");
  const [noteText, setNoteText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);

  // State change
  const [showStateMenu, setShowStateMenu] = useState(false);
  const [pendingState, setPendingState] = useState<IncidentState | null>(null);
  const [resCode, setResCode] = useState(IncidentResolutionCode.SOLVED_PERMANENTLY);
  const [resNotes, setResNotes] = useState("");
  const [closeCode, setCloseCode] = useState(IncidentClosureCode.SOLVED_PERMANENTLY);
  const [closeNotes, setCloseNotes] = useState("");

  // Assign
  const [showAssign, setShowAssign] = useState(false);
  const [assignGroupId, setAssignGroupId] = useState("");
  const [assignToId, setAssignToId] = useState("");

  // Convert
  const [showConvert, setShowConvert] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  if (!incident) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
        <AlertCircle className="w-10 h-10" />
        <p className="text-sm">Incident bulunamadı veya yükleniyor.</p>
      </div>
    );
  }

  const stateInfo    = INCIDENT_STATE_MAP[incident.state];
  const priorityInfo = ITSM_PRIORITY_MAP[incident.priority];
  const validTransitions = ALL_STATES.filter((s) => s !== incident.state && isValidIncidentTransition(incident.state, s));
  const incidentGroups = config.groups.filter((g) => g.type === "all" || g.type === "incident");
  const selectedAssignGroup = incidentGroups.find((g) => g.id === assignGroupId);

  const handleStateTransition = async (targetState: IncidentState) => {
    setShowStateMenu(false);
    if (targetState === IncidentState.RESOLVED || targetState === IncidentState.CLOSED) {
      setPendingState(targetState);
      return;
    }
    setSaving(true);
    await changeState(incidentId, { state: targetState });
    setSaving(false);
  };

  const doResolve = async () => {
    if (!resNotes.trim()) return;
    setSaving(true);
    await resolve(incidentId, { resolutionCode: resCode, resolutionNotes: resNotes });
    setSaving(false);
    setPendingState(null);
    setResNotes("");
  };

  const doClose = async () => {
    if (!closeNotes.trim()) return;
    setSaving(true);
    await close(incidentId, { closureCode: closeCode, closureNotes: closeNotes });
    setSaving(false);
    setPendingState(null);
    setCloseNotes("");
  };

  const doAssign = async () => {
    if (!assignToId) return;
    setSaving(true);
    await assign(incidentId, { assignedToId: assignToId });
    setSaving(false);
    setShowAssign(false);
    setAssignGroupId("");
    setAssignToId("");
  };

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
        justification:      `Incident ${incident.number} üzerinden dönüştürüldü.`,
        plannedStartDate:   new Date(today + "T00:00:00").toISOString(),
        plannedEndDate:     new Date(today + "T23:59:59").toISOString(),
        implementationPlan: "—",
        backoutPlan:        "—",
        relatedIncidentIds: [incident.id],
        sourceIncidentNumber: incident.number,
      });
      if (cr) router.push(`/itsm/change-requests/${cr.id}`);
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : "Dönüştürme başarısız.");
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
        description:          incident.description ?? "",
        impact:               incident.impact as unknown as Impact,
        urgency:              incident.urgency as unknown as Urgency,
        sourceIncidentNumber: incident.number,
      });
      if (sr) router.push(`/itsm/service-requests/${sr.id}`);
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : "Dönüştürme başarısız.");
    } finally {
      setSaving(false);
    }
  };

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
    { key: "details",     label: "Detaylar"        },
    { key: "attachments", label: "Ekler",      count: (incident.attachments ?? []).length },
    { key: "worknotes",   label: "İş Notları", count: activeWorkNotes.length },
    { key: "comments",    label: "Yorumlar",   count: activeComments.length  },
    { key: "timeline",    label: "Zaman",      count: activeEvents.length    },
  ];

  // SLA calc
  const now = Date.now();
  const resMs = new Date(incident.sla.resolutionDeadline).getTime() - now;
  const resH  = Math.floor(Math.abs(resMs) / 3_600_000);
  const resM  = Math.floor((Math.abs(resMs) % 3_600_000) / 60_000);

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
              <span className="font-mono text-xs text-gray-400">{incident.number}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", stateInfo.badge)}>{stateInfo.label}</span>
            </div>
            <h2 className="text-sm font-semibold text-gray-900 leading-snug">{incident.shortDescription}</h2>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
              {incident.category && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{incident.category}</span>}
              <span>{format(new Date(incident.createdAt), "dd MMM yyyy HH:mm", { locale: tr })}</span>
              <span>güncellendi {formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true, locale: tr })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* State Stepper */}
      <StateStepper currentState={incident.state} />

      {/* Body: tabs + sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Tabs */}
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

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Details */}
            {tab === "details" && (
              <div className="space-y-3">
                {incident.description && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-600 mb-1.5">Açıklama</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{incident.description}</p>
                  </div>
                )}
                {incident.resolutionNotes && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <h3 className="text-xs font-semibold text-emerald-700 mb-1.5">Çözüm</h3>
                    <p className="text-sm text-emerald-700">{incident.resolutionNotes}</p>
                  </div>
                )}
                {incident.closureNotes && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-600 mb-1.5">Kapatma Notu</h3>
                    <p className="text-sm text-gray-700">{incident.closureNotes}</p>
                  </div>
                )}
                {!incident.description && !incident.resolutionNotes && !incident.closureNotes && (
                  <p className="text-sm text-gray-400 text-center py-8">Açıklama eklenmemiş.</p>
                )}
              </div>
            )}

            {/* Attachments */}
            {tab === "attachments" && (
              <IncidentAttachments
                attachments={incident.attachments ?? []}
                onAdd={(file) => addAttachment(incident.id, file)}
                onRemove={(aid) => removeAttachment(incident.id, aid)}
              />
            )}

            {/* Work Notes */}
            {tab === "worknotes" && (
              <div className="space-y-3">
                <div className="p-3 bg-white border border-gray-200 rounded-lg">
                  <textarea className="input w-full min-h-[72px] resize-none text-sm" placeholder="İş notu ekle (yalnızca ajanlara görünür)..."
                    value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <div className="flex justify-end mt-2">
                    <button onClick={submitNote} disabled={saving || !noteText.trim()} className="btn-primary text-xs">Not Ekle</button>
                  </div>
                </div>
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
                <div className="p-3 bg-white border border-gray-200 rounded-lg">
                  <textarea className="input w-full min-h-[72px] resize-none text-sm" placeholder="Yorum ekle (müşteriye görünür)..."
                    value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                  <div className="flex justify-end mt-2">
                    <button onClick={submitComment} disabled={saving || !commentText.trim()} className="btn-primary text-xs">Yorum Ekle</button>
                  </div>
                </div>
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
        <div className="w-56 border-l border-gray-200 bg-white flex-shrink-0 overflow-y-auto p-3 space-y-4">

          {/* Durum Değiştir */}
          {incident.state !== IncidentState.CLOSED && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</p>
              <div className="relative">
                <button
                  onClick={() => setShowStateMenu(!showStateMenu)}
                  disabled={saving}
                  className="w-full flex items-center justify-between gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Durum Değiştir
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showStateMenu && "rotate-180")} />
                </button>
                {showStateMenu && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    {validTransitions.map((s) => (
                      <button key={s} onClick={() => handleStateTransition(s)}
                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                        {TRANSITION_LABEL[s] ?? s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Resolve form */}
              {pendingState === IncidentState.RESOLVED && (
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
                  <p className="text-xs font-medium text-emerald-800">Çözüm Bilgileri</p>
                  <select className="input w-full text-xs" value={resCode} onChange={(e) => setResCode(e.target.value as IncidentResolutionCode)}>
                    {Object.values(IncidentResolutionCode).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <textarea className="input w-full text-xs min-h-[60px] resize-none" placeholder="Çözüm notları *"
                    value={resNotes} onChange={(e) => setResNotes(e.target.value)} />
                  <div className="flex gap-1.5">
                    <button onClick={doResolve} disabled={saving || !resNotes.trim()} className="btn-primary text-xs flex-1">Onayla</button>
                    <button onClick={() => setPendingState(null)} className="btn-secondary text-xs">İptal</button>
                  </div>
                </div>
              )}

              {/* Close form */}
              {pendingState === IncidentState.CLOSED && (
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  <p className="text-xs font-medium text-gray-700">Kapatma Bilgileri</p>
                  <select className="input w-full text-xs" value={closeCode} onChange={(e) => setCloseCode(e.target.value as IncidentClosureCode)}>
                    {Object.values(IncidentClosureCode).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <textarea className="input w-full text-xs min-h-[60px] resize-none" placeholder="Kapatma gerekçesi *"
                    value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
                  <div className="flex gap-1.5">
                    <button onClick={doClose} disabled={saving || !closeNotes.trim()} className="btn-primary text-xs flex-1">Kapat</button>
                    <button onClick={() => setPendingState(null)} className="btn-secondary text-xs">İptal</button>
                  </div>
                </div>
              )}

              {/* Assign */}
              <button onClick={() => setShowAssign(!showAssign)} className="w-full px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
                Ata
              </button>
              {showAssign && (
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  {incidentGroups.length > 0 && (
                    <>
                      <select className="input w-full text-xs" value={assignGroupId}
                        onChange={(e) => { setAssignGroupId(e.target.value); setAssignToId(""); }}>
                        <option value="">— Ekip Seç —</option>
                        {incidentGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      <select className="input w-full text-xs" value={assignToId} onChange={(e) => setAssignToId(e.target.value)}
                        disabled={!selectedAssignGroup}>
                        <option value="">— Kişi Seç —</option>
                        {(selectedAssignGroup?.memberIds ?? []).map((uid) => {
                          const p = Object.values(profiles).find((pr) => pr.id === uid);
                          return <option key={uid} value={uid}>{p?.name ?? uid}</option>;
                        })}
                      </select>
                    </>
                  )}
                  <div className="flex gap-1.5">
                    <button onClick={doAssign} disabled={saving || !assignToId} className="btn-primary text-xs flex-1">Ata</button>
                    <button onClick={() => setShowAssign(false)} className="btn-secondary text-xs">İptal</button>
                  </div>
                </div>
              )}

              {/* Convert */}
              <button onClick={() => setShowConvert(!showConvert)} className="w-full px-3 py-2 border border-gray-200 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-50 transition-colors">
                Dönüştür...
              </button>
              {showConvert && (
                <div className="space-y-1">
                  {convertError && <div className="px-2 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{convertError}</div>}
                  <button onClick={convertToCR} disabled={saving}
                    className="flex items-center gap-2 w-full px-2.5 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50">
                    <GitPullRequest className="w-3 h-3" /> CR'a Dönüştür
                  </button>
                  <button onClick={convertToSR} disabled={saving}
                    className="flex items-center gap-2 w-full px-2.5 py-2 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-100 transition-colors disabled:opacity-50">
                    <LifeBuoy className="w-3 h-3" /> SR'a Dönüştür
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SLA */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" /> SLA
              {incident.sla.pausedAt && <span className="text-amber-600 font-normal">(Dur.)</span>}
            </p>
            {[
              { label: "Yanıt", deadline: incident.sla.responseDeadline, breached: incident.sla.responseBreached, responded: !!incident.sla.respondedAt },
              { label: "Çözüm", deadline: incident.sla.resolutionDeadline, breached: incident.sla.resolutionBreached },
            ].map(({ label, deadline, breached, responded }) => {
              const ms = new Date(deadline).getTime() - now;
              const h  = Math.floor(Math.abs(ms) / 3_600_000);
              const m  = Math.floor((Math.abs(ms) % 3_600_000) / 60_000);
              const over = ms < 0 || breached;
              return (
                <div key={label} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  {responded
                    ? <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> OK</span>
                    : over
                    ? <span className="text-xs text-red-600 font-medium flex items-center gap-0.5"><XCircle className="w-3 h-3" /> İhlal</span>
                    : <span className={cn("text-xs font-medium flex items-center gap-0.5", h < 2 ? "text-amber-600" : "text-emerald-600")}>
                        <Clock className="w-3 h-3" /> {h}s{m}d
                      </span>
                  }
                </div>
              );
            })}
          </div>

          {/* Info */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bilgiler</p>
            {[
              { label: "Etki",    value: incident.impact.replace(/^\d-/, "")   },
              { label: "Aciliyet", value: incident.urgency.replace(/^\d-/, "") },
              { label: "Atanan",  value: incident.assignedToId ? (profiles[incident.assignedToId]?.name ?? incident.assignedToId) : "—" },
              { label: "Grup",    value: incident.assignmentGroupName ?? "—"   },
              { label: "İlişkili CR", value: incident.relatedCRId ?? "—"      },
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

export default function IncidentsPage() {
  const { incidents, loading } = useIncidentStore();
  const { load: loadConfig } = useITSMConfigStore();

  const [stateFilter, setStateFilter]     = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [search, setSearch]               = useState("");
  const [sortBy, setSortBy]               = useState<"updated" | "priority">("updated");
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [showNew, setShowNew]             = useState(false);
  const [currentPage, setCurrentPage]     = useState(0);

  // Mobile: when incident is selected, hide list panel
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  useEffect(() => { setCurrentPage(0); }, [stateFilter, priorityFilter, search, sortBy]);

  const stateCounts = incidents.reduce<Record<string, number>>((acc, inc) => {
    acc[inc.state] = (acc[inc.state] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = useMemo(() => incidents
    .filter((inc) => {
      if (stateFilter !== "all" && inc.state !== stateFilter) return false;
      if (priorityFilter !== "all" && inc.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!inc.shortDescription.toLowerCase().includes(q) && !inc.number.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "priority") {
        const priorityOrder = [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW];
        return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    }), [incidents, stateFilter, priorityFilter, search, sortBy]);

  const paginated = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filtered, currentPage],
  );

  const handleSelectIncident = (id: string) => {
    setSelectedId(id);
    setMobileShowDetail(true);
  };

  const handleCloseDetail = () => {
    setMobileShowDetail(false);
    setSelectedId(null);
  };

  return (
    <div className={cn(
      "flex overflow-hidden bg-gray-100 rounded-lg border border-gray-200",
      "-m-3 md:-m-6 -mb-20 md:-mb-6 h-[calc(100vh-3.5rem)]"
    )}>
      {/* ── Left: Incident List ────────────────────────────────────────────── */}
      <div className={cn(
        "flex flex-col bg-white border-r border-gray-200 transition-all duration-200 overflow-hidden flex-shrink-0",
        listCollapsed ? "w-0" : "w-72",
        mobileShowDetail ? "hidden md:flex" : "flex"
      )}>
        {/* List header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 flex-shrink-0">
          <h1 className="text-sm font-semibold text-gray-900 flex-1">Incident'lar</h1>
          <button onClick={() => setShowNew(true)} className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors" title="Yeni Incident">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setListCollapsed(true)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors hidden md:flex" title="Listeyi gizle">
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
                  <span className="ml-1 opacity-70">{incidents.length}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Priority + Sort */}
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
          <div className="flex gap-1 flex-1">
            {PRIORITY_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setPriorityFilter(f.value)}
                className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                  priorityFilter === f.value ? "bg-indigo-100 text-indigo-700" : "text-gray-400 hover:text-gray-600"
                )}>
                {f.label}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "updated" | "priority")}
            className="text-[10px] text-gray-500 bg-transparent border-0 outline-none cursor-pointer">
            <option value="updated">Son güncelleme</option>
            <option value="priority">Öncelik</option>
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
              <AlertCircle className="w-8 h-8" />
              <p className="text-xs">Incident bulunamadı</p>
            </div>
          ) : (
            paginated.map((inc) => {
              const stateInfo    = INCIDENT_STATE_MAP[inc.state];
              const priorityInfo = ITSM_PRIORITY_MAP[inc.priority];
              const isBreached   = inc.sla.resolutionBreached;
              const remainMs     = new Date(inc.sla.resolutionDeadline).getTime() - Date.now();
              const selected     = selectedId === inc.id;
              return (
                <button
                  key={inc.id}
                  onClick={() => handleSelectIncident(inc.id)}
                  className={cn(
                    "w-full text-left px-3 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50",
                    selected && "bg-indigo-50 border-l-2 border-l-indigo-500"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", priorityInfo.dot)} />
                    <span className="font-mono text-[10px] text-gray-400 flex-1">{inc.number}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", stateInfo.badge)}>{stateInfo.label}</span>
                    {(isBreached || remainMs < 0) && inc.state !== IncidentState.CLOSED && inc.state !== IncidentState.RESOLVED && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" title="SLA İhlali" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{inc.shortDescription}</p>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                    {inc.category && <span>{inc.category}</span>}
                    <span className="ml-auto">{formatDistanceToNow(new Date(inc.updatedAt), { addSuffix: true, locale: tr })}</span>
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

      {/* ── Collapsed toggle ─────────────────────────────────────────────────── */}
      {listCollapsed && (
        <button onClick={() => setListCollapsed(false)}
          className="hidden md:flex flex-col items-center justify-center w-8 bg-white border-r border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors gap-1">
          <PanelLeftOpen className="w-3.5 h-3.5" />
        </button>
      )}

      {/* ── Right: Detail Panel ───────────────────────────────────────────────── */}
      <div className={cn("flex-1 min-w-0 overflow-hidden", !mobileShowDetail && selectedId === null ? "hidden md:flex" : "flex")}>
        {selectedId ? (
          <div className="w-full h-full">
            <IncidentDetail
              key={selectedId}
              incidentId={selectedId}
              onClose={mobileShowDetail ? handleCloseDetail : undefined}
            />
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center w-full h-full text-gray-400 gap-3">
            <AlertCircle className="w-12 h-12 opacity-30" />
            <p className="text-sm">Listeden bir incident seçin</p>
            <button onClick={() => setShowNew(true)} className="mt-2 btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Yeni Incident
            </button>
          </div>
        )}
      </div>

      {showNew && <NewIncidentModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
