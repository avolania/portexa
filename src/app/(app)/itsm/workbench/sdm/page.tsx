"use client";

import { useEffect, useMemo } from "react";
import { useState } from "react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { useAuthStore } from "@/store/useAuthStore";
import { IncidentState, Priority, ServiceRequestState, ChangeRequestState } from "@/lib/itsm/types/enums";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INC_OPEN = new Set([IncidentState.NEW, IncidentState.ASSIGNED, IncidentState.IN_PROGRESS, IncidentState.PENDING]);
const INC_RESOLVED = new Set([IncidentState.RESOLVED, IncidentState.CLOSED]);

const SR_OPEN = new Set([
  ServiceRequestState.SUBMITTED, ServiceRequestState.PENDING_APPROVAL,
  ServiceRequestState.APPROVED, ServiceRequestState.IN_PROGRESS, ServiceRequestState.PENDING,
]);
const SR_CLOSED = new Set([ServiceRequestState.FULFILLED, ServiceRequestState.CLOSED]);

const CR_OPEN = new Set([
  ChangeRequestState.PENDING_APPROVAL, ChangeRequestState.SCHEDULED, ChangeRequestState.IMPLEMENT, ChangeRequestState.REVIEW,
]);
const CR_CLOSED = new Set([ChangeRequestState.CLOSED]);

const weekAgo = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

// ─── Sub-components ───────────────────────────────────────────────────────────

const MiniSparkline = ({ data, color, height = 32, width = 100 }: { data: number[]; color: string; height?: number; width?: number }) => {
  const max = Math.max(...data); const min = Math.min(...data); const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - 4 - ((v - min) / range) * (height - 8)}`).join(" ");
  const gradId = `sg-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const CapacityBar = ({ active, capacity }: { active: number; capacity: number }) => {
  const pct = capacity > 0 ? Math.min(100, (active / capacity) * 100) : 0;
  const color = pct > 90 ? "#DC2626" : pct > 70 ? "#D97706" : "#059669";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .5s ease" }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color, minWidth: 30 }}>{Math.round(pct)}%</span>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SDMDashboardPage() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");

  const { incidents, load: loadInc } = useIncidentStore();
  const { serviceRequests, load: loadSR } = useServiceRequestStore();
  const { changeRequests, load: loadCR } = useChangeRequestStore();
  const { profiles } = useAuthStore();

  useEffect(() => { loadInc(); loadSR(); loadCR(); }, [loadInc, loadSR, loadCR]);

  // ── Derived metrics ──────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const cutoff = period === "day"
      ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
      : period === "week" ? weekAgo()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Active counts
    const incActive = incidents.filter(i => INC_OPEN.has(i.state));
    const srActive  = serviceRequests.filter(s => SR_OPEN.has(s.state));
    const crActive  = changeRequests.filter(c => CR_OPEN.has(c.state));
    const totalActive = incActive.length + srActive.length + crActive.length;

    // Resolved in period
    const incResolved = incidents.filter(i => INC_RESOLVED.has(i.state) && i.updatedAt >= cutoff).length;
    const srResolved  = serviceRequests.filter(s => SR_CLOSED.has(s.state) && s.updatedAt >= cutoff).length;
    const crResolved  = changeRequests.filter(c => CR_CLOSED.has(c.state) && c.updatedAt >= cutoff).length;
    const totalResolved = incResolved + srResolved + crResolved;

    // SLA compliance per priority (incidents only)
    const slaByPrio = ([Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW] as const).map(prio => {
      const group = incidents.filter(i => i.priority === prio);
      if (group.length === 0) return { prio, pct: 100, total: 0 };
      const breached = group.filter(i => i.sla.resolutionBreached).length;
      return { prio, pct: Math.round(((group.length - breached) / group.length) * 100), total: group.length };
    });

    const overallSLA = slaByPrio.every(s => s.total === 0) ? 100
      : Math.round(slaByPrio.reduce((sum, s) => sum + s.pct, 0) / 4);

    // Team workload (incidents grouped by assignee)
    const agentMap = new Map<string, { name: string; active: number; resolved: number; slaBreached: number }>();
    for (const inc of incidents) {
      const agentName = inc.assignedTo?.fullName
        ?? (inc.assignedToId ? profiles[inc.assignedToId]?.name : undefined);
      if (!agentName || !inc.assignedToId) continue;
      const key = inc.assignedToId;
      if (!agentMap.has(key)) agentMap.set(key, { name: agentName, active: 0, resolved: 0, slaBreached: 0 });
      const entry = agentMap.get(key)!;
      if (INC_OPEN.has(inc.state)) entry.active++;
      if (INC_RESOLVED.has(inc.state) && inc.updatedAt >= cutoff) entry.resolved++;
      if (inc.sla.resolutionBreached) entry.slaBreached++;
    }
    const teamWorkload = Array.from(agentMap.values())
      .sort((a, b) => b.active - a.active)
      .slice(0, 10);

    // Category distribution (incidents)
    const catMap = new Map<string, number>();
    for (const inc of incidents) {
      const cat = inc.category || "Diğer";
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
    }
    const catTotal = incidents.length || 1;
    const categoryDist = Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count, pct: Math.round((count / catTotal) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const CAT_COLORS = ["#3B82F6","#8B5CF6","#DC2626","#D97706","#059669","#0891B2"];
    categoryDist.forEach((c, i) => { (c as typeof c & { color: string }).color = CAT_COLORS[i % CAT_COLORS.length]; });

    // Volume by hour (today — incidents + SR + CR)
    const hourMap = new Array(24).fill(0);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();
    for (const inc of incidents) {
      if (inc.createdAt < todayStartIso) continue;
      hourMap[new Date(inc.createdAt).getHours()]++;
    }
    for (const sr of serviceRequests) {
      if (sr.createdAt < todayStartIso) continue;
      hourMap[new Date(sr.createdAt).getHours()]++;
    }
    for (const cr of changeRequests) {
      if (cr.createdAt < todayStartIso) continue;
      hourMap[new Date(cr.createdAt).getHours()]++;
    }

    // P1/P2 breach list
    const breachAlerts = incidents
      .filter(i => i.sla.resolutionBreached && INC_OPEN.has(i.state))
      .sort((a, b) => new Date(a.sla.resolutionDeadline).getTime() - new Date(b.sla.resolutionDeadline).getTime())
      .slice(0, 5);

    return { totalActive, totalResolved, overallSLA, slaByPrio, teamWorkload, categoryDist: categoryDist as (typeof categoryDist[number] & { color: string })[], hourMap, breachAlerts, incActive: incActive.length, srActive: srActive.length, crActive: crActive.length };
  }, [incidents, serviceRequests, changeRequests, profiles, period]);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
    .sdm-root ::-webkit-scrollbar{width:5px}
    .sdm-root ::-webkit-scrollbar-track{background:transparent}
    .sdm-root ::-webkit-scrollbar-thumb{background:#CBD5E0;border-radius:3px}
    @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .sdm-tr:hover td{background:#FAFBFC}
  `;

  const PRIO_LABELS = ["P1 — Critical", "P2 — High", "P3 — Medium", "P4 — Low"];
  const PRIO_COLORS = ["#DC2626", "#D97706", "#2563EB", "#059669"];

  return (
    <div className="sdm-root" style={{ fontFamily: "'IBM Plex Sans',sans-serif", background: "#F1F5F9", height: "100%", overflowY: "auto", color: "#0F172A" }}>
      <style>{css}</style>

      {/* Sub-header */}
      <div style={{ height: 46, background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", padding: "0 24px", gap: 12, flexShrink: 0, position: "sticky", top: 0, zIndex: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>Service Delivery Manager</span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#F0FDF4", color: "#059669", border: "1px solid #BBF7D0" }}>Live</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 2, background: "#F8FAFC", borderRadius: 6, padding: 2, border: "1px solid #E2E8F0" }}>
          {(["day", "week", "month"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer",
              background: period === p ? "#1E293B" : "transparent",
              color: period === p ? "#fff" : "#64748B",
              fontSize: 11, fontWeight: 600,
            }}>{p === "day" ? "Bugün" : p === "week" ? "Hafta" : "Ay"}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1400, margin: "0 auto" }}>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { l: "Açık Ticket",      v: String(metrics.totalActive),   sub: `INC: ${metrics.incActive} · SR: ${metrics.srActive} · CR: ${metrics.crActive}`, c: metrics.totalActive > 20 ? "#DC2626" : "#F59E0B", ic: "📋" },
            { l: "Çözülen",          v: String(metrics.totalResolved),  sub: period === "day" ? "bugün" : period === "week" ? "bu hafta" : "bu ay",              c: "#059669", ic: "✓" },
            { l: "SLA Uyumu",        v: `${metrics.overallSLA}%`,       sub: `P1: ${metrics.slaByPrio[0].pct}% · P2: ${metrics.slaByPrio[1].pct}%`,             c: metrics.overallSLA >= 95 ? "#059669" : "#D97706", ic: "⏱️" },
            { l: "SLA İhlali",       v: String(metrics.breachAlerts.length), sub: "açık & ihlalli",                                                              c: metrics.breachAlerts.length > 0 ? "#DC2626" : "#059669", ic: "🚨" },
          ].map((kpi, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 10, padding: "18px 20px", border: "1px solid #E2E8F0", position: "relative", overflow: "hidden", animation: `slideUp .4s ease ${i * 0.06}s both` }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: kpi.c }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>{kpi.l}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#0F172A", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "-.02em", lineHeight: 1 }}>{kpi.v}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>{kpi.sub}</div>
                </div>
                <span style={{ fontSize: 22 }}>{kpi.ic}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 18 }}>

          {/* Left */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Team Workload */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden", animation: "slideUp .4s ease .15s both" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>👥 Ekip Workload (Incident)</h3>
                <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'IBM Plex Mono',monospace" }}>{metrics.teamWorkload.length} agent</span>
              </div>
              {metrics.teamWorkload.length === 0 ? (
                <div style={{ padding: "32px 20px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                  Henüz atanmış incident yok
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["Agent", "Aktif", "Çözülen", "SLA İhlali", "Kapasite"].map(h => (
                        <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.teamWorkload.map((agent, i) => {
                      const capacity = 8;
                      return (
                        <tr key={agent.name} className="sdm-tr" style={{ borderBottom: "1px solid #F1F5F9", animation: `slideUp .2s ease ${i * 0.03}s both` }}>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 26, height: 26, borderRadius: "50%", background: `hsl(${i * 45 + 200},50%,90%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: `hsl(${i * 45 + 200},50%,35%)` }}>
                                {agent.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{agent.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: agent.active >= capacity ? "#DC2626" : "#1E293B" }}>{agent.active}</span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", color: "#059669" }}>{agent.resolved}</span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: agent.slaBreached > 0 ? "#DC2626" : "#CBD5E0" }}>{agent.slaBreached}</span>
                          </td>
                          <td style={{ padding: "10px 14px" }}><CapacityBar active={agent.active} capacity={capacity} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* SLA Breach Alerts */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "18px 22px", animation: "slideUp .4s ease .25s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🚨 SLA İhlali — Açık Ticketlar</h3>
              {metrics.breachAlerts.length === 0 ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: "#059669", fontSize: 13, fontWeight: 600 }}>✓ Aktif SLA ihlali yok</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {metrics.breachAlerts.map((inc, i) => (
                    <div key={inc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#FFF5F5", border: "1px solid #FCA5A5", animation: `slideUp .2s ease ${i * 0.05}s both` }}>
                      <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "'IBM Plex Mono',monospace", padding: "2px 6px", borderRadius: 3, background: "#FEE2E2", color: "#DC2626" }}>{inc.number}</span>
                      <span style={{ flex: 1, fontSize: 12, color: "#1E293B", fontWeight: 500 }}>{inc.shortDescription}</span>
                      <span style={{ fontSize: 11, color: "#64748B" }}>{inc.assignedTo?.fullName ?? (inc.assignedToId ? profiles[inc.assignedToId]?.name : null) ?? "Atanmamış"}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", fontFamily: "'IBM Plex Mono',monospace" }}>
                        {inc.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Volume Trend */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "18px 22px", animation: "slideUp .4s ease .3s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📈 Bugünkü Ticket Hacmi</h3>
              <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12 }}>Saatlik dağılım — INC + SR + CR</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 80 }}>
                {metrics.hourMap.map((v, i) => {
                  const maxV = Math.max(...metrics.hourMap, 1);
                  const h = (v / maxV) * 64;
                  const now = new Date().getHours();
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      {v > 0 && <span style={{ fontSize: 8, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#64748B" }}>{v}</span>}
                      <div style={{ width: "100%", height: h || 2, borderRadius: 2, background: i === now ? "#3B82F6" : v > 0 ? "#93C5FD" : "#F1F5F9", transition: "height .4s ease" }} />
                      {i % 4 === 0 && <span style={{ fontSize: 7, color: "#94A3B8", fontFamily: "'IBM Plex Mono',monospace" }}>{String(i).padStart(2, "0")}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* SLA by Priority */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "18px 20px", animation: "slideUp .4s ease .1s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>⏱️ SLA Uyumu — Önceliğe Göre</h3>
              {metrics.slaByPrio.map((sla, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: PRIO_COLORS[i] }}>{PRIO_LABELS[i]}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'IBM Plex Mono',monospace" }}>{sla.total} ticket</span>
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "'IBM Plex Mono',monospace", color: sla.pct >= 95 ? "#059669" : "#DC2626" }}>
                        {sla.pct}%
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: "#F1F5F9", borderRadius: 2, overflow: "hidden", position: "relative" }}>
                    <div style={{ width: `${sla.pct}%`, height: "100%", background: sla.pct >= 95 ? PRIO_COLORS[i] : "#DC2626", borderRadius: 2, transition: "width .6s ease" }} />
                    <div style={{ position: "absolute", left: "95%", top: -1, width: 2, height: 6, background: "#475569", borderRadius: 1 }} />
                  </div>
                  {sla.total === 0 && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>Bu öncelikte incident yok</div>}
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                <div style={{ width: 2, height: 8, background: "#475569", borderRadius: 1 }} />
                <span style={{ fontSize: 9, color: "#94A3B8" }}>Hedef: %95</span>
              </div>
            </div>

            {/* Category Distribution */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "18px 20px", animation: "slideUp .4s ease .2s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📊 Kategori Dağılımı</h3>
              {metrics.categoryDist.length === 0 ? (
                <div style={{ padding: "12px 0", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>Veri yok</div>
              ) : (
                metrics.categoryDist.map((cat, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>{cat.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#1E293B" }}>
                        {cat.count} <span style={{ color: "#94A3B8", fontWeight: 400 }}>({cat.pct}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${cat.pct}%`, height: "100%", background: cat.color, borderRadius: 3, transition: "width .5s ease" }} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Ticket Type Summary */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "18px 20px", animation: "slideUp .4s ease .3s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📋 Ticket Tipi Özeti</h3>
              {[
                { label: "Incident (INC)",        active: metrics.incActive, resolved: metrics.breachAlerts.length, resolvedLabel: "ihlalli", color: "#DC2626", bg: "#FEE2E2" },
                { label: "Servis Talebi (SR)",     active: metrics.srActive,  resolved: 0, resolvedLabel: "",          color: "#2563EB", bg: "#DBEAFE" },
                { label: "Değişiklik (CR)",        active: metrics.crActive,  resolved: 0, resolvedLabel: "",          color: "#7C3AED", bg: "#F3E8FF" },
              ].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0", marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'IBM Plex Mono',monospace", color: t.color }}>{t.active}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8" }}>aktif</div>
                  </div>
                  {t.resolvedLabel && t.resolved > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#FEE2E2", color: "#DC2626" }}>
                      {t.resolved} {t.resolvedLabel}
                    </span>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
