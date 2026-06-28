"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  AB_ALLERGENS,
  type Specification,
  type SpecChange,
  type SpecType,
  type SpecStatus,
  type AllergenStatus,
  type MicroSpec,
  type AttributeField,
  type UpdateSpecDto,
  type CreateSpecDto,
  type Supplier,
} from "@/lib/qms/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<SpecType, string> = {
  raw_material: "Ham Madde",
  finished_good: "Bitmiş Ürün",
  packaging: "Ambalaj",
};

const STATUS_LABELS: Record<SpecStatus, string> = {
  draft: "Taslak",
  in_review: "İncelemede",
  approved: "Onaylı",
  published: "Yayında",
  superseded: "Yerini Aldı",
  archived: "Arşiv",
};

const STATUS_COLORS: Record<SpecStatus, { bg: string; text: string }> = {
  draft:     { bg: "#F3F4F6", text: "#6B7280" },
  in_review: { bg: "#FEF3C7", text: "#D97706" },
  approved:  { bg: "#D1FAE5", text: "#059669" },
  published: { bg: "#DBEAFE", text: "#2563EB" },
  superseded:{ bg: "#F3E8FF", text: "#7C3AED" },
  archived:  { bg: "#E5E7EB", text: "#374151" },
};

const TYPE_COLORS: Record<SpecType, { bg: string; text: string }> = {
  raw_material:  { bg: "#FEF3C7", text: "#92400E" },
  finished_good: { bg: "#DBEAFE", text: "#1E40AF" },
  packaging:     { bg: "#D1FAE5", text: "#065F46" },
};

const ALLERGEN_LABELS: Record<string, string> = {
  gluten:      "Gluten (Tahıllar)",
  crustaceans: "Kabuklu Deniz Ürünleri",
  eggs:        "Yumurta",
  fish:        "Balık",
  peanuts:     "Yerfıstığı",
  soy:         "Soya",
  milk:        "Süt",
  nuts:        "Sert Kabuklu Meyveler",
  celery:      "Kereviz",
  mustard:     "Hardal",
  sesame:      "Susam",
  sulphites:   "Sülfitler",
  lupin:       "Acı Bakla",
  molluscs:    "Yumuşakçalar",
};

const ALLERGEN_STATUS_LABELS: Record<AllergenStatus, string> = {
  contains:    "İçerir",
  may_contain: "İçerebilir",
  free:        "İçermez",
};

const ALLERGEN_STATUS_COLORS: Record<AllergenStatus, { bg: string; text: string }> = {
  contains:    { bg: "#FEE2E2", text: "#DC2626" },
  may_contain: { bg: "#FEF3C7", text: "#D97706" },
  free:        { bg: "#D1FAE5", text: "#059669" },
};

const COMMON_ORGANISMS = [
  "TPC / Aerobik Bakteri Sayısı",
  "E. coli",
  "Salmonella spp.",
  "Listeria monocytogenes",
  "Maya / Küf",
];

const COMMON_PHYSICO = [
  { key: "ph",       label: "pH",               unit: "" },
  { key: "brix",     label: "Brix",             unit: "°Bx" },
  { key: "moisture", label: "Nem",              unit: "%" },
  { key: "aw",       label: "Su Aktivitesi (Aw)", unit: "" },
  { key: "fat",      label: "Yağ",              unit: "%" },
  { key: "protein",  label: "Protein",          unit: "%" },
];

const COMMON_ORGANOLEPTIC = [
  { key: "appearance", label: "Görünüm" },
  { key: "color",      label: "Renk" },
  { key: "odor",       label: "Koku" },
  { key: "taste",      label: "Tat" },
  { key: "texture",    label: "Doku" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SpesifikasyonlarPage() {
  const [token, setToken] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
  const initialId = searchParams.get("id");

  const [specs, setSpecs] = useState<Specification[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [selectedSpec, setSelectedSpec] = useState<Specification | null>(null);
  const [specChanges, setSpecChanges] = useState<SpecChange[]>([]);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<Specification>>({});
  const [activeTab, setActiveTab] = useState("genel");
  const [saving, setSaving] = useState(false);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newDto, setNewDto] = useState<Partial<CreateSpecDto>>({});
  const [creating, setCreating] = useState(false);

  const [transitioning, setTransitioning] = useState(false);

  // ─── Load specs ─────────────────────────────────────────────────────────────

  const loadSpecs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/qms/specifications?${params}`, { headers });
      if (res.ok) setSpecs(await res.json());
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, search, headers]);

  const loadSuppliers = useCallback(async () => {
    const res = await fetch("/api/qms/suppliers", { headers });
    if (res.ok) setSuppliers(await res.json());
  }, [headers]);

  useEffect(() => { loadSpecs(); }, [loadSpecs]);
  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  // ─── Load single spec ────────────────────────────────────────────────────────

  const loadSpec = useCallback(async (id: string) => {
    const res = await fetch(`/api/qms/specifications/${id}`, { headers });
    if (res.ok) {
      const { spec, changes } = await res.json();
      setSelectedSpec(spec);
      setSpecChanges(changes ?? []);
      setEditMode(false);
      setEditDraft({});
    }
  }, [headers]);

  useEffect(() => {
    if (selectedId) loadSpec(selectedId);
    else { setSelectedSpec(null); setSpecChanges([]); setEditMode(false); }
  }, [selectedId, loadSpec]);

  // ─── Edit helpers ────────────────────────────────────────────────────────────

  function startEdit() {
    if (!selectedSpec) return;
    setEditDraft({ ...selectedSpec });
    setEditMode(true);
  }

  function cancelEdit() {
    setEditDraft({});
    setEditMode(false);
  }

  async function saveEdit() {
    if (!selectedSpec || !editDraft) return;
    setSaving(true);
    try {
      const dto: UpdateSpecDto = {};
      const fields: (keyof UpdateSpecDto)[] = [
        "name", "code", "supplier_id", "co_authored_with_supplier",
        "organoleptic", "physical_chemical", "microbiological", "nutritional",
        "allergens", "shelf_life", "storage_conditions", "labeling_regulatory",
        "linked_finished_good_ids",
      ];
      for (const f of fields) {
        if (f in editDraft) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (dto as any)[f] = (editDraft as any)[f];
        }
      }
      const res = await fetch(`/api/qms/specifications/${selectedSpec.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(dto),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedSpec(updated);
        setSpecs((prev) => prev.map((s) => s.id === updated.id ? updated : s));
        setEditMode(false);
        setEditDraft({});
      } else {
        const { error } = await res.json();
        alert(error ?? "Kayıt hatası");
      }
    } finally {
      setSaving(false);
    }
  }

  // ─── Transition ──────────────────────────────────────────────────────────────

  async function doTransition(action: string) {
    if (!selectedSpec) return;
    setTransitioning(true);
    try {
      const res = await fetch(`/api/qms/specifications/${selectedSpec.id}/transition`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedSpec(updated);
        setSpecs((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      } else {
        const { error } = await res.json();
        alert(error ?? "İşlem hatası");
      }
    } finally {
      setTransitioning(false);
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async function doDelete() {
    if (!selectedSpec || selectedSpec.status !== "draft") return;
    if (!confirm(`"${selectedSpec.name}" silinsin mi?`)) return;
    const res = await fetch(`/api/qms/specifications/${selectedSpec.id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      setSpecs((prev) => prev.filter((s) => s.id !== selectedSpec.id));
      setSelectedId(null);
    } else {
      const { error } = await res.json();
      alert(error ?? "Silme hatası");
    }
  }

  // ─── Create new ──────────────────────────────────────────────────────────────

  async function createNew() {
    if (!newDto.type || !newDto.name?.trim() || !newDto.code?.trim()) {
      alert("Tip, Ad ve Kod zorunludur");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/qms/specifications", {
        method: "POST",
        headers,
        body: JSON.stringify(newDto),
      });
      if (res.ok) {
        const created = await res.json();
        setSpecs((prev) => [created, ...prev]);
        setSelectedId(created.id);
        setShowNewForm(false);
        setNewDto({});
      } else {
        const { error } = await res.json();
        alert(error ?? "Oluşturma hatası");
      }
    } finally {
      setCreating(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const current = editMode ? editDraft : (selectedSpec ?? {});

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", background: "#F3F4F6" }}>
      {/* Left panel */}
      <div style={{ width: 288, flexShrink: 0, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Spesifikasyonlar</span>
            <button
              onClick={() => setShowNewForm(true)}
              style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "#3B82F6", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}
            >
              + Yeni Spec
            </button>
          </div>

          {/* Type tabs */}
          <div style={{ display: "flex", gap: 2, marginBottom: 8, background: "#F9FAFB", borderRadius: 6, padding: 3 }}>
            {[
              { val: "all", label: "Tümü" },
              { val: "raw_material", label: "Ham" },
              { val: "finished_good", label: "Bitmiş" },
              { val: "packaging", label: "Ambalaj" },
            ].map((t) => (
              <button
                key={t.val}
                onClick={() => setTypeFilter(t.val)}
                style={{
                  flex: 1, fontSize: 10, fontWeight: 600, borderRadius: 4, border: "none", padding: "4px 2px", cursor: "pointer",
                  background: typeFilter === t.val ? "#fff" : "transparent",
                  color: typeFilter === t.val ? "#111827" : "#6B7280",
                  boxShadow: typeFilter === t.val ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "100%", fontSize: 11, padding: "5px 8px", border: "1px solid #E5E7EB", borderRadius: 6, marginBottom: 8, color: "#374151", background: "#fff" }}
          >
            <option value="all">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="in_review">İncelemede</option>
            <option value="approved">Onaylı</option>
            <option value="published">Yayında</option>
            <option value="archived">Arşiv</option>
          </select>

          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara..."
            style={{ width: "100%", fontSize: 12, padding: "6px 10px", border: "1px solid #E5E7EB", borderRadius: 6, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Spec list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 16, fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>Yükleniyor…</div>
          ) : specs.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>
              Spesifikasyon bulunamadı
            </div>
          ) : (
            specs.map((s) => {
              const typeColor = TYPE_COLORS[s.type];
              const statusColor = STATUS_COLORS[s.status];
              const isSelected = s.id === selectedId;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #F3F4F6",
                    cursor: "pointer",
                    background: isSelected ? "#EFF6FF" : "#fff",
                    borderLeft: isSelected ? "3px solid #3B82F6" : "3px solid transparent",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 3 }}>{s.name}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#6B7280", marginBottom: 5 }}>{s.code}</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: typeColor.bg, color: typeColor.text }}>{TYPE_LABELS[s.type]}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: statusColor.bg, color: statusColor.text }}>{STATUS_LABELS[s.status]}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!selectedSpec ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Bir spesifikasyon seçin</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Sol panelden bir spec seçin veya yeni oluşturun</div>
            </div>
          </div>
        ) : (
          <>
            {/* Spec header */}
            <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "14px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>{selectedSpec.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: STATUS_COLORS[selectedSpec.status].bg, color: STATUS_COLORS[selectedSpec.status].text }}>{STATUS_LABELS[selectedSpec.status]}</span>
                    {selectedSpec.co_authored_with_supplier && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "#EDE9FE", color: "#7C3AED" }}>Tedarikçi ile</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#6B7280" }}>
                    <span style={{ fontFamily: "monospace" }}>{selectedSpec.code}</span>
                    <span>•</span>
                    <span>{TYPE_LABELS[selectedSpec.type]}</span>
                    <span>•</span>
                    <span>v{selectedSpec.version}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {/* Transition buttons */}
                  {selectedSpec.status === "draft" && !editMode && (
                    <button onClick={() => doTransition("submit")} disabled={transitioning}
                      style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "none", background: "#D97706", color: "#fff", cursor: "pointer" }}>
                      İncelemeye Gönder
                    </button>
                  )}
                  {selectedSpec.status === "in_review" && (
                    <button onClick={() => doTransition("approve")} disabled={transitioning}
                      style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "none", background: "#059669", color: "#fff", cursor: "pointer" }}>
                      Onayla
                    </button>
                  )}
                  {selectedSpec.status === "approved" && (
                    <button onClick={() => doTransition("publish")} disabled={transitioning}
                      style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "none", background: "#2563EB", color: "#fff", cursor: "pointer" }}>
                      Yayınla
                    </button>
                  )}
                  {["draft","in_review","approved","published"].includes(selectedSpec.status) && (
                    <button onClick={() => doTransition("archive")} disabled={transitioning}
                      style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280", cursor: "pointer" }}>
                      Arşivle
                    </button>
                  )}

                  {/* Edit/Save/Cancel */}
                  {selectedSpec.status === "draft" && !editMode && (
                    <button onClick={startEdit}
                      style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "1.5px solid #3B82F6", background: "#fff", color: "#3B82F6", cursor: "pointer" }}>
                      Düzenle
                    </button>
                  )}
                  {editMode && (
                    <>
                      <button onClick={saveEdit} disabled={saving}
                        style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "none", background: "#3B82F6", color: "#fff", cursor: "pointer" }}>
                        {saving ? "Kaydediliyor…" : "Kaydet"}
                      </button>
                      <button onClick={cancelEdit}
                        style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280", cursor: "pointer" }}>
                        İptal
                      </button>
                    </>
                  )}
                  {selectedSpec.status === "draft" && !editMode && (
                    <button onClick={doDelete}
                      style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#fff", color: "#DC2626", cursor: "pointer" }}>
                      Sil
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0 20px", display: "flex", gap: 0 }}>
              {[
                { key: "genel", label: "Genel" },
                { key: "alerjenler", label: "Alerjenler" },
                { key: "mikrobiyoloji", label: "Mikrobiyoloji" },
                { key: "fizikokimyasal", label: "Fizikokimyasal" },
                { key: "organoleptik", label: "Organoleptik" },
                { key: "raf_omru", label: "Raf Ömrü" },
                { key: "gecmis", label: "Değişiklik Geçmişi" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
                    padding: "10px 14px", border: "none", background: "none", cursor: "pointer",
                    color: activeTab === tab.key ? "#3B82F6" : "#6B7280",
                    borderBottom: activeTab === tab.key ? "2px solid #3B82F6" : "2px solid transparent",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {activeTab === "genel" && (
                <GenelTab spec={selectedSpec} editMode={editMode} draft={editDraft} setDraft={setEditDraft} suppliers={suppliers} />
              )}
              {activeTab === "alerjenler" && (
                <AlerjenlerTab spec={selectedSpec} editMode={editMode} draft={editDraft} setDraft={setEditDraft} />
              )}
              {activeTab === "mikrobiyoloji" && (
                <MikrobiyolojiTab spec={selectedSpec} editMode={editMode} draft={editDraft} setDraft={setEditDraft} />
              )}
              {activeTab === "fizikokimyasal" && (
                <FizikoKimyasalTab spec={selectedSpec} editMode={editMode} draft={editDraft} setDraft={setEditDraft} />
              )}
              {activeTab === "organoleptik" && (
                <OrganoleptikTab spec={selectedSpec} editMode={editMode} draft={editDraft} setDraft={setEditDraft} />
              )}
              {activeTab === "raf_omru" && (
                <RafOmruTab spec={selectedSpec} editMode={editMode} draft={editDraft} setDraft={setEditDraft} />
              )}
              {activeTab === "gecmis" && (
                <GecmisTab changes={specChanges} />
              )}
            </div>
          </>
        )}
      </div>

      {/* New Spec slide-over */}
      {showNewForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.3)" }} onClick={() => setShowNewForm(false)} />
          <div style={{ width: 380, background: "#fff", height: "100vh", display: "flex", flexDirection: "column", boxShadow: "-4px 0 20px rgba(0,0,0,0.1)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Yeni Spesifikasyon</span>
              <button onClick={() => setShowNewForm(false)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#6B7280" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <FormField label="Tip *">
                <select value={newDto.type ?? ""} onChange={(e) => setNewDto((d) => ({ ...d, type: e.target.value as SpecType }))}
                  style={inputStyle}>
                  <option value="">Seçin…</option>
                  <option value="raw_material">Ham Madde</option>
                  <option value="finished_good">Bitmiş Ürün</option>
                  <option value="packaging">Ambalaj</option>
                </select>
              </FormField>
              <FormField label="Ad *">
                <input value={newDto.name ?? ""} onChange={(e) => setNewDto((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Spec adı" style={inputStyle} />
              </FormField>
              <FormField label="Kod *">
                <input value={newDto.code ?? ""} onChange={(e) => setNewDto((d) => ({ ...d, code: e.target.value }))}
                  placeholder="SP-001" style={{ ...inputStyle, fontFamily: "monospace" }} />
              </FormField>
              {newDto.type === "raw_material" && (
                <FormField label="Tedarikçi">
                  <select value={newDto.supplier_id ?? ""} onChange={(e) => setNewDto((d) => ({ ...d, supplier_id: e.target.value || undefined }))}
                    style={inputStyle}>
                    <option value="">Tedarikçi seçin (opsiyonel)</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                  </select>
                </FormField>
              )}
            </div>
            <div style={{ padding: 20, borderTop: "1px solid #E5E7EB", display: "flex", gap: 8 }}>
              <button onClick={createNew} disabled={creating}
                style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: "9px 0", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", cursor: "pointer" }}>
                {creating ? "Oluşturuluyor…" : "Oluştur"}
              </button>
              <button onClick={() => setShowNewForm(false)}
                style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: "9px 0", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#374151", cursor: "pointer" }}>
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared form helpers ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 13,
  padding: "8px 12px",
  border: "1.5px solid #E2E8F0",
  borderRadius: 8,
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
};

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Genel Tab ────────────────────────────────────────────────────────────────

function GenelTab({
  spec, editMode, draft, setDraft, suppliers,
}: {
  spec: Specification;
  editMode: boolean;
  draft: Partial<Specification>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Specification>>>;
  suppliers: Supplier[];
}) {
  const current = editMode ? draft : spec;
  const supplier = suppliers.find((s) => s.id === current.supplier_id);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <InfoCard label="Ad" value={editMode
        ? <input value={(current.name ?? "")} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} style={inputStyle} />
        : spec.name}
      />
      <InfoCard label="Kod" value={editMode
        ? <input value={(current.code ?? "")} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} style={{ ...inputStyle, fontFamily: "monospace" }} />
        : <span style={{ fontFamily: "monospace" }}>{spec.code}</span>}
      />
      <InfoCard label="Tip" value={TYPE_LABELS[spec.type]} />
      <InfoCard label="Versiyon" value={`v${spec.version}`} />
      <InfoCard label="Durum" value={
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: STATUS_COLORS[spec.status].bg, color: STATUS_COLORS[spec.status].text }}>
          {STATUS_LABELS[spec.status]}
        </span>
      } />
      <InfoCard label="Tedarikçi ile" value={spec.co_authored_with_supplier ? "Evet" : "Hayır"} />
      {spec.type === "raw_material" && (
        <InfoCard label="Tedarikçi" value={editMode
          ? <select value={(current.supplier_id ?? "")} onChange={(e) => setDraft((d) => ({ ...d, supplier_id: e.target.value || null }))} style={inputStyle}>
              <option value="">Seçin…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
            </select>
          : (supplier?.display_name ?? "—")}
        />
      )}
      <InfoCard label="Oluşturulma" value={spec.created_at ? new Date(spec.created_at).toLocaleDateString("tr-TR") : "—"} />
      <InfoCard label="Güncellenme" value={spec.updated_at ? new Date(spec.updated_at).toLocaleDateString("tr-TR") : "—"} />
      {spec.type === "raw_material" && (
        <InfoCard label="Bağlı Bitmiş Ürün" value={`${spec.linked_finished_good_ids?.length ?? 0} adet`} />
      )}
      <div style={{ gridColumn: "1/-1" }}>
        <InfoCard label="Depolama Koşulları" value={editMode
          ? <textarea value={(current.storage_conditions ?? "")} onChange={(e) => setDraft((d) => ({ ...d, storage_conditions: e.target.value }))}
              style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />
          : (spec.storage_conditions ?? "—")}
        />
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "12px 14px", border: "1px solid #E5E7EB" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#111827" }}>{value}</div>
    </div>
  );
}

// ─── Alerjenler Tab ───────────────────────────────────────────────────────────

function AlerjenlerTab({
  spec, editMode, draft, setDraft,
}: {
  spec: Specification;
  editMode: boolean;
  draft: Partial<Specification>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Specification>>>;
}) {
  const allergens = editMode ? (draft.allergens ?? spec.allergens ?? {}) : (spec.allergens ?? {});

  function setAllergenStatus(allergen: string, status: AllergenStatus | "") {
    const updated = { ...allergens };
    if (status === "") {
      delete updated[allergen as keyof typeof updated];
    } else {
      updated[allergen as keyof typeof updated] = status;
    }
    setDraft((d) => ({ ...d, allergens: updated }));
  }

  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 12, color: "#6B7280" }}>
        AB 14 Alerjen Listesi — Her alerjen için durumu işaretleyin
      </div>
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>Alerjen</th>
              {(["contains", "may_contain", "free"] as AllergenStatus[]).map((s) => (
                <th key={s} style={{ textAlign: "center", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: ALLERGEN_STATUS_COLORS[s].text, borderBottom: "1px solid #E5E7EB", background: ALLERGEN_STATUS_COLORS[s].bg }}>
                  {ALLERGEN_STATUS_LABELS[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AB_ALLERGENS.map((allergen, i) => {
              const current = allergens[allergen];
              return (
                <tr key={allergen} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td style={{ padding: "8px 14px", fontSize: 13, fontWeight: 500, color: "#374151" }}>
                    {ALLERGEN_LABELS[allergen]}
                  </td>
                  {(["contains", "may_contain", "free"] as AllergenStatus[]).map((status) => {
                    const isSelected = current === status;
                    const colors = ALLERGEN_STATUS_COLORS[status];
                    return (
                      <td key={status} style={{ textAlign: "center", padding: "8px 14px" }}>
                        {editMode ? (
                          <button
                            onClick={() => setAllergenStatus(allergen, isSelected ? "" : status)}
                            style={{
                              width: 28, height: 28, borderRadius: "50%", border: isSelected ? "none" : "1.5px solid #E5E7EB",
                              background: isSelected ? colors.bg : "#fff",
                              color: isSelected ? colors.text : "#9CA3AF",
                              cursor: "pointer", fontSize: 14, fontWeight: 700,
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            {isSelected ? "✓" : ""}
                          </button>
                        ) : (
                          isSelected ? (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: colors.bg, color: colors.text }}>
                              {ALLERGEN_STATUS_LABELS[status]}
                            </span>
                          ) : null
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Mikrobiyoloji Tab ────────────────────────────────────────────────────────

function MikrobiyolojiTab({
  spec, editMode, draft, setDraft,
}: {
  spec: Specification;
  editMode: boolean;
  draft: Partial<Specification>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Specification>>>;
}) {
  const rows: MicroSpec[] = editMode ? (draft.microbiological ?? spec.microbiological ?? []) : (spec.microbiological ?? []);

  function updateRow(idx: number, field: keyof MicroSpec, value: string) {
    const updated = rows.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    setDraft((d) => ({ ...d, microbiological: updated }));
  }
  function addRow(organism?: string) {
    setDraft((d) => ({
      ...d,
      microbiological: [...(d.microbiological ?? rows), { organism: organism ?? "", limit: "", method: "" }],
    }));
  }
  function removeRow(idx: number) {
    setDraft((d) => ({ ...d, microbiological: rows.filter((_, i) => i !== idx) }));
  }

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", overflow: "hidden", marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["Mikroorganizma", "Limit", "Test Metodu", ...(editMode ? [""] : [])].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={editMode ? 4 : 3} style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>Henüz mikrobiyolojik kriter tanımlanmamış</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "8px 14px" }}>
                  {editMode ? <input value={r.organism} onChange={(e) => updateRow(i, "organism", e.target.value)} style={{ ...inputStyle, fontSize: 12 }} /> : <span style={{ fontSize: 13 }}>{r.organism}</span>}
                </td>
                <td style={{ padding: "8px 14px" }}>
                  {editMode ? <input value={r.limit} onChange={(e) => updateRow(i, "limit", e.target.value)} style={{ ...inputStyle, fontSize: 12 }} /> : <span style={{ fontSize: 13, fontFamily: "monospace" }}>{r.limit}</span>}
                </td>
                <td style={{ padding: "8px 14px" }}>
                  {editMode ? <input value={r.method} onChange={(e) => updateRow(i, "method", e.target.value)} style={{ ...inputStyle, fontSize: 12 }} /> : <span style={{ fontSize: 13 }}>{r.method}</span>}
                </td>
                {editMode && (
                  <td style={{ padding: "8px 14px" }}>
                    <button onClick={() => removeRow(i)} style={{ border: "none", background: "none", color: "#EF4444", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>×</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editMode && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => addRow()} style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "1.5px dashed #3B82F6", background: "transparent", color: "#3B82F6", cursor: "pointer" }}>
            + Satır Ekle
          </button>
          {COMMON_ORGANISMS.map((o) => (
            <button key={o} onClick={() => addRow(o)}
              style={{ fontSize: 10, fontWeight: 500, padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#6B7280", cursor: "pointer" }}>
              + {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fizikokimyasal Tab ───────────────────────────────────────────────────────

function FizikoKimyasalTab({
  spec, editMode, draft, setDraft,
}: {
  spec: Specification;
  editMode: boolean;
  draft: Partial<Specification>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Specification>>>;
}) {
  const attrs = editMode ? (draft.physical_chemical ?? spec.physical_chemical ?? {}) : (spec.physical_chemical ?? {});

  function updateAttr(key: string, field: keyof AttributeField, value: string | number) {
    const updated = { ...attrs, [key]: { ...(attrs[key] ?? { label: key }), [field]: value } };
    setDraft((d) => ({ ...d, physical_chemical: updated }));
  }
  function addAttr(key: string, label: string, unit?: string) {
    if (attrs[key]) return;
    const updated = { ...attrs, [key]: { label, unit: unit ?? "", target: "", min: undefined, max: undefined, method: "" } };
    setDraft((d) => ({ ...d, physical_chemical: updated }));
  }
  function removeAttr(key: string) {
    const updated = { ...attrs };
    delete updated[key];
    setDraft((d) => ({ ...d, physical_chemical: updated }));
  }

  const keys = Object.keys(attrs);

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", overflow: "hidden", marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["Parametre", "Hedef", "Min", "Max", "Birim", "Test Metodu", ...(editMode ? [""] : [])].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr><td colSpan={editMode ? 7 : 6} style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>Parametre tanımlanmamış</td></tr>
            ) : keys.map((key) => {
              const a = attrs[key];
              return (
                <tr key={key} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "8px 14px", fontSize: 13, fontWeight: 500 }}>{a.label}</td>
                  {editMode ? (
                    <>
                      <td style={{ padding: "8px 8px" }}><input value={String(a.target ?? "")} onChange={(e) => updateAttr(key, "target", e.target.value)} style={{ ...inputStyle, fontSize: 12, width: 80 }} /></td>
                      <td style={{ padding: "8px 8px" }}><input type="number" value={a.min ?? ""} onChange={(e) => updateAttr(key, "min", parseFloat(e.target.value))} style={{ ...inputStyle, fontSize: 12, width: 70 }} /></td>
                      <td style={{ padding: "8px 8px" }}><input type="number" value={a.max ?? ""} onChange={(e) => updateAttr(key, "max", parseFloat(e.target.value))} style={{ ...inputStyle, fontSize: 12, width: 70 }} /></td>
                      <td style={{ padding: "8px 8px" }}><input value={a.unit ?? ""} onChange={(e) => updateAttr(key, "unit", e.target.value)} style={{ ...inputStyle, fontSize: 12, width: 60 }} /></td>
                      <td style={{ padding: "8px 8px" }}><input value={a.method ?? ""} onChange={(e) => updateAttr(key, "method", e.target.value)} style={{ ...inputStyle, fontSize: 12, width: 120 }} /></td>
                      <td style={{ padding: "8px 8px" }}><button onClick={() => removeAttr(key)} style={{ border: "none", background: "none", color: "#EF4444", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>×</button></td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "8px 14px", fontSize: 12, fontFamily: "monospace" }}>{a.target ?? "—"}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, fontFamily: "monospace" }}>{a.min ?? "—"}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, fontFamily: "monospace" }}>{a.max ?? "—"}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12 }}>{a.unit ?? "—"}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12 }}>{a.method ?? "—"}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editMode && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {COMMON_PHYSICO.map((p) => !attrs[p.key] && (
            <button key={p.key} onClick={() => addAttr(p.key, p.label, p.unit)}
              style={{ fontSize: 10, fontWeight: 500, padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#6B7280", cursor: "pointer" }}>
              + {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Organoleptik Tab ─────────────────────────────────────────────────────────

function OrganoleptikTab({
  spec, editMode, draft, setDraft,
}: {
  spec: Specification;
  editMode: boolean;
  draft: Partial<Specification>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Specification>>>;
}) {
  const attrs = editMode ? (draft.organoleptic ?? spec.organoleptic ?? {}) : (spec.organoleptic ?? {});

  function updateTarget(key: string, value: string) {
    const updated = { ...attrs, [key]: { ...(attrs[key] ?? { label: key }), target: value } };
    setDraft((d) => ({ ...d, organoleptic: updated }));
  }
  function addAttr(key: string, label: string) {
    if (attrs[key]) return;
    const updated = { ...attrs, [key]: { label, target: "" } };
    setDraft((d) => ({ ...d, organoleptic: updated }));
  }
  function removeAttr(key: string) {
    const updated = { ...attrs };
    delete updated[key];
    setDraft((d) => ({ ...d, organoleptic: updated }));
  }

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", overflow: "hidden", marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["Parametre", "Tanım / Hedef", ...(editMode ? [""] : [])].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(attrs).length === 0 ? (
              <tr><td colSpan={editMode ? 3 : 2} style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>Organoleptik kriter tanımlanmamış</td></tr>
            ) : Object.keys(attrs).map((key) => {
              const a = attrs[key];
              return (
                <tr key={key} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "8px 14px", fontSize: 13, fontWeight: 500, width: 180 }}>{a.label}</td>
                  <td style={{ padding: "8px 14px" }}>
                    {editMode
                      ? <input value={String(a.target ?? "")} onChange={(e) => updateTarget(key, e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />
                      : <span style={{ fontSize: 13 }}>{String(a.target ?? "—")}</span>}
                  </td>
                  {editMode && (
                    <td style={{ padding: "8px 8px" }}>
                      <button onClick={() => removeAttr(key)} style={{ border: "none", background: "none", color: "#EF4444", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>×</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editMode && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {COMMON_ORGANOLEPTIC.map((o) => !attrs[o.key] && (
            <button key={o.key} onClick={() => addAttr(o.key, o.label)}
              style={{ fontSize: 10, fontWeight: 500, padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#6B7280", cursor: "pointer" }}>
              + {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Raf Ömrü Tab ─────────────────────────────────────────────────────────────

function RafOmruTab({
  spec, editMode, draft, setDraft,
}: {
  spec: Specification;
  editMode: boolean;
  draft: Partial<Specification>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Specification>>>;
}) {
  const shelfLife = editMode ? (draft.shelf_life ?? spec.shelf_life) : spec.shelf_life;
  const storageConditions = editMode ? (draft.storage_conditions ?? spec.storage_conditions) : spec.storage_conditions;

  const unitLabels = { day: "Gün", month: "Ay", year: "Yıl" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 500 }}>
      <div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Raf Ömrü</label>
        {editMode ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              value={shelfLife?.value ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, shelf_life: { value: parseInt(e.target.value) || 0, unit: d.shelf_life?.unit ?? spec.shelf_life?.unit ?? "day" } }))}
              placeholder="Süre"
              style={{ ...inputStyle, width: 100 }}
            />
            <select
              value={shelfLife?.unit ?? "day"}
              onChange={(e) => setDraft((d) => ({ ...d, shelf_life: { value: d.shelf_life?.value ?? spec.shelf_life?.value ?? 0, unit: e.target.value as "day" | "month" | "year" } }))}
              style={inputStyle}
            >
              <option value="day">Gün</option>
              <option value="month">Ay</option>
              <option value="year">Yıl</option>
            </select>
          </div>
        ) : (
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
            {shelfLife ? `${shelfLife.value} ${unitLabels[shelfLife.unit]}` : "—"}
          </div>
        )}
      </div>

      <div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Depolama Koşulları</label>
        {editMode ? (
          <textarea
            value={storageConditions ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, storage_conditions: e.target.value }))}
            placeholder="Örn: +2°C ile +8°C arası, kuru ve serin yerde saklayın"
            style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
          />
        ) : (
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {storageConditions ?? "—"}
          </div>
        )}
      </div>

      {spec.type === "raw_material" && (
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Bağlı Bitmiş Ürünler ({spec.linked_finished_good_ids?.length ?? 0})
          </label>
          {spec.linked_finished_good_ids?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {spec.linked_finished_good_ids.map((id) => (
                <div key={id} style={{ fontSize: 11, fontFamily: "monospace", padding: "4px 8px", background: "#F3F4F6", borderRadius: 4, color: "#374151" }}>{id}</div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>Bağlı bitmiş ürün yok</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Değişiklik Geçmişi Tab ───────────────────────────────────────────────────

function GecmisTab({ changes }: { changes: SpecChange[] }) {
  const [openDiff, setOpenDiff] = useState<string | null>(null);

  if (changes.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
        <div style={{ fontSize: 13 }}>Henüz değişiklik kaydı yok</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 700 }}>
      {changes.map((c) => (
        <div key={c.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", padding: "2px 8px", borderRadius: 4, background: "#DBEAFE", color: "#2563EB" }}>v{c.version}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{c.summary || "Değişiklik"}</span>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(c.changed_at).toLocaleDateString("tr-TR")}</span>
              {Object.keys(c.diff ?? {}).length > 0 && (
                <button onClick={() => setOpenDiff(openDiff === c.id ? null : c.id)}
                  style={{ fontSize: 10, fontWeight: 600, border: "1px solid #E5E7EB", borderRadius: 4, padding: "3px 8px", background: "#fff", color: "#6B7280", cursor: "pointer" }}>
                  {openDiff === c.id ? "Kapat" : "Diff"}
                </button>
              )}
            </div>
          </div>

          {openDiff === c.id && Object.keys(c.diff ?? {}).length > 0 && (
            <div style={{ padding: "12px 16px" }}>
              {Object.entries(c.diff).map(([field, { from, to }]) => (
                <div key={field} style={{ marginBottom: 8, fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: "#374151", textTransform: "uppercase", fontSize: 10 }}>{field}: </span>
                  <span style={{ color: "#DC2626", textDecoration: "line-through", marginRight: 6 }}>{JSON.stringify(from)}</span>
                  <span style={{ color: "#059669" }}>{JSON.stringify(to)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
