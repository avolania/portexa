"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Ticket, ChevronRight, Clock, CheckCircle2, XCircle,
  AlertCircle, ClipboardList, MessageSquare, X, Send,
} from "lucide-react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useAuthStore } from "@/store/useAuthStore";
import { IncidentState, ServiceRequestState } from "@/lib/itsm/types/enums";
import { INCIDENT_STATE_MAP, SR_STATE_MAP } from "@/lib/itsm/ui-maps";
import type { Incident } from "@/lib/itsm/types/incident.types";
import type { ServiceRequest } from "@/lib/itsm/types/service-request.types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { tr } from "date-fns/locale";

function StateIcon({ state }: { state: string }) {
  const closed = [
    IncidentState.CLOSED, IncidentState.RESOLVED,
    ServiceRequestState.FULFILLED, ServiceRequestState.CLOSED,
  ].includes(state as IncidentState);
  const rejected = [ServiceRequestState.REJECTED, ServiceRequestState.CANCELLED].includes(
    state as ServiceRequestState
  );
  if (closed)   return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (rejected) return <XCircle      className="w-4 h-4 text-red-500"     />;
  return          <Clock           className="w-4 h-4 text-amber-500"   />;
}

function TicketModal({
  ticket,
  type,
  onClose,
  onAddComment,
}: {
  ticket: Incident | ServiceRequest;
  type: "incident" | "sr";
  onClose: () => void;
  onAddComment: (id: string, text: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const stateInfo = type === "incident"
    ? INCIDENT_STATE_MAP[(ticket as Incident).state]
    : SR_STATE_MAP[(ticket as ServiceRequest).state];

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    await onAddComment(ticket.id, comment.trim());
    setComment("");
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-gray-400">{ticket.number}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", stateInfo.badge)}>
                {stateInfo.label}
              </span>
            </div>
            <h2 className="text-base font-semibold text-gray-900 leading-snug">{ticket.shortDescription}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-0.5">Tür</div>
              <div className="font-medium text-gray-900">
                {type === "incident" ? "Olay" : "Servis Talebi"}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-0.5">Oluşturulma</div>
              <div className="font-medium text-gray-900">
                {format(new Date(ticket.createdAt), "dd MMM yyyy", { locale: tr })}
              </div>
            </div>
            {type === "incident" && (
              <>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-500 mb-0.5">Kategori</div>
                  <div className="font-medium text-gray-900 capitalize">{(ticket as Incident).category || "—"}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-500 mb-0.5">Öncelik</div>
                  <div className="font-medium text-gray-900">{(ticket as Incident).priority}</div>
                </div>
              </>
            )}
            {type === "sr" && (
              <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                <div className="text-xs text-gray-500 mb-0.5">Talep Türü</div>
                <div className="font-medium text-gray-900">{(ticket as ServiceRequest).requestType || "—"}</div>
              </div>
            )}
          </div>

          {ticket.description && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Açıklama</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </div>
          )}

          {ticket.comments.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Yorumlar ({ticket.comments.length})
              </div>
              <div className="space-y-3">
                {ticket.comments.map((c) => (
                  <div key={c.id} className="bg-blue-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-blue-800">{c.authorName ?? "Destek Ekibi"}</span>
                      <span className="text-xs text-blue-400">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: tr })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Yorum Ekle</div>
            <div className="flex gap-2">
              <textarea
                className="input flex-1 min-h-[72px] resize-none text-sm"
                placeholder="Ek bilgi veya güncelleme ekleyin..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                onClick={handleComment}
                disabled={!comment.trim() || sending}
                className="self-end btn-primary px-3 py-2 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Tab = "all" | "open" | "closed";

export default function HelpdeskMyTicketsPage() {
  const { user } = useAuthStore();
  const { incidents, addComment: addIncidentComment } = useIncidentStore();
  const { serviceRequests, addComment: addSRComment } = useServiceRequestStore();

  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<
    { ticket: Incident | ServiceRequest; type: "incident" | "sr" } | null
  >(null);

  if (!user) return null;

  const myIncidents = incidents.filter(
    (i) => i.callerId === user.id || i.reportedById === user.id
  );
  const mySRs = serviceRequests.filter((sr) => sr.requestedById === user.id);

  const CLOSED_INCIDENT = [IncidentState.CLOSED, IncidentState.RESOLVED];
  const CLOSED_SR = [
    ServiceRequestState.FULFILLED, ServiceRequestState.CLOSED,
    ServiceRequestState.REJECTED, ServiceRequestState.CANCELLED,
  ];

  type Row = { ticket: Incident | ServiceRequest; type: "incident" | "sr"; closed: boolean };
  const all: Row[] = [
    ...myIncidents.map((i) => ({
      ticket: i as Incident | ServiceRequest,
      type: "incident" as const,
      closed: CLOSED_INCIDENT.includes(i.state),
    })),
    ...mySRs.map((sr) => ({
      ticket: sr as Incident | ServiceRequest,
      type: "sr" as const,
      closed: CLOSED_SR.includes(sr.state),
    })),
  ].sort((a, b) => b.ticket.createdAt.localeCompare(a.ticket.createdAt));

  const filtered = all.filter((r) => {
    if (tab === "open")   return !r.closed;
    if (tab === "closed") return r.closed;
    return true;
  });

  const openCount   = all.filter((r) => !r.closed).length;
  const closedCount = all.filter((r) =>  r.closed).length;

  const handleAddComment = async (id: string, text: string) => {
    if (!selected) return;
    if (selected.type === "incident") {
      await addIncidentComment(id, { content: text });
      const updated = useIncidentStore.getState().incidents.find((i) => i.id === id);
      if (updated) setSelected({ ticket: updated, type: "incident" });
    } else {
      await addSRComment(id, { content: text });
      const updated = useServiceRequestStore.getState().serviceRequests.find((s) => s.id === id);
      if (updated) setSelected({ ticket: updated, type: "sr" });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/helpdesk/portal" className="hover:text-indigo-600">Destek Portalı</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-900 font-medium">Taleplerim</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Taleplerim</h1>
              <p className="text-sm text-gray-500">Açtığınız olay ve servis talepleri</p>
            </div>
          </div>
          <Link href="/helpdesk/portal" className="btn-primary text-sm">+ Yeni Talep</Link>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {([
          { id: "all",    label: "Tümü",   count: all.length  },
          { id: "open",   label: "Açık",   count: openCount   },
          { id: "closed", label: "Kapalı", count: closedCount },
        ] as { id: Tab; label: string; count: number }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {t.label}
            <span className={cn(
              "ml-1.5 px-1.5 py-0.5 rounded-full text-xs",
              tab === t.id ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <Ticket className="w-10 h-10" />
            <p className="text-sm">
              Henüz {tab === "open" ? "açık" : tab === "closed" ? "kapalı" : "hiç"} talebiniz yok.
            </p>
            <Link href="/helpdesk/portal" className="text-sm text-indigo-600 hover:underline">
              Yeni talep oluşturun →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map(({ ticket, type, closed }) => {
              const stateInfo = type === "incident"
                ? INCIDENT_STATE_MAP[(ticket as Incident).state]
                : SR_STATE_MAP[(ticket as ServiceRequest).state];
              return (
                <li key={ticket.id}>
                  <button
                    onClick={() => setSelected({ ticket, type })}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                      type === "incident" ? "bg-red-100" : "bg-indigo-100"
                    )}>
                      {type === "incident"
                        ? <AlertCircle  className="w-4 h-4 text-red-600"    />
                        : <ClipboardList className="w-4 h-4 text-indigo-600" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs text-gray-400">{ticket.number}</span>
                        <span className={cn("px-1.5 py-0.5 rounded-full text-xs font-medium", stateInfo.badge)}>
                          {stateInfo.label}
                        </span>
                        {ticket.comments.length > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-gray-400">
                            <MessageSquare className="w-3 h-3" /> {ticket.comments.length}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-900 truncate">{ticket.shortDescription}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: tr })}
                      </div>
                    </div>

                    <StateIcon state={type === "incident" ? (ticket as Incident).state : (ticket as ServiceRequest).state} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected && (
        <TicketModal
          ticket={selected.ticket}
          type={selected.type}
          onClose={() => setSelected(null)}
          onAddComment={handleAddComment}
        />
      )}
    </div>
  );
}
