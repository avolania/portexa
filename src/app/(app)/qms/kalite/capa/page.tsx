"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, ListChecks, X, CheckSquare, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CAPA, CAPAAction, NCR, CapaState, CreateCapaDto } from "@/lib/qms/types";

const CAPA_STATE_LABEL: Record<CapaState, string> = {
  draft: "Taslak",
  in_progress: "Devam Ediyor",
  verification: "Doğrulama",
  effectiveness_check: "Etkinlik Kontrolü",
  approved: "Onaylandı",
  closed: "Kapalı",
};

const CAPA_STATE_COLOR: Record<CapaState, string> = {
  draft: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  verification: "bg-amber-100 text-amber-700",
  effectiveness_check: "bg-purple-100 text-purple-700",
  approved: "bg-green-100 text-green-700",
  closed: "bg-gray-200 text-gray-500",
};

const TYPE_LABEL: Record<string, string> = {
  corrective: "Düzeltici",
  preventive: "Önleyici",
  both: "Her İkisi",
};

const TYPE_COLOR: Record<string, string> = {
  corrective: "bg-red-100 text-red-700",
  preventive: "bg-blue-100 text-blue-700",
  both: "bg-purple-100 text-purple-700",
};

const METHOD_LABEL: Record<string, string> = {
  "5why": "5-Neden",
  fishbone: "Balık Kılçığı",
  "8d": "8D",
};

const ACTION_STATUS_LABEL: Record<string, string> = {
  open: "Açık",
  done: "Tamamlandı",
  verified: "Doğrulandı",
};

const ACTION_STATUS_COLOR: Record<string, string> = {
  open: "bg-gray-100 text-gray-600",
  done: "bg-blue-100 text-blue-700",
  verified: "bg-green-100 text-green-700",
};

const STATE_STEPS: CapaState[] = [
  "draft", "in_progress", "verification", "effectiveness_check", "approved", "closed",
];

const TRANSITION_ACTIONS: Record<CapaState, { action: string; label: string; color: string } | null> = {
  draft: { action: "start", label: "Başlat", color: "bg-blue-600 hover:bg-blue-700" },
  in_progress: { action: "submit_verification", label: "Doğrulamaya Gönder", color: "bg-amber-600 hover:bg-amber-700" },
  verification: { action: "submit_effectiveness", label: "Etkinlik Kontrolüne Gönder", color: "bg-purple-600 hover:bg-purple-700" },
  effectiveness_check: { action: "approve", label: "Onayla", color: "bg-green-600 hover:bg-green-700" },
  approved: { action: "close", label: "Kapat", color: "bg-gray-700 hover:bg-gray-800" },
  closed: null,
};

interface CapaWithActions extends CAPA {
  actions?: CAPAAction[];
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}

export default function CapaPage() {
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [ncrs, setNcrs] = useState<NCR[]>([]);
  const [selectedCapa, setSelectedCapa] = useState<CapaWithActions | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [savingRoot, setSavingRoot] = useState(false);
  const [newAction, setNewAction] = useState({ description: "", owner_id: "", due_date: "" });
  const [addingAction, setAddingAction] = useState(false);
  const [form, setForm] = useState<Partial<CreateCapaDto>>({
    type: "corrective",
    owner_id: "",
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  });

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  };

  const loadData = useCallback(async () => {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };
    const params = new URLSearchParams();
    if (stateFilter) params.set("state", stateFilter);

    const [capasRes, ncrsRes] = await Promise.all([
      fetch(`/api/qms/quality/capa?${params}`, { headers }),
      fetch("/api/qms/quality/ncr", { headers }),
    ]);

    if (capasRes.ok) {
      const data: CAPA[] = await capasRes.json();
      setCapas(typeFilter ? data.filter((c) => c.type === typeFilter) : data);
    }
    if (ncrsRes.ok) setNcrs(await ncrsRes.json());
    setLoading(false);
  }, [stateFilter, typeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectCapa = async (capa: CAPA) => {
    const token = await getToken();
    const res = await fetch(`/api/qms/quality/capa/${capa.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSelectedCapa(await res.json());
    } else {
      setSelectedCapa(capa);
    }
  };

  const transition = async (action: string) => {
    if (!selectedCapa) return;
    setTransitioning(true);
    const token = await getToken();
    const res = await fetch(`/api/qms/quality/capa/${selectedCapa.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelectedCapa((prev) => ({ ...prev!, ...updated }));
      setCapas((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    } else {
      const err = await res.json();
      alert(err.error ?? "İşlem başarısız");
    }
    setTransitioning(false);
  };

  const saveRootCause = async () => {
    if (!selectedCapa) return;
    setSavingRoot(true);
    const token = await getToken();
    await fetch(`/api/qms/quality/capa/${selectedCapa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        root_cause: selectedCapa.root_cause,
        root_cause_method: selectedCapa.root_cause_method,
      }),
    });
    setSavingRoot(false);
  };

  const addAction = async () => {
    if (!selectedCapa || !newAction.description || !newAction.owner_id || !newAction.due_date) return;
    setAddingAction(true);
    const token = await getToken();
    const res = await fetch(`/api/qms/quality/capa/${selectedCapa.id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(newAction),
    });
    if (res.ok) {
      const action = await res.json();
      setSelectedCapa((prev) => prev ? { ...prev, actions: [...(prev.actions ?? []), action] } : null);
      setNewAction({ description: "", owner_id: "", due_date: "" });
    }
    setAddingAction(false);
  };

  const updateActionStatus = async (actionId: string, status: "open" | "done" | "verified") => {
    if (!selectedCapa) return;
    const token = await getToken();
    const res = await fetch(`/api/qms/quality/capa/${selectedCapa.id}/actions/${actionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelectedCapa((prev) => prev ? {
        ...prev,
        actions: (prev.actions ?? []).map((a) => a.id === actionId ? updated : a),
      } : null);
    }
  };

  const deleteAction = async (actionId: string) => {
    if (!selectedCapa) return;
    const token = await getToken();
    await fetch(`/api/qms/quality/capa/${selectedCapa.id}/actions/${actionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSelectedCapa((prev) => prev ? {
      ...prev,
      actions: (prev.actions ?? []).filter((a) => a.id !== actionId),
    } : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getToken();
    const res = await fetch("/api/qms/quality/capa", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ type: "corrective", owner_id: "", due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] });
      await loadData();
    }
  };

  const linkedNcr = (ncr_id: string | null) =>
    ncrs.find((n) => n.id === ncr_id);

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
              <ListChecks className="w-5 h-5 text-indigo-600" />
              <h1 className="font-bold text-gray-900 text-sm">CAPA</h1>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Yeni CAPA
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tüm Tipler</option>
              <option value="corrective">Düzeltici</option>
              <option value="preventive">Önleyici</option>
              <option value="both">Her İkisi</option>
            </select>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tüm Durumlar</option>
              {STATE_STEPS.map((s) => (
                <option key={s} value={s}>{CAPA_STATE_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {capas.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400 italic">
              CAPA bulunamadı
            </div>
          ) : (
            capas.map((capa, i) => {
              const ncr = linkedNcr(capa.ncr_id);
              return (
                <button
                  key={capa.id}
                  onClick={() => selectCapa(capa)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedCapa?.id === capa.id ? "bg-indigo-50 border-l-2 border-indigo-500" : ""
                  }`}
                  style={{ animation: `rowIn 0.2s ease ${i * 0.02}s both` }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-gray-900">{capa.capa_number}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLOR[capa.type]}`}>
                      {TYPE_LABEL[capa.type]}
                    </span>
                  </div>
                  {ncr && (
                    <div className="text-xs text-gray-500 font-mono">{ncr.ncr_number}</div>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">{formatDate(capa.due_date)}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CAPA_STATE_COLOR[capa.state]}`}>
                      {CAPA_STATE_LABEL[capa.state]}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right detail */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {selectedCapa ? (
          <div className="p-6 space-y-5 max-w-2xl">
            {/* Header */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-bold text-gray-900">{selectedCapa.capa_number}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${CAPA_STATE_COLOR[selectedCapa.state]}`}>
                {CAPA_STATE_LABEL[selectedCapa.state]}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TYPE_COLOR[selectedCapa.type]}`}>
                {TYPE_LABEL[selectedCapa.type]}
              </span>
            </div>

            {/* State progress */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center">
                {STATE_STEPS.map((step, i) => {
                  const idx = STATE_STEPS.indexOf(selectedCapa.state);
                  const isDone = i < idx;
                  const isActive = i === idx;
                  const stepColor = isDone ? "#059669" : isActive ? "#6366F1" : "#E5E7EB";
                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ background: stepColor }}
                        >
                          {isDone ? "✓" : i + 1}
                        </div>
                        <span className="text-[9px] text-gray-500 mt-1 text-center w-14 leading-tight">
                          {CAPA_STATE_LABEL[step]}
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
                <h3 className="font-semibold text-gray-900 text-sm">CAPA Bilgileri</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  ["Bağlı NCR", selectedCapa.ncr_id ? (linkedNcr(selectedCapa.ncr_id)?.ncr_number ?? selectedCapa.ncr_id.slice(0, 8)) : "—"],
                  ["Sorumlu", selectedCapa.owner_id],
                  ["Son Tarih", formatDate(selectedCapa.due_date)],
                  ["Oluşturulma", formatDate(selectedCapa.created_at)],
                  ["Onaylayan", selectedCapa.approved_by ?? "—"],
                  ["Onay Tarihi", formatDate(selectedCapa.approved_at)],
                ].map(([label, value]) => (
                  <div key={label} className="px-5 py-2.5 flex justify-between">
                    <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</span>
                    <span className="text-sm text-gray-900 font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Root cause */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Kök Neden Analizi</h3>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Metot</label>
                <select
                  value={selectedCapa.root_cause_method ?? ""}
                  onChange={(e) => setSelectedCapa((prev) => prev ? {
                    ...prev,
                    root_cause_method: (e.target.value || null) as CAPA["root_cause_method"],
                  } : null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seçin (opsiyonel)...</option>
                  {Object.entries(METHOD_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Kök Neden</label>
                <textarea
                  rows={4}
                  value={selectedCapa.root_cause ?? ""}
                  onChange={(e) => setSelectedCapa((prev) => prev ? { ...prev, root_cause: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={saveRootCause}
                disabled={savingRoot}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {savingRoot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Kaydet"}
              </button>
            </div>

            {/* Transition button */}
            {TRANSITION_ACTIONS[selectedCapa.state] && (
              <button
                onClick={() => {
                  const t = TRANSITION_ACTIONS[selectedCapa.state];
                  if (t) transition(t.action);
                }}
                disabled={transitioning}
                className={`w-full py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${TRANSITION_ACTIONS[selectedCapa.state]!.color}`}
              >
                {transitioning ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  TRANSITION_ACTIONS[selectedCapa.state]!.label
                )}
              </button>
            )}

            {/* Actions table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Aksiyon Planı</h3>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Aksiyon</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Sorumlu</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Son Tarih</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(selectedCapa.actions ?? []).map((action) => (
                    <tr key={action.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700 max-w-[200px]">{action.description}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-500">{action.owner_id.slice(0, 8)}...</td>
                      <td className="px-4 py-2.5 text-gray-500">{formatDate(action.due_date)}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={action.status}
                          onChange={(e) => updateActionStatus(action.id, e.target.value as "open" | "done" | "verified")}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border-0 cursor-pointer ${ACTION_STATUS_COLOR[action.status]}`}
                        >
                          {Object.entries(ACTION_STATUS_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => deleteAction(action.id)}
                          className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Add action row */}
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        placeholder="Aksiyon açıklaması..."
                        value={newAction.description}
                        onChange={(e) => setNewAction((a) => ({ ...a, description: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        placeholder="Kullanıcı ID..."
                        value={newAction.owner_id}
                        onChange={(e) => setNewAction((a) => ({ ...a, owner_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="date"
                        value={newAction.due_date}
                        onChange={(e) => setNewAction((a) => ({ ...a, due_date: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5">
                      <button
                        onClick={addAction}
                        disabled={addingAction || !newAction.description || !newAction.owner_id || !newAction.due_date}
                        className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {addingAction ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3 h-3" />}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <ListChecks className="w-16 h-16 text-gray-200 mb-4" />
            <h3 className="text-gray-500 font-medium">Bir CAPA seçin</h3>
            <p className="text-sm text-gray-400 mt-1">Sol listeden bir CAPA seçin</p>
          </div>
        )}
      </div>

      {/* New CAPA form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="w-[440px] bg-white shadow-2xl flex flex-col" style={{ animation: "slideRight 0.2s ease" }}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Yeni CAPA Oluştur</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Bağlı NCR</label>
                <select
                  value={form.ncr_id ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, ncr_id: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Opsiyonel...</option>
                  {ncrs.filter((n) => n.state === "disposition_approved").map((n) => (
                    <option key={n.id} value={n.id}>{n.ncr_number} — {n.description.slice(0, 50)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">CAPA Tipi *</label>
                <select
                  required
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CreateCapaDto["type"] }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="corrective">Düzeltici</option>
                  <option value="preventive">Önleyici</option>
                  <option value="both">Her İkisi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Sorumlu (Kullanıcı ID) *</label>
                <input
                  required
                  type="text"
                  value={form.owner_id}
                  onChange={(e) => setForm((f) => ({ ...f, owner_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Son Tarih *</label>
                <input
                  required
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Kök Neden (Opsiyonel)</label>
                <textarea
                  rows={3}
                  value={form.root_cause ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, root_cause: e.target.value }))}
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
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
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
