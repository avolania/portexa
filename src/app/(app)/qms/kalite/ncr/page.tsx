"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, AlertTriangle, X, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { NCR, Supplier, NcrState, NcrDisposition, NcrSource, CreateNcrDto } from "@/lib/qms/types";

const NCR_STATE_LABEL: Record<NcrState, string> = {
  open: "Açık",
  investigating: "Araştırılıyor",
  disposition_pending: "Elden Çıkarma Bekliyor",
  disposition_approved: "Elden Çıkarma Onaylandı",
  capa_linked: "CAPA Bağlı",
  closed: "Kapalı",
  rejected: "Reddedildi",
};

const NCR_STATE_COLOR: Record<NcrState, string> = {
  open: "bg-red-100 text-red-700",
  investigating: "bg-amber-100 text-amber-700",
  disposition_pending: "bg-purple-100 text-purple-700",
  disposition_approved: "bg-blue-100 text-blue-700",
  capa_linked: "bg-indigo-100 text-indigo-700",
  closed: "bg-gray-100 text-gray-600",
  rejected: "bg-gray-200 text-gray-500",
};

const SEVERITY_COLOR: Record<string, string> = {
  minor: "bg-gray-100 text-gray-600",
  major: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const SEVERITY_LABEL: Record<string, string> = {
  minor: "Minör",
  major: "Major",
  critical: "Kritik",
};

const DISPOSITION_LABEL: Record<NcrDisposition, string> = {
  use_as_is: "Olduğu Gibi Kullan",
  rework: "Yeniden İşle",
  return: "İade Et",
  scrap: "İmha Et",
  concession: "Taviz Ver",
};

const STATE_STEPS: NcrState[] = [
  "open", "investigating", "disposition_pending", "disposition_approved", "capa_linked", "closed",
];

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}

export default function NcrPage() {
  const [ncrs, setNcrs] = useState<NCR[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedNcr, setSelectedNcr] = useState<NCR | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState<NcrDisposition | "">("");
  const [form, setForm] = useState<Partial<CreateNcrDto>>({
    source: "manual",
    supplier_id: "",
    severity: "minor",
    description: "",
    category: "quality",
  });

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  };

  const loadData = useCallback(async () => {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (severityFilter) params.set("severity", severityFilter);
    if (stateFilter) params.set("state", stateFilter);

    const [ncrsRes, suppliersRes] = await Promise.all([
      fetch(`/api/qms/quality/ncr?${params}`, { headers }),
      fetch("/api/qms/suppliers", { headers }),
    ]);

    if (ncrsRes.ok) setNcrs(await ncrsRes.json());
    if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
    setLoading(false);
  }, [search, severityFilter, stateFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const transition = async (
    action: string,
    extras?: { disposition?: NcrDisposition; capaId?: string }
  ) => {
    if (!selectedNcr) return;
    setTransitioning(true);
    const token = await getToken();
    const res = await fetch(`/api/qms/quality/ncr/${selectedNcr.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...extras }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelectedNcr(updated);
      setNcrs((prev) => prev.map((n) => n.id === updated.id ? updated : n));
    } else {
      const err = await res.json();
      alert(err.error ?? "İşlem başarısız");
    }
    setTransitioning(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getToken();
    const res = await fetch("/api/qms/quality/ncr", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ source: "manual", supplier_id: "", severity: "minor", description: "", category: "quality" });
      await loadData();
    }
  };

  const supplierName = (id: string) =>
    suppliers.find((s) => s.id === id)?.display_name ?? id;

  const stateIndex = (state: NcrState) => STATE_STEPS.indexOf(state);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ height: "calc(100vh - 64px)" }}>
      {/* Left panel */}
      <div className="w-[380px] flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h1 className="font-bold text-gray-900 text-sm">Uygunsuzluklar (NCR)</h1>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Yeni NCR
            </button>
          </div>
          <input
            type="text"
            placeholder="NCR numarası veya açıklama ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <div className="flex gap-2 mt-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Tüm Önem</option>
              <option value="minor">Minör</option>
              <option value="major">Major</option>
              <option value="critical">Kritik</option>
            </select>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Tüm Durumlar</option>
              {STATE_STEPS.map((s) => (
                <option key={s} value={s}>{NCR_STATE_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {ncrs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400 italic">
              NCR bulunamadı
            </div>
          ) : (
            ncrs.map((ncr, i) => (
              <button
                key={ncr.id}
                onClick={() => { setSelectedNcr(ncr); setSelectedDisposition(""); }}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selectedNcr?.id === ncr.id ? "bg-red-50 border-l-2 border-red-500" : ""
                }`}
                style={{ animation: `rowIn 0.2s ease ${i * 0.02}s both` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-gray-900">{ncr.ncr_number}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SEVERITY_COLOR[ncr.severity]}`}>
                    {SEVERITY_LABEL[ncr.severity]}
                  </span>
                </div>
                <div className="text-xs text-gray-500 line-clamp-1">{ncr.description}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">{supplierName(ncr.supplier_id)}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${NCR_STATE_COLOR[ncr.state]}`}>
                    {NCR_STATE_LABEL[ncr.state]}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right detail */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {selectedNcr ? (
          <div className="p-6 space-y-5 max-w-2xl">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-xl font-bold text-gray-900">{selectedNcr.ncr_number}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${SEVERITY_COLOR[selectedNcr.severity]}`}>
                    {SEVERITY_LABEL[selectedNcr.severity]}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${NCR_STATE_COLOR[selectedNcr.state]}`}>
                    {NCR_STATE_LABEL[selectedNcr.state]}
                  </span>
                </div>
              </div>
              {selectedNcr.state !== "closed" && selectedNcr.state !== "rejected" && (
                <button
                  onClick={() => transition("reject")}
                  disabled={transitioning}
                  className="px-3 py-1.5 border border-red-300 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Reddet
                </button>
              )}
            </div>

            {/* State progress bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center">
                {STATE_STEPS.map((step, i) => {
                  const idx = stateIndex(selectedNcr.state);
                  const isDone = i < idx;
                  const isActive = i === idx;
                  const stepColor = isDone ? "#059669" : isActive ? "#DC2626" : "#E5E7EB";
                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ background: stepColor }}
                        >
                          {isDone ? "✓" : i + 1}
                        </div>
                        <span className="text-[9px] text-gray-500 mt-1 text-center w-16 leading-tight">
                          {NCR_STATE_LABEL[step]}
                        </span>
                      </div>
                      {i < STATE_STEPS.length - 1 && (
                        <div className="flex-1 h-0.5 mb-4" style={{ background: isDone ? "#059669" : "#E5E7EB" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">NCR Bilgileri</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  ["Kaynak", selectedNcr.source],
                  ["Tedarikçi", supplierName(selectedNcr.supplier_id)],
                  ["Kategori", selectedNcr.category],
                  ["Oluşturulma", formatDate(selectedNcr.created_at)],
                  ["Sorumlu", selectedNcr.assignee_id ?? "—"],
                  ["Elden Çıkarma", selectedNcr.disposition ? DISPOSITION_LABEL[selectedNcr.disposition] : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="px-5 py-2.5 flex justify-between">
                    <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</span>
                    <span className="text-sm text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Açıklama</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{selectedNcr.description}</p>
            </div>

            {/* Action buttons */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Aksiyonlar</h3>

              {selectedNcr.state === "open" && (
                <button
                  onClick={() => transition("investigate")}
                  disabled={transitioning}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {transitioning ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Araştırmaya Başla"}
                </button>
              )}

              {selectedNcr.state === "investigating" && (
                <div className="space-y-3">
                  <select
                    value={selectedDisposition}
                    onChange={(e) => setSelectedDisposition(e.target.value as NcrDisposition)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Elden çıkarma kararı seçin...</option>
                    {(Object.keys(DISPOSITION_LABEL) as NcrDisposition[]).map((d) => (
                      <option key={d} value={d}>{DISPOSITION_LABEL[d]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => selectedDisposition && transition("set_disposition", { disposition: selectedDisposition })}
                    disabled={!selectedDisposition || transitioning}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {transitioning ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Elden Çıkarma Ayarla"}
                  </button>
                </div>
              )}

              {selectedNcr.state === "disposition_pending" && (
                <button
                  onClick={() => transition("approve_disposition")}
                  disabled={transitioning}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {transitioning ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Elden Çıkarmayı Onayla"}
                </button>
              )}

              {selectedNcr.state === "disposition_approved" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">CAPA ID girin veya CAPA sayfasından bağlayın:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="CAPA UUID..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      id="capa-id-input"
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById("capa-id-input") as HTMLInputElement;
                        if (input?.value) transition("link_capa", { capaId: input.value });
                      }}
                      disabled={transitioning}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <>CAPA Bağla <ChevronRight className="w-3.5 h-3.5" /></>}
                    </button>
                  </div>
                </div>
              )}

              {selectedNcr.state === "capa_linked" && (
                <button
                  onClick={() => transition("close")}
                  disabled={transitioning}
                  className="w-full py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {transitioning ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "NCR'ı Kapat"}
                </button>
              )}

              {(selectedNcr.state === "closed" || selectedNcr.state === "rejected") && (
                <p className="text-sm text-gray-500 text-center italic">
                  Bu NCR {NCR_STATE_LABEL[selectedNcr.state].toLowerCase()}.
                </p>
              )}
            </div>

            {/* Cost recovery */}
            {(selectedNcr.cost_recovery_amount || selectedNcr.state !== "open") && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">Maliyet Geri Kazanımı</h3>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold block mb-1">Tutar</label>
                    <div className="text-sm text-gray-900 font-semibold">
                      {selectedNcr.cost_recovery_amount
                        ? `${selectedNcr.cost_recovery_amount} ${selectedNcr.cost_recovery_currency}`
                        : "—"}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold block mb-1">Durum</label>
                    <div className="text-sm text-gray-700">{selectedNcr.cost_recovery_status}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <AlertTriangle className="w-16 h-16 text-gray-200 mb-4" />
            <h3 className="text-gray-500 font-medium">Bir NCR seçin</h3>
            <p className="text-sm text-gray-400 mt-1">Sol listeden bir uygunsuzluk raporu seçin</p>
          </div>
        )}
      </div>

      {/* New NCR form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="w-[440px] bg-white shadow-2xl flex flex-col" style={{ animation: "slideRight 0.2s ease" }}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Yeni NCR Oluştur</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Tedarikçi *</label>
                <select
                  required
                  value={form.supplier_id}
                  onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçin...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Kaynak *</label>
                <select
                  required
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as NcrSource }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="manual">Manuel</option>
                  <option value="coa_auto">COA Otomatik</option>
                  <option value="incoming_inspection">Gelen Kontrol</option>
                  <option value="audit">Denetim</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Önem Derecesi *</label>
                <select
                  required
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as "minor" | "major" | "critical" }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="minor">Minör</option>
                  <option value="major">Major</option>
                  <option value="critical">Kritik</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Açıklama *</label>
                <textarea
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </form>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes rowIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideRight { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}
