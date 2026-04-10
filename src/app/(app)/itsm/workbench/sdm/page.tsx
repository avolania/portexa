"use client";

import { useState } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────
const TEAM_WORKLOAD = [
  { name: "Ahmet Y.",  role: "L1 Agent",       active: 4, pending: 1, resolved: 18, capacity: 8, avgResTime: "2.1s", csat: 4.5 },
  { name: "Can D.",    role: "L1 Agent",        active: 3, pending: 0, resolved: 22, capacity: 8, avgResTime: "1.8s", csat: 4.7 },
  { name: "Elif K.",   role: "L2 Specialist",   active: 5, pending: 2, resolved: 9,  capacity: 6, avgResTime: "4.5s", csat: 4.3 },
  { name: "Mehmet S.", role: "L2 Specialist",   active: 6, pending: 1, resolved: 7,  capacity: 6, avgResTime: "5.2s", csat: 4.1 },
  { name: "Fatma B.",  role: "L2 Specialist",   active: 2, pending: 0, resolved: 11, capacity: 6, avgResTime: "3.8s", csat: 4.6 },
  { name: "Hakan Ö.",  role: "L3 Security",     active: 3, pending: 1, resolved: 5,  capacity: 4, avgResTime: "8.1s", csat: 4.8 },
  { name: "Oğuz Ç.",   role: "L3 DBA",          active: 2, pending: 1, resolved: 4,  capacity: 4, avgResTime: "6.5s", csat: 4.4 },
  { name: "Burak M.",  role: "L1 Agent",        active: 1, pending: 0, resolved: 15, capacity: 8, avgResTime: "2.4s", csat: 4.2 },
];

const SLA_WEEKLY = [
  { week: "W10", p1: 88, p2: 93, p3: 97, p4: 100 },
  { week: "W11", p1: 91, p2: 95, p3: 98, p4: 100 },
  { week: "W12", p1: 85, p2: 92, p3: 96, p4: 99  },
  { week: "W13", p1: 92, p2: 96, p3: 99, p4: 100 },
  { week: "W14", p1: 89, p2: 94, p3: 97, p4: 100 },
  { week: "W15", p1: 94, p2: 97, p3: 98, p4: 100 },
];

const ESCALATION_DATA = [
  { from: "L1 → L2",          count: 34, avgTime: "45dk", topReason: "Teknik bilgi yetersizliği", pct: 28 },
  { from: "L2 → L3",          count: 12, avgTime: "2.1s", topReason: "Vendor support gerekli",    pct: 35 },
  { from: "L1 → L3 (Direct)", count: 3,  avgTime: "15dk", topReason: "P1 Critical",               pct: 100 },
];

const BOTTLENECKS = [
  { area: "Network Ops - L2",  queueSize: 8, avgWait: "3.2s", trend: "up",     severity: "high"   },
  { area: "App Support - L2",  queueSize: 5, avgWait: "2.8s", trend: "stable", severity: "medium" },
  { area: "Security - L3",     queueSize: 4, avgWait: "4.5s", trend: "up",     severity: "high"   },
  { area: "Service Desk - L1", queueSize: 3, avgWait: "25dk", trend: "down",   severity: "low"    },
  { area: "DBA - L3",          queueSize: 3, avgWait: "5.1s", trend: "stable", severity: "medium" },
];

const TICKET_VOLUME = {
  today:  [3, 5, 8, 12, 15, 18, 14, 10, 7],
  labels: ["08", "09", "10", "11", "12", "13", "14", "15", "16"],
};

const CATEGORY_DIST = [
  { name: "Application",     count: 32, pct: 28, color: "#3B82F6" },
  { name: "Network",         count: 24, pct: 21, color: "#8B5CF6" },
  { name: "Infrastructure",  count: 20, pct: 18, color: "#DC2626" },
  { name: "Hardware",        count: 18, pct: 16, color: "#D97706" },
  { name: "Access",          count: 12, pct: 10, color: "#059669" },
  { name: "Security",        count: 8,  pct: 7,  color: "#0891B2" },
];

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
  const pct = Math.min(100, (active / capacity) * 100);
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

const StarRating = ({ score }: { score: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
    {[1, 2, 3, 4, 5].map(n => (
      <span key={n} style={{ fontSize: 10, color: n <= Math.round(score) ? "#F59E0B" : "#E2E8F0" }}>★</span>
    ))}
    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#475569", marginLeft: 3 }}>{score}</span>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SDMDashboardPage() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");

  const totalActive   = TEAM_WORKLOAD.reduce((s, t) => s + t.active, 0);
  const totalCapacity = TEAM_WORKLOAD.reduce((s, t) => s + t.capacity, 0);
  const utilizationPct = Math.round((totalActive / totalCapacity) * 100);
  const totalResolved = TEAM_WORKLOAD.reduce((s, t) => s + t.resolved, 0);
  const avgCSAT       = (TEAM_WORKLOAD.reduce((s, t) => s + t.csat, 0) / TEAM_WORKLOAD.length).toFixed(1);
  const currentSLA    = SLA_WEEKLY[SLA_WEEKLY.length - 1];
  const overallSLA    = Math.round((currentSLA.p1 + currentSLA.p2 + currentSLA.p3 + currentSLA.p4) / 4);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
    .sdm-root ::-webkit-scrollbar{width:5px}
    .sdm-root ::-webkit-scrollbar-track{background:transparent}
    .sdm-root ::-webkit-scrollbar-thumb{background:#CBD5E0;border-radius:3px}
    @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .sdm-tr:hover td{background:#FAFBFC}
  `;

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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { l: "Ekip Kullanımı",       v: `${utilizationPct}%`,    sub: `${totalActive}/${totalCapacity} aktif`,        c: utilizationPct > 80 ? "#DC2626" : "#059669", ic: "🔥" },
            { l: "Açık Ticket",          v: String(totalActive),      sub: "tüm seviyeler",                                c: "#F59E0B", ic: "📋" },
            { l: "Çözülen (Hafta)",      v: String(totalResolved),    sub: "+12% geçen haftaya göre",                      c: "#059669", ic: "✓" },
            { l: "SLA Uyumu",            v: `${overallSLA}%`,         sub: `P1: ${currentSLA.p1}% · P2: ${currentSLA.p2}%`, c: overallSLA >= 95 ? "#059669" : "#D97706", ic: "⏱️" },
            { l: "Müşteri Memnuniyeti",  v: `${avgCSAT}/5`,           sub: "ortalama CSAT",                                c: parseFloat(avgCSAT) >= 4.5 ? "#059669" : "#D97706", ic: "⭐" },
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

            {/* Team Workload Table */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden", animation: "slideUp .4s ease .15s both" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>👥 Ekip Workload & Performans</h3>
                <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'IBM Plex Mono',monospace" }}>{TEAM_WORKLOAD.length} agent</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["Agent", "Aktif", "Bekleyen", "Çözülen", "Kapasite", "Ort. Çözüm", "CSAT"].map(h => (
                      <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TEAM_WORKLOAD.map((agent, i) => (
                    <tr key={agent.name} className="sdm-tr" style={{ borderBottom: "1px solid #F1F5F9", animation: `slideUp .2s ease ${i * 0.03}s both` }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: `hsl(${i * 45 + 200},50%,90%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: `hsl(${i * 45 + 200},50%,35%)` }}>
                            {agent.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{agent.name}</div>
                            <div style={{ fontSize: 10, color: "#94A3B8" }}>{agent.role}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: agent.active >= agent.capacity ? "#DC2626" : "#1E293B" }}>{agent.active}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", color: agent.pending > 0 ? "#7C3AED" : "#CBD5E0" }}>{agent.pending}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", color: "#059669" }}>{agent.resolved}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }}><CapacityBar active={agent.active} capacity={agent.capacity} /></td>
                      <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: "#475569" }}>{agent.avgResTime}</span></td>
                      <td style={{ padding: "10px 14px" }}><StarRating score={agent.csat} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Escalation Analysis */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "18px 22px", animation: "slideUp .4s ease .25s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>⬆ Eskalasyon Analizi</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ESCALATION_DATA.map((esc, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0", animation: `slideUp .2s ease ${i * 0.06}s both` }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: "#FFFBEB", border: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⬆</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 2 }}>{esc.from}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>En sık neden: <strong>{esc.topReason}</strong></div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'IBM Plex Mono',monospace", color: "#F59E0B" }}>{esc.count}</div>
                      <div style={{ fontSize: 10, color: "#94A3B8" }}>Ort: {esc.avgTime}</div>
                    </div>
                    <div style={{ width: 40, textAlign: "right" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: esc.pct > 30 ? "#DC2626" : "#64748B" }}>{esc.pct}%</span>
                      <div style={{ fontSize: 9, color: "#94A3B8" }}>toplam</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottleneck Analysis */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "18px 22px", animation: "slideUp .4s ease .3s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🔧 Bottleneck Analizi</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {BOTTLENECKS.map((bn, i) => {
                  const sevC = bn.severity === "high" ? "#DC2626" : bn.severity === "medium" ? "#D97706" : "#059669";
                  return (
                    <div key={i} style={{ padding: "14px 16px", borderRadius: 8, border: `1px solid ${sevC}20`, background: `${sevC}05`, animation: `slideUp .2s ease ${i * 0.05}s both` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{bn.area}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: `${sevC}15`, color: sevC, textTransform: "uppercase" }}>{bn.severity}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748B" }}>
                        <span>Kuyruk: <strong style={{ color: "#1E293B", fontFamily: "'IBM Plex Mono',monospace" }}>{bn.queueSize}</strong></span>
                        <span>Bekleme: <strong style={{ color: "#1E293B", fontFamily: "'IBM Plex Mono',monospace" }}>{bn.avgWait}</strong></span>
                        <span style={{ color: bn.trend === "up" ? "#DC2626" : bn.trend === "down" ? "#059669" : "#94A3B8", fontWeight: 600 }}>
                          {bn.trend === "up" ? "↑" : bn.trend === "down" ? "↓" : "→"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* SLA Trends */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "18px 20px", animation: "slideUp .4s ease .1s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>⏱️ SLA Uyum Trendi</h3>
              {[
                { l: "P1 — Critical", data: SLA_WEEKLY.map(w => w.p1), c: "#DC2626", current: currentSLA.p1, target: 95 },
                { l: "P2 — High",     data: SLA_WEEKLY.map(w => w.p2), c: "#D97706", current: currentSLA.p2, target: 95 },
                { l: "P3 — Medium",   data: SLA_WEEKLY.map(w => w.p3), c: "#2563EB", current: currentSLA.p3, target: 95 },
                { l: "P4 — Low",      data: SLA_WEEKLY.map(w => w.p4), c: "#059669", current: currentSLA.p4, target: 95 },
              ].map((sla, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: sla.c }}>{sla.l}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <MiniSparkline data={sla.data} color={sla.c} width={70} height={20} />
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "'IBM Plex Mono',monospace", color: sla.current >= sla.target ? "#059669" : "#DC2626" }}>
                        {sla.current}%
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: "#F1F5F9", borderRadius: 2, overflow: "hidden", position: "relative" }}>
                    <div style={{ width: `${sla.current}%`, height: "100%", background: sla.current >= sla.target ? sla.c : "#DC2626", borderRadius: 2, transition: "width .6s ease" }} />
                    <div style={{ position: "absolute", left: `${sla.target}%`, top: -1, width: 2, height: 6, background: "#475569", borderRadius: 1 }} />
                  </div>
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
              {CATEGORY_DIST.map((cat, i) => (
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
              ))}
            </div>

            {/* Volume Trend */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "18px 20px", animation: "slideUp .4s ease .25s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📈 Bugünkü Ticket Hacmi</h3>
              <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12 }}>Saatlik dağılım</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
                {TICKET_VOLUME.today.map((v, i) => {
                  const maxV = Math.max(...TICKET_VOLUME.today);
                  const h = (v / maxV) * 64;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#64748B" }}>{v}</span>
                      <div style={{ width: "100%", height: h, borderRadius: 3, background: v === maxV ? "#3B82F6" : "#DBEAFE", transition: "height .4s ease" }} />
                      <span style={{ fontSize: 8, color: "#94A3B8", fontFamily: "'IBM Plex Mono',monospace" }}>{TICKET_VOLUME.labels[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CSAT Summary */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "18px 20px", animation: "slideUp .4s ease .3s both" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>⭐ Müşteri Memnuniyeti (CSAT)</h3>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 42, fontWeight: 800, fontFamily: "'IBM Plex Mono',monospace", color: parseFloat(avgCSAT) >= 4.5 ? "#059669" : "#D97706", lineHeight: 1 }}>{avgCSAT}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 4 }}>
                  {[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 16, color: n <= Math.round(parseFloat(avgCSAT)) ? "#F59E0B" : "#E2E8F0" }}>★</span>)}
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>5 üzerinden ortalama</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: "#F8FAFC", fontSize: 11 }}>
                <span style={{ color: "#64748B" }}>En yüksek: <strong style={{ color: "#059669" }}>Hakan Ö. (4.8)</strong></span>
                <span style={{ color: "#64748B" }}>En düşük: <strong style={{ color: "#D97706" }}>Mehmet S. (4.1)</strong></span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
