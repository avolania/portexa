"use client";

import { useState, useEffect, useRef } from "react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Priority, IncidentState, ServiceRequestState, ChangeRequestState,
} from "@/lib/itsm/types/enums";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

// ─── Sabitler ──────────────────────────────────────────────────────────────────

const TYPE_C = {
  INC: { label: "INC", color: "#DC2626", bg: "#FEE2E2" },
  SR:  { label: "SR",  color: "#2563EB", bg: "#DBEAFE" },
  CR:  { label: "CR",  color: "#7C3AED", bg: "#F3E8FF" },
} as const;

const PRIO_C: Record<string, { label: string; color: string; bg: string }> = {
  [Priority.CRITICAL]: { label: "P1", color: "#fff", bg: "#DC2626" },
  [Priority.HIGH]:     { label: "P2", color: "#fff", bg: "#D97706" },
  [Priority.MEDIUM]:   { label: "P3", color: "#fff", bg: "#2563EB" },
  [Priority.LOW]:      { label: "P4", color: "#fff", bg: "#6B7280" },
};

const STATE_C: Record<string, { label: string; color: string; icon: string }> = {
  [IncidentState.NEW]:         { label: "New",            color: "#3B82F6", icon: "○" },
  [IncidentState.ASSIGNED]:    { label: "Assigned",       color: "#0891B2", icon: "○" },
  [IncidentState.IN_PROGRESS]: { label: "In Progress",    color: "#D97706", icon: "◎" },
  [IncidentState.PENDING]:     { label: "Pending",        color: "#7C3AED", icon: "⏷" },
  [IncidentState.RESOLVED]:    { label: "Resolved",       color: "#059669", icon: "✓" },
  [IncidentState.CLOSED]:      { label: "Closed",         color: "#6B7280", icon: "✕" },
  [ServiceRequestState.DRAFT]:            { label: "Draft",          color: "#6B7280", icon: "○" },
  [ServiceRequestState.SUBMITTED]:        { label: "Submitted",      color: "#3B82F6", icon: "○" },
  [ServiceRequestState.PENDING_APPROVAL]: { label: "Onay Bekleniyor",color: "#D97706", icon: "⏳" },
  [ServiceRequestState.APPROVED]:         { label: "Approved",       color: "#059669", icon: "✓" },
  [ServiceRequestState.FULFILLED]:        { label: "Fulfilled",      color: "#059669", icon: "✓" },
  [ChangeRequestState.SCHEDULED]:         { label: "Scheduled",      color: "#0891B2", icon: "📅" },
  [ChangeRequestState.IMPLEMENT]:         { label: "Implement",      color: "#D97706", icon: "◎" },
  [ChangeRequestState.REVIEW]:            { label: "Review",         color: "#7C3AED", icon: "⏷" },
};

const PRIORITY_ESCALATE: Record<string, Priority> = {
  [Priority.LOW]:    Priority.MEDIUM,
  [Priority.MEDIUM]: Priority.HIGH,
  [Priority.HIGH]:   Priority.CRITICAL,
};

// ─── Yardımcı: SLA kalan süre ──────────────────────────────────────────────────

function slaRemaining(deadline: string, breached: boolean): { text: string; color: string; pct: number; pulse: boolean } {
  if (breached) {
    const over = Math.round((Date.now() - new Date(deadline).getTime()) / 60000);
    return { text: `${over}dk aşıldı`, color: "#EF4444", pct: 100, pulse: true };
  }
  const rem = Math.round((new Date(deadline).getTime() - Date.now()) / 60000);
  if (rem <= 0) return { text: "Şimdi!", color: "#EF4444", pct: 100, pulse: true };
  if (rem < 30) return { text: `${rem}dk`, color: "#EF4444", pct: 90, pulse: false };
  if (rem < 60) return { text: `${rem}dk`, color: "#F59E0B", pct: 70, pulse: false };
  const h = Math.floor(rem / 60), m = rem % 60;
  if (h < 24) return { text: `${h}s ${m}dk`, color: h < 2 ? "#F59E0B" : "#10B981", pct: Math.min(60, h * 5), pulse: false };
  return { text: `${Math.floor(h / 24)}g ${h % 24}s`, color: "#10B981", pct: 20, pulse: false };
}

// ─── Ticket satır tipi ─────────────────────────────────────────────────────────

interface TicketRow {
  id: string;
  type: "INC" | "SR" | "CR";
  number: string;
  title: string;
  priority: string;
  state: string;
  category: string;
  assignedToId?: string;
  assignedToName?: string;
  callerName: string;
  slaDeadline: string;
  slaBreached: boolean;
  createdAt: string;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function L1WorkbenchPage() {
  const { incidents, assign: assignInc, changeState: changeIncState, update: updateInc, addWorkNote, addAttachment: addIncAttachment, load: loadInc } = useIncidentStore();
  const { serviceRequests, load: loadSR, update: updateSR, changeState: changeSRState, addWorkNote: addSRWorkNote, addAttachment: addSRAttachment } = useServiceRequestStore();
  const { changeRequests, load: loadCR, update: updateCR, addWorkNote: addCRWorkNote, addAttachment: addCRAttachment } = useChangeRequestStore();
  const { user, profiles, loadProfiles } = useAuthStore();

  const [search, setSearch]               = useState("");
  const [filterType, setFilterType]       = useState<"all" | "INC" | "SR" | "CR">("all");
  const [filterState, setFilterState]     = useState("all");
  const [filterMine, setFilterMine]       = useState(false);
  const [sortCol, setSortCol]             = useState<"priority" | "sla" | "state" | "type">("priority");
  const [sortAsc, setSortAsc]             = useState(true);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [detailId, setDetailId]           = useState<string | null>(null);
  const [noteText, setNoteText]           = useState("");
  const [bulkOpen, setBulkOpen]           = useState(false);
  const [assignOpen, setAssignOpen]       = useState<string | null>(null);
  const [escalateId, setEscalateId]       = useState<string | null>(null);
  const [escalateNote, setEscalateNote]   = useState("");
  const [escalateLoading, setEscalateLoading] = useState(false);

  // Çöz / Beklet onay modal
  const [actionModal, setActionModal]     = useState<{ id: string; type: TicketRow["type"]; action: "resolve" | "pending" } | null>(null);
  const [actionNote, setActionNote]       = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [noteSaving, setNoteSaving]       = useState(false);
  const [noteError, setNoteError]         = useState<string | null>(null);
  const [attachSaving, setAttachSaving]   = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null); // ticket id
  const [assignSearch, setAssignSearch]   = useState("");
  const [assignSaving, setAssignSaving]   = useState(false);

  useEffect(() => { loadInc(); loadSR(); loadCR(); loadProfiles(); }, [loadInc, loadSR, loadCR, loadProfiles]);

  // Tüm ticket'ları birleştir
  const allRows: TicketRow[] = [
    ...incidents.map((inc) => ({
      id: inc.id,
      type: "INC" as const,
      number: inc.number,
      title: inc.shortDescription,
      priority: inc.priority,
      state: inc.state,
      category: inc.category,
      assignedToId: inc.assignedToId,
      assignedToName: inc.assignedTo?.fullName ?? (inc.assignedToId ? profiles[inc.assignedToId]?.name : undefined),
      callerName: inc.caller?.fullName ?? inc.callerId,
      slaDeadline: inc.sla.resolutionDeadline,
      slaBreached: inc.sla.resolutionBreached,
      createdAt: inc.createdAt,
    })),
    ...serviceRequests.map((sr) => ({
      id: sr.id,
      type: "SR" as const,
      number: sr.number,
      title: sr.shortDescription,
      priority: sr.priority ?? Priority.MEDIUM,
      state: sr.state,
      category: sr.category,
      assignedToId: sr.assignedToId,
      assignedToName: sr.assignedTo?.fullName ?? (sr.assignedToId ? profiles[sr.assignedToId]?.name : undefined),
      callerName: sr.requestedFor?.fullName ?? sr.requestedForId,
      slaDeadline: sr.sla?.fulfillmentDeadline ?? new Date(Date.now() + 86400000 * 5).toISOString(),
      slaBreached: sr.sla?.slaBreached ?? false,
      createdAt: sr.createdAt,
    })),
    ...changeRequests.map((cr) => ({
      id: cr.id,
      type: "CR" as const,
      number: cr.number,
      title: cr.shortDescription,
      priority: cr.priority,
      state: cr.state,
      category: cr.category,
      assignedToId: cr.assignedToId,
      assignedToName: cr.assignedTo?.fullName ?? (cr.assignedToId ? profiles[cr.assignedToId]?.name : undefined),
      callerName: cr.requestedBy?.fullName ?? cr.requestedById,
      slaDeadline: new Date(Date.now() + 86400000 * 3).toISOString(),
      slaBreached: false,
      createdAt: cr.createdAt,
    })),
  ];

  const PRIORITY_ORDER: Record<string, number> = {
    [Priority.CRITICAL]: 0, [Priority.HIGH]: 1, [Priority.MEDIUM]: 2, [Priority.LOW]: 3,
  };

  const filtered = allRows
    .filter(t => filterType === "all" || t.type === filterType)
    .filter(t => filterState === "all" || t.state === filterState)
    .filter(t => !filterMine || t.assignedToId === user?.id)
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return t.number.toLowerCase().includes(q) || t.title.toLowerCase().includes(q) || t.callerName.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortCol === "priority") return ((PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)) * dir;
      if (sortCol === "sla") return (new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime()) * dir;
      if (sortCol === "state") return a.state.localeCompare(b.state) * dir;
      if (sortCol === "type") return a.type.localeCompare(b.type) * dir;
      return 0;
    });

  const myOpen    = allRows.filter(t => t.assignedToId === user?.id && t.state !== IncidentState.RESOLVED && t.state !== IncidentState.CLOSED && t.state !== ServiceRequestState.CLOSED && t.state !== ChangeRequestState.CLOSED).length;
  const resolved  = allRows.filter(t => t.assignedToId === user?.id && (t.state === IncidentState.RESOLVED || t.state === ServiceRequestState.FULFILLED)).length;
  const breached  = allRows.filter(t => t.slaBreached).length;
  const unassigned = allRows.filter(t => !t.assignedToId && (t.state === IncidentState.NEW || t.state === ServiceRequestState.SUBMITTED)).length;

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(p => !p);
    else { setSortCol(col); setSortAsc(true); }
  };

  const toggleSelect = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => {
    const ids = filtered.map(t => t.id);
    const allSel = ids.every(id => selected.has(id));
    setSelected(p => { const n = new Set(p); ids.forEach(id => allSel ? n.delete(id) : n.add(id)); return n; });
  };

  const handleAssignToMe = async (ticketId: string, type: TicketRow["type"]) => {
    if (!user) return;
    if (type === "INC") await assignInc(ticketId, { assignedToId: user.id });
    else if (type === "SR") await updateSR(ticketId, { assignedToId: user.id });
    else if (type === "CR") await updateCR(ticketId, { assignedToId: user.id });
    setAssignOpen(null);
  };

  const handleAssignTo = async (ticketId: string, type: TicketRow["type"], targetId: string) => {
    setAssignSaving(true);
    try {
      if (type === "INC") await assignInc(ticketId, { assignedToId: targetId });
      else if (type === "SR") await updateSR(ticketId, { assignedToId: targetId });
      else if (type === "CR") await updateCR(ticketId, { assignedToId: targetId });
      setShowAssignModal(null);
      setAssignSearch("");
    } finally { setAssignSaving(false); }
  };

  const handleStateChange = async (ticketId: string, type: TicketRow["type"], newState: string) => {
    if (type === "INC") {
      if (newState === IncidentState.IN_PROGRESS) await changeIncState(ticketId, { state: IncidentState.IN_PROGRESS });
      else if (newState === IncidentState.PENDING)  await changeIncState(ticketId, { state: IncidentState.PENDING });
      else if (newState === IncidentState.RESOLVED)  await changeIncState(ticketId, { state: IncidentState.RESOLVED });
    }
  };

  const handleActionConfirm = async () => {
    if (!actionModal || !actionNote.trim()) return;
    setActionLoading(true);
    try {
      const noteContent = actionModal.action === "resolve"
        ? `[ÇÖZÜLDÜ] ${actionNote.trim()}`
        : `[BEKLETİLDİ] ${actionNote.trim()}`;
      if (actionModal.type === "INC") {
        await addWorkNote(actionModal.id, { content: noteContent });
        await changeIncState(actionModal.id, {
          state: actionModal.action === "resolve" ? IncidentState.RESOLVED : IncidentState.PENDING,
        });
      } else if (actionModal.type === "SR") {
        await addSRWorkNote(actionModal.id, { content: noteContent });
        if (actionModal.action === "resolve") {
          await changeSRState(actionModal.id, ServiceRequestState.FULFILLED);
        } else {
          await changeSRState(actionModal.id, ServiceRequestState.PENDING);
        }
      } else if (actionModal.type === "CR") {
        await addCRWorkNote(actionModal.id, { content: noteContent });
      }
      if (detailId === actionModal.id && actionModal.action === "resolve") setDetailId(null);
    } finally {
      setActionLoading(false);
      setActionModal(null);
      setActionNote("");
    }
  };

  const handleEscalate = async () => {
    if (!escalateId) return;
    const ticket = allRows.find(t => t.id === escalateId);
    if (!ticket) return;
    setEscalateLoading(true);
    try {
      if (ticket.type === "INC") {
        const nextPriority = PRIORITY_ESCALATE[ticket.priority];
        if (nextPriority) {
          await updateInc(escalateId, {
            priorityOverride: nextPriority,
            priorityOverrideReason: escalateNote || "L1 tarafından eskalasyon yapıldı",
          });
        }
        const noteBody = escalateNote
          ? `[ESKALASYoN] ${escalateNote}`
          : "[ESKALASYon] L1 agent tarafından eskalasyon yapıldı. L2/L3 incelemesi gerekiyor.";
        await addWorkNote(escalateId, { content: noteBody });
      }
    } finally {
      setEscalateLoading(false);
      setEscalateId(null);
      setEscalateNote("");
      if (detailId === escalateId) setDetailId(null);
    }
  };

  const detail = detailId ? allRows.find(t => t.id === detailId) : null;
  const escalateTicket = escalateId ? allRows.find(t => t.id === escalateId) : null;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveNote = async () => {
    if (!detail || !noteText.trim()) return;
    setNoteSaving(true);
    setNoteError(null);
    try {
      if (detail.type === "INC") await addWorkNote(detail.id, { content: noteText.trim() });
      else if (detail.type === "SR") await addSRWorkNote(detail.id, { content: noteText.trim() });
      else if (detail.type === "CR") await addCRWorkNote(detail.id, { content: noteText.trim() });
      setNoteText("");
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Not kaydedilemedi');
    } finally { setNoteSaving(false); }
  };

  const handleAttachFile = async (file: File) => {
    if (!detail) return;
    setAttachSaving(true);
    setNoteError(null);
    try {
      if (detail.type === "INC") await addIncAttachment(detail.id, file);
      else if (detail.type === "SR") await addSRAttachment(detail.id, file);
      else if (detail.type === "CR") await addCRAttachment(detail.id, file);
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Dosya yüklenemedi');
    } finally { setAttachSaving(false); }
  };

  // Sort header helper
  const SortHead = ({ col, label, w }: { col: typeof sortCol; label: string; w?: string }) => (
    <th
      onClick={() => toggleSort(col)}
      style={{
        padding: "8px 10px", textAlign: "left", cursor: "pointer", userSelect: "none",
        fontSize: 10, fontWeight: 700,
        color: sortCol === col ? "#4F46E5" : "#6B7280",
        textTransform: "uppercase", letterSpacing: "0.06em",
        fontFamily: "'JetBrains Mono', monospace",
        width: w, whiteSpace: "nowrap",
        borderBottom: "1px solid #E5E7EB",
        background: "#F9FAFB", position: "sticky", top: 0, zIndex: 10,
      }}
    >
      {label} {sortCol === col && <span style={{ fontSize: 8 }}>{sortAsc ? "▲" : "▼"}</span>}
    </th>
  );

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#F3F4F6", color: "#111827",
        height: "100%",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideR { from { opacity:0; transform:translateX(16px) } to { opacity:1; transform:translateX(0) } }
        @keyframes scaleIn { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:scale(1) } }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes rowIn  { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #F3F4F6; }
        ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
      `}</style>

      {/* ── Stats + Filter Bar ── */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #E5E7EB",
        padding: "8px 16px", display: "flex", alignItems: "center",
        gap: 10, flexShrink: 0, flexWrap: "wrap",
      }}>
        {/* Stats */}
        {[
          { label: "Üzerimde",  value: myOpen,     color: "#D97706", pulse: false },
          { label: "Çözülen",   value: resolved,   color: "#059669", pulse: false },
          { label: "SLA İhlal", value: breached,   color: "#DC2626", pulse: breached > 0 },
          { label: "Atanmamış", value: unassigned, color: "#2563EB", pulse: false },
        ].map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 6,
            background: "#F9FAFB", border: "1px solid #E5E7EB",
          }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase" }}>{s.label}</span>
            <span style={{
              fontSize: 16, fontWeight: 800, color: s.color,
              fontFamily: "'JetBrains Mono', monospace",
              animation: s.pulse ? "pulse 1.2s ease infinite" : "none",
            }}>{s.value}</span>
          </div>
        ))}

        <div style={{ width: 1, height: 28, background: "#E5E7EB", margin: "0 4px" }} />

        {/* Tip filtresi */}
        <div style={{ display: "flex", gap: 2, background: "#F3F4F6", borderRadius: 6, padding: 2 }}>
          {([["all", "Tümü"], ["INC", "INC"], ["SR", "SR"], ["CR", "CR"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilterType(k)} style={{
              padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer",
              background: filterType === k ? "#fff" : "transparent",
              boxShadow: filterType === k ? "0 1px 3px rgba(0,0,0,.1)" : "none",
              color: filterType === k
                ? (k === "all" ? "#111827" : TYPE_C[k]?.color ?? "#111827")
                : "#6B7280",
              fontSize: 11, fontWeight: 600,
              fontFamily: k !== "all" ? "'JetBrains Mono', monospace" : "'DM Sans', sans-serif",
            }}>{l}</button>
          ))}
        </div>

        {/* Durum filtresi */}
        <div style={{ display: "flex", gap: 2, background: "#F3F4F6", borderRadius: 6, padding: 2, flexWrap: "wrap" }}>
          <button onClick={() => setFilterState("all")} style={{
            padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer",
            background: filterState === "all" ? "#fff" : "transparent",
            boxShadow: filterState === "all" ? "0 1px 3px rgba(0,0,0,.1)" : "none",
            color: filterState === "all" ? "#111827" : "#6B7280", fontSize: 11, fontWeight: 600,
          }}>Tümü</button>
          {([
            [IncidentState.NEW, "New", "#3B82F6", "○"],
            [IncidentState.IN_PROGRESS, "In Progress", "#D97706", "◎"],
            [IncidentState.PENDING, "Pending", "#7C3AED", "⏷"],
            [IncidentState.RESOLVED, "Resolved", "#059669", "✓"],
          ] as const).map(([k, l, c, icon]) => (
            <button key={k} onClick={() => setFilterState(filterState === k ? "all" : k)} style={{
              padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer",
              background: filterState === k ? "#fff" : "transparent",
              boxShadow: filterState === k ? "0 1px 3px rgba(0,0,0,.1)" : "none",
              color: filterState === k ? c : "#6B7280",
              fontSize: 11, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 3,
            }}>
              <span style={{ fontSize: 9 }}>{icon}</span>{l}
            </button>
          ))}
        </div>

        {/* Benim filtresi */}
        <button onClick={() => setFilterMine(p => !p)} style={{
          padding: "4px 12px", borderRadius: 6,
          border: filterMine ? "1px solid #3B82F6" : "1px solid #E5E7EB",
          background: filterMine ? "#EFF6FF" : "#fff",
          color: filterMine ? "#2563EB" : "#6B7280",
          fontSize: 11, fontWeight: 600, cursor: "pointer",
        }}>👤 Benim ({myOpen})</button>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "#F9FAFB", border: "1px solid #E5E7EB",
          borderRadius: 6, padding: "5px 10px", width: 220,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ticket, kişi veya kelime..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#111827", fontSize: 11, fontFamily: "'DM Sans', sans-serif",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
          )}
        </div>

        {/* Bulk action */}
        {selected.size > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, animation: "fadeIn 0.2s ease" }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: "#2563EB",
              padding: "3px 8px", borderRadius: 4, background: "#DBEAFE",
              fontFamily: "'JetBrains Mono', monospace",
            }}>{selected.size} seçili</span>
            <div style={{ position: "relative" }}>
              <button onClick={() => setBulkOpen(p => !p)} style={{
                padding: "5px 12px", borderRadius: 6, border: "1px solid #C7D2FE",
                background: "#EFF6FF", color: "#4F46E5", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>⚡ Toplu İşlem ▾</button>
              {bulkOpen && (
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 4,
                  background: "#fff", border: "1px solid #E5E7EB",
                  borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                  overflow: "hidden", zIndex: 100, minWidth: 200,
                }}>
                  <div style={{ padding: "6px 12px", fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", borderBottom: "1px solid #F3F4F6" }}>Durum Değiştir</div>
                  {[
                    [IncidentState.IN_PROGRESS, "◎ In Progress", "#D97706"],
                    [IncidentState.PENDING,      "⏷ Pending",    "#7C3AED"],
                    [IncidentState.RESOLVED,     "✓ Resolved",   "#059669"],
                  ].map(([k, l, c]) => (
                    <button key={k} onClick={() => { setBulkOpen(false); setSelected(new Set()); }} style={{
                      width: "100%", padding: "7px 12px", border: "none", cursor: "pointer",
                      background: "#fff", color: c as string, fontSize: 12, textAlign: "left",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                      onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                    >{l as string}</button>
                  ))}
                  <div style={{ padding: "6px 12px", fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", borderTop: "1px solid #F3F4F6", borderBottom: "1px solid #F3F4F6" }}>Ata</div>
                  <button onClick={() => { setBulkOpen(false); setSelected(new Set()); }} style={{
                    width: "100%", padding: "7px 12px", border: "none", cursor: "pointer",
                    background: "#fff", color: "#2563EB", fontSize: 12, fontWeight: 600, textAlign: "left",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                  >👤 Hepsini Bana Ata</button>
                  <div style={{ padding: "6px 12px", borderTop: "1px solid #F3F4F6" }}>
                    <button onClick={() => { setSelected(new Set()); setBulkOpen(false); }} style={{
                      width: "100%", padding: "5px", borderRadius: 4, border: "none",
                      background: "#F3F4F6", color: "#6B7280", fontSize: 10, cursor: "pointer",
                    }}>Seçimi Temizle</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "'JetBrains Mono', monospace" }}>{filtered.length} kayıt</span>
      </div>

      {/* ── Tablo ── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
          <thead>
            <tr>
              <th style={{
                width: 36, padding: "8px 10px", background: "#F9FAFB",
                borderBottom: "1px solid #E5E7EB", position: "sticky", top: 0, zIndex: 10,
              }}>
                <input
                  type="checkbox"
                  onChange={selectAll}
                  checked={filtered.length > 0 && filtered.every(t => selected.has(t.id))}
                  style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#4F46E5" }}
                />
              </th>
              <SortHead col="type"     label="Tip"   w="52" />
              <SortHead col="priority" label="Ön."   w="48" />
              <th style={{
                padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700,
                color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em",
                borderBottom: "1px solid #E5E7EB", background: "#F9FAFB",
                position: "sticky", top: 0, zIndex: 10,
              }}>Ticket</th>
              <SortHead col="state" label="Durum" w="120" />
              <SortHead col="sla"   label="SLA"   w="110" />
              <th style={{
                padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700,
                color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em",
                width: 110, borderBottom: "1px solid #E5E7EB", background: "#F9FAFB",
                position: "sticky", top: 0, zIndex: 10,
              }}>Atanan</th>
              <th style={{
                padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700,
                color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em",
                width: 90, borderBottom: "1px solid #E5E7EB", background: "#F9FAFB",
                position: "sticky", top: 0, zIndex: 10,
              }}>Kategori</th>
              <th style={{
                padding: "8px 10px", textAlign: "center", fontSize: 10, fontWeight: 700,
                color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em",
                width: 110, borderBottom: "1px solid #E5E7EB", background: "#F9FAFB",
                position: "sticky", top: 0, zIndex: 10,
              }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => {
              const tc = TYPE_C[t.type];
              const pc = PRIO_C[t.priority];
              const sc = STATE_C[t.state] ?? { label: t.state, color: "#6B7280", icon: "○" };
              const sla = slaRemaining(t.slaDeadline, t.slaBreached);
              const isSel = selected.has(t.id);
              const isMine = t.assignedToId === user?.id;

              return (
                <tr
                  key={t.id}
                  onClick={() => setDetailId(t.id)}
                  style={{
                    cursor: "pointer", transition: "background .1s",
                    background: isSel ? "#EFF6FF" : t.slaBreached ? "#FEF2F2" : "#fff",
                    borderBottom: "1px solid #F3F4F6",
                    animation: `rowIn .2s ease ${i * 0.02}s both`,
                  }}
                  onMouseEnter={e => { if (!isSel && !t.slaBreached) (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; }}
                  onMouseLeave={e => { if (!isSel && !t.slaBreached) (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                >
                  {/* Checkbox */}
                  <td style={{ padding: "8px 10px" }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleSelect(t.id)}
                      style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#4F46E5" }} />
                  </td>

                  {/* Tip */}
                  <td style={{ padding: "8px 6px" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "2px 5px", borderRadius: 3,
                      background: tc.bg, color: tc.color,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>{tc.label}</span>
                  </td>

                  {/* Priority */}
                  <td style={{ padding: "8px 6px" }}>
                    {pc ? (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: "2px 5px", borderRadius: 3,
                        background: pc.bg, color: pc.color,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>{pc.label}</span>
                    ) : (
                      <span style={{ fontSize: 10, color: "#9CA3AF" }}>—</span>
                    )}
                  </td>

                  {/* Ticket info */}
                  <td style={{ padding: "8px 10px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: "#6366F1",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>{t.number}</span>
                        {t.slaBreached && (
                          <span style={{
                            fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 3,
                            background: "#DC2626", color: "#fff",
                            animation: "pulse 1.2s ease infinite",
                          }}>SLA!</span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#111827", lineHeight: 1.3 }}>
                        {t.title}
                      </span>
                      <span style={{ fontSize: 10, color: "#9CA3AF" }}>{t.callerName}</span>
                    </div>
                  </td>

                  {/* State */}
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      padding: "3px 8px", borderRadius: 4,
                      background: `${sc.color}15`, color: sc.color,
                      fontSize: 10, fontWeight: 600,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      <span style={{ fontSize: 8 }}>{sc.icon}</span>{sc.label}
                    </span>
                  </td>

                  {/* SLA */}
                  <td style={{ padding: "8px 10px" }}>
                    {t.state === IncidentState.RESOLVED || t.state === ServiceRequestState.FULFILLED || t.state === ChangeRequestState.CLOSED ? (
                      <span style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>✓ Tamamlandı</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: sla.color,
                          fontFamily: "'JetBrains Mono', monospace",
                          animation: sla.pulse ? "pulse 1s ease infinite" : "none",
                        }}>{sla.text}</span>
                        <div style={{ height: 3, background: "#E5E7EB", borderRadius: 2, overflow: "hidden", width: 80 }}>
                          <div style={{
                            width: `${sla.pct}%`, height: "100%",
                            borderRadius: 2, background: sla.color,
                            transition: "width .5s ease",
                          }} />
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Atanan */}
                  <td style={{ padding: "8px 10px" }}>
                    {t.assignedToId ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                          background: isMine ? "#3B82F6" : "#E5E7EB",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 7, fontWeight: 800,
                          color: isMine ? "#fff" : "#6B7280",
                          border: isMine ? "2px solid #93C5FD" : "none",
                        }}>
                          {(t.assignedToName ?? t.assignedToId).split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: isMine ? 700 : 400, color: isMine ? "#2563EB" : "#6B7280" }}>
                          {isMine ? "Ben" : (t.assignedToName ?? t.assignedToId).split(" ")[0]}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 10, color: "#D1D5DB", fontStyle: "italic" }}>Atanmadı</span>
                    )}
                  </td>

                  {/* Kategori */}
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ fontSize: 10, color: "#9CA3AF" }}>{t.category}</span>
                  </td>

                  {/* İşlemler */}
                  <td style={{ padding: "8px 6px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                      {/* Ata */}
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() => setAssignOpen(assignOpen === t.id ? null : t.id)}
                          title="Ata"
                          style={{
                            width: 26, height: 26, borderRadius: 5,
                            border: t.assignedToId ? "1px solid #DBEAFE" : "1px solid #E5E7EB",
                            background: t.assignedToId ? "#EFF6FF" : "#fff",
                            cursor: "pointer", fontSize: 11, color: "#2563EB",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>👤</button>
                        {assignOpen === t.id && (
                          <div style={{
                            position: "absolute", bottom: "100%", right: 0, marginBottom: 4,
                            background: "#fff", border: "1px solid #E5E7EB",
                            borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.1)",
                            overflow: "hidden", zIndex: 50, minWidth: 160,
                          }}>
                            <button
                              onClick={() => handleAssignToMe(t.id, t.type)}
                              style={{
                                width: "100%", padding: "7px 10px", border: "none", cursor: "pointer",
                                background: "#EFF6FF", color: "#2563EB", fontSize: 11, fontWeight: 600, textAlign: "left",
                              }}>👤 Bana Ata</button>
                            <button
                              onClick={() => { setAssignOpen(null); setShowAssignModal(t.id); }}
                              style={{
                                width: "100%", padding: "7px 10px", border: "none", borderTop: "1px solid #F3F4F6",
                                cursor: "pointer", background: "#fff", color: "#374151", fontSize: 11, fontWeight: 600, textAlign: "left",
                              }}>👥 Başkasına Ata</button>
                          </div>
                        )}
                      </div>
                      {/* İşleme al */}
                      {(t.state === IncidentState.NEW || t.state === IncidentState.ASSIGNED) && (
                        <button
                          onClick={() => handleStateChange(t.id, t.type, IncidentState.IN_PROGRESS)}
                          title="İşleme Al"
                          style={{
                            width: 26, height: 26, borderRadius: 5, border: "1px solid #FDE68A",
                            background: "#FFFBEB", cursor: "pointer", fontSize: 11, color: "#D97706",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>▶</button>
                      )}
                      {/* Çöz */}
                      {t.state === IncidentState.IN_PROGRESS && t.type === "INC" && (
                        <button
                          onClick={() => { setActionModal({ id: t.id, type: t.type, action: "resolve" }); setActionNote(""); }}
                          title="Çöz"
                          style={{
                            width: 26, height: 26, borderRadius: 5, border: "1px solid #A7F3D0",
                            background: "#ECFDF5", cursor: "pointer", fontSize: 11, color: "#059669",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>✓</button>
                      )}
                      {/* Beklet */}
                      {t.state === IncidentState.IN_PROGRESS && (
                        <button
                          onClick={() => { setActionModal({ id: t.id, type: t.type, action: "pending" }); setActionNote(""); }}
                          title="Beklet"
                          style={{
                            width: 26, height: 26, borderRadius: 5, border: "1px solid #DDD6FE",
                            background: "#F5F3FF", cursor: "pointer", fontSize: 11, color: "#7C3AED",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>⏷</button>
                      )}
                      {/* Eskalasyon */}
                      <button
                        onClick={() => setEscalateId(t.id)}
                        title="Eskalasyon"
                        style={{
                          width: 26, height: 26, borderRadius: 5, border: "1px solid #FECACA",
                          background: "#FEF2F2", cursor: "pointer", fontSize: 11, color: "#DC2626",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>⬆</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            Sonuç bulunamadı
          </div>
        )}
      </div>

      {/* ── Detail Slide-over ── */}
      {detail && (
        <>
          <div
            onClick={() => setDetailId(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,.3)",
              zIndex: 200, animation: "fadeIn .15s ease",
            }}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: 440,
            background: "#fff", borderLeft: "1px solid #E5E7EB",
            zIndex: 201, display: "flex", flexDirection: "column",
            animation: "slideR .2s ease",
            boxShadow: "-8px 0 32px rgba(0,0,0,.08)",
          }}>
            {/* Header */}
            <div style={{
              padding: "14px 18px", borderBottom: "1px solid #F3F4F6",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              {detail && (() => {
                const tc = TYPE_C[detail.type];
                const pc = PRIO_C[detail.priority];
                return (
                  <>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 3,
                      background: tc.bg, color: tc.color,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>{tc.label}</span>
                    {pc && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 3,
                        background: pc.bg, color: pc.color,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>{pc.label}</span>
                    )}
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: "#6366F1",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>{detail.number}</span>
                  </>
                );
              })()}
              <div style={{ flex: 1 }} />
              <button onClick={() => setDetailId(null)} style={{
                width: 28, height: 28, borderRadius: 6, border: "1px solid #E5E7EB",
                background: "#F9FAFB", color: "#6B7280", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6, lineHeight: 1.4 }}>
                {detail.title}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                {(() => {
                  const sc = STATE_C[detail.state] ?? { label: detail.state, color: "#6B7280", icon: "○" };
                  return (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      padding: "3px 8px", borderRadius: 4,
                      background: `${sc.color}15`, color: sc.color,
                      fontSize: 10, fontWeight: 600,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      <span style={{ fontSize: 8 }}>{sc.icon}</span>{sc.label}
                    </span>
                  );
                })()}
                {detail.slaBreached && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 3,
                    background: "#DC2626", color: "#fff", animation: "pulse 1.2s ease infinite",
                  }}>SLA İHLALİ</span>
                )}
              </div>

              {/* Quick Actions */}
              <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
                {(detail.state === IncidentState.NEW || detail.state === IncidentState.ASSIGNED) && (
                  <button onClick={() => handleStateChange(detail.id, detail.type, IncidentState.IN_PROGRESS)} style={{
                    padding: "7px 14px", borderRadius: 6, border: "none",
                    background: "#D97706", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>▶ İşleme Al</button>
                )}
                {detail.state === IncidentState.IN_PROGRESS && detail.type === "INC" && (
                  <button onClick={() => { setActionModal({ id: detail.id, type: detail.type, action: "resolve" }); setActionNote(""); }} style={{
                    padding: "7px 14px", borderRadius: 6, border: "none",
                    background: "#059669", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>✓ Çözüldü</button>
                )}
                {detail.state === IncidentState.IN_PROGRESS && (
                  <button onClick={() => { setActionModal({ id: detail.id, type: detail.type, action: "pending" }); setActionNote(""); }} style={{
                    padding: "7px 14px", borderRadius: 6, border: "1px solid #DDD6FE",
                    background: "#F5F3FF", color: "#7C3AED", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>⏷ Beklet</button>
                )}
                <button
                  onClick={() => setEscalateId(detail.id)}
                  style={{
                    padding: "7px 14px", borderRadius: 6, border: "1px solid #FECACA",
                    background: "#FEF2F2", color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>⬆ Eskalasyon</button>
              </div>

              {/* SLA widget */}
              {detail.state !== IncidentState.RESOLVED && detail.state !== ServiceRequestState.FULFILLED && (() => {
                const s = slaRemaining(detail.slaDeadline, detail.slaBreached);
                return (
                  <div style={{
                    padding: "12px 14px", borderRadius: 8, marginBottom: 16,
                    background: s.pulse ? "#FEF2F2" : "#F9FAFB",
                    border: s.pulse ? "1px solid #FECACA" : "1px solid #E5E7EB",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280" }}>SLA Kalan</span>
                      <span style={{
                        fontSize: 18, fontWeight: 800, color: s.color,
                        fontFamily: "'JetBrains Mono', monospace",
                        animation: s.pulse ? "pulse 1s ease infinite" : "none",
                      }}>{s.text}</span>
                    </div>
                    <div style={{ height: 4, background: "#E5E7EB", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${s.pct}%`, height: "100%", borderRadius: 2, background: s.color }} />
                    </div>
                  </div>
                );
              })()}

              {/* Field grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                {[
                  ["Arayan",      detail.callerName],
                  ["Kategori",    detail.category],
                  ["Atanan",      detail.assignedToName ?? (detail.assignedToId ? detail.assignedToId.slice(0, 8) : "—")],
                  ["Oluşturulma", formatDistanceToNow(new Date(detail.createdAt), { addSuffix: true, locale: tr })],
                ].map(([l, v]) => (
                  <div key={l} style={{
                    padding: "8px 10px", borderRadius: 6,
                    background: "#F9FAFB", border: "1px solid #F3F4F6",
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: v === "—" ? "#D1D5DB" : "#111827" }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Atama */}
              {detail.state !== IncidentState.RESOLVED && detail.state !== IncidentState.CLOSED &&
               detail.state !== ServiceRequestState.FULFILLED && detail.state !== ServiceRequestState.CLOSED &&
               detail.state !== ChangeRequestState.CLOSED && (
                <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                  <button
                    onClick={() => handleAssignToMe(detail.id, detail.type)}
                    style={{
                      flex: 1, padding: "9px 12px", borderRadius: 8, border: "none",
                      background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>👤 Bana Ata</button>
                  <button
                    onClick={() => setShowAssignModal(detail.id)}
                    style={{
                      flex: 1, padding: "9px 12px", borderRadius: 8,
                      border: "1px solid #E5E7EB",
                      background: "#fff", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>👥 Başkasına Ata</button>
                </div>
              )}

              {/* Work Note */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 6 }}>Work Note</div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Dahili not ekleyin..."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 6,
                    background: "#fff", color: "#111827", fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#3B82F6")}
                  onBlur={e => (e.target.style.borderColor = "#E5E7EB")}
                />
                {noteError && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#DC2626", fontFamily: "monospace", background: "#FEF2F2", padding: "4px 8px", borderRadius: 4 }}>{noteError}</div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button
                    onClick={handleSaveNote}
                    disabled={noteSaving || !noteText.trim() || !detail}
                    style={{
                      padding: "7px 18px", borderRadius: 6, border: "none",
                      background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      opacity: (noteSaving || !noteText.trim() || !detail) ? 0.5 : 1,
                    }}>{noteSaving ? "Kaydediliyor..." : "Kaydet"}</button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={attachSaving || !detail}
                    style={{
                      padding: "7px 14px", borderRadius: 6, border: "1px solid #E5E7EB",
                      background: "#fff", color: "#6B7280", fontSize: 11, cursor: "pointer",
                      opacity: (attachSaving || !detail) ? 0.5 : 1,
                    }}>{attachSaving ? "Yükleniyor..." : "📎 Dosya Ekle"}</button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachFile(f); e.target.value = ""; }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Atama Modal ── */}
      {showAssignModal && (() => {
        const ticket = allRows.find(t => t.id === showAssignModal);
        if (!ticket) return null;
        const q = assignSearch.toLowerCase();
        const profileList = Object.values(profiles).filter(p =>
          !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.department ?? "").toLowerCase().includes(q)
        );
        return (
          <>
            <div
              onClick={() => { setShowAssignModal(null); setAssignSearch(""); }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 300, animation: "fadeIn .15s ease" }}
            />
            <div style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              background: "#fff", borderRadius: 12, padding: 24, width: 420,
              boxShadow: "0 20px 60px rgba(0,0,0,.18)", zIndex: 301,
              animation: "scaleIn .2s ease", display: "flex", flexDirection: "column", maxHeight: "80vh",
            }}>
              {/* Başlık */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: "#EFF6FF",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>👥</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Atama</div>
                  <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "'JetBrains Mono', monospace" }}>
                    {ticket.number} — {ticket.title.slice(0, 38)}{ticket.title.length > 38 ? "…" : ""}
                  </div>
                </div>
                <button
                  onClick={() => { setShowAssignModal(null); setAssignSearch(""); }}
                  style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#6B7280", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>

              {/* Mevcut atanan */}
              {ticket.assignedToName && (
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "#F9FAFB", border: "1px solid #E5E7EB", marginBottom: 12, fontSize: 12, color: "#374151" }}>
                  <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", marginRight: 6 }}>Mevcut:</span>
                  {ticket.assignedToName}
                </div>
              )}

              {/* Bana ata kısayolu */}
              <button
                onClick={() => handleAssignTo(ticket.id, ticket.type, user!.id)}
                disabled={assignSaving}
                style={{
                  width: "100%", padding: "9px 14px", borderRadius: 8, border: "none", marginBottom: 12,
                  background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left",
                  opacity: assignSaving ? 0.6 : 1,
                }}>👤 Bana Ata ({user?.name})</button>

              {/* Arama */}
              <input
                value={assignSearch}
                onChange={e => setAssignSearch(e.target.value)}
                placeholder="İsim, e-posta veya departman ile ara..."
                style={{
                  width: "100%", padding: "8px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8,
                  fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8,
                }}
                onFocus={e => (e.target.style.borderColor = "#3B82F6")}
                onBlur={e => (e.target.style.borderColor = "#E5E7EB")}
                autoFocus
              />

              {/* Profil listesi */}
              <div style={{ overflowY: "auto", flex: 1, borderRadius: 8, border: "1px solid #E5E7EB" }}>
                {profileList.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>Sonuç bulunamadı</div>
                ) : profileList.map(p => {
                  const initials = p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  const isCurrentAssignee = p.id === ticket.assignedToId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleAssignTo(ticket.id, ticket.type, p.id)}
                      disabled={assignSaving}
                      style={{
                        width: "100%", padding: "10px 12px", border: "none", borderBottom: "1px solid #F3F4F6",
                        background: isCurrentAssignee ? "#EFF6FF" : "#fff", cursor: assignSaving ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                        opacity: assignSaving ? 0.6 : 1,
                      }}
                      onMouseEnter={e => { if (!assignSaving) e.currentTarget.style.background = "#F9FAFB"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isCurrentAssignee ? "#EFF6FF" : "#fff"; }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%", background: isCurrentAssignee ? "#3B82F6" : "#E2E8F0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: isCurrentAssignee ? "#fff" : "#475569",
                        flexShrink: 0,
                      }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: 6 }}>
                          {p.name}
                          {isCurrentAssignee && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "#DBEAFE", color: "#2563EB" }}>Atanmış</span>}
                        </div>
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>{p.department ? `${p.department} · ` : ""}{p.email}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Çöz / Beklet Onay Modal ── */}
      {actionModal && (() => {
        const ticket = allRows.find(t => t.id === actionModal.id);
        if (!ticket) return null;
        const isResolve = actionModal.action === "resolve";
        return (
          <>
            <div
              onClick={() => { setActionModal(null); setActionNote(""); }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 300, animation: "fadeIn .15s ease" }}
            />
            <div style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              background: "#fff", borderRadius: 12, padding: 24, width: 440,
              boxShadow: "0 20px 60px rgba(0,0,0,.18)", zIndex: 301,
              animation: "scaleIn .2s ease",
            }}>
              {/* Başlık */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: isResolve ? "#ECFDF5" : "#F5F3FF",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>{isResolve ? "✓" : "⏷"}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                    {isResolve ? "İşlem Çözüldü" : "Beklete Al"}
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "'JetBrains Mono', monospace" }}>
                    {ticket.number} — {ticket.title.slice(0, 40)}{ticket.title.length > 40 ? "…" : ""}
                  </div>
                </div>
                <button
                  onClick={() => { setActionModal(null); setActionNote(""); }}
                  style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#6B7280", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>

              {/* Açıklama alanı */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  {isResolve ? "Çözüm Açıklaması" : "Bekleme Nedeni"}
                  <span style={{ color: "#EF4444", marginLeft: 3 }}>*</span>
                </label>
                <textarea
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  placeholder={isResolve
                    ? "Örn: Sunucu yeniden başlatıldı, servis normal seviyeye döndü..."
                    : "Örn: Üçüncü parti tedarikçi yanıtı bekleniyor, müşteri onayı gerekiyor..."}
                  rows={4}
                  autoFocus
                  style={{
                    width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8,
                    background: "#F9FAFB", color: "#111827", fontSize: 13,
                    fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#3B82F6"; e.target.style.background = "#fff"; }}
                  onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
                />
                {!actionNote.trim() && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#9CA3AF" }}>
                    İşlem için açıklama zorunludur.
                  </div>
                )}
              </div>

              {/* Butonlar */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleActionConfirm}
                  disabled={actionLoading || !actionNote.trim()}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
                    background: actionLoading || !actionNote.trim()
                      ? "#F3F4F6"
                      : isResolve ? "#059669" : "#7C3AED",
                    color: actionLoading || !actionNote.trim() ? "#9CA3AF" : "#fff",
                    fontSize: 13, fontWeight: 600,
                    cursor: actionLoading || !actionNote.trim() ? "not-allowed" : "pointer",
                    transition: "background .15s",
                  }}
                >
                  {actionLoading ? "İşleniyor..." : isResolve ? "✓ Çözüldü Olarak İşaretle" : "⏷ Beklete Al"}
                </button>
                <button
                  onClick={() => { setActionModal(null); setActionNote(""); }}
                  style={{
                    padding: "10px 18px", borderRadius: 8, border: "1px solid #E5E7EB",
                    background: "#fff", color: "#6B7280", fontSize: 13, cursor: "pointer",
                  }}>İptal</button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Eskalasyon Modal ── */}
      {escalateId && (
        <>
          <div
            onClick={() => { setEscalateId(null); setEscalateNote(""); }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 300, animation: "fadeIn .15s ease" }}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: "#fff", borderRadius: 12, padding: 24, width: 420,
            boxShadow: "0 20px 60px rgba(0,0,0,.18)", zIndex: 301,
            animation: "scaleIn .2s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: "#FEF2F2",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>⬆</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Eskalasyon</div>
                {escalateTicket && (
                  <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "'JetBrains Mono', monospace" }}>
                    {escalateTicket.number} — {escalateTicket.title.slice(0, 40)}{escalateTicket.title.length > 40 ? "…" : ""}
                  </div>
                )}
              </div>
            </div>

            {escalateTicket && escalateTicket.type === "INC" && PRIORITY_ESCALATE[escalateTicket.priority] && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                background: "#FEF2F2", borderRadius: 8, marginBottom: 14, border: "1px solid #FECACA",
              }}>
                <span style={{ fontSize: 12, color: "#6B7280" }}>Öncelik:</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 3,
                  background: PRIO_C[escalateTicket.priority]?.bg, color: PRIO_C[escalateTicket.priority]?.color,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>{PRIO_C[escalateTicket.priority]?.label}</span>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>→</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 3,
                  background: PRIO_C[PRIORITY_ESCALATE[escalateTicket.priority]]?.bg,
                  color: PRIO_C[PRIORITY_ESCALATE[escalateTicket.priority]]?.color,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>{PRIO_C[PRIORITY_ESCALATE[escalateTicket.priority]]?.label}</span>
                <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600, marginLeft: 4 }}>yükseltilecek</span>
              </div>
            )}

            {escalateTicket?.priority === Priority.CRITICAL && (
              <div style={{ padding: "10px 12px", background: "#FFF7ED", borderRadius: 8, marginBottom: 14, border: "1px solid #FDE68A" }}>
                <span style={{ fontSize: 12, color: "#92400E" }}>Bu ticket zaten P1 — öncelik yükseltilemez. Yalnızca not eklenecek.</span>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Eskalasyon Nedeni <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(isteğe bağlı)</span>
              </label>
              <textarea
                value={escalateNote}
                onChange={e => setEscalateNote(e.target.value)}
                placeholder="Örn: Müşteri üst yönetimi devreye soktu, etki alanı genişledi..."
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8,
                  background: "#F9FAFB", color: "#111827", fontSize: 12,
                  fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box",
                }}
                onFocus={e => { e.target.style.borderColor = "#3B82F6"; e.target.style.background = "#fff"; }}
                onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleEscalate}
                disabled={escalateLoading}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
                  background: escalateLoading ? "#F3F4F6" : "#DC2626",
                  color: escalateLoading ? "#9CA3AF" : "#fff",
                  fontSize: 13, fontWeight: 600, cursor: escalateLoading ? "not-allowed" : "pointer",
                  transition: "background .15s",
                }}
              >{escalateLoading ? "İşleniyor..." : "⬆ Eskalasyonu Onayla"}</button>
              <button
                onClick={() => { setEscalateId(null); setEscalateNote(""); }}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: "1px solid #E5E7EB",
                  background: "#fff", color: "#6B7280", fontSize: 13, cursor: "pointer",
                }}>İptal</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
