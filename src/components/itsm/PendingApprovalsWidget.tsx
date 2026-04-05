"use client";

import Link from "next/link";
import { Clock, ArrowRight, GitMerge } from "lucide-react";
import { useWorkflowInstanceStore } from "@/store/useWorkflowInstanceStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";

const TICKET_LINKS: Record<string, string> = {
  service_request: "/itsm/service-requests",
  change_request:  "/itsm/change-requests",
  incident:        "/itsm/incidents",
};

const TICKET_LABELS: Record<string, string> = {
  service_request: "SR",
  change_request:  "CHG",
  incident:        "INC",
};

const TICKET_COLORS: Record<string, string> = {
  service_request: "bg-blue-100 text-blue-700",
  change_request:  "bg-violet-100 text-violet-700",
  incident:        "bg-red-100 text-red-700",
};

export default function PendingApprovalsWidget() {
  const { user } = useAuthStore();
  const instances = useWorkflowInstanceStore((s) => s.instances);
  const serviceRequests = useServiceRequestStore((s) => s.serviceRequests);
  const changeRequests = useChangeRequestStore((s) => s.changeRequests);

  if (!user) return null;

  // Kullanıcının onay bekleyen aktif adımları
  const pending = instances
    .filter((i) => i.status === "running")
    .flatMap((instance) => {
      const step = instance.steps[instance.currentStepIndex];
      if (!step || step.status !== "active") return [];
      if (!step.resolvedApproverIds.includes(user.id)) return [];
      // Bu adımda zaten karar verdiyse gösterme
      if (step.decisions.some((d) => d.approverId === user.id)) return [];

      // Ticket başlığını bul
      let title = instance.ticketId;
      let number = "";
      if (instance.ticketType === "service_request") {
        const sr = serviceRequests.find((s) => s.id === instance.ticketId);
        if (sr) { title = sr.shortDescription; number = sr.number; }
      } else if (instance.ticketType === "change_request") {
        const cr = changeRequests.find((c) => c.id === instance.ticketId);
        if (cr) { title = cr.shortDescription; number = cr.number; }
      }

      return [{ instance, step, title, number }];
    });

  if (pending.length === 0) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitMerge className="w-4 h-4 text-indigo-500" />
          <h2 className="text-base font-semibold text-gray-900">Onay Bekleyen Talepler</h2>
        </div>
        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
          {pending.length}
        </span>
      </div>

      <div className="space-y-2">
        {pending.map(({ instance, step, title, number }) => (
          <Link
            key={instance.id}
            href={`${TICKET_LINKS[instance.ticketType]}/${instance.ticketId}`}
            className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded", TICKET_COLORS[instance.ticketType])}>
                  {TICKET_LABELS[instance.ticketType]}
                </span>
                {number && (
                  <span className="font-mono text-xs text-gray-400">{number}</span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="w-3 h-3 text-indigo-400" />
                <span className="text-xs text-indigo-600 font-medium">{step.label}</span>
                <span className="text-xs text-gray-400">adımında onayınız bekleniyor</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors mt-1 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
