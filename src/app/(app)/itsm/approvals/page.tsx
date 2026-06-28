"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkflowInstanceStore } from "@/store/useWorkflowInstanceStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import type { WorkflowInstance, WorkflowStepInstance } from "@/lib/itsm/types/workflow-engine.types";
import type { ServiceRequest } from "@/lib/itsm/types/service-request.types";
import type { ChangeRequest } from "@/lib/itsm/types/change-request.types";
import { formatDistanceToNow, format } from "date-fns";
import { tr } from "date-fns/locale";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: tr }); }
  catch { return iso; }
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: tr }); }
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

function initials(name: string) {
  return (name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
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
  sr?: ServiceRequest;
  cr?: ChangeRequest;
}

// ─── Step status helpers ───────────────────────────────────────────────────────

function stepIcon(status: WorkflowStepInstance["status"]) {
  if (status === "approved") return { icon: "✓", bg: "#D1FAE5", color: "#065F46" };
  if (status === "rejected") return { icon: "✕", bg: "#FEE2E2", color: "#991B1B" };
  if (status === "active")   return { icon: "⏳", bg: "#FEF3C7", color: "#92400E" };
  return { icon: "○", bg: "#F3F4F6", color: "#9CA3AF" };
}

// ─── Approval Hierarchy (compact, inside card) ────────────────────────────────

function ApprovalHierarchy({
  steps,
  profiles,
}: {
  steps: WorkflowStepInstance[];
  profiles: Record<string, { name: string; email: string }>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {steps.map((step, i) => {
        const { icon, bg, color } = stepIcon(step.status);
        const isLast = i === steps.length - 1;
        const approvedDecisions = step.decisions.filter((d) => d.decision === "approved");
        const rejectedDecisions = step.decisions.filter((d) => d.decision === "rejected");

        return (
          <div key={step.stepDefId} style={{ display: "flex", gap: 10 }}>
            {/* Left: icon + connector */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: bg, color, fontSize: 9, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: step.status === "active" ? "2px solid #D97706" : "2px solid transparent",
                flexShrink: 0,
              }}>{icon}</div>
              {!isLast && (
                <div style={{
                  width: 1.5, flex: 1, minHeight: 10,
                  background: step.status === "approved" ? "#6EE7B7" : "#E5E7EB",
                  margin: "2px 0",
                }} />
              )}
            </div>

            {/* Right: label + approvers */}
            <div style={{ paddingBottom: isLast ? 0 : 8, flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: step.status === "active" ? 700 : 600,
                  color: step.status === "active" ? "#92400E" : step.status === "approved" ? "#065F46" : "#6B7280",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{step.label}</span>
                {step.status === "active" && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                    background: "#FEF3C7", color: "#92400E",
                  }}>AKTİF</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>
                {step.approvalMode === "all"
                  ? `${approvedDecisions.length}/${step.resolvedApproverIds.length} onay gerekli`
                  : "İlk onay yeterli"}
                {approvedDecisions.length > 0 && (
                  <span style={{ color: "#059669", marginLeft: 4 }}>
                    · {approvedDecisions.map((d) => d.approverName.split(" ")[0]).join(", ")} onayladı
                  </span>
                )}
                {rejectedDecisions.length > 0 && (
                  <span style={{ color: "#DC2626", marginLeft: 4 }}>
                    · {rejectedDecisions.map((d) => d.approverName.split(" ")[0]).join(", ")} reddetti
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail Slide-Over ────────────────────────────────────────────────────────

function DetailSlideOver({
  row,
  profiles,
  onClose,
  onDecide,
}: {
  row: ApprovalRow;
  profiles: Record<string, { name: string; email: string }>;
  onClose: () => void;
  onDecide: (row: ApprovalRow, decision: "approved" | "rejected") => void;
}) {
  const router = useRouter();
  const typeColor = row.ticketType === "SR"
    ? { bg: "#DBEAFE", text: "#1D4ED8" }
    : { bg: "#F3E8FF", text: "#6D28D9" };

  const ticketUrl = row.ticketType === "SR"
    ? `/itsm/service-requests/${row.instance.ticketId}`
    : `/itsm/change-requests/${row.instance.ticketId}`;

  // SR-specific fields
  const description = row.sr?.description ?? row.cr?.description ?? "—";
  const category = row.sr?.category ?? row.cr?.category ?? "—";
  const subcategory = row.sr?.subcategory ?? row.cr?.subcategory;
  const priority = row.sr?.priority ?? row.cr?.priority ?? "—";
  const state = row.sr?.state ?? row.cr?.state ?? "—";
  const assignedTo = row.sr?.assignedTo?.fullName ?? row.cr?.assignedTo?.fullName ?? "Atanmamış";

  const priorityColors: Record<string, { bg: string; text: string }> = {
    p1: { bg: "#FEE2E2", text: "#DC2626" }, critical: { bg: "#FEE2E2", text: "#DC2626" },
    p2: { bg: "#FEF3C7", text: "#D97706" }, high: { bg: "#FEF3C7", text: "#D97706" },
    p3: { bg: "#DBEAFE", text: "#2563EB" }, medium: { bg: "#DBEAFE", text: "#2563EB" }, normal: { bg: "#DBEAFE", text: "#2563EB" },
    p4: { bg: "#F3F4F6", text: "#6B7280" }, low: { bg: "#F3F4F6", text: "#6B7280" },
  };
  const pColor = priorityColors[priority?.toLowerCase()] ?? { bg: "#F3F4F6", text: "#6B7280" };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.25)", zIndex: 500, backdropFilter: "blur(1px)" }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: "#fff", boxShadow: "-8px 0 32px rgba(0,0,0,.12)",
        zIndex: 501, display: "flex", flexDirection: "column",
        animation: "slideRight .2s ease",
      }}>

        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: "1px solid #E5E7EB",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 800, fontFamily: "monospace",
            padding: "3px 8px", borderRadius: 4,
            background: typeColor.bg, color: typeColor.text, flexShrink: 0, marginTop: 2,
          }}>{row.ticketType}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "#374151" }}>
                {row.ticketNumber}
              </span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>· {timeAgo(row.submittedAt)}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>{row.title}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
              Talep eden: <span style={{ fontWeight: 500, color: "#374151" }}>{row.requesterName}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => router.push(ticketUrl)}
              title="Belgeye git"
              style={{
                width: 30, height: 30, borderRadius: 6, border: "1px solid #E5E7EB",
                background: "#F9FAFB", color: "#374151", fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>↗</button>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 6, border: "1px solid #E5E7EB",
                background: "#F9FAFB", color: "#374151", fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Ticket details */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>
              Talep Bilgileri
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginBottom: 14 }}>
              <DetailField label="Kategori" value={subcategory ? `${category} / ${subcategory}` : category} />
              <DetailField label="Öncelik" value={
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: pColor.bg, color: pColor.text, fontFamily: "monospace" }}>
                  {priority?.toUpperCase()}
                </span>
              } />
              <DetailField label="Durum" value={state} />
              <DetailField label="Atanan" value={assignedTo} />
            </div>
            {description && description !== "—" && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 6 }}>Açıklama</div>
                <div style={{
                  fontSize: 12, color: "#374151", lineHeight: 1.6,
                  background: "#F9FAFB", borderRadius: 8, padding: "10px 12px",
                  border: "1px solid #F3F4F6",
                }}>{description}</div>
              </div>
            )}
          </div>

          {/* Full approval hierarchy */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14 }}>
              Onay Hiyerarşisi
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {row.instance.steps.map((step, i) => {
                const { icon, bg, color } = stepIcon(step.status);
                const isLast = i === row.instance.steps.length - 1;
                const isActive = step.status === "active";

                return (
                  <div key={step.stepDefId} style={{ display: "flex", gap: 12 }}>
                    {/* Left: icon + connector line */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: bg, color, fontSize: 11, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: isActive ? "2.5px solid #D97706" : "2px solid transparent",
                        boxShadow: isActive ? "0 0 0 3px rgba(217,119,6,.15)" : "none",
                        flexShrink: 0,
                      }}>{icon}</div>
                      {!isLast && (
                        <div style={{
                          width: 2, flex: 1, minHeight: 12,
                          background: step.status === "approved" ? "#6EE7B7" : "#E5E7EB",
                          margin: "3px 0",
                        }} />
                      )}
                    </div>

                    {/* Right: content */}
                    <div style={{ paddingBottom: isLast ? 0 : 16, flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: isActive ? "#92400E" : step.status === "approved" ? "#065F46" : step.status === "rejected" ? "#991B1B" : "#6B7280",
                        }}>{step.label}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                          fontFamily: "monospace",
                          background: bg, color,
                        }}>
                          {step.status === "approved" ? "ONAYLANDI" : step.status === "rejected" ? "REDDEDİLDİ" : step.status === "active" ? "AKTİF" : "BEKLİYOR"}
                        </span>
                        {step.approvalMode === "all" && (
                          <span style={{ fontSize: 10, color: "#9CA3AF" }}>
                            ({step.decisions.filter(d => d.decision === "approved").length}/{step.resolvedApproverIds.length})
                          </span>
                        )}
                      </div>

                      {/* Approver decisions */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {step.resolvedApproverIds.map((approverId) => {
                          const p = profiles[approverId];
                          const name = p?.name ?? approverId;
                          const decision = step.decisions.find((d) => d.approverId === approverId);
                          const ini = initials(name);

                          return (
                            <div key={approverId} style={{
                              display: "flex", alignItems: "flex-start", gap: 8,
                              padding: "8px 10px", borderRadius: 8,
                              background: decision
                                ? decision.decision === "approved" ? "#F0FDF4" : "#FFF5F5"
                                : "#F9FAFB",
                              border: decision
                                ? decision.decision === "approved" ? "1px solid #BBF7D0" : "1px solid #FECACA"
                                : "1px solid #F3F4F6",
                            }}>
                              <div style={{
                                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                                background: decision
                                  ? decision.decision === "approved" ? "#D1FAE5" : "#FEE2E2"
                                  : "#E5E7EB",
                                color: decision
                                  ? decision.decision === "approved" ? "#065F46" : "#991B1B"
                                  : "#6B7280",
                                fontSize: 9, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>{ini}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{name}</span>
                                  {decision && (
                                    <span style={{
                                      fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                                      background: decision.decision === "approved" ? "#D1FAE5" : "#FEE2E2",
                                      color: decision.decision === "approved" ? "#065F46" : "#991B1B",
                                      fontFamily: "monospace",
                                    }}>
                                      {decision.decision === "approved" ? "✓ ONAYLADI" : "✕ REDDETTİ"}
                                    </span>
                                  )}
                                  {!decision && step.status === "active" && (
                                    <span style={{ fontSize: 10, color: "#D97706" }}>⏳ Bekliyor</span>
                                  )}
                                  {!decision && step.status === "pending" && (
                                    <span style={{ fontSize: 10, color: "#9CA3AF" }}>Henüz başlamadı</span>
                                  )}
                                </div>
                                {decision?.decidedAt && (
                                  <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>
                                    {fmtDate(decision.decidedAt)}
                                  </div>
                                )}
                                {decision?.comment && (
                                  <div style={{
                                    fontSize: 11, color: "#374151", marginTop: 4,
                                    fontStyle: "italic", lineHeight: 1.4,
                                  }}>
                                    &ldquo;{decision.comment}&rdquo;
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: "16px 24px", borderTop: "1px solid #E5E7EB",
          display: "flex", gap: 10,
        }}>
          <button
            onClick={() => onDecide(row, "approved")}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
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
              flex: 1, padding: "10px 0", borderRadius: 8,
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
    </>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>{value}</div>
    </div>
  );
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
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 600 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: "#fff", borderRadius: 14, padding: 28, width: 440,
        boxShadow: "0 24px 64px rgba(0,0,0,.18)", zIndex: 601,
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
  onOpen,
}: {
  row: ApprovalRow;
  profiles: Record<string, { name: string; email: string }>;
  onDecide: (row: ApprovalRow, decision: "approved" | "rejected") => void;
  onOpen: (row: ApprovalRow) => void;
}) {
  const typeColor = row.ticketType === "SR"
    ? { bg: "#DBEAFE", text: "#1D4ED8" }
    : { bg: "#F3E8FF", text: "#6D28D9" };

  return (
    <div
      onClick={() => onOpen(row)}
      style={{
        background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12,
        padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14,
        boxShadow: "0 1px 4px rgba(0,0,0,.04)", transition: "box-shadow .15s, border-color .15s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)";
        e.currentTarget.style.borderColor = "#CBD5E1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.04)";
        e.currentTarget.style.borderColor = "#E5E7EB";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, fontFamily: "monospace",
          padding: "3px 8px", borderRadius: 4,
          background: typeColor.bg, color: typeColor.text, flexShrink: 0,
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

      {/* Approval hierarchy */}
      <div style={{
        background: "#F9FAFB", borderRadius: 8, padding: "10px 12px",
        border: "1px solid #F3F4F6",
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
          Onay Hiyerarşisi
        </div>
        <ApprovalHierarchy steps={row.instance.steps} profiles={profiles} />
      </div>

      {/* Actions */}
      <div
        style={{ display: "flex", gap: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
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
  const [selectedRow, setSelectedRow] = useState<ApprovalRow | null>(null);
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

  const rows = useMemo((): ApprovalRow[] => {
    if (!user) return [];

    const running = instances.filter((i) => i.status === "running");

    return running
      .filter((i) => i.ticketType === "service_request" || i.ticketType === "change_request")
      .flatMap((instance): ApprovalRow[] => {
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
            sr,
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
            cr,
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

      if (result.instanceCompleted) {
        if (row.ticketType === "SR") {
          if (result.outcome === "approved") await approveSR(row.instance.ticketId, { comments: comment });
          else if (result.outcome === "rejected") await rejectSR(row.instance.ticketId, { comments: comment });
        } else {
          if (result.outcome === "approved") await approveCR(row.instance.ticketId, { comments: comment });
          else if (result.outcome === "rejected") await rejectCR(row.instance.ticketId, { comments: comment });
        }
      }

      setDecisionModal(null);
      setSelectedRow(null);
      await loadInstances();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bir hata oluştu.";
      setError(msg);
      setDecisionModal(null);
    } finally {
      setSaving(false);
    }
  };

  const openDecide = (row: ApprovalRow, decision: "approved" | "rejected") => {
    setDecisionModal({ row, decision });
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
              onDecide={openDecide}
              onOpen={setSelectedRow}
            />
          ))}
        </div>
      )}

      {/* Detail Slide-Over */}
      {selectedRow && (
        <DetailSlideOver
          row={selectedRow}
          profiles={profiles}
          onClose={() => setSelectedRow(null)}
          onDecide={(row, decision) => {
            openDecide(row, decision);
          }}
        />
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
