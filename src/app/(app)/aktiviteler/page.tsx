"use client";

import { useState, useMemo } from "react";
import {
  Plus, X, Check, Send, Edit2, Trash2,
  CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown,
} from "lucide-react";
import { useActivityStore } from "@/store/useActivityStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useTeamStore } from "@/store/useTeamStore";
import type { ActivityEntry, ActivityType, ActivityStatus } from "@/types";
import { ACTIVITY_TYPE_META } from "@/types";
import { cn } from "@/lib/utils";

const ACTIVITY_TYPES = Object.entries(ACTIVITY_TYPE_META) as [ActivityType, typeof ACTIVITY_TYPE_META[ActivityType]][];

const STATUS_META: Record<ActivityStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:     { label: "Taslak",         color: "text-gray-600",    bg: "bg-gray-100",    icon: Edit2 },
  submitted: { label: "Onay Bekliyor",  color: "text-amber-700",   bg: "bg-amber-100",   icon: Clock },
  approved:  { label: "Onaylandı",      color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle2 },
  rejected:  { label: "Reddedildi",     color: "text-red-700",     bg: "bg-red-100",     icon: XCircle },
};

type FilterTab = "all" | ActivityStatus;

// ─── Activity Modal ────────────────────────────────────────────────────────────

function ActivityModal({
  entry,
  onClose,
}: {
  entry?: ActivityEntry;
  onClose: () => void;
}) {
  const { addEntry, updateEntry } = useActivityStore();
  const { projects } = useProjectStore();
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState({
    type: (entry?.type ?? "development") as ActivityType,
    title: entry?.title ?? "",
    projectId: entry?.projectId ?? (projects[0]?.id ?? ""),
    date: entry?.date ?? new Date().toISOString().slice(0, 10),
    hours: entry?.hours?.toString() ?? "",
    description: entry?.description ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Başlık zorunludur";
    if (!form.projectId) e.projectId = "Proje seçin";
    if (!form.date) e.date = "Tarih zorunludur";
    const h = parseFloat(form.hours);
    if (!form.hours || isNaN(h) || h <= 0) e.hours = "Geçerli saat girin";
    if (h > 24) e.hours = "24 saati aşamaz";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = (submit = false) => {
    if (!validate()) return;
    if (!user) return;
    const now = new Date().toISOString();
    if (entry) {
      updateEntry(entry.id, {
        type: form.type,
        title: form.title.trim(),
        projectId: form.projectId,
        date: form.date,
        hours: parseFloat(form.hours),
        description: form.description.trim() || undefined,
        ...(submit ? { status: "submitted", submittedAt: now } : {}),
      });
    } else {
      addEntry({
        id: crypto.randomUUID(),
        userId: user.id,
        type: form.type,
        title: form.title.trim(),
        projectId: form.projectId,
        date: form.date,
        hours: parseFloat(form.hours),
        description: form.description.trim() || undefined,
        status: submit ? "submitted" : "draft",
        submittedAt: submit ? now : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{entry ? "Aktiviteyi Düzenle" : "Yeni Aktivite"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Activity type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Aktivite Tipi</label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_TYPES.map(([type, meta]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type }))}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                    form.type === type
                      ? `${meta.bg} ${meta.color} border-current ring-1 ring-current`
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {meta.icon} {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Başlık <span className="text-red-500">*</span>
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Aktivite başlığını girin..."
              className={cn(
                "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300",
                errors.title ? "border-red-400" : "border-gray-300"
              )}
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
          </div>

          {/* Project + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proje <span className="text-red-500">*</span>
              </label>
              <select
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                className={cn(
                  "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300",
                  errors.projectId ? "border-red-400" : "border-gray-300"
                )}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tarih <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className={cn(
                  "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300",
                  errors.date ? "border-red-400" : "border-gray-300"
                )}
              />
            </div>
          </div>

          {/* Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Süre (saat) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={form.hours}
              onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
              placeholder="0.0"
              className={cn(
                "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300",
                errors.hours ? "border-red-400" : "border-gray-300"
              )}
            />
            {errors.hours && <p className="text-xs text-red-500 mt-1">{errors.hours}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Yapılan iş hakkında kısa açıklama..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            İptal
          </button>
          {(!entry || entry.status === "draft") && (
            <button
              onClick={() => handleSave(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Taslak Kaydet
            </button>
          )}
          <button
            onClick={() => handleSave(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <Send className="w-3.5 h-3.5" />
            Onaya Gönder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Approval Modal ────────────────────────────────────────────────────────────

function ApprovalModal({
  entry,
  onClose,
}: {
  entry: ActivityEntry;
  onClose: () => void;
}) {
  const { approveEntry, rejectEntry } = useActivityStore();
  const { projects } = useProjectStore();
  const user = useAuthStore((s) => s.user);
  const { members } = useTeamStore();
  const profiles = useAuthStore((s) => s.profiles);

  const [note, setNote] = useState("");
  const [showReject, setShowReject] = useState(false);

  const resolveUserName = (uid: string) => {
    const tm = members.find((m) => m.id === uid);
    if (tm) return tm.name;
    const prof = Object.values(profiles).find((p) => p.id === uid);
    return prof?.name ?? uid;
  };

  const project = projects.find((p) => p.id === entry.projectId);
  const typeMeta = ACTIVITY_TYPE_META[entry.type];

  const handleApprove = () => {
    if (!user) return;
    approveEntry(entry.id, user.id);
    onClose();
  };

  const handleReject = () => {
    if (!user) return;
    rejectEntry(entry.id, user.id, note.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Aktivite İnceleme</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Who + when */}
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-800">{resolveUserName(entry.userId)}</span> tarafından{" "}
            {entry.submittedAt ? new Date(entry.submittedAt).toLocaleDateString("tr-TR") : "—"} tarihinde gönderildi
          </div>

          {/* Details card */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn("flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full", typeMeta.bg, typeMeta.color)}>
                {typeMeta.icon} {typeMeta.label}
              </span>
            </div>
            <div className="font-semibold text-gray-900">{entry.title}</div>
            {entry.description && <div className="text-sm text-gray-600">{entry.description}</div>}
            <div className="flex items-center gap-4 text-sm text-gray-500 pt-1 border-t border-gray-200">
              <span>📁 {project?.name ?? "—"}</span>
              <span>📅 {new Date(entry.date).toLocaleDateString("tr-TR")}</span>
              <span className="font-semibold text-indigo-700">{entry.hours} saat</span>
            </div>
          </div>

          {/* Reject note */}
          {showReject && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Red Notu (isteğe bağlı)</label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reddetme sebebini yazın..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          {!showReject ? (
            <>
              <button
                onClick={() => setShowReject(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Reddet
              </button>
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                Onayla
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowReject(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Geri
              </button>
              <button
                onClick={handleReject}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                <XCircle className="w-4 h-4" />
                Reddet
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Activity Card ─────────────────────────────────────────────────────────────

function ActivityCard({
  entry,
  canManage,
  canApprove,
  onEdit,
  onApprove,
}: {
  entry: ActivityEntry;
  canManage: boolean;
  canApprove: boolean;
  onEdit: () => void;
  onApprove: () => void;
}) {
  const { deleteEntry, submitEntry } = useActivityStore();
  const { projects } = useProjectStore();
  const { members } = useTeamStore();
  const profiles = useAuthStore((s) => s.profiles);

  const project = projects.find((p) => p.id === entry.projectId);
  const typeMeta = ACTIVITY_TYPE_META[entry.type];
  const statusMeta = STATUS_META[entry.status];
  const StatusIcon = statusMeta.icon;

  const resolveUserName = (uid: string) => {
    const tm = members.find((m) => m.id === uid);
    if (tm) return tm.name;
    const prof = Object.values(profiles).find((p) => p.id === uid);
    return prof?.name ?? uid;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-3 hover:border-gray-300 transition-colors">
      {/* Type badge */}
      <span className={cn("flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 mt-0.5", typeMeta.bg, typeMeta.color)}>
        {typeMeta.icon}
        <span className="hidden sm:inline">{typeMeta.label}</span>
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="font-medium text-sm text-gray-900">{entry.title}</div>
          <span className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0", statusMeta.bg, statusMeta.color)}>
            <StatusIcon className="w-3 h-3" />
            {statusMeta.label}
          </span>
        </div>

        {entry.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{entry.description}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
          <span>📁 {project?.name ?? "—"}</span>
          <span>📅 {new Date(entry.date).toLocaleDateString("tr-TR")}</span>
          <span className="font-semibold text-indigo-600">{entry.hours} saat</span>
          {canApprove && <span>👤 {resolveUserName(entry.userId)}</span>}
          {entry.status === "rejected" && entry.rejectionNote && (
            <span className="text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {entry.rejectionNote}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {canManage && entry.status === "draft" && (
          <>
            <button
              onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Düzenle"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => submitEntry(entry.id)}
              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="Onaya gönder"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => deleteEntry(entry.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sil"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {canApprove && entry.status === "submitted" && (
          <button
            onClick={onApprove}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          >
            İncele
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AktivitelerPage() {
  const { entries } = useActivityStore();
  const user = useAuthStore((s) => s.user);
  const { projects } = useProjectStore();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<ActivityEntry | undefined>();
  const [approvalEntry, setApprovalEntry] = useState<ActivityEntry | undefined>();
  const [filterProject, setFilterProject] = useState("all");

  const isManager = user?.role === "admin" || user?.role === "pm";
  const isMember = user?.role === "member";

  // Members see only their own; managers see all
  const visibleEntries = useMemo(() => {
    let list = isMember
      ? entries.filter((e) => e.userId === user?.id)
      : entries;

    if (filterProject !== "all") list = list.filter((e) => e.projectId === filterProject);
    if (activeTab !== "all") list = list.filter((e) => e.status === activeTab);

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, user, isMember, activeTab, filterProject]);

  // Stats (this month)
  const now = new Date();
  const monthEntries = (isMember ? entries.filter((e) => e.userId === user?.id) : entries)
    .filter((e) => e.date.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`));

  const stats = {
    total:     monthEntries.reduce((s, e) => s + e.hours, 0),
    approved:  monthEntries.filter((e) => e.status === "approved").reduce((s, e) => s + e.hours, 0),
    pending:   monthEntries.filter((e) => e.status === "submitted").length,
    draft:     monthEntries.filter((e) => e.status === "draft").length,
  };

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all",       label: "Tümü",          count: (isMember ? entries.filter((e) => e.userId === user?.id) : entries).length },
    { id: "draft",     label: "Taslak",         count: (isMember ? entries.filter((e) => e.userId === user?.id) : entries).filter((e) => e.status === "draft").length },
    { id: "submitted", label: "Onay Bekliyor",  count: (isMember ? entries.filter((e) => e.userId === user?.id) : entries).filter((e) => e.status === "submitted").length },
    { id: "approved",  label: "Onaylandı",      count: (isMember ? entries.filter((e) => e.userId === user?.id) : entries).filter((e) => e.status === "approved").length },
    { id: "rejected",  label: "Reddedildi",     count: (isMember ? entries.filter((e) => e.userId === user?.id) : entries).filter((e) => e.status === "rejected").length },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aktivite Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isManager ? "Ekip aktivitelerini görüntüleyin ve onaylayın." : "Aktivitelerinizi kaydedin ve onaya gönderin."}
          </p>
        </div>
        <button
          onClick={() => { setEditEntry(undefined); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Yeni Aktivite
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Bu Ay (Toplam)", value: `${stats.total.toFixed(1)}s`,    color: "text-indigo-700" },
          { label: "Onaylanan",      value: `${stats.approved.toFixed(1)}s`, color: "text-emerald-700" },
          { label: "Onay Bekleyen",  value: `${stats.pending} kayıt`,        color: "text-amber-700" },
          { label: "Taslak",         value: `${stats.draft} kayıt`,          color: "text-gray-700" },
        ].map((s) => (
          <div key={s.label} className="card py-3">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Project filter */}
        <div className="relative">
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="appearance-none text-sm border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="all">Tüm Projeler</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {visibleEntries.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm font-medium text-gray-700">Aktivite bulunamadı</p>
            <p className="text-xs text-gray-400 mt-1">
              {activeTab === "all" ? "Henüz aktivite eklenmemiş." : "Bu filtreyle eşleşen aktivite yok."}
            </p>
          </div>
        ) : (
          visibleEntries.map((entry) => (
            <ActivityCard
              key={entry.id}
              entry={entry}
              canManage={entry.userId === user?.id && entry.status === "draft"}
              canApprove={isManager}
              onEdit={() => { setEditEntry(entry); setShowModal(true); }}
              onApprove={() => setApprovalEntry(entry)}
            />
          ))
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <ActivityModal
          entry={editEntry}
          onClose={() => { setShowModal(false); setEditEntry(undefined); }}
        />
      )}
      {approvalEntry && (
        <ApprovalModal
          entry={approvalEntry}
          onClose={() => setApprovalEntry(undefined)}
        />
      )}
    </div>
  );
}
