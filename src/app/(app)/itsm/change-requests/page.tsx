"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, GitPullRequest, ChevronRight, Calendar, Paperclip, X as XIcon } from "lucide-react";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ChangeRequestState, ChangeType, ChangeRisk, Impact, SapModule, SapCategory } from "@/lib/itsm/types/enums";
import { ITSM_PRIORITY_MAP, CR_STATE_MAP, CHANGE_TYPE_MAP, CHANGE_RISK_MAP, APPROVAL_STATE_MAP } from "@/lib/itsm/ui-maps";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import type { CreateChangeRequestDto } from "@/lib/itsm/types/change-request.types";

// ─── New CR Modal ─────────────────────────────────────────────────────────────

function NewCRModal({ onClose }: { onClose: () => void }) {
  const { create, addAttachment } = useChangeRequestStore();
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    shortDescription:   "",
    description:        "",
    justification:      "",
    category:           "",
    sapCategory:        "",
    sapModule:          "",
    type:               ChangeType.NORMAL as ChangeType,
    risk:               ChangeRisk.MODERATE as ChangeRisk,
    impact:             Impact.MEDIUM as Impact,
    plannedStartDate:   "",
    plannedEndDate:     "",
    implementationPlan: "",
    backoutPlan:        "",
    testPlan:           "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shortDescription.trim() || !form.plannedStartDate || !form.plannedEndDate) return;
    setSaving(true);
    const dto: CreateChangeRequestDto = {
      requestedById:      user?.id ?? "",
      changeManagerId:    user?.id ?? "",
      type:               form.type,
      category:           form.category || "Genel",
      sapCategory:        form.sapCategory || undefined,
      sapModule:          form.sapModule   || undefined,
      risk:               form.risk,
      impact:             form.impact,
      shortDescription:   form.shortDescription,
      description:        form.description,
      justification:      form.justification,
      plannedStartDate:   new Date(form.plannedStartDate).toISOString(),
      plannedEndDate:     new Date(form.plannedEndDate).toISOString(),
      implementationPlan: form.implementationPlan || "—",
      backoutPlan:        form.backoutPlan        || "—",
      testPlan:           form.testPlan           || undefined,
    };
    const cr = await create(dto);
    if (cr && pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        await addAttachment(cr.id, file);
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
            <textarea className="input w-full min-h-[70px] resize-none" placeholder="Değişikliğin kapsamı ve içeriği..." value={form.description} onChange={(e) => f("description", e.target.value)} />
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
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planlanan Başlangıç *</label>
              <input type="datetime-local" className="input w-full" value={form.plannedStartDate} onChange={(e) => f("plannedStartDate", e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planlanan Bitiş *</label>
              <input type="datetime-local" className="input w-full" value={form.plannedEndDate} onChange={(e) => f("plannedEndDate", e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uygulama Planı</label>
            <textarea className="input w-full min-h-[60px] resize-none" placeholder="Adım adım uygulama planı..." value={form.implementationPlan} onChange={(e) => f("implementationPlan", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Geri Alma Planı</label>
            <textarea className="input w-full min-h-[60px] resize-none" placeholder="Sorun oluşursa nasıl geri alınacak?" value={form.backoutPlan} onChange={(e) => f("backoutPlan", e.target.value)} />
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

const STATE_FILTERS = [
  { value: "all",                            label: "Tümü"           },
  { value: ChangeRequestState.NEW,           label: "Yeni"           },
  { value: ChangeRequestState.ASSESS,        label: "Değerlendirme"  },
  { value: ChangeRequestState.AUTHORIZE,     label: "Yetkilendirme"  },
  { value: ChangeRequestState.SCHEDULED,     label: "Planlandı"      },
  { value: ChangeRequestState.IMPLEMENT,     label: "Uygulama"       },
  { value: ChangeRequestState.REVIEW,        label: "İnceleme"       },
  { value: ChangeRequestState.CLOSED,        label: "Kapandı"        },
];

export default function ChangeRequestsPage() {
  const { changeRequests, loading } = useChangeRequestStore();
  const [stateFilter, setStateFilter] = useState("all");
  const [search, setSearch]           = useState("");
  const [showNew, setShowNew]         = useState(false);

  const filtered = changeRequests.filter((cr) => {
    if (stateFilter !== "all" && cr.state !== stateFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!cr.shortDescription.toLowerCase().includes(q) && !cr.number.toLowerCase().includes(q)) return false;
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
            <span className="text-gray-900 font-medium">Değişiklik Talepleri</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Değişiklik Yönetimi</h1>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Yeni Değişiklik</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Numara veya başlık ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATE_FILTERS.map((f) => (
            <button key={f.value} onClick={() => setStateFilter(f.value)}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                stateFilter === f.value ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50")}>
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
            <GitPullRequest className="w-10 h-10" />
            <p className="text-sm">Hiç değişiklik talebi bulunamadı.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-28 hidden sm:table-cell">Numara</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Başlık</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-24 hidden sm:table-cell">Tip</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-24 hidden md:table-cell">Risk</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-32">Durum</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-36 hidden md:table-cell">Planlanan Başlangıç</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((cr) => {
                const stateInfo = CR_STATE_MAP[cr.state];
                const typeInfo  = CHANGE_TYPE_MAP[cr.type];
                const riskInfo  = CHANGE_RISK_MAP[cr.risk];
                return (
                  <tr key={cr.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden sm:table-cell">{cr.number}</td>
                    <td className="px-4 py-3">
                      <Link href={`/itsm/change-requests/${cr.id}`} className="font-medium text-gray-900 hover:text-indigo-600 line-clamp-1">
                        {cr.shortDescription}
                      </Link>
                      <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        <span className="sm:hidden font-mono">{cr.number}</span>
                        {cr.category && <span>{cr.category}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", typeInfo.badge)}>{typeInfo.label}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", riskInfo.badge)}>{riskInfo.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", stateInfo.badge)}>{stateInfo.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {format(new Date(cr.plannedStartDate), "dd MMM yyyy", { locale: tr })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showNew && <NewCRModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
