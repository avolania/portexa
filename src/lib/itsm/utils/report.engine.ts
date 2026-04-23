import { subDays, isAfter, parseISO, format, differenceInMinutes } from "date-fns";
import { tr } from "date-fns/locale";
import type { Incident } from "@/lib/itsm/types/incident.types";
import type { ServiceRequest } from "@/lib/itsm/types/service-request.types";
import type { ChangeRequest } from "@/lib/itsm/types/change-request.types";
import type { CustomReport, ReportGroupBy } from "@/lib/itsm/types/custom-report.types";

export interface ReportRow { name: string; value: number }

type AnyTicket = (Incident | ServiceRequest | ChangeRequest) & { _type: "INC" | "SR" | "CR" };

function getGroupKey(item: AnyTicket, groupBy: ReportGroupBy, profiles: Record<string, { name: string }>): string {
  switch (groupBy) {
    case "state":    return item.state;
    case "priority": return item.priority;
    case "assignee": {
      const id = item.assignedToId;
      if (!id) return "Atanmamış";
      return profiles[id]?.name ?? id.slice(0, 8);
    }
    case "category": return (item as Incident).category ?? (item as ServiceRequest).requestType ?? "–";
    case "week":     return format(parseISO(item.createdAt), "d MMM", { locale: tr });
    case "month":    return format(parseISO(item.createdAt), "MMM yyyy", { locale: tr });
  }
}

function computeMetric(items: AnyTicket[], metric: CustomReport["metric"]): number {
  if (items.length === 0) return 0;

  switch (metric) {
    case "count":
      return items.length;

    case "avg_resolution_hours": {
      const resolved = items.filter((i) => {
        const ri = i as Incident;
        const sr = i as ServiceRequest;
        return ri.resolvedAt || sr.fulfilledAt;
      });
      if (resolved.length === 0) return 0;
      const total = resolved.reduce((sum, i) => {
        const ri = i as Incident;
        const sr = i as ServiceRequest;
        const end = ri.resolvedAt ?? sr.fulfilledAt ?? i.updatedAt;
        return sum + differenceInMinutes(parseISO(end), parseISO(i.createdAt));
      }, 0);
      return Math.round(total / resolved.length / 60);
    }

    case "sla_compliance_pct": {
      const breached = items.filter((i) => {
        const ri = i as Incident;
        const sr = i as ServiceRequest;
        return ri.sla?.resolutionBreached || sr.sla?.slaBreached;
      }).length;
      return Math.round(((items.length - breached) / items.length) * 100);
    }
  }
}

export function computeReport(
  report: CustomReport,
  incidents: Incident[],
  serviceRequests: ServiceRequest[],
  changeRequests: ChangeRequest[],
  profiles: Record<string, { name: string }>,
): ReportRow[] {
  // 1. Collect source data
  let items: AnyTicket[] = [];
  if (report.source === "INC" || report.source === "ALL")
    items.push(...incidents.map((i) => ({ ...i, _type: "INC" as const })));
  if (report.source === "SR"  || report.source === "ALL")
    items.push(...serviceRequests.map((s) => ({ ...s, _type: "SR" as const })));
  if (report.source === "CR"  || report.source === "ALL")
    items.push(...changeRequests.map((c) => ({ ...c, _type: "CR" as const })));

  // 2. Date filter
  if (report.filters.dateRange !== "all") {
    const days = parseInt(report.filters.dateRange);
    const cutoff = subDays(new Date(), days);
    items = items.filter((i) => isAfter(parseISO(i.createdAt), cutoff));
  }

  // 3. Priority / state filters
  if (report.filters.priorities?.length)
    items = items.filter((i) => report.filters.priorities!.includes(i.priority));
  if (report.filters.states?.length)
    items = items.filter((i) => report.filters.states!.includes(i.state));

  // 4. Group
  const groups = new Map<string, AnyTicket[]>();
  for (const item of items) {
    const key = getGroupKey(item, report.groupBy, profiles);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  // 5. Compute metric per group + sort by value desc
  return Array.from(groups.entries())
    .map(([name, rows]) => ({ name, value: computeMetric(rows, report.metric) }))
    .sort((a, b) => b.value - a.value);
}
