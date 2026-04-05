"use client";

import { ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TicketEventType } from "@/lib/itsm/types/enums";
import type { TicketEvent } from "@/lib/itsm/types/interfaces";

// ─── Turkish labels & colors per event type ───────────────────────────────────

const EVENT_CONFIG: Record<
  TicketEventType,
  { label: string; dot: string }
> = {
  [TicketEventType.CREATED]:                   { label: "Oluşturuldu",               dot: "bg-indigo-400 border-indigo-300" },
  [TicketEventType.ASSIGNED]:                  { label: "Atandı",                    dot: "bg-blue-400 border-blue-300" },
  [TicketEventType.STATE_CHANGED]:             { label: "Durum değişti",             dot: "bg-violet-400 border-violet-300" },
  [TicketEventType.PRIORITY_CHANGED]:          { label: "Öncelik değişti",           dot: "bg-amber-400 border-amber-300" },
  [TicketEventType.COMMENT_ADDED]:             { label: "Yorum eklendi",             dot: "bg-gray-400 border-gray-300" },
  [TicketEventType.WORK_NOTE_ADDED]:           { label: "İş notu eklendi",           dot: "bg-gray-400 border-gray-300" },
  [TicketEventType.SLA_RESPONSE_BREACHED]:     { label: "Yanıt SLA ihlali",          dot: "bg-red-400 border-red-300" },
  [TicketEventType.SLA_RESOLUTION_BREACHED]:   { label: "Çözüm SLA ihlali",          dot: "bg-red-400 border-red-300" },
  [TicketEventType.SLA_PAUSED]:                { label: "SLA duraklatıldı",          dot: "bg-amber-400 border-amber-300" },
  [TicketEventType.SLA_RESUMED]:               { label: "SLA devam ediyor",          dot: "bg-emerald-400 border-emerald-300" },
  [TicketEventType.RESOLVED]:                  { label: "Çözüldü",                   dot: "bg-emerald-400 border-emerald-300" },
  [TicketEventType.CLOSED]:                    { label: "Kapatıldı",                 dot: "bg-emerald-500 border-emerald-400" },
  [TicketEventType.REOPENED]:                  { label: "Yeniden açıldı",            dot: "bg-orange-400 border-orange-300" },
  [TicketEventType.RELATED_CR_LINKED]:         { label: "CR bağlandı",              dot: "bg-indigo-400 border-indigo-300" },
  [TicketEventType.RELATED_INCIDENT_LINKED]:   { label: "Incident bağlandı",         dot: "bg-indigo-400 border-indigo-300" },
  [TicketEventType.CONVERTED_FROM_INCIDENT]:   { label: "Incident'tan dönüştürüldü", dot: "bg-violet-500 border-violet-400" },
};

function getConfig(type: TicketEventType) {
  return EVENT_CONFIG[type] ?? { label: type.replace(/_/g, " "), dot: "bg-gray-400 border-gray-300" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TicketTimeline({ timeline }: { timeline: TicketEvent[] }) {
  if (timeline.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-gray-400 text-center py-6">Aktivite kaydı yok.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <ol className="relative border-l border-gray-200 ml-3 space-y-6 py-2">
        {[...timeline].reverse().map((event) => {
          const { label, dot } = getConfig(event.type as TicketEventType);
          const isConversion = event.type === TicketEventType.CONVERTED_FROM_INCIDENT;

          return (
            <li key={event.id} className="ml-6">
              <span
                className={cn(
                  "absolute -left-2 w-4 h-4 rounded-full border-2 flex items-center justify-center",
                  dot,
                )}
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{event.actorName}</span>
                    <span className="text-sm text-gray-500">·</span>
                    <span
                      className={cn(
                        "text-sm",
                        isConversion ? "text-violet-700 font-medium" : "text-gray-600",
                      )}
                    >
                      {label}
                    </span>
                  </div>

                  {/* Değer değişimi (önceki → yeni) */}
                  {event.previousValue && event.newValue && !isConversion && (
                    <span className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <span>{event.previousValue}</span>
                      <ArrowRight className="w-3 h-3 shrink-0" />
                      <span>{event.newValue}</span>
                    </span>
                  )}

                  {/* Conversion: incident linki */}
                  {isConversion && event.newValue && (
                    <p className="text-xs text-violet-600 mt-0.5 font-medium">
                      {event.newValue} numaralı incident
                    </p>
                  )}

                  {/* Not */}
                  {event.note && !isConversion && (
                    <p className="text-xs text-gray-500 mt-0.5">{event.note}</p>
                  )}
                </div>

                <span className="text-xs text-gray-400 flex-shrink-0">
                  {format(new Date(event.timestamp), "dd MMM HH:mm", { locale: tr })}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
