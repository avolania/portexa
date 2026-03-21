"use client";

import { useState, useRef } from "react";
import { Plus, X, FileText, Users, AlertTriangle, GitBranch, Bug, CheckCircle2, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { useGovernanceStore, GOVERNANCE_STATUS_META } from "@/store/useGovernanceStore";
import { useProjectStore } from "@/store/useProjectStore";
import { exportGovernance, getGovernanceTemplate } from "@/lib/exportExcel";
import type { GovernanceCategory, GovernanceItem, GovernanceStatus, Priority, Attachment } from "@/types";
import Button from "@/components/ui/Button";
import AttachmentSection from "@/components/ui/AttachmentSection";

const TABS: { id: GovernanceCategory; label: string; icon: React.ElementType }[] = [
  { id: "charter",  label: "Tüzük",        icon: FileText },
  { id: "meeting",  label: "Toplantılar",   icon: Users },
  { id: "risk",     label: "Riskler",       icon: AlertTriangle },
  { id: "change",   label: "Değişiklikler", icon: GitBranch },
  { id: "issue",    label: "Sorunlar",      icon: Bug },
  { id: "decision", label: "Kararlar",      icon: CheckCircle2 },
];

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  low:      { label: "Düşük",    color: "text-gray-500" },
  medium:   { label: "Orta",     color: "text-amber-600" },
  high:     { label: "Yüksek",   color: "text-orange-600" },
  critical: { label: "Kritik",   color: "text-red-600" },
};

const IMPACT_LABELS: Record<string, string> = { low: "Düşük", medium: "Orta", high: "Yüksek" };

interface Props {
  projectId: string;
}

export default function GovernancePanel({ projectId }: Props) {
  const [activeTab, setActiveTab] = useState<GovernanceCategory>("charter");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GovernanceItem | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getProjectItems, addItem, updateItem } = useGovernanceStore();
  const { projects } = useProjectStore();
  const projectName = projects.find((p) => p.id === projectId)?.name ?? "Proje";

  function handleExport() {
    const allItems = getProjectItems(projectId);
    exportGovernance(projectName, allItems);
  }

  function handleTemplate() {
    getGovernanceTemplate(projectName);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        let success = 0;
        const errors: string[] = [];

        rows.forEach((row, i) => {
          const title = String(row.title ?? "").trim();
          if (!title) { errors.push(`Satır ${i + 2}: "title" boş`); return; }
          const category = (row.category as GovernanceCategory) || "issue";
          const validCategories: GovernanceCategory[] = ["charter", "meeting", "risk", "change", "issue", "decision"];
          if (!validCategories.includes(category)) { errors.push(`Satır ${i + 2}: geçersiz kategori "${row.category}"`); return; }

          addItem({
            id: crypto.randomUUID(),
            projectId,
            category,
            title,
            description: row.description || undefined,
            status: (row.status as GovernanceStatus) || (category === "risk" ? "open" : category === "meeting" ? "scheduled" : "draft"),
            priority: (row.priority as GovernanceItem["priority"]) || undefined,
            owner: row.owner || undefined,
            dueDate: row.dueDate || undefined,
            impact: (row.impact as GovernanceItem["impact"]) || undefined,
            probability: (row.probability as GovernanceItem["probability"]) || undefined,
            mitigationPlan: row.mitigationPlan || undefined,
            requestedBy: row.requestedBy || undefined,
            impactAssessment: row.impactAssessment || undefined,
            meetingDate: row.meetingDate || undefined,
            attendees: row.attendees ? String(row.attendees).split(",").map((s) => s.trim()).filter(Boolean) : undefined,
            minutes: row.minutes || undefined,
            decidedBy: row.decidedBy || undefined,
            rationale: row.rationale || undefined,
            createdAt: new Date().toISOString(),
          });
          success++;
        });

        setImportResult({ success, errors });
      } catch {
        setImportResult({ success: 0, errors: ["Dosya okunamadı. Geçerli bir Excel dosyası yükleyin."] });
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const items = getProjectItems(projectId, activeTab);

  function handleAdd() {
    const newItem: GovernanceItem = {
      id: `g${Date.now()}`,
      projectId,
      category: activeTab,
      title: (document.getElementById("gov-title") as HTMLInputElement)?.value || "Yeni Kayıt",
      description: (document.getElementById("gov-desc") as HTMLTextAreaElement)?.value,
      status: activeTab === "risk" ? "open" : activeTab === "meeting" ? "scheduled" : "draft",
      owner: (document.getElementById("gov-owner") as HTMLInputElement)?.value,
      dueDate: (document.getElementById("gov-due") as HTMLInputElement)?.value || undefined,
      createdAt: new Date().toISOString(),
    };
    addItem(newItem);
    setShowAdd(false);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
        {/* Tab bar rendered below */}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Şablon
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Excel Yükle
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            İndir
          </button>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className="space-y-1.5">
          {importResult.success > 0 && (
            <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              ✓ {importResult.success} kayıt başarıyla eklendi.
            </div>
          )}
          {importResult.errors.map((err, i) => (
            <div key={i} className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">⚠ {err}</div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = getProjectItems(projectId, tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            Bu kategoride kayıt bulunmuyor.
          </div>
        ) : (
          items.map((item) => {
            const statusMeta = GOVERNANCE_STATUS_META[item.status];
            return (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-full text-left card hover:shadow-md transition-shadow p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.bg} ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                      {item.priority && (
                        <span className={`text-xs font-medium ${PRIORITY_META[item.priority].color}`}>
                          {PRIORITY_META[item.priority].label}
                        </span>
                      )}
                      {item.impact && (
                        <span className="text-xs text-gray-500">
                          Etki: <strong>{IMPACT_LABELS[item.impact]}</strong>
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 truncate">{item.title}</div>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {item.owner && <div className="text-xs text-gray-500">{item.owner}</div>}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(item.createdAt).toLocaleDateString("tr-TR")}
                    </div>
                    {item.dueDate && (
                      <div className="text-xs text-amber-600 mt-0.5">
                        Son: {new Date(item.dueDate).toLocaleDateString("tr-TR")}
                      </div>
                    )}
                  </div>
                </div>

                {/* Risk specific */}
                {item.category === "risk" && item.mitigationPlan && (
                  <div className="mt-2 text-xs text-gray-500 bg-amber-50 rounded-lg p-2">
                    <strong className="text-amber-700">Azaltma Planı:</strong> {item.mitigationPlan}
                  </div>
                )}

                {/* Meeting specific */}
                {item.category === "meeting" && item.meetingDate && (
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span>📅 {new Date(item.meetingDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
                    {item.attendees && <span>👥 {item.attendees.length} katılımcı</span>}
                  </div>
                )}

                {/* Decision specific */}
                {item.category === "decision" && item.decidedBy && (
                  <div className="mt-1 text-xs text-gray-500">Karar veren: <strong>{item.decidedBy}</strong></div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Add button */}
      <Button variant="outline" onClick={() => setShowAdd(true)} className="w-full">
        <Plus className="w-4 h-4" />
        {TABS.find((t) => t.id === activeTab)?.label} Ekle
      </Button>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                Yeni {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Başlık</label>
                <input id="gov-title" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Başlık..." />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Açıklama</label>
                <textarea id="gov-desc" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Açıklama..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Sorumlu</label>
                  <input id="gov-owner" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ad Soyad" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Son Tarih</label>
                  <input id="gov-due" type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>İptal</Button>
                <Button className="flex-1" onClick={handleAdd}>Kaydet</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GOVERNANCE_STATUS_META[selectedItem.status].bg} ${GOVERNANCE_STATUS_META[selectedItem.status].color}`}>
                    {GOVERNANCE_STATUS_META[selectedItem.status].label}
                  </span>
                  {selectedItem.priority && (
                    <span className={`text-xs font-semibold ${PRIORITY_META[selectedItem.priority].color}`}>
                      {PRIORITY_META[selectedItem.priority].label} Öncelik
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-gray-900">{selectedItem.title}</h2>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              {selectedItem.description && (
                <p className="text-gray-600">{selectedItem.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                {selectedItem.owner && (
                  <div><span className="text-xs text-gray-400">Sorumlu</span><div className="font-medium text-gray-800">{selectedItem.owner}</div></div>
                )}
                {selectedItem.dueDate && (
                  <div><span className="text-xs text-gray-400">Son Tarih</span><div className="font-medium text-gray-800">{new Date(selectedItem.dueDate).toLocaleDateString("tr-TR")}</div></div>
                )}
                <div><span className="text-xs text-gray-400">Oluşturulma</span><div className="font-medium text-gray-800">{new Date(selectedItem.createdAt).toLocaleDateString("tr-TR")}</div></div>
              </div>

              {/* Risk fields */}
              {selectedItem.category === "risk" && (
                <div className="bg-amber-50 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-xs text-gray-400">Etki</span><div className="font-medium">{IMPACT_LABELS[selectedItem.impact ?? ""]}</div></div>
                    <div><span className="text-xs text-gray-400">Olasılık</span><div className="font-medium">{IMPACT_LABELS[selectedItem.probability ?? ""]}</div></div>
                  </div>
                  {selectedItem.mitigationPlan && (
                    <div><span className="text-xs text-gray-400">Azaltma Planı</span><p className="text-gray-700 mt-0.5">{selectedItem.mitigationPlan}</p></div>
                  )}
                </div>
              )}

              {/* Change request fields */}
              {selectedItem.category === "change" && (
                <div className="bg-blue-50 rounded-xl p-3 space-y-2">
                  {selectedItem.requestedBy && (
                    <div><span className="text-xs text-gray-400">Talep Eden</span><div className="font-medium">{selectedItem.requestedBy}</div></div>
                  )}
                  {selectedItem.impactAssessment && (
                    <div><span className="text-xs text-gray-400">Etki Değerlendirmesi</span><p className="text-gray-700 mt-0.5">{selectedItem.impactAssessment}</p></div>
                  )}
                </div>
              )}

              {/* Meeting fields */}
              {selectedItem.category === "meeting" && (
                <div className="bg-violet-50 rounded-xl p-3 space-y-2">
                  {selectedItem.meetingDate && (
                    <div><span className="text-xs text-gray-400">Toplantı Tarihi</span><div className="font-medium">{new Date(selectedItem.meetingDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div></div>
                  )}
                  {selectedItem.attendees && selectedItem.attendees.length > 0 && (
                    <div><span className="text-xs text-gray-400">Katılımcılar</span><div className="flex flex-wrap gap-1 mt-1">{selectedItem.attendees.map((a) => (<span key={a} className="text-xs bg-white border border-violet-200 text-violet-700 px-2 py-0.5 rounded-full">{a}</span>))}</div></div>
                  )}
                  {selectedItem.minutes && (
                    <div><span className="text-xs text-gray-400">Toplantı Notları</span><p className="text-gray-700 mt-0.5">{selectedItem.minutes}</p></div>
                  )}
                </div>
              )}

              {/* Decision fields */}
              {selectedItem.category === "decision" && (
                <div className="bg-emerald-50 rounded-xl p-3 space-y-2">
                  {selectedItem.decidedBy && (
                    <div><span className="text-xs text-gray-400">Karar Veren</span><div className="font-medium">{selectedItem.decidedBy}</div></div>
                  )}
                  {selectedItem.rationale && (
                    <div><span className="text-xs text-gray-400">Gerekçe</span><p className="text-gray-700 mt-0.5">{selectedItem.rationale}</p></div>
                  )}
                </div>
              )}

              {/* Attachments */}
              <div className="pt-2 border-t border-gray-100">
                <AttachmentSection
                  attachments={selectedItem.attachments ?? []}
                  onAdd={(att: Attachment) => {
                    const updated = [...(selectedItem.attachments ?? []), att];
                    updateItem(selectedItem.id, { attachments: updated });
                    setSelectedItem({ ...selectedItem, attachments: updated });
                  }}
                  onRemove={(id) => {
                    const updated = (selectedItem.attachments ?? []).filter((a) => a.id !== id);
                    updateItem(selectedItem.id, { attachments: updated });
                    setSelectedItem({ ...selectedItem, attachments: updated });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
