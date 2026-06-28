"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, PackageSearch, X, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Lot, Supplier, Specification, LotDisposition, COA, CreateLotDto } from "@/lib/qms/types";

const DISPOSITION_LABEL: Record<LotDisposition, string> = {
  pending: "Beklemede",
  accepted: "Kabul Edildi",
  rejected: "Reddedildi",
  on_hold: "Bekletiliyor",
  conditional: "Koşullu",
};

const DISPOSITION_COLOR: Record<LotDisposition, string> = {
  pending: "bg-gray-100 text-gray-600",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  on_hold: "bg-amber-100 text-amber-700",
  conditional: "bg-purple-100 text-purple-700",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}

export default function LotlarPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotCoas, setLotCoas] = useState<COA[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState<string>("");

  const [form, setForm] = useState<Partial<CreateLotDto>>({
    supplier_id: "",
    spec_id: "",
    lot_number: "",
    po_number: "",
    received_date: new Date().toISOString().split("T")[0],
    quantity_value: undefined,
    quantity_unit: "",
    notes: "",
  });

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  };

  const loadData = useCallback(async () => {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };

    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (dispositionFilter) params.set("disposition", dispositionFilter);

    const [lotsRes, suppliersRes, specsRes] = await Promise.all([
      fetch(`/api/qms/quality/lots?${params}`, { headers }),
      fetch("/api/qms/suppliers", { headers }),
      fetch("/api/qms/specifications", { headers }),
    ]);

    if (lotsRes.ok) setLots(await lotsRes.json());
    if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
    if (specsRes.ok) setSpecs(await specsRes.json());
    setLoading(false);
  }, [searchQuery, dispositionFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadLotCoas = async (lotId: string) => {
    const token = await getToken();
    const res = await fetch(`/api/qms/quality/coa?lotId=${lotId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const allCoas: COA[] = await res.json();
      setLotCoas(allCoas.filter((c) => c.lot_id === lotId));
    }
  };

  const selectLot = async (lot: Lot) => {
    setSelectedLot(lot);
    await loadLotCoas(lot.id);
  };

  const handleDispositionChange = async (lotId: string, disposition: LotDisposition) => {
    const token = await getToken();
    await fetch(`/api/qms/quality/lots/${lotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ disposition }),
    });
    await loadData();
    if (selectedLot?.id === lotId) {
      setSelectedLot((prev) => prev ? { ...prev, disposition } : null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const token = await getToken();
    const res = await fetch("/api/qms/quality/lots", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...form,
        spec_id: form.spec_id || undefined,
        quantity_value: form.quantity_value || undefined,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({
        supplier_id: "", spec_id: "", lot_number: "", po_number: "",
        received_date: new Date().toISOString().split("T")[0],
        quantity_value: undefined, quantity_unit: "", notes: "",
      });
      await loadData();
    }
    setSubmitting(false);
  };

  const supplierName = (id: string) =>
    suppliers.find((s) => s.id === id)?.display_name ?? id;
  const specName = (id: string | null) =>
    id ? (specs.find((s) => s.id === id)?.name ?? id) : "—";

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
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PackageSearch className="w-5 h-5 text-blue-600" />
              <h1 className="font-bold text-gray-900 text-sm">Lot / Teslim Alma</h1>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Yeni Lot
            </button>
          </div>
          <input
            type="text"
            placeholder="Lot numarası veya PO ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={dispositionFilter}
            onChange={(e) => setDispositionFilter(e.target.value)}
            className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tüm Durumlar</option>
            {(Object.keys(DISPOSITION_LABEL) as LotDisposition[]).map((d) => (
              <option key={d} value={d}>{DISPOSITION_LABEL[d]}</option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {lots.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400 italic">
              Lot bulunamadı
            </div>
          ) : (
            lots.map((lot, i) => (
              <button
                key={lot.id}
                onClick={() => selectLot(lot)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selectedLot?.id === lot.id ? "bg-blue-50 border-l-2 border-blue-500" : ""
                }`}
                style={{ animation: `rowIn 0.2s ease ${i * 0.02}s both` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-semibold text-gray-900">
                    {lot.lot_number}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${DISPOSITION_COLOR[lot.disposition]}`}>
                    {DISPOSITION_LABEL[lot.disposition]}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{supplierName(lot.supplier_id)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{formatDate(lot.received_date)}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right detail panel */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {selectedLot ? (
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 font-mono">
                  {selectedLot.lot_number}
                </h2>
                <p className="text-sm text-gray-500">{supplierName(selectedLot.supplier_id)}</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedLot.disposition}
                  onChange={(e) =>
                    handleDispositionChange(selectedLot.id, e.target.value as LotDisposition)
                  }
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(Object.keys(DISPOSITION_LABEL) as LotDisposition[]).map((d) => (
                    <option key={d} value={d}>{DISPOSITION_LABEL[d]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Info grid */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Lot Bilgileri</h3>
              </div>
              <div className="grid grid-cols-2 gap-0 divide-y divide-gray-50">
                {[
                  ["PO Numarası", selectedLot.po_number ?? "—"],
                  ["Teslim Tarihi", formatDate(selectedLot.received_date)],
                  ["Spesifikasyon", specName(selectedLot.spec_id)],
                  ["Miktar", selectedLot.quantity_value
                    ? `${selectedLot.quantity_value} ${selectedLot.quantity_unit ?? ""}`
                    : "—"
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="px-5 py-3 flex justify-between">
                    <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</span>
                    <span className="text-sm text-gray-900">{value}</span>
                  </div>
                ))}
                {selectedLot.notes && (
                  <div className="px-5 py-3 col-span-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold block mb-1">Notlar</span>
                    <span className="text-sm text-gray-700">{selectedLot.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Linked COAs */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">Analiz Sertifikaları (COA)</h3>
                <a
                  href={`/qms/kalite/coa?lotId=${selectedLot.id}`}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  COA Ekle <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
              {lotCoas.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-xs text-gray-400 italic">
                  Henüz COA eklenmemiş
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {lotCoas.map((coa) => (
                    <div key={coa.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {coa.file_name ?? "COA Dosyası"}
                        </div>
                        <div className="text-xs text-gray-500">{formatDate(coa.created_at)}</div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        coa.status === "conforming" ? "bg-green-100 text-green-700" :
                        coa.status === "nonconforming" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {coa.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <PackageSearch className="w-16 h-16 text-gray-200 mb-4" />
            <h3 className="text-gray-500 font-medium">Bir lot seçin</h3>
            <p className="text-sm text-gray-400 mt-1">Sol listeden bir lot seçerek detayları görüntüleyin</p>
          </div>
        )}
      </div>

      {/* New Lot slide-over */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="w-[440px] bg-white shadow-2xl flex flex-col" style={{ animation: "slideRight 0.2s ease" }}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Yeni Lot Oluştur</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Tedarikçi *
                </label>
                <select
                  required
                  value={form.supplier_id}
                  onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tedarikçi seçin...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.display_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Spesifikasyon
                </label>
                <select
                  value={form.spec_id}
                  onChange={(e) => setForm((f) => ({ ...f, spec_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seçin (opsiyonel)...</option>
                  {specs
                    .filter((s) => !form.supplier_id || s.supplier_id === form.supplier_id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Lot Numarası *
                </label>
                <input
                  required
                  type="text"
                  value={form.lot_number}
                  onChange={(e) => setForm((f) => ({ ...f, lot_number: e.target.value }))}
                  placeholder="Örn: LOT-2026-001"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  PO Numarası
                </label>
                <input
                  type="text"
                  value={form.po_number}
                  onChange={(e) => setForm((f) => ({ ...f, po_number: e.target.value }))}
                  placeholder="Opsiyonel"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Teslim Tarihi *
                </label>
                <input
                  required
                  type="date"
                  value={form.received_date}
                  onChange={(e) => setForm((f) => ({ ...f, received_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Miktar
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.quantity_value ?? ""}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      quantity_value: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Birim
                  </label>
                  <input
                    type="text"
                    value={form.quantity_unit}
                    onChange={(e) => setForm((f) => ({ ...f, quantity_unit: e.target.value }))}
                    placeholder="kg, ton, adet..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Notlar
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
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
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Oluştur"}
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
