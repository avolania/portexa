"use client";

import Link from "next/link";
import {
  AlertCircle, ClipboardList, GitPullRequest, ArrowRight,
  Clock, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { IncidentState, ServiceRequestState, ChangeRequestState, ApprovalState } from "@/lib/itsm/types/enums";
import {
  ITSM_PRIORITY_MAP,
  INCIDENT_STATE_MAP,
  SR_STATE_MAP,
  CR_STATE_MAP,
} from "@/lib/itsm/ui-maps";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

function ITSMBadge({ label, className }: { label: string; className: string }) {
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", className)}>{label}</span>;
}

function SLABar({ deadline, breached }: { deadline: string; breached: boolean }) {
  const now = new Date();
  const end = new Date(deadline);
  const remainMs = end.getTime() - now.getTime();
  const remainH = Math.floor(remainMs / 3_600_000);
  if (breached || remainMs < 0) {
    return <span className="text-xs text-red-600 font-medium flex items-center gap-1"><XCircle className="w-3 h-3" />SLA İhlali</span>;
  }
  if (remainH < 2) {
    return <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{remainH}s kaldı</span>;
  }
  return <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" />{remainH}s kaldı</span>;
}

export default function ITSMDashboardPage() {
  const { incidents } = useIncidentStore();
  const { serviceRequests } = useServiceRequestStore();
  const { changeRequests } = useChangeRequestStore();

  // KPI counts
  const openIncidents    = incidents.filter((i) => ![IncidentState.CLOSED, IncidentState.RESOLVED].includes(i.state)).length;
  const slaBreached      = incidents.filter((i) => i.sla.resolutionBreached).length;
  const pendingApprovals = serviceRequests.filter((sr) => sr.approvalState === ApprovalState.REQUESTED).length;
  const activeCRs        = changeRequests.filter((cr) => ![ChangeRequestState.CLOSED, ChangeRequestState.CANCELLED].includes(cr.state)).length;

  // Recent data
  const recentIncidents = [...incidents]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const recentCRs = [...changeRequests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const pendingSRs = serviceRequests
    .filter((sr) => sr.state === ServiceRequestState.PENDING_APPROVAL)
    .slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ITSM</h1>
        <p className="text-sm text-gray-500 mt-1">IT Servis Yönetimi — Incident, Servis Talebi ve Değişiklik Yönetimi</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Açık Incident",       value: openIncidents,    icon: AlertCircle,    color: "text-red-600",    bg: "bg-red-50",     href: "/itsm/incidents"        },
          { label: "SLA İhlali",          value: slaBreached,      icon: Clock,          color: "text-orange-600", bg: "bg-orange-50",  href: "/itsm/incidents?sla=1"  },
          { label: "Onay Bekleyen Talep", value: pendingApprovals, icon: ClipboardList,  color: "text-amber-600",  bg: "bg-amber-50",   href: "/itsm/service-requests" },
          { label: "Aktif Değişiklik",    value: activeCRs,        icon: GitPullRequest, color: "text-indigo-600", bg: "bg-indigo-50",  href: "/itsm/change-requests"  },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} className="card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{card.value}</div>
              <div className="text-sm text-gray-500 mt-1">{card.label}</div>
            </Link>
          );
        })}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Incidents */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Son Incident'lar</h2>
              <Link href="/itsm/incidents" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                Tümünü gör <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentIncidents.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Henüz incident bulunmuyor.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentIncidents.map((inc) => {
                  const stateInfo    = INCIDENT_STATE_MAP[inc.state];
                  const priorityInfo = ITSM_PRIORITY_MAP[inc.priority];
                  return (
                    <Link key={inc.id} href={`/itsm/incidents/${inc.id}`}
                      className="flex items-center gap-3 py-3 hover:bg-gray-50 -mx-4 px-4 rounded transition-colors">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityInfo.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-mono">{inc.number}</span>
                          <span className="text-sm font-medium text-gray-900 truncate">{inc.shortDescription}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatDistanceToNow(new Date(inc.createdAt), { addSuffix: true, locale: tr })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <SLABar deadline={inc.sla.resolutionDeadline} breached={inc.sla.resolutionBreached} />
                        <ITSMBadge label={stateInfo.label} className={stateInfo.badge} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Change Requests */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Aktif Değişiklik Talepleri</h2>
              <Link href="/itsm/change-requests" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                Tümünü gör <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentCRs.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Henüz değişiklik talebi bulunmuyor.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentCRs.map((cr) => {
                  const stateInfo = CR_STATE_MAP[cr.state];
                  return (
                    <div key={cr.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-mono">{cr.number}</span>
                          <span className="text-sm font-medium text-gray-900 truncate">{cr.shortDescription}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Planlanan başlangıç: {new Date(cr.plannedStartDate).toLocaleDateString("tr-TR")}
                        </div>
                      </div>
                      <ITSMBadge label={stateInfo.label} className={stateInfo.badge} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-6">
          {/* Pending SR Approvals */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Onay Bekleyen Talepler</h2>
              <Link href="/itsm/service-requests" className="text-xs text-indigo-600 hover:underline">Tümü</Link>
            </div>
            {pendingSRs.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Onay bekleyen talep yok.</p>
            ) : (
              <div className="space-y-3">
                {pendingSRs.map((sr) => (
                  <div key={sr.id} className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <div className="text-xs text-gray-400 font-mono mb-0.5">{sr.number}</div>
                    <div className="text-sm font-medium text-gray-900 truncate">{sr.shortDescription}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(sr.createdAt), { addSuffix: true, locale: tr })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Incident priority breakdown */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Açık Incident Dağılımı</h2>
            {[
              { key: "1-Critical", label: "Kritik",  color: "bg-red-500" },
              { key: "2-High",     label: "Yüksek",  color: "bg-orange-500" },
              { key: "3-Medium",   label: "Orta",    color: "bg-amber-500" },
              { key: "4-Low",      label: "Düşük",   color: "bg-gray-400" },
            ].map((p) => {
              const count = incidents.filter(
                (i) => i.priority === p.key && ![IncidentState.CLOSED, IncidentState.RESOLVED].includes(i.state)
              ).length;
              const pct = openIncidents > 0 ? Math.round((count / openIncidents) * 100) : 0;
              return (
                <div key={p.key} className="flex items-center gap-3 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${p.color} flex-shrink-0`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">{p.label}</span>
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className={`h-full rounded-full ${p.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick links */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Hızlı Erişim</h2>
            <div className="space-y-2">
              {[
                { href: "/itsm/incidents",       label: "Tüm Incident'lar",        icon: AlertCircle    },
                { href: "/itsm/service-requests", label: "Servis Talepleri",        icon: ClipboardList  },
                { href: "/itsm/change-requests",  label: "Değişiklik Talepleri",    icon: GitPullRequest },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                  <Icon className="w-4 h-4 text-gray-400" />
                  {label}
                  <ArrowRight className="w-3 h-3 text-gray-400 ml-auto" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
