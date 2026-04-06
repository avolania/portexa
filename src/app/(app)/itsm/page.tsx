"use client";

import Link from "next/link";
import {
  AlertTriangle, ClipboardList, GitPullRequest, ArrowRight,
  XCircle, CheckCircle2, Plus, TrendingUp, TrendingDown,
} from "lucide-react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { useAuthStore } from "@/store/useAuthStore";
import {
  IncidentState, ServiceRequestState, ChangeRequestState,
  ApprovalState, Priority, ChangeRisk,
} from "@/lib/itsm/types/enums";
import { ITSM_PRIORITY_MAP, INCIDENT_STATE_MAP, SR_STATE_MAP, CR_STATE_MAP } from "@/lib/itsm/ui-maps";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { tr } from "date-fns/locale";

// ─── SLA bar (inline yüzde gösterimi) ─────────────────────────────────────────

function SLAPercent({ deadline, breached }: { deadline: string; breached: boolean }) {
  const now = Date.now();
  const end = new Date(deadline).getTime();
  const remainMs = end - now;
  if (breached || remainMs < 0) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1 bg-gray-100 rounded-full"><div className="h-full w-full bg-red-500 rounded-full" /></div>
        <span className="text-xs font-semibold text-red-600 tabular-nums w-8">100%</span>
      </div>
    );
  }
  // Toplam süreyi bilemiyoruz, kalan saate göre skor yap (24s max)
  const remainH = remainMs / 3_600_000;
  const pct = Math.max(0, Math.min(100, Math.round((1 - remainH / 24) * 100)));
  const color = pct > 75 ? "bg-red-500" : pct > 50 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn(
        "text-xs font-semibold tabular-nums w-8",
        pct > 75 ? "text-red-600" : pct > 50 ? "text-amber-600" : "text-emerald-600"
      )}>{pct}%</span>
    </div>
  );
}

// ─── Mini sparkline (SVG) ──────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const h = 40;
  const w = 200;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 6)}`)
    .join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sg-${color.replace("#", "")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Risk badge ───────────────────────────────────────────────────────────────

const RISK_BADGE: Record<string, string> = {
  [ChangeRisk.CRITICAL]: "bg-red-100 text-red-700",
  [ChangeRisk.HIGH]:     "bg-orange-100 text-orange-700",
  [ChangeRisk.MODERATE]: "bg-amber-100 text-amber-700",
  [ChangeRisk.LOW]:      "bg-gray-100 text-gray-600",
};

const RISK_LABEL: Record<string, string> = {
  [ChangeRisk.CRITICAL]: "Kritik",
  [ChangeRisk.HIGH]:     "Yüksek",
  [ChangeRisk.MODERATE]: "Orta",
  [ChangeRisk.LOW]:      "Düşük",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ITSMDashboardPage() {
  const { incidents } = useIncidentStore();
  const { serviceRequests } = useServiceRequestStore();
  const { changeRequests } = useChangeRequestStore();

  // KPI
  const openIncidents   = incidents.filter((i) => ![IncidentState.CLOSED, IncidentState.RESOLVED].includes(i.state)).length;
  const slaBreachedCnt  = incidents.filter((i) => i.sla.resolutionBreached).length;
  const pendingSRs      = serviceRequests.filter((sr) => sr.approvalState === ApprovalState.REQUESTED).length;
  const activeCRs       = changeRequests.filter((cr) => ![ChangeRequestState.CLOSED, ChangeRequestState.CANCELLED].includes(cr.state)).length;

  // Total counts (önceki haftayla fark simüle — gerçek data yoksa sabit)
  const totalIncidents = incidents.length;
  const slaCompliance  = totalIncidents > 0 ? Math.round(((totalIncidents - slaBreachedCnt) / totalIncidents) * 100) : 100;

  // Son kayıtlar
  const recentIncidents = [...incidents]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const recentSRs = [...serviceRequests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  const recentCRs = [...changeRequests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  // Açık incident öncelik dağılımı
  const openByPriority = [
    { key: Priority.CRITICAL, label: "Kritik",  bar: "bg-red-500"    },
    { key: Priority.HIGH,     label: "Yüksek",  bar: "bg-orange-500" },
    { key: Priority.MEDIUM,   label: "Orta",    bar: "bg-amber-400"  },
    { key: Priority.LOW,      label: "Düşük",   bar: "bg-gray-400"   },
  ].map((p) => ({
    ...p,
    count: incidents.filter(
      (i) => i.priority === p.key && ![IncidentState.CLOSED, IncidentState.RESOLVED].includes(i.state)
    ).length,
  }));

  // SLA performans (önceliğe göre)
  const slaByPriority = [
    { label: "P1 — Kritik",  target: "1 saat",   key: Priority.CRITICAL },
    { label: "P2 — Yüksek",  target: "4 saat",   key: Priority.HIGH     },
    { label: "P3 — Orta",    target: "24 saat",   key: Priority.MEDIUM   },
    { label: "P4 — Düşük",   target: "72 saat",   key: Priority.LOW      },
  ].map((row) => {
    const group = incidents.filter((i) => i.priority === row.key);
    const met   = group.filter((i) => !i.sla.resolutionBreached).length;
    const pct   = group.length > 0 ? Math.round((met / group.length) * 100) : 100;
    return { ...row, pct };
  });

  // Sparkline data — son 7 gün incident sayısı
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().slice(0, 10);
    return {
      inc: incidents.filter((t) => t.createdAt.slice(0, 10) === ds).length,
      sr:  serviceRequests.filter((t) => t.createdAt.slice(0, 10) === ds).length,
      cr:  changeRequests.filter((t) => t.createdAt.slice(0, 10) === ds).length,
    };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ITSM Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: tr })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/itsm/incidents" className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Incident
          </Link>
          <Link href="/itsm/service-requests" className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
            <Plus className="w-3.5 h-3.5" /> SR
          </Link>
          <Link href="/itsm/change-requests" className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-100 transition-colors">
            <Plus className="w-3.5 h-3.5" /> CR
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Açık Incident", value: openIncidents,
            delta: `${slaBreachedCnt} SLA ihlali`, deltaUp: slaBreachedCnt > 0,
            icon: AlertTriangle, accent: "border-l-red-500",
            iconBg: "bg-red-50", iconColor: "text-red-600",
            href: "/itsm/incidents",
          },
          {
            label: "Bekleyen SR", value: pendingSRs,
            delta: `${serviceRequests.length} toplam`, deltaUp: false,
            icon: ClipboardList, accent: "border-l-blue-500",
            iconBg: "bg-blue-50", iconColor: "text-blue-600",
            href: "/itsm/service-requests",
          },
          {
            label: "Aktif CR", value: activeCRs,
            delta: `${changeRequests.length} toplam`, deltaUp: false,
            icon: GitPullRequest, accent: "border-l-violet-500",
            iconBg: "bg-violet-50", iconColor: "text-violet-600",
            href: "/itsm/change-requests",
          },
          {
            label: "SLA Uyumu", value: `${slaCompliance}%`,
            delta: slaBreachedCnt > 0 ? `${slaBreachedCnt} ihlal` : "Tüm SLA'lar uyumlu",
            deltaUp: slaBreachedCnt > 0,
            icon: slaBreachedCnt > 0 ? XCircle : CheckCircle2,
            accent: slaCompliance >= 90 ? "border-l-emerald-500" : "border-l-amber-500",
            iconBg: slaCompliance >= 90 ? "bg-emerald-50" : "bg-amber-50",
            iconColor: slaCompliance >= 90 ? "text-emerald-600" : "text-amber-600",
            href: "/itsm/incidents",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href}
              className={cn("card border-l-4 hover:shadow-md transition-all relative overflow-hidden group", card.accent)}>
              <div className="flex items-center justify-between mb-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", card.iconBg)}>
                  <Icon className={cn("w-4.5 h-4.5", card.iconColor)} />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>
              <div className="text-3xl font-bold text-gray-900 tracking-tight">{card.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{card.label}</div>
              <div className={cn("flex items-center gap-1 text-xs font-medium mt-2",
                card.deltaUp ? "text-red-600" : "text-gray-400")}>
                {card.deltaUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {card.delta}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-5">

          {/* Incident tablosu */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-semibold text-gray-900">Son Incident'lar</h2>
                <span className="text-xs font-bold font-mono bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {recentIncidents.length}
                </span>
              </div>
              <Link href="/itsm/incidents" className="text-xs font-medium text-indigo-600 hover:underline flex items-center gap-1">
                Tümünü gör <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {recentIncidents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Henüz incident bulunmuyor.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["ID", "Başlık", "Öncelik", "Durum", "Atanan", "SLA"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentIncidents.map((inc) => {
                    const st  = INCIDENT_STATE_MAP[inc.state];
                    const pri = ITSM_PRIORITY_MAP[inc.priority];
                    return (
                      <tr key={inc.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/itsm/incidents/${inc.id}`}>
                        <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-semibold whitespace-nowrap">{inc.number}</td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <span className="text-sm font-medium text-gray-900 truncate block">{inc.shortDescription}</span>
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(inc.createdAt), { addSuffix: true, locale: tr })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold", pri.badge)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", pri.dot)} />
                            {pri.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", st.badge)}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {inc.assignedToId ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600">
                                {inc.assignedToId.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="truncate max-w-[70px]">{inc.assignedToId.slice(0, 8)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300">Atanmadı</span>
                          )}
                        </td>
                        <td className="px-4 py-3 w-28">
                          {[IncidentState.CLOSED, IncidentState.RESOLVED].includes(inc.state) ? (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Tamamlandı
                            </span>
                          ) : (
                            <SLAPercent deadline={inc.sla.resolutionDeadline} breached={inc.sla.resolutionBreached} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* SR + CR yan yana */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Service Requests */}
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100">
                <ClipboardList className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-900 flex-1">Servis Talepleri</h3>
                <span className="text-xs font-bold font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{recentSRs.length}</span>
              </div>
              {recentSRs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Kayıt yok.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentSRs.map((sr) => {
                    const st = SR_STATE_MAP[sr.state];
                    return (
                      <Link key={sr.id} href={`/itsm/service-requests/${sr.id}`}
                        className="flex flex-col px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-mono font-semibold text-blue-600">{sr.number}</span>
                          <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", st.badge)}>{st.label}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate">{sr.shortDescription}</span>
                        <span className="text-xs text-gray-400 mt-0.5">
                          {formatDistanceToNow(new Date(sr.createdAt), { addSuffix: true, locale: tr })}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
              <div className="px-4 py-2.5 border-t border-gray-50 text-center">
                <Link href="/itsm/service-requests" className="text-xs font-semibold text-blue-600 hover:underline">
                  Tümünü gör →
                </Link>
              </div>
            </div>

            {/* Change Requests */}
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100">
                <GitPullRequest className="w-4 h-4 text-violet-500" />
                <h3 className="text-sm font-semibold text-gray-900 flex-1">Değişiklik Talepleri</h3>
                <span className="text-xs font-bold font-mono bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{recentCRs.length}</span>
              </div>
              {recentCRs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Kayıt yok.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentCRs.map((cr) => {
                    const st = CR_STATE_MAP[cr.state];
                    return (
                      <Link key={cr.id} href={`/itsm/change-requests/${cr.id}`}
                        className="flex flex-col px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-mono font-semibold text-violet-600">{cr.number}</span>
                          <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", st.badge)}>{st.label}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate">{cr.shortDescription}</span>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(cr.createdAt), { addSuffix: true, locale: tr })}
                          </span>
                          <span className={cn("px-1.5 py-0.5 rounded text-xs font-semibold", RISK_BADGE[cr.risk])}>
                            Risk: {RISK_LABEL[cr.risk]}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
              <div className="px-4 py-2.5 border-t border-gray-50 text-center">
                <Link href="/itsm/change-requests" className="text-xs font-semibold text-violet-600 hover:underline">
                  Tümünü gör →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-5">

          {/* Haftalık Trend */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Haftalık Ticket Trendi</h3>
            <p className="text-xs text-gray-400 mb-4">Son 7 gün</p>
            <div className="space-y-4">
              {[
                { label: "Incidents",           data: last7.map((d) => d.inc), color: "#ef4444" },
                { label: "Servis Talepleri",    data: last7.map((d) => d.sr),  color: "#3b82f6" },
                { label: "Değişiklik Talepleri",data: last7.map((d) => d.cr),  color: "#8b5cf6" },
              ].map((row) => {
                const avg = row.data.length ? Math.round(row.data.reduce((a, b) => a + b, 0) / row.data.length * 10) / 10 : 0;
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold" style={{ color: row.color }}>{row.label}</span>
                      <span className="text-xs text-gray-400 font-mono">Ort: {avg}</span>
                    </div>
                    <Sparkline data={row.data} color={row.color} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* SLA Performansı */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">SLA Performansı</h3>
            <div className="space-y-4">
              {slaByPriority.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-700">{row.label}</span>
                    <span className="text-xs text-gray-400 font-mono">Hedef: {row.target}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all",
                          row.pct >= 95 ? "bg-emerald-500" : row.pct >= 85 ? "bg-amber-400" : "bg-red-500"
                        )}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className={cn(
                      "text-xs font-bold font-mono w-10 text-right",
                      row.pct >= 95 ? "text-emerald-600" : row.pct >= 85 ? "text-amber-600" : "text-red-600"
                    )}>{row.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Açık Incident Dağılımı */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Açık Incident Dağılımı</h3>
            <div className="space-y-3">
              {openByPriority.map((p) => {
                const pct = openIncidents > 0 ? Math.round((p.count / openIncidents) * 100) : 0;
                return (
                  <div key={p.key} className="flex items-center gap-3">
                    <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", p.bar)} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">{p.label}</span>
                        <span className="text-sm font-semibold text-gray-900">{p.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", p.bar)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {openIncidents === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">Açık incident yok.</p>
              )}
            </div>
          </div>

          {/* Hızlı Erişim */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Hızlı Erişim</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Yeni Incident", href: "/itsm/incidents",        bg: "bg-red-50 hover:bg-red-100",     text: "text-red-700"    },
                { label: "Yeni SR",       href: "/itsm/service-requests", bg: "bg-blue-50 hover:bg-blue-100",   text: "text-blue-700"   },
                { label: "Yeni CR",       href: "/itsm/change-requests",  bg: "bg-violet-50 hover:bg-violet-100",text: "text-violet-700" },
                { label: "Ayarlar",       href: "/itsm/settings",         bg: "bg-gray-50 hover:bg-gray-100",   text: "text-gray-700"   },
              ].map((a) => (
                <Link key={a.href} href={a.href}
                  className={cn("flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors", a.bg, a.text)}>
                  <Plus className="w-3.5 h-3.5" /> {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
