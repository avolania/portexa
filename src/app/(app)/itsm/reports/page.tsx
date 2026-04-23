"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { useAuthStore } from "@/store/useAuthStore";
import { IncidentState, ServiceRequestState, ChangeRequestState, Priority } from "@/lib/itsm/types/enums";
import { cn } from "@/lib/utils";
import { subWeeks, startOfWeek, format, isAfter, parseISO, differenceInMinutes } from "date-fns";
import { tr } from "date-fns/locale";
import {
  AlertCircle, ClipboardList, GitPullRequest,
  TrendingUp, Clock, ShieldCheck, Users,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "ozet" | "trend" | "sla" | "ekip";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "ozet",  label: "Özet",      icon: TrendingUp  },
  { id: "trend", label: "Trend",     icon: Clock       },
  { id: "sla",   label: "SLA",       icon: ShieldCheck },
  { id: "ekip",  label: "Ekip",      icon: Users       },
];

const INC_TERMINAL = [IncidentState.RESOLVED, IncidentState.CLOSED];
const SR_TERMINAL  = [ServiceRequestState.FULFILLED, ServiceRequestState.CLOSED, ServiceRequestState.REJECTED, ServiceRequestState.CANCELLED];
const CR_TERMINAL  = [ChangeRequestState.IMPLEMENT, ChangeRequestState.CLOSED];

const PRIORITY_COLORS: Record<string, string> = {
  [Priority.CRITICAL]: "#DC2626",
  [Priority.HIGH]:     "#D97706",
  [Priority.MEDIUM]:   "#2563EB",
  [Priority.LOW]:      "#6B7280",
};
const PRIORITY_LABELS: Record<string, string> = {
  [Priority.CRITICAL]: "Critical",
  [Priority.HIGH]:     "High",
  [Priority.MEDIUM]:   "Medium",
  [Priority.LOW]:      "Low",
};
const TYPE_COLORS = { INC: "#DC2626", SR: "#2563EB", CR: "#7C3AED" };

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs font-medium text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-gray-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Simple bar for priority breakdown ───────────────────────────────────────

function PriorityBar({ data }: { data: { label: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <div className="text-xs text-gray-400">Veri yok</div>;
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-16 shrink-0">{d.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(d.count / total) * 100}%`, background: d.color }} />
          </div>
          <span className="text-xs font-medium text-gray-700 w-6 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { incidents }       = useIncidentStore();
  const { serviceRequests } = useServiceRequestStore();
  const { changeRequests }  = useChangeRequestStore();
  const profiles            = useAuthStore((s) => s.profiles);
  const [tab, setTab] = useState<Tab>("ozet");

  const resolveName = (id: string) => profiles[id]?.name ?? id.slice(0, 8);

  // ── Özet hesapları ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const openInc = incidents.filter((i) => !INC_TERMINAL.includes(i.state)).length;
    const openSR  = serviceRequests.filter((s) => !SR_TERMINAL.includes(s.state)).length;
    const openCR  = changeRequests.filter((c) => !CR_TERMINAL.includes(c.state)).length;

    const p1Count = incidents.filter((i) => i.priority === Priority.CRITICAL && !INC_TERMINAL.includes(i.state)).length;

    const slaBreached = [
      ...incidents.filter((i) => i.sla.resolutionBreached && !INC_TERMINAL.includes(i.state)),
      ...serviceRequests.filter((s) => s.sla.slaBreached && !SR_TERMINAL.includes(s.state)),
    ].length;

    const resolvedIncs = incidents.filter((i) => i.resolvedAt);
    const avgResMinutes = resolvedIncs.length
      ? resolvedIncs.reduce((sum, i) => {
          return sum + differenceInMinutes(parseISO(i.resolvedAt!), parseISO(i.createdAt));
        }, 0) / resolvedIncs.length
      : 0;
    const avgResHours = Math.round(avgResMinutes / 60);

    return { openInc, openSR, openCR, p1Count, slaBreached, avgResHours };
  }, [incidents, serviceRequests, changeRequests]);

  // Priority breakdown for INC
  const incPriorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of incidents) {
      if (!INC_TERMINAL.includes(i.state)) counts[i.priority] = (counts[i.priority] ?? 0) + 1;
    }
    return [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW].map((p) => ({
      label: PRIORITY_LABELS[p], count: counts[p] ?? 0, color: PRIORITY_COLORS[p],
    }));
  }, [incidents]);

  // State distribution
  const stateData = useMemo(() => {
    const incStates = incidents.reduce<Record<string, number>>((acc, i) => {
      acc[i.state] = (acc[i.state] ?? 0) + 1; return acc;
    }, {});
    return Object.entries(incStates).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  const STATE_PIE_COLORS = ["#3B82F6","#D97706","#7C3AED","#059669","#374151","#0891B2","#DC2626"];

  // ── Trend hesapları ────────────────────────────────────────────────────────

  const trendData = useMemo(() => {
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const start = startOfWeek(subWeeks(new Date(), 11 - i), { weekStartsOn: 1 });
      const end   = subWeeks(new Date(), 10 - i);
      return { start, end, label: format(start, "d MMM", { locale: tr }) };
    });

    return weeks.map(({ start, end, label }) => {
      const inc = incidents.filter((i) => {
        const d = parseISO(i.createdAt);
        return isAfter(d, start) && !isAfter(d, end);
      }).length;
      const sr = serviceRequests.filter((i) => {
        const d = parseISO(i.createdAt);
        return isAfter(d, start) && !isAfter(d, end);
      }).length;
      const cr = changeRequests.filter((i) => {
        const d = parseISO(i.createdAt);
        return isAfter(d, start) && !isAfter(d, end);
      }).length;
      return { label, INC: inc, SR: sr, CR: cr };
    });
  }, [incidents, serviceRequests, changeRequests]);

  // ── SLA hesapları ──────────────────────────────────────────────────────────

  const slaData = useMemo(() => {
    const calc = (items: typeof incidents, breachField: "resolutionBreached" | "responseBreached") => {
      const total   = items.length;
      const breached = items.filter((i) => i.sla[breachField]).length;
      const pct = total ? Math.round(((total - breached) / total) * 100) : 0;
      return { total, breached, ok: total - breached, pct };
    };

    const incRes  = calc(incidents, "resolutionBreached");
    const incResp = calc(incidents, "responseBreached");
    const srRes = {
      total: serviceRequests.length,
      breached: serviceRequests.filter((s) => s.sla.slaBreached).length,
      ok: serviceRequests.filter((s) => !s.sla.slaBreached).length,
      pct: serviceRequests.length ? Math.round((serviceRequests.filter((s) => !s.sla.slaBreached).length / serviceRequests.length) * 100) : 0,
    };

    // By priority
    const byPriority = [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW].map((p) => {
      const items = incidents.filter((i) => i.priority === p);
      const breached = items.filter((i) => i.sla.resolutionBreached).length;
      const pct = items.length ? Math.round(((items.length - breached) / items.length) * 100) : null;
      return { priority: PRIORITY_LABELS[p], pKey: p, total: items.length, breached, pct };
    });

    return { incRes, incResp, srRes, byPriority };
  }, [incidents, serviceRequests]);

  const slaChartData = [
    { name: "INC Çözüm",   ok: slaData.incRes.ok,  breach: slaData.incRes.breached  },
    { name: "INC Yanıt",   ok: slaData.incResp.ok, breach: slaData.incResp.breached },
    { name: "SR Çözüm",    ok: slaData.srRes.ok,   breach: slaData.srRes.breached   },
  ];

  // ── Ekip hesapları ─────────────────────────────────────────────────────────

  const agentData = useMemo(() => {
    const agents: Record<string, { name: string; assigned: number; resolved: number; totalMinutes: number }> = {};

    for (const inc of incidents) {
      if (!inc.assignedToId) continue;
      const key = inc.assignedToId;
      if (!agents[key]) agents[key] = { name: resolveName(key), assigned: 0, resolved: 0, totalMinutes: 0 };
      agents[key].assigned++;
      if (inc.resolvedAt) {
        agents[key].resolved++;
        agents[key].totalMinutes += differenceInMinutes(parseISO(inc.resolvedAt), parseISO(inc.createdAt));
      }
    }
    for (const sr of serviceRequests) {
      if (!sr.assignedToId) continue;
      const key = sr.assignedToId;
      if (!agents[key]) agents[key] = { name: resolveName(key), assigned: 0, resolved: 0, totalMinutes: 0 };
      agents[key].assigned++;
      if (sr.fulfilledAt) {
        agents[key].resolved++;
        agents[key].totalMinutes += differenceInMinutes(parseISO(sr.fulfilledAt), parseISO(sr.createdAt));
      }
    }

    return Object.entries(agents)
      .map(([, v]) => ({
        ...v,
        avgHours: v.resolved > 0 ? Math.round(v.totalMinutes / v.resolved / 60) : null,
      }))
      .sort((a, b) => b.assigned - a.assigned)
      .slice(0, 15);
  }, [incidents, serviceRequests, profiles]);

  // ── Kategori breakdown ─────────────────────────────────────────────────────

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of incidents) {
      if (i.category) counts[i.category] = (counts[i.category] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [incidents]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Raporlar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ticket metrikleri ve ekip performansı</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}>
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── ÖZET TAB ───────────────────────────────────────────────────────── */}
      {tab === "ozet" && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard label="Açık Incident" value={stats.openInc}   color="bg-red-50 text-red-600"     icon={AlertCircle}    />
            <StatCard label="Açık SR"        value={stats.openSR}   color="bg-blue-50 text-blue-600"   icon={ClipboardList}  />
            <StatCard label="Açık CR"        value={stats.openCR}   color="bg-violet-50 text-violet-600" icon={GitPullRequest} />
            <StatCard label="P1 Aktif"       value={stats.p1Count}  color="bg-red-50 text-red-700"     icon={AlertCircle}    sub="Kritik öncelik" />
            <StatCard label="SLA İhlali"     value={stats.slaBreached} color="bg-amber-50 text-amber-600" icon={Clock}       sub="Açık ticket'larda" />
            <StatCard label="Ort. Çözüm"     value={`${stats.avgResHours}s`} color="bg-emerald-50 text-emerald-600" icon={Clock} sub="Incident (saat)" />
          </div>

          {/* Graphs row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Priority breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Açık Incident — Öncelik Dağılımı</h2>
              <PriorityBar data={incPriorityData} />
            </div>

            {/* State pie */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Incident Durum Dağılımı</h2>
              {stateData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-xs text-gray-400">Veri yok</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={stateData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false} fontSize={10}>
                      {stateData.map((_, i) => <Cell key={i} fill={STATE_PIE_COLORS[i % STATE_PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v} ticket`]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category */}
          {categoryData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Kategori Bazında Incident Hacmi</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Ticket" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── TREND TAB ──────────────────────────────────────────────────────── */}
      {tab === "trend" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Son 12 Hafta — Ticket Hacmi</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="INC" name="Incident"   stackId="a" fill={TYPE_COLORS.INC} />
                <Bar dataKey="SR"  name="Servis Talebi" stackId="a" fill={TYPE_COLORS.SR} />
                <Bar dataKey="CR"  name="Değişiklik"  stackId="a" fill={TYPE_COLORS.CR} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Weekly totals table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Haftalık Detay</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                    <th className="px-4 py-2.5 text-left font-semibold">Hafta</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-red-600">INC</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-blue-600">SR</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-violet-600">CR</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {[...trendData].reverse().map((row, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600">{row.label}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-red-700">{row.INC || "–"}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-blue-700">{row.SR  || "–"}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-violet-700">{row.CR  || "–"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{row.INC + row.SR + row.CR || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SLA TAB ────────────────────────────────────────────────────────── */}
      {tab === "sla" && (
        <div className="space-y-6">
          {/* SLA compliance bars */}
          <div className="grid md:grid-cols-3 gap-4">
            {slaChartData.map((d) => {
              const total = d.ok + d.breach;
              const pct = total ? Math.round((d.ok / total) * 100) : null;
              const color = pct === null ? "#E5E7EB" : pct >= 90 ? "#059669" : pct >= 70 ? "#D97706" : "#DC2626";
              return (
                <div key={d.name} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="text-xs text-gray-500 mb-1">{d.name} Uyumu</div>
                  <div className="text-3xl font-bold mb-2" style={{ color }}>
                    {pct === null ? "–" : `%${pct}`}
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct ?? 0}%`, background: color }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>{d.ok} uyumlu</span>
                    <span>{d.breach} ihlal</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SLA by priority table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Incident SLA — Öncelik Bazında</h2>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                  <th className="px-5 py-2.5 text-left font-semibold">Öncelik</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Toplam</th>
                  <th className="px-5 py-2.5 text-right font-semibold">İhlal</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Uyum</th>
                  <th className="px-5 py-2.5 text-left font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody>
                {slaData.byPriority.map((row) => {
                  const pct = row.pct;
                  const color = pct === null ? "text-gray-400" : pct >= 90 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600";
                  const dotColor = PRIORITY_COLORS[row.pKey];
                  return (
                    <tr key={row.priority} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
                          <span className="font-medium text-gray-700">{row.priority}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{row.total}</td>
                      <td className="px-5 py-3 text-right text-red-600 font-medium">{row.breached}</td>
                      <td className={cn("px-5 py-3 text-right font-bold", color)}>{pct === null ? "–" : `%${pct}`}</td>
                      <td className="px-5 py-3">
                        {pct !== null && (
                          <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: dotColor }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── EKİP TAB ───────────────────────────────────────────────────────── */}
      {tab === "ekip" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Agent Performansı</h2>
              <span className="text-xs text-gray-400">INC + SR bazında</span>
            </div>
            {agentData.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-xs text-gray-400">
                Henüz atanmış ticket yok
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                    <th className="px-5 py-2.5 text-left font-semibold">Agent</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Atanan</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Çözülen</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Çözüm %</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Ort. Süre</th>
                  </tr>
                </thead>
                <tbody>
                  {agentData.map((a, i) => {
                    const rate = a.assigned > 0 ? Math.round((a.resolved / a.assigned) * 100) : 0;
                    return (
                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                              {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-800">{a.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700 font-medium">{a.assigned}</td>
                        <td className="px-5 py-3 text-right text-emerald-700 font-medium">{a.resolved}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={cn("font-bold", rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-red-600")}>
                            %{rate}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-500 font-mono">
                          {a.avgHours !== null ? `${a.avgHours}s` : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Agent bar chart */}
          {agentData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Atanan vs Çözülen</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agentData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="assigned" name="Atanan"  fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="resolved" name="Çözülen" fill="#059669" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
