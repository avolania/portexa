"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, ArrowUp, ArrowDown,
  AlertCircle, Loader2, Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  InnovationStage, EvaluationCriterion,
  CreateStageDto, UpdateStageDto,
  CreateCriterionDto, UpdateCriterionDto,
} from "@/lib/innovation/types";

type Tab = "stages" | "criteria";

function apiCall(url: string, method: string, token: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export default function InnovationSettings() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<Tab>("stages");
  const [loading, setLoading] = useState(true);

  // Stages state
  const [stages, setStages] = useState<InnovationStage[]>([]);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageForm, setEditStageForm] = useState<UpdateStageDto>({});
  const [showNewStage, setShowNewStage] = useState(false);
  const [newStageForm, setNewStageForm] = useState<CreateStageDto>({
    name: "", color: "#6B7280", min_score_to_advance: 0, required_evaluations: 0,
  });
  const [stageSaving, setStageSaving] = useState(false);
  const [stageError, setStageError] = useState("");

  // Criteria state
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null);
  const [editCriterionForm, setEditCriterionForm] = useState<UpdateCriterionDto>({});
  const [showNewCriterion, setShowNewCriterion] = useState(false);
  const [newCriterionForm, setNewCriterionForm] = useState<CreateCriterionDto>({
    name: "", description: "", weight: 0.25, max_score: 10,
  });
  const [criterionSaving, setCriterionSaving] = useState(false);
  const [criterionError, setCriterionError] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); router.push("/giris"); return; }
        setToken(session.access_token);

        const statsRes = await fetch("/api/innovation/stats", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!statsRes.ok) { setLoading(false); router.push("/innovation"); return; }
        const stats = await statsRes.json();
        if (stats.user_role !== "innovation_admin") { setLoading(false); router.push("/innovation"); return; }

        const [stagesRes, criteriaRes] = await Promise.all([
          fetch("/api/innovation/stages?all=1", { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch("/api/innovation/criteria", { headers: { Authorization: `Bearer ${session.access_token}` } }),
        ]);
        if (stagesRes.ok) setStages(await stagesRes.json());
        if (criteriaRes.ok) setCriteria(await criteriaRes.json());
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  // ── Stage handlers ────────────────────────────────────────────────────────

  const handleCreateStage = useCallback(async () => {
    if (!newStageForm.name.trim()) { setStageError("İsim zorunlu"); return; }
    setStageSaving(true); setStageError("");
    const res = await apiCall("/api/innovation/stages", "POST", token, newStageForm);
    if (res.ok) {
      const created: InnovationStage = await res.json();
      setStages((prev) => [...prev, created]);
      setShowNewStage(false);
      setNewStageForm({ name: "", color: "#6B7280", min_score_to_advance: 0, required_evaluations: 0 });
    } else {
      const err = await res.json();
      setStageError(err.error ?? "Hata");
    }
    setStageSaving(false);
  }, [token, newStageForm]);

  const handleSaveStage = useCallback(async (id: string) => {
    setStageSaving(true); setStageError("");
    const res = await apiCall(`/api/innovation/stages/${id}`, "PATCH", token, editStageForm);
    if (res.ok) {
      const updated: InnovationStage = await res.json();
      setStages((prev) => prev.map((s) => s.id === id ? updated : s));
      setEditingStageId(null);
    } else {
      const err = await res.json();
      setStageError(err.error ?? "Hata");
    }
    setStageSaving(false);
  }, [token, editStageForm]);

  const handleDeleteStage = useCallback(async (id: string) => {
    if (!confirm("Bu aşamayı silmek istediğinize emin misiniz?")) return;
    const res = await apiCall(`/api/innovation/stages/${id}`, "DELETE", token);
    if (res.ok) {
      setStages((prev) => prev.filter((s) => s.id !== id));
    } else {
      const err = await res.json();
      setStageError(err.error ?? "Hata");
    }
  }, [token]);

  const handleToggleStageActive = useCallback(async (stage: InnovationStage) => {
    const res = await apiCall(`/api/innovation/stages/${stage.id}`, "PATCH", token, { is_active: !stage.is_active });
    if (res.ok) {
      const updated: InnovationStage = await res.json();
      setStages((prev) => prev.map((s) => s.id === stage.id ? updated : s));
    }
  }, [token]);

  const handleReorderStage = useCallback(async (idx: number, dir: -1 | 1) => {
    const other = idx + dir;
    if (other < 0 || other >= stages.length) return;
    const a = stages[idx];
    const b = stages[other];
    await Promise.all([
      apiCall(`/api/innovation/stages/${a.id}`, "PATCH", token, { order_index: b.order_index }),
      apiCall(`/api/innovation/stages/${b.id}`, "PATCH", token, { order_index: a.order_index }),
    ]);
    setStages((prev) => {
      const next = [...prev];
      next[idx] = { ...a, order_index: b.order_index };
      next[other] = { ...b, order_index: a.order_index };
      return next.sort((x, y) => x.order_index - y.order_index);
    });
  }, [token, stages]);

  // ── Criterion handlers ────────────────────────────────────────────────────

  const handleCreateCriterion = useCallback(async () => {
    if (!newCriterionForm.name.trim()) { setCriterionError("İsim zorunlu"); return; }
    setCriterionSaving(true); setCriterionError("");
    const res = await apiCall("/api/innovation/criteria", "POST", token, newCriterionForm);
    if (res.ok) {
      const created: EvaluationCriterion = await res.json();
      setCriteria((prev) => [...prev, created]);
      setShowNewCriterion(false);
      setNewCriterionForm({ name: "", description: "", weight: 0.25, max_score: 10 });
    } else {
      const err = await res.json();
      setCriterionError(err.error ?? "Hata");
    }
    setCriterionSaving(false);
  }, [token, newCriterionForm]);

  const handleSaveCriterion = useCallback(async (id: string) => {
    setCriterionSaving(true); setCriterionError("");
    const res = await apiCall(`/api/innovation/criteria/${id}`, "PATCH", token, editCriterionForm);
    if (res.ok) {
      const updated: EvaluationCriterion = await res.json();
      setCriteria((prev) => prev.map((c) => c.id === id ? updated : c));
      setEditingCriterionId(null);
    } else {
      const err = await res.json();
      setCriterionError(err.error ?? "Hata");
    }
    setCriterionSaving(false);
  }, [token, editCriterionForm]);

  const handleDeleteCriterion = useCallback(async (id: string) => {
    if (!confirm("Bu kriteri silmek istediğinize emin misiniz?")) return;
    const res = await apiCall(`/api/innovation/criteria/${id}`, "DELETE", token);
    if (res.ok) {
      setCriteria((prev) => prev.filter((c) => c.id !== id));
    } else {
      const err = await res.json();
      setCriterionError(err.error ?? "Hata");
    }
  }, [token]);

  const handleToggleCriterionActive = useCallback(async (criterion: EvaluationCriterion) => {
    const res = await apiCall(`/api/innovation/criteria/${criterion.id}`, "PATCH", token, { is_active: !criterion.is_active });
    if (res.ok) {
      const updated: EvaluationCriterion = await res.json();
      setCriteria((prev) => prev.map((c) => c.id === criterion.id ? updated : c));
    }
  }, [token]);

  const handleReorderCriterion = useCallback(async (idx: number, dir: -1 | 1) => {
    const other = idx + dir;
    if (other < 0 || other >= criteria.length) return;
    const a = criteria[idx];
    const b = criteria[other];
    await Promise.all([
      apiCall(`/api/innovation/criteria/${a.id}`, "PATCH", token, { order_index: b.order_index }),
      apiCall(`/api/innovation/criteria/${b.id}`, "PATCH", token, { order_index: a.order_index }),
    ]);
    setCriteria((prev) => {
      const next = [...prev];
      next[idx] = { ...a, order_index: b.order_index };
      next[other] = { ...b, order_index: a.order_index };
      return next.sort((x, y) => x.order_index - y.order_index);
    });
  }, [token, criteria]);

  const totalWeight = criteria.filter((c) => c.is_active).reduce((sum, c) => sum + c.weight, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">İnovasyon Ayarları</h1>
        <p className="text-sm text-gray-500 mt-0.5">Aşama ve değerlendirme kriteri yönetimi</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["stages", "criteria"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setStageError(""); setCriterionError(""); }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "stages" ? "Aşamalar" : "Değerlendirme Kriterleri"}
          </button>
        ))}
      </div>

      {/* ── Stages Tab ──────────────────────────────────────────────────────── */}
      {tab === "stages" && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Aşamalar</h2>
            <button
              onClick={() => setShowNewStage((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Yeni Aşama
            </button>
          </div>

          {stageError && (
            <div className="mx-4 mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {stageError}
              <button onClick={() => setStageError("")} className="ml-auto text-xs">✕</button>
            </div>
          )}

          {showNewStage && (
            <div className="p-4 border-b border-blue-100 bg-blue-50">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">İsim *</label>
                  <input
                    value={newStageForm.name}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                    placeholder="Aşama ismi"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Renk</label>
                  <input
                    type="color"
                    value={newStageForm.color}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, color: e.target.value }))}
                    className="mt-1 w-full h-9 border border-gray-200 rounded-lg px-1 py-1 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Skor</label>
                  <input
                    type="number" min={0} max={100}
                    value={newStageForm.min_score_to_advance}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, min_score_to_advance: Number(e.target.value) }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zorunlu Değerlendirme</label>
                  <input
                    type="number" min={0} max={10}
                    value={newStageForm.required_evaluations}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, required_evaluations: Number(e.target.value) }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleCreateStage}
                  disabled={stageSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {stageSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Kaydet
                </button>
                <button onClick={() => { setShowNewStage(false); setNewStageForm({ name: "", color: "#6B7280", min_score_to_advance: 0, required_evaluations: 0 }); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  İptal
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {stages.map((stage, idx) => (
              <div key={stage.id} className={`p-4 ${!stage.is_active ? "opacity-50" : ""}`}>
                {editingStageId === stage.id ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">İsim</label>
                      <input
                        value={editStageForm.name ?? stage.name}
                        onChange={(e) => setEditStageForm((f) => ({ ...f, name: e.target.value }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Renk</label>
                      <input
                        type="color"
                        value={editStageForm.color ?? stage.color}
                        onChange={(e) => setEditStageForm((f) => ({ ...f, color: e.target.value }))}
                        className="mt-1 w-full h-9 border border-gray-200 rounded-lg px-1 py-1 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Skor</label>
                      <input
                        type="number" min={0} max={100}
                        value={editStageForm.min_score_to_advance ?? stage.min_score_to_advance}
                        onChange={(e) => setEditStageForm((f) => ({ ...f, min_score_to_advance: Number(e.target.value) }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zorunlu Değerlendirme</label>
                      <input
                        type="number" min={0} max={10}
                        value={editStageForm.required_evaluations ?? stage.required_evaluations}
                        onChange={(e) => setEditStageForm((f) => ({ ...f, required_evaluations: Number(e.target.value) }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="col-span-2 flex gap-2 mt-1">
                      <button
                        onClick={() => handleSaveStage(stage.id)}
                        disabled={stageSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {stageSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Kaydet
                      </button>
                      <button onClick={() => setEditingStageId(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                    <span className="text-xs font-mono text-gray-400 w-5">{stage.order_index}</span>
                    <span className="flex-1 text-sm font-semibold text-gray-800">{stage.name}</span>
                    <span className="text-xs text-gray-500 hidden md:block">Min: {stage.min_score_to_advance}</span>
                    <span className="text-xs text-gray-500 hidden md:block">Değ: {stage.required_evaluations}</span>
                    <button
                      onClick={() => handleToggleStageActive(stage)}
                      className={`text-xs px-2 py-0.5 rounded font-semibold transition-colors ${
                        stage.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {stage.is_active ? "Aktif" : "Pasif"}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleReorderStage(idx, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleReorderStage(idx, 1)} disabled={idx === stages.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditingStageId(stage.id); setEditStageForm({}); }} className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteStage(stage.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {stages.length === 0 && (
              <p className="p-6 text-sm text-gray-400 italic text-center">Henüz aşama yok.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Criteria Tab ─────────────────────────────────────────────────────── */}
      {tab === "criteria" && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Değerlendirme Kriterleri</h2>
              {Math.abs(totalWeight - 1) > 0.01 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  ⚠ Σ ağırlık = %{Math.round(totalWeight * 100)} — toplamın %100 olması önerilir
                </p>
              )}
            </div>
            <button
              onClick={() => setShowNewCriterion((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Yeni Kriter
            </button>
          </div>

          {criterionError && (
            <div className="mx-4 mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {criterionError}
              <button onClick={() => setCriterionError("")} className="ml-auto text-xs">✕</button>
            </div>
          )}

          {showNewCriterion && (
            <div className="p-4 border-b border-blue-100 bg-blue-50">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">İsim *</label>
                  <input
                    value={newCriterionForm.name}
                    onChange={(e) => setNewCriterionForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                    placeholder="Kriter ismi"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Açıklama</label>
                  <input
                    value={newCriterionForm.description ?? ""}
                    onChange={(e) => setNewCriterionForm((f) => ({ ...f, description: e.target.value }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                    placeholder="Opsiyonel"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ağırlık (%)</label>
                  <input
                    type="number" min={1} max={100}
                    value={Math.round(newCriterionForm.weight * 100)}
                    onChange={(e) => setNewCriterionForm((f) => ({ ...f, weight: Number(e.target.value) / 100 }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Skor</label>
                  <input
                    type="number" min={1} max={100}
                    value={newCriterionForm.max_score}
                    onChange={(e) => setNewCriterionForm((f) => ({ ...f, max_score: Number(e.target.value) }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleCreateCriterion}
                  disabled={criterionSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {criterionSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Kaydet
                </button>
                <button onClick={() => { setShowNewCriterion(false); setNewCriterionForm({ name: "", description: "", weight: 0.25, max_score: 10 }); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  İptal
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {criteria.map((criterion, idx) => (
              <div key={criterion.id} className={`p-4 ${!criterion.is_active ? "opacity-50" : ""}`}>
                {editingCriterionId === criterion.id ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">İsim</label>
                      <input
                        value={editCriterionForm.name ?? criterion.name}
                        onChange={(e) => setEditCriterionForm((f) => ({ ...f, name: e.target.value }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Açıklama</label>
                      <input
                        value={editCriterionForm.description ?? criterion.description ?? ""}
                        onChange={(e) => setEditCriterionForm((f) => ({ ...f, description: e.target.value }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ağırlık (%)</label>
                      <input
                        type="number" min={1} max={100}
                        value={Math.round((editCriterionForm.weight ?? criterion.weight) * 100)}
                        onChange={(e) => setEditCriterionForm((f) => ({ ...f, weight: Number(e.target.value) / 100 }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Skor</label>
                      <input
                        type="number" min={1} max={100}
                        value={editCriterionForm.max_score ?? criterion.max_score}
                        onChange={(e) => setEditCriterionForm((f) => ({ ...f, max_score: Number(e.target.value) }))}
                        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="col-span-2 flex gap-2 mt-1">
                      <button
                        onClick={() => handleSaveCriterion(criterion.id)}
                        disabled={criterionSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {criterionSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Kaydet
                      </button>
                      <button onClick={() => setEditingCriterionId(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-semibold text-gray-800">{criterion.name}</span>
                    {criterion.description && (
                      <span className="text-xs text-gray-400 truncate max-w-[160px] hidden md:block">{criterion.description}</span>
                    )}
                    <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      %{Math.round(criterion.weight * 100)}
                    </span>
                    <span className="text-xs text-gray-500">Max: {criterion.max_score}</span>
                    <button
                      onClick={() => handleToggleCriterionActive(criterion)}
                      className={`text-xs px-2 py-0.5 rounded font-semibold transition-colors ${
                        criterion.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {criterion.is_active ? "Aktif" : "Pasif"}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleReorderCriterion(idx, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleReorderCriterion(idx, 1)} disabled={idx === criteria.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditingCriterionId(criterion.id); setEditCriterionForm({}); }} className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteCriterion(criterion.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {criteria.length === 0 && (
              <p className="p-6 text-sm text-gray-400 italic text-center">Henüz kriter yok.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
