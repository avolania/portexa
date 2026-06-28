"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2, Upload, Sparkles, CheckCircle2, XCircle, AlertCircle,
  FileText, X, ChevronRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { COA, COAFlag, COAResult, Supplier, Lot } from "@/lib/qms/types";

const COA_STATUS_LABEL: Record<string, string> = {
  submitted: "Gönderildi",
  auto_checked: "Otomatik Kontrol",
  conforming: "Uygun",
  nonconforming: "Uygunsuz",
  manual_review: "Manuel İnceleme",
};

const COA_STATUS_COLOR: Record<string, string> = {
  submitted: "bg-gray-100 text-gray-600",
  auto_checked: "bg-blue-100 text-blue-700",
  conforming: "bg-green-100 text-green-700",
  nonconforming: "bg-red-100 text-red-700",
  manual_review: "bg-amber-100 text-amber-700",
};

const OVERALL_COLOR: Record<string, string> = {
  pass: "text-green-600",
  fail: "text-red-600",
  partial: "text-amber-600",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}

interface ExtractedResult {
  attribute_key: string;
  reported_value: string;
  unit: string | null;
}

interface CoaDetail extends COA {
  results?: COAResult[];
}

export default function CoaPage() {
  const [coas, setCoas] = useState<COA[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedCoa, setSelectedCoa] = useState<CoaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractedResults, setExtractedResults] = useState<ExtractedResult[]>([]);
  const [showExtractPanel, setShowExtractPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  };

  const loadData = useCallback(async () => {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };
    const params = new URLSearchParams();
    if (supplierFilter) params.set("supplierId", supplierFilter);
    if (statusFilter) params.set("status", statusFilter);

    const [coasRes, suppliersRes, lotsRes] = await Promise.all([
      fetch(`/api/qms/quality/coa?${params}`, { headers }),
      fetch("/api/qms/suppliers", { headers }),
      fetch("/api/qms/quality/lots", { headers }),
    ]);

    if (coasRes.ok) setCoas(await coasRes.json());
    if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
    if (lotsRes.ok) setLots(await lotsRes.json());
    setLoading(false);
  }, [supplierFilter, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectCoa = async (coa: COA) => {
    const token = await getToken();
    const res = await fetch(`/api/qms/quality/coa/${coa.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSelectedCoa(await res.json());
    } else {
      setSelectedCoa(coa);
    }
    setExtractedResults([]);
    setShowExtractPanel(false);
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedCoa) return;
    setUploading(true);
    const token = await getToken();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/qms/quality/coa/${selectedCoa.id}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      setSelectedCoa((prev) => prev ? { ...prev, file_ref: data.file_ref, file_name: data.file_name } : null);
    }
    setUploading(false);
  };

  const handleExtract = async () => {
    if (!selectedCoa) return;
    setExtracting(true);
    setShowExtractPanel(true);
    const token = await getToken();
    const res = await fetch(`/api/qms/quality/coa/${selectedCoa.id}/extract`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setExtractedResults(data.extracted ?? []);
    }
    setExtracting(false);
  };

  const handleSaveAndCompare = async () => {
    if (!selectedCoa) return;
    setSaving(true);
    const token = await getToken();
    const res = await fetch(`/api/qms/quality/coa/${selectedCoa.id}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        results: extractedResults.map((r) => ({
          attribute_key: r.attribute_key,
          reported_value: r.reported_value,
          unit: r.unit,
        })),
      }),
    });
    if (res.ok) {
      setShowExtractPanel(false);
      await selectCoa(selectedCoa);
      await loadData();
    }
    setSaving(false);
  };

  const handleCreateNcr = async () => {
    if (!selectedCoa) return;
    const token = await getToken();
    const lot = lots.find((l) => l.id === selectedCoa.lot_id);
    await fetch("/api/qms/quality/ncr", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        source: "coa_auto",
        supplier_id: selectedCoa.supplier_id,
        lot_id: selectedCoa.lot_id,
        coa_id: selectedCoa.id,
        spec_id: selectedCoa.spec_id,
        severity: "minor",
        description: `COA karşılaştırma hatası: ${selectedCoa.comparison_flags.filter((f: COAFlag) => f.result === "fail").length} başarısız parametre. Lot: ${lot?.lot_number ?? ""}`,
      }),
    });
    alert("NCR oluşturuldu. NCR Workbench sayfasından takip edebilirsiniz.");
  };

  const supplierName = (id: string) =>
    suppliers.find((s) => s.id === id)?.display_name ?? id;
  const lotNumber = (id: string) =>
    lots.find((l) => l.id === id)?.lot_number ?? id;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <FileText className="w-5 h-5 text-blue-600" />
        <h1 className="font-bold text-gray-900 text-sm">COA & Karşılaştırma</h1>
        <div className="flex-1" />
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tüm Tedarikçiler</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tüm Durumlar</option>
          {Object.entries(COA_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table + detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Lot No", "Tedarikçi", "Spec", "Durum", "Sonuç", "Bayraklar", "Tarih", "İşlemler"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {coas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400 italic">
                      COA bulunamadı
                    </td>
                  </tr>
                ) : (
                  coas.map((coa, i) => {
                    const flags = (coa.comparison_flags ?? []) as COAFlag[];
                    const failCount = flags.filter((f) => f.result === "fail").length;
                    return (
                      <tr
                        key={coa.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => selectCoa(coa)}
                        style={{ animation: `rowIn 0.2s ease ${i * 0.02}s both` }}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                          {lotNumber(coa.lot_id)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{supplierName(coa.supplier_id)}</td>
                        <td className="px-4 py-3 text-gray-500">{coa.spec_id ? "Bağlı" : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${COA_STATUS_COLOR[coa.status]}`}>
                            {COA_STATUS_LABEL[coa.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {coa.comparison_overall ? (
                            <span className={`font-semibold ${OVERALL_COLOR[coa.comparison_overall]}`}>
                              {coa.comparison_overall.toUpperCase()}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {failCount > 0 ? (
                            <span className="text-red-600 font-semibold">{failCount} hata</span>
                          ) : flags.length > 0 ? (
                            <span className="text-green-600">Tümü geçti</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(coa.created_at)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); selectCoa(coa); }}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            Detay <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail slide-over */}
        {selectedCoa && (
          <div className="w-[480px] bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-sm">COA Detayı</h2>
              <button onClick={() => setSelectedCoa(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${COA_STATUS_COLOR[selectedCoa.status]}`}>
                  {COA_STATUS_LABEL[selectedCoa.status]}
                </span>
                {selectedCoa.comparison_overall && (
                  <span className={`text-sm font-bold ${OVERALL_COLOR[selectedCoa.comparison_overall]}`}>
                    {selectedCoa.comparison_overall === "pass" ? "✓ Uygun" :
                     selectedCoa.comparison_overall === "fail" ? "✗ Uygunsuz" : "⚠ Kısmi"}
                  </span>
                )}
              </div>

              {/* File section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">PDF Dosyası</span>
                </div>
                {selectedCoa.file_name ? (
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">{selectedCoa.file_name}</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-3">Henüz dosya yüklenmemiş</p>
                )}
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    PDF Yükle
                  </button>
                  {selectedCoa.file_ref && (
                    <button
                      onClick={handleExtract}
                      disabled={extracting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      AI ile Çıkar
                    </button>
                  )}
                </div>
              </div>

              {/* AI extraction panel */}
              {showExtractPanel && (
                <div className="border border-purple-200 rounded-lg overflow-hidden">
                  <div className="bg-purple-50 px-4 py-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-700">AI Çıkarım Sonuçları</span>
                    {extracting && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600 ml-auto" />}
                  </div>
                  {!extracting && extractedResults.length > 0 && (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-500">Parametre</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-500">Değer</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-500">Birim</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {extractedResults.map((r, i) => (
                              <tr key={i}>
                                <td className="px-3 py-2">
                                  <input
                                    value={r.attribute_key}
                                    onChange={(e) => {
                                      const upd = [...extractedResults];
                                      upd[i] = { ...upd[i], attribute_key: e.target.value };
                                      setExtractedResults(upd);
                                    }}
                                    className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    value={r.reported_value}
                                    onChange={(e) => {
                                      const upd = [...extractedResults];
                                      upd[i] = { ...upd[i], reported_value: e.target.value };
                                      setExtractedResults(upd);
                                    }}
                                    className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    value={r.unit ?? ""}
                                    onChange={(e) => {
                                      const upd = [...extractedResults];
                                      upd[i] = { ...upd[i], unit: e.target.value || null };
                                      setExtractedResults(upd);
                                    }}
                                    className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-3 bg-gray-50 flex justify-end">
                        <button
                          onClick={handleSaveAndCompare}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Kaydet & Karşılaştır
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Comparison results */}
              {selectedCoa.comparison_flags && selectedCoa.comparison_flags.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-700">Karşılaştırma Sonuçları</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Parametre</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Spec Limiti</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Bildirilen</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Sonuç</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(selectedCoa.comparison_flags as COAFlag[]).map((flag, i) => (
                        <tr key={i} className={flag.result === "fail" ? "bg-red-50" : ""}>
                          <td className="px-3 py-2 font-mono">{flag.attribute_key}</td>
                          <td className="px-3 py-2 text-gray-600">{flag.spec_limit}</td>
                          <td className="px-3 py-2">{flag.reported_value}</td>
                          <td className="px-3 py-2">
                            {flag.result === "pass" ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* NCR button */}
              {selectedCoa.comparison_overall === "fail" && !selectedCoa.generated_ncr_id && (
                <button
                  onClick={handleCreateNcr}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <AlertCircle className="w-4 h-4" />
                  NCR Oluştur
                </button>
              )}

              {selectedCoa.generated_ncr_id && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
                  <AlertCircle className="w-4 h-4" />
                  NCR oluşturuldu. ID: <span className="font-mono font-semibold">{selectedCoa.generated_ncr_id.slice(0, 8)}...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes rowIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
