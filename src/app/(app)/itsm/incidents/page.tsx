"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, ChevronRight, AlertCircle, Clock, XCircle, Paperclip, X as XIcon } from "lucide-react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useITSMConfigStore } from "@/store/useITSMConfigStore";
import { IncidentState, Priority, Impact, Urgency } from "@/lib/itsm/types/enums";
import { ITSM_PRIORITY_MAP, INCIDENT_STATE_MAP } from "@/lib/itsm/ui-maps";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import type { CreateIncidentDto } from "@/lib/itsm/types/incident.types";

// ─── New Incident Modal ───────────────────────────────────────────────────────

function NewIncidentModal({ onClose }: { onClose: () => void }) {
  const { create, addAttachment } = useIncidentStore();
  const { user } = useAuthStore();
  const { config, load: loadConfig } = useITSMConfigStore();
  const incidentCategories = config.categories.incidentCategories;
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    shortDescription: "",
    description: "",
    category: "",
    impact: Impact.MEDIUM as Impact,
    urgency: Urgency.MEDIUM as Urgency,
    callerId: user?.id ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shortDescription.trim()) return;
    setSaving(true);
    const dto: CreateIncidentDto = {
      callerId:         form.callerId || (user?.id ?? ""),
      category:         form.category || "Genel",
      impact:           form.impact,
      urgency:          form.urgency,
      shortDescription: form.shortDescription,
      description:      form.description,
    };
    const incident = await create(dto);
    if (incident && pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        await addAttachment(incident.id, file);
      }
    }
    setSaving(false);
    onClose();
  };

  const f = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Yeni Incident</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kısa Açıklama *</label>
            <input
              className="input w-full"
              placeholder="Incident'ı kısaca açıklayın"
              value={form.shortDescription}
              onChange={(e) => f("shortDescription", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Detaylı Açıklama</label>
            <textarea
              className="input w-full min-h-[80px] resize-none"
              placeholder="Detaylar, adımlar, etki..."
              value={form.description}
              onChange={(e) => f("description", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select className="input w-full" value={form.category} onChange={(e) => f("category", e.target.value)}>
                <option value="">— Seçin —</option>
                {incidentCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
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
          {/* Attachments */}
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
              <input
                type="file"
                multiple
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                onChange={(e) => {
                  if (e.target.files) setPendingFiles((pf) => [...pf, ...Array.from(e.target.files!)]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">İptal</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Kaydediliyor..." : "Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STATE_FILTERS: { value: string; label: string }[] = [
  { value: "all",                          label: "Tümü"      },
  { value: IncidentState.NEW,              label: "Yeni"      },
  { value: IncidentState.ASSIGNED,         label: "Atandı"    },
  { value: IncidentState.IN_PROGRESS,      label: "İşlemde"   },
  { value: IncidentState.PENDING,          label: "Beklemede" },
  { value: IncidentState.RESOLVED,         label: "Çözüldü"   },
  { value: IncidentState.CLOSED,           label: "Kapandı"   },
];

export default function IncidentsPage() {
  const { incidents, loading } = useIncidentStore();
  const [stateFilter, setStateFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = incidents.filter((inc) => {
    if (stateFilter !== "all" && inc.state !== stateFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!inc.shortDescription.toLowerCase().includes(q) && !inc.number.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/itsm" className="hover:text-indigo-600">ITSM</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-900 font-medium">Incident'lar</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Incident Yönetimi</h1>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Yeni Incident</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Numara veya başlık ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStateFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                stateFilter === f.value
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <AlertCircle className="w-10 h-10" />
            <p className="text-sm">Hiç incident bulunamadı.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-28 hidden sm:table-cell">Numara</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Başlık</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-28 hidden sm:table-cell">Öncelik</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-28">Durum</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-36 hidden md:table-cell">SLA</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-32 hidden lg:table-cell">Oluşturulma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((inc) => {
                const stateInfo    = INCIDENT_STATE_MAP[inc.state];
                const priorityInfo = ITSM_PRIORITY_MAP[inc.priority];
                const isBreached   = inc.sla.resolutionBreached;
                const remainMs     = new Date(inc.sla.resolutionDeadline).getTime() - Date.now();
                const remainH      = Math.floor(remainMs / 3_600_000);
                return (
                  <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden sm:table-cell">{inc.number}</td>
                    <td className="px-4 py-3">
                      <Link href={`/itsm/incidents/${inc.id}`} className="font-medium text-gray-900 hover:text-indigo-600 line-clamp-1">
                        {inc.shortDescription}
                      </Link>
                      <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        <span className="sm:hidden font-mono">{inc.number}</span>
                        {inc.category && <span>{inc.category}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", priorityInfo.badge)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", priorityInfo.dot)} />
                        {priorityInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", stateInfo.badge)}>
                        {stateInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {inc.state === IncidentState.CLOSED || inc.state === IncidentState.RESOLVED ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : isBreached || remainMs < 0 ? (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <XCircle className="w-3 h-3" /> İhlal
                        </span>
                      ) : (
                        <span className={cn("flex items-center gap-1 text-xs font-medium", remainH < 2 ? "text-amber-600" : "text-emerald-600")}>
                          <Clock className="w-3 h-3" /> {remainH}s kaldı
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                      {formatDistanceToNow(new Date(inc.createdAt), { addSuffix: true, locale: tr })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showNew && <NewIncidentModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
