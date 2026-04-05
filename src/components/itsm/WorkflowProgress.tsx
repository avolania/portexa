"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Circle, ChevronDown, ChevronUp, Clock, User } from "lucide-react";
import { useWorkflowInstanceStore } from "@/store/useWorkflowInstanceStore";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { WorkflowTicketType, WorkflowStepInstance } from "@/lib/itsm/types/workflow-engine.types";

// ─── Onay karar formu ─────────────────────────────────────────────────────────

function DecisionForm({
  stepDefId,
  instanceId,
  onDone,
}: {
  stepDefId: string;
  instanceId: string;
  onDone: (outcome: 'approved' | 'rejected' | 'pending') => void;
}) {
  const { decide } = useWorkflowInstanceStore();
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);

  const submit = async (decision: "approved" | "rejected") => {
    if (decision === "rejected" && !comment.trim()) return;
    setSaving(true);
    const result = await decide(instanceId, stepDefId, decision, comment || undefined);
    setSaving(false);
    onDone(result?.outcome ?? "pending");
  };

  if (!mode) {
    return (
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setMode("approve")}
          className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
        >
          Onayla
        </button>
        <button
          onClick={() => setMode("reject")}
          className="flex-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 border border-red-200 transition-colors"
        >
          Reddet
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        className="input w-full text-xs min-h-[60px] resize-none"
        placeholder={mode === "reject" ? "Red gerekçesi yazın... *" : "Yorum ekle (isteğe bağlı)"}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={() => submit(mode === "approve" ? "approved" : "rejected")}
          disabled={saving || (mode === "reject" && !comment.trim())}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50",
            mode === "approve"
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-red-600 text-white hover:bg-red-700"
          )}
        >
          {saving ? "Kaydediliyor..." : mode === "approve" ? "Onayla" : "Reddet"}
        </button>
        <button
          onClick={() => setMode(null)}
          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200"
        >
          İptal
        </button>
      </div>
    </div>
  );
}

// ─── Tek adım satırı ──────────────────────────────────────────────────────────

function StepRow({
  step,
  instanceId,
  isCurrent,
  canDecide,
  onDecision,
}: {
  step: WorkflowStepInstance;
  instanceId: string;
  isCurrent: boolean;
  canDecide: boolean;
  onDecision: (outcome: 'approved' | 'rejected' | 'pending') => void;
}) {
  const [expanded, setExpanded] = useState(isCurrent);
  const { profiles } = useAuthStore();

  const iconClass = cn("w-5 h-5 shrink-0 mt-0.5");
  const StatusIcon =
    step.status === "approved" ? (
      <CheckCircle2 className={cn(iconClass, "text-emerald-500")} />
    ) : step.status === "rejected" ? (
      <XCircle className={cn(iconClass, "text-red-500")} />
    ) : step.status === "active" ? (
      <Clock className={cn(iconClass, "text-indigo-500")} />
    ) : (
      <Circle className={cn(iconClass, "text-gray-300")} />
    );

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        step.status === "active"
          ? "border-indigo-200 bg-indigo-50/50"
          : step.status === "approved"
          ? "border-emerald-100 bg-emerald-50/30"
          : step.status === "rejected"
          ? "border-red-100 bg-red-50/30"
          : "border-gray-100 bg-white"
      )}
    >
      <div
        className="flex items-start gap-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {StatusIcon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                step.status === "active"
                  ? "text-indigo-700"
                  : step.status === "approved"
                  ? "text-emerald-700"
                  : step.status === "rejected"
                  ? "text-red-700"
                  : "text-gray-400"
              )}
            >
              {step.label}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {step.status === "active" && (
                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                  Bekliyor
                </span>
              )}
              {step.completedAt && (
                <span className="text-xs text-gray-400">
                  {format(new Date(step.completedAt), "dd MMM HH:mm", { locale: tr })}
                </span>
              )}
              {(step.decisions.length > 0 || step.status === "active") &&
                (expanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {step.resolvedApproverIds.length > 0 ? (
              <span className="text-xs text-gray-500">
                {step.resolvedApproverIds.map((uid) => {
                  const p = Object.values(profiles).find((p) => p.id === uid);
                  return p?.name ?? uid.slice(0, 8) + '…';
                }).join(', ')}
              </span>
            ) : (
              <span className="text-xs text-red-400">Onaycı bulunamadı</span>
            )}
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">
              {step.approvalMode === "all" ? "tümü onaylamalı" : "ilk onay yeterli"}
            </span>
          </div>
        </div>
      </div>

      {/* Genişletilmiş içerik */}
      {expanded && (
        <div className="mt-3 space-y-2 pl-7">
          {/* Verilen kararlar */}
          {step.decisions.map((d, i) => {
            const profile = Object.values(profiles).find((p) => p.id === d.approverId);
            const name = profile?.name ?? d.approverName;
            return (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <User className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <span className="font-medium text-gray-700">{name}</span>
                  <span
                    className={cn(
                      "ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium",
                      d.decision === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    )}
                  >
                    {d.decision === "approved" ? "Onayladı" : "Reddetti"}
                  </span>
                  {d.decidedAt && (
                    <span className="ml-1.5 text-gray-400">
                      {format(new Date(d.decidedAt), "dd MMM HH:mm", { locale: tr })}
                    </span>
                  )}
                  {d.comment && (
                    <p className="mt-1 text-gray-500 italic">{d.comment}</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Onay formu */}
          {isCurrent && canDecide && (
            <DecisionForm
              stepDefId={step.stepDefId}
              instanceId={instanceId}
              onDone={onDecision}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function WorkflowProgress({
  ticketType,
  ticketId,
  onApproved,
  onRejected,
}: {
  ticketType: WorkflowTicketType;
  ticketId: string;
  /** Tüm adımlar onaylandığında çağrılır; ticket store approve() burada tetiklenir */
  onApproved?: () => void;
  /** Herhangi bir adım reddedildiğinde çağrılır; ticket store reject() burada tetiklenir */
  onRejected?: (comment?: string) => void;
}) {
  const instance = useWorkflowInstanceStore((s) =>
    s.instances.find(
      (i) =>
        i.ticketId === ticketId &&
        i.ticketType === ticketType &&
        (i.status === "running" || i.status === "completed" || i.status === "rejected")
    )
  );
  const { user } = useAuthStore();

  if (!instance) return null;

  const activeStep = instance.steps[instance.currentStepIndex] ?? null;

  // Giriş yapan kullanıcı bu adıma karar verebilir mi?
  const canDecide =
    instance.status === "running" &&
    activeStep?.status === "active" &&
    !!user &&
    activeStep.resolvedApproverIds.includes(user.id) &&
    !activeStep.decisions.some((d) => d.approverId === user.id);

  const handleDecision = (outcome: "approved" | "rejected" | "pending") => {
    if (outcome === "approved") onApproved?.();
    else if (outcome === "rejected") onRejected?.();
  };

  const statusLabel =
    instance.status === "completed"
      ? "Onaylandı"
      : instance.status === "rejected"
      ? "Reddedildi"
      : `${instance.currentStepIndex + 1}/${instance.steps.length}. adım`;

  const statusColor =
    instance.status === "completed"
      ? "text-emerald-600 bg-emerald-50"
      : instance.status === "rejected"
      ? "text-red-600 bg-red-50"
      : "text-indigo-600 bg-indigo-50";

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Onay Akışı</h3>
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusColor)}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-2">
        {instance.steps.map((step, i) => (
          <StepRow
            key={step.stepDefId}
            step={step}
            instanceId={instance.id}
            isCurrent={i === instance.currentStepIndex && instance.status === "running"}
            canDecide={canDecide && i === instance.currentStepIndex}
            onDecision={handleDecision}
          />
        ))}
      </div>
    </div>
  );
}
