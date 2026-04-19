"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkflowInstanceStore } from "@/store/useWorkflowInstanceStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import type { WorkflowInstance, WorkflowStepInstance } from "@/lib/itsm/types/workflow-engine.types";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: tr }); }
  catch { return iso; }
}

function activeStepForUser(instance: WorkflowInstance, userId: string): WorkflowStepInstance | null {
  const step = instance.steps.find((s) => s.status === "active");
  if (!step) return null;
  const isApprover = step.resolvedApproverIds.includes(userId);
  const alreadyDecided = step.decisions.some((d) => d.approverId === userId);
  if (isApprover && !alreadyDecided) return step;
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterType = "all" | "SR" | "CR";

interface ApprovalRow {
  instance: WorkflowInstance;
  ticketType: "SR" | "CR";
  ticketNumber: string;
  title: string;
  requesterName: string;
  submittedAt: string;
  activeStep: WorkflowStepInstance;
}

// ─── Decision Modal ───────────────────────────────────────────────────────────

function DecisionModal({
  row,
  decision,
  onConfirm,
  onClose,
  saving,
}: {
  row: ApprovalRow;
  decision: "approved" | "rejected";
  onConfirm: (comment: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [comment, setComment] = useState("");
  const isReject = decision === "rejected";

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 400 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: "#fff", borderRadius: 14, padding: 28, width: 440,
        boxShadow: "0 24px 64px rgba(0,0,0,.18)", zIndex: 401,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: isReject ? "#FEE2E2" : "#D1FAE5",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>
            {isReject ? "✕" : "✓"}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
              {isReject ? "Reddet" : "Onayla"}
            </div>
            <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "monospace" }}>
              {row.ticketNumber} — {row.title.slice(0, 40)}{row.title.length > 40 ? "…" : ""}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", marginBottom: 6 }}>
            {isReject ? "Red gerekçesi *" : "Yorum (isteğe bağlı)"}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={isReject ? "Neden reddediyorsunuz?" : "Onay notu ekleyin..."}
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8,
              fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none",
              boxSizing: "border-box", transition: "border-color .15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = isReject ? "#DC2626" : "#059669")}
            onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
            autoFocus
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={saving} style={{
            padding: "9px 20px", borderRadius: 8, border: "1px solid #E5E7EB",
            background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>İptal</button>
          <button
            onClick={() => onConfirm(comment)}
            disabled={saving || (isReject && !comment.trim())}
            style={{
              padding: "9px 24px", borderRadius: 8, border: "none",
              background: isReject ? "#DC2626" : "#059669",
              color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              opacity: (saving || (isReject && !comment.trim())) ? 0.5 : 1,
            }}>
            {saving ? "Kaydediliyor..." : (isReject ? "Reddet" : "Onayla")}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Approval Card ────────────────────────────────────────────────────────────

function ApprovalCard({
  row,
  profiles,
  onDecide,
}: {
  row: ApprovalRow;
  profiles: Record<string, { name: string; email: string }>;
  onDecide: (row: ApprovalRow, decision: "approved" | "rejected") => void;
}) {
  const step = row.activeStep;
  const pendingApprovers = step.resolvedApproverIds.filter(
    (id) => !step.decisions.some((d) => d.approverId === id)
  );
  const approvedCount = step.decisions.filter((d) => d.decision === "approved").length;

  const typeColor = row.ticketType === "SR"
    ? { bg: "#DBEAFE", text: "#1D4ED8" }
    : { bg: "#F3E8FF", text: "#6D28D9" };

  return (
    <div style={{
      background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12,
      padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14,
      boxShadow: "0 1px 4px rgba(0,0,0,.04)", transition: "box-shadow .15s",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.04)")}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, fontFamily: "monospace",
          padding: "3px 8px", borderRadius: 4,
          background: typeColor.bg, color: typeColor.text,
        }}>{row.ticketType}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "#374151" }}>
              {row.ticketNumber}
            </span>
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>·</span>
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>{timeAgo(row.submittedAt)}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{row.title}</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
            Talep eden: <span style={{ fontWeight: 500, color: "#374151" }}>{row.requesterName}</span>
          </div>
        </div>
      </div>

      {/* Step info */}
      <div style={{
        background: "#F9FAFB", borderRadius: 8, padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, background: "#FEF3C7",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
        }}>⏳</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E" }}>{step.label}</div>
          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>
            {step.approvalMode === "all"
              ? `${approvedCount}/${step.resolvedApproverIds.length} onay`
              : "İlk onay yeterli"}
            {" · "}
            {pendingApprovers.length} kişi bekliyor
          </div>
        </div>
        {/* Approver avatars */}
        <div style={{ display: "flex", gap: -4 }}>
          {step.resolvedApproverIds.slice(0, 4).map((id) => {
            const p = profiles[id];
            const decided = step.decisions.find((d) => d.approverId === id);
            const initials = (p?.name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            const bg = decided
              ? decided.decision === "approved" ? "#D1FAE5" : "#FEE2E2"
              : "#E5E7EB";
            const color = decided
              ? decided.decision === "approved" ? "#065F46" : "#991B1B"
              : "#6B7280";
            return (
              <div key={id} title={p?.name ?? id} style={{
                width: 24, height: 24, borderRadius: "50%",
                background: bg, color, fontSize: 8, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #fff", marginLeft: -4,
              }}>{initials}</div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onDecide(row, "approved")}
          style={{
            flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
            background: "#059669", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "background .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#047857")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#059669")}
        >
          <span>✓</span> Onayla
        </button>
        <button
          onClick={() => onDecide(row, "rejected")}
          style={{
            flex: 1, padding: "9px 0", borderRadius: 8,
            border: "1.5px solid #DC2626", background: "#fff",
            color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all .15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#FEE2E2"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
        >
          <span>✕</span> Reddet
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { user, profiles, loadProfiles } = useAuthStore();
  const { instances, load: loadInstances } = useWorkflowInstanceStore();
  const { serviceRequests, load: loadSR, approve: approveSR, reject: rejectSR } = useServiceRequestStore();
  const { changeRequests, load: loadCR, approve: approveCR, reject: rejectCR } = useChangeRequestStore();
  const { decide } = useWorkflowInstanceStore();

  const [filter, setFilter] = useState<FilterType>("all");
  const [decisionModal, setDecisionModal] = useState<{ row: ApprovalRow; decision: "approved" | "rejected" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSystemAdmin = user?.role === "system_admin";

  useEffect(() => {
    loadInstances();
    loadSR();
    loadCR();
    loadProfiles();
  }, [loadInstances, loadSR, loadCR, loadProfiles]);

  // Onay bekleyen satırları hesapla
  const rows = useMemo((): ApprovalRow[] => {
    if (!user) return [];

    const running = instances.filter((i) => i.status === "running");

    return running
      .filter((i) => i.ticketType === "service_request" || i.ticketType === "change_request")
      .flatMap((instance): ApprovalRow[] => {
        // System admin tüm active adımları görür, normal kullanıcı sadece kendine ait olanları
        const step = isSystemAdmin
          ? instance.steps.find((s) => s.status === "active") ?? null
          : activeStepForUser(instance, user.id);

        if (!step) return [];

        const ticketType = instance.ticketType === "service_request" ? "SR" : "CR";

        if (ticketType === "SR") {
          const sr = serviceRequests.find((r) => r.id === instance.ticketId);
          if (!sr) return [];
          const requesterName = profiles[sr.requestedById]?.name ?? sr.requestedById;
          return [{
            instance,
            ticketType: "SR",
            ticketNumber: sr.number,
            title: sr.shortDescription,
            requesterName,
            submittedAt: sr.createdAt,
            activeStep: step,
          }];
        } else {
          const cr = changeRequests.find((r) => r.id === instance.ticketId);
          if (!cr) return [];
          const requesterName = profiles[cr.requestedById]?.name ?? cr.requestedById;
          return [{
            instance,
            ticketType: "CR",
            ticketNumber: cr.number,
            title: cr.shortDescription,
            requesterName,
            submittedAt: cr.createdAt,
            activeStep: step,
          }];
        }
      });
  }, [instances, serviceRequests, changeRequests, user, profiles, isSystemAdmin]);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.ticketType === filter);
  const srCount = rows.filter((r) => r.ticketType === "SR").length;
  const crCount = rows.filter((r) => r.ticketType === "CR").length;

  const handleDecide = async (comment: string) => {
    if (!decisionModal || !user) return;
    const { row, decision } = decisionModal;
    setSaving(true);
    setError(null);
    try {
      const result = await decide(row.instance.id, row.activeStep.stepDefId, decision, comment || undefined);
      if (!result) throw new Error("Karar kaydedilemedi.");

      // Workflow sonuçlandıysa ticket state'ini de güncelle
      if (result.instanceCompleted) {
        if (row.ticketType === "SR") {
          if (result.outcome === "approved") {
            await approveSR(row.instance.ticketId, { comments: comment });
          } else if (result.outcome === "rejected") {
            await rejectSR(row.instance.ticketId, { comments: comment });
          }
        } else {
          if (result.outcome === "approved") {
            await approveCR(row.instance.ticketId, { comments: comment });
          } else if (result.outcome === "rejected") {
            await rejectCR(row.instance.ticketId, { comments: comment });
          }
        }
      }

      setDecisionModal(null);
      await loadInstances();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bir hata oluştu.";
      setError(msg);
      setDecisionModal(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
      {/* Başlık */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>Onay Bekleyen Belgeler</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
          {isSystemAdmin
            ? "Tüm organizasyonlardaki aktif onay adımları"
            : "Size atanan onay bekleyen servis talepleri ve değişiklikler"}
        </div>
      </div>

      {/* Hata */}
      {error && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", background: "#FEF2F2",
          border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626",
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, cursor: "pointer", background: "none", border: "none", color: "#DC2626", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Filtreler */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["all", "SR", "CR"] as FilterType[]).map((f) => {
          const label = f === "all" ? `Tümü (${rows.length})` : f === "SR" ? `Servis Talepleri (${srCount})` : `Değişiklikler (${crCount})`;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: active ? "none" : "1px solid #E5E7EB",
                background: active ? "#3B82F6" : "#fff",
                color: active ? "#fff" : "#374151",
                cursor: "pointer", transition: "all .15s",
              }}
            >{label}</button>
          );
        })}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 0",
          border: "1.5px dashed #E5E7EB", borderRadius: 12,
          color: "#9CA3AF", fontSize: 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontWeight: 600, color: "#6B7280" }}>Onay bekleyen belge yok</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Tüm onaylar tamamlandı.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
          {filtered.map((row) => (
            <ApprovalCard
              key={row.instance.id}
              row={row}
              profiles={profiles}
              onDecide={(r, d) => setDecisionModal({ row: r, decision: d })}
            />
          ))}
        </div>
      )}

      {/* Decision Modal */}
      {decisionModal && (
        <DecisionModal
          row={decisionModal.row}
          decision={decisionModal.decision}
          onConfirm={handleDecide}
          onClose={() => !saving && setDecisionModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
