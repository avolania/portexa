"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, BarChart2, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Scorecard, Supplier } from "@/lib/qms/types";

const RATING_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  B: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  C: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  D: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

function generatePeriodOptions(): string[] {
  const options: string[] = [];
  const now = new Date();
  let year = now.getFullYear();
  let q = Math.ceil((now.getMonth() + 1) / 3);

  for (let i = 0; i < 5; i++) {
    options.push(`${year}-Q${q}`);
    q--;
    if (q === 0) {
      q = 4;
      year--;
    }
  }
  return options;
}

function formatPct(val: number | null): string {
  if (val === null) return "—";
  return `${val.toFixed(1)}%`;
}

export default function SkorkartPage() {
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [period, setPeriod] = useState(getCurrentQuarter());
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Scorecard | null>(null);

  const periodOptions = generatePeriodOptions();

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  };

  const loadData = useCallback(async () => {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };

    const [scorecardsRes, suppliersRes] = await Promise.all([
      fetch(`/api/qms/quality/scorecards?period=${encodeURIComponent(period)}`, { headers }),
      fetch("/api/qms/suppliers", { headers }),
    ]);

    if (scorecardsRes.ok) setScorecards(await scorecardsRes.json());
    if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
    setLoading(false);
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  const computeAll = async () => {
    setComputing(true);
    const token = await getToken();
    const res = await fetch("/api/qms/quality/scorecards", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ period }),
    });
    if (res.ok) {
      await loadData();
    }
    setComputing(false);
  };

  const supplierName = (id: string) =>
    suppliers.find((s) => s.id === id)?.display_name ?? id;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tedarikçi Skorkart</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tedarikçi performans değerlendirmesi</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {periodOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={computeAll}
            disabled={computing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {computing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Skorkart Hesapla
          </button>
        </div>
      </div>

      {/* Cards grid */}
      {scorecards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-xl">
          <BarChart2 className="w-12 h-12 text-gray-200 mb-3" />
          <h3 className="text-gray-500 font-medium">Bu dönem için skorkart yok</h3>
          <p className="text-sm text-gray-400 mt-1">
            &ldquo;Skorkart Hesapla&rdquo; butonuna basarak {period} dönemini hesaplayın
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {scorecards.map((sc, i) => {
            const rating = sc.rating ?? "—";
            const ratingStyle = RATING_COLOR[rating] ?? { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };
            return (
              <div
                key={sc.id}
                className={`bg-white rounded-xl border ${ratingStyle.border} overflow-hidden cursor-pointer hover:shadow-md transition-shadow`}
                onClick={() => setSelectedCard(sc)}
                style={{ animation: `scaleIn 0.3s ease ${i * 0.05}s both` }}
              >
                {/* Card header */}
                <div className={`px-5 py-4 ${ratingStyle.bg} border-b ${ratingStyle.border}`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-900 text-sm truncate">
                        {supplierName(sc.supplier_id)}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">{sc.period}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {sc.trend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
                      {sc.trend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
                      {sc.trend === "flat" && <Minus className="w-4 h-4 text-gray-400" />}
                      <span className={`text-3xl font-black ${ratingStyle.text}`}>{rating}</span>
                    </div>
                  </div>
                </div>

                {/* KPI mini-table */}
                <div className="px-5 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Kalite Kabulü", value: formatPct(sc.quality_acceptance_rate) },
                      { label: "Dok. Uyum", value: formatPct(sc.doc_compliance_pct) },
                      { label: "NCR Sayısı", value: sc.ncr_count.toString() },
                      { label: "NCR / Lot", value: sc.ncr_rate_per_lot !== null ? sc.ncr_rate_per_lot.toFixed(2) : "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
                        <div className="text-sm font-bold text-gray-900 mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-4 pt-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedCard(sc); }}
                    className="w-full py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Detay
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedCard(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ animation: "scaleIn 0.2s ease" }}>
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900">{supplierName(selectedCard.supplier_id)}</h2>
                <div className="flex items-center gap-2">
                  {selectedCard.trend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
                  {selectedCard.trend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
                  {selectedCard.trend === "flat" && <Minus className="w-4 h-4 text-gray-400" />}
                  <span className={`text-4xl font-black ${RATING_COLOR[selectedCard.rating ?? ""]?.text ?? "text-gray-600"}`}>
                    {selectedCard.rating ?? "—"}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">{selectedCard.period}</p>
            </div>
            <div className="px-6 py-5 space-y-3">
              {[
                ["Kalite Kabul Oranı", formatPct(selectedCard.quality_acceptance_rate)],
                ["Doküman Uyum", formatPct(selectedCard.doc_compliance_pct)],
                ["Zamanında Teslimat", formatPct(selectedCard.on_time_delivery_pct)],
                ["NCR Sayısı", selectedCard.ncr_count.toString()],
                ["NCR / Lot Oranı", selectedCard.ncr_rate_per_lot !== null ? selectedCard.ncr_rate_per_lot.toFixed(2) : "—"],
                ["CAPA Zamanında Kapatma", formatPct(selectedCard.capa_closure_on_time_pct)],
                ["Ortalama CAPA Kapanış (gün)", selectedCard.avg_capa_close_days !== null ? selectedCard.avg_capa_close_days.toFixed(1) : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className="text-sm font-semibold text-gray-900">{value}</span>
                </div>
              ))}
              {selectedCard.notes && (
                <div className="pt-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Notlar</p>
                  <p className="text-sm text-gray-700">{selectedCard.notes}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setSelectedCard(null)}
                className="w-full py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
