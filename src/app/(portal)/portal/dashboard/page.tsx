"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { NCR, ComplianceDocument, COA, Scorecard } from "@/lib/qms/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DashboardData {
  ncrs: Array<NCR & { response_count: number }>;
  pendingCoas: COA[];
  complianceDocs: ComplianceDocument[];
  scorecard: Scorecard | null;
}

const NCR_STATE_LABEL: Record<string, string> = {
  open: "Açık",
  investigating: "Araştırılıyor",
  disposition_pending: "Karar Bekliyor",
  capa_linked: "CAPA Bağlı",
};

const NCR_STATE_BADGE: Record<string, { bg: string; color: string }> = {
  open: { bg: "#DBEAFE", color: "#1D4ED8" },
  investigating: { bg: "#FEF3C7", color: "#D97706" },
  disposition_pending: { bg: "#F3E8FF", color: "#7C3AED" },
  capa_linked: { bg: "#D1FAE5", color: "#059669" },
};

const SEVERITY_BADGE: Record<string, { bg: string; color: string }> = {
  minor: { bg: "#F3F4F6", color: "#6B7280" },
  major: { bg: "#FEF3C7", color: "#D97706" },
  critical: { bg: "#FEE2E2", color: "#DC2626" },
};

const SEVERITY_LABEL: Record<string, string> = {
  minor: "Düşük",
  major: "Önemli",
  critical: "Kritik",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  requested: "Talep Edildi",
  uploaded: "Yüklendi",
  in_review: "İncelemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  expiring: "Süresi Dolmak Üzere",
  expired: "Süresi Doldu",
};

export default function PortalDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [supplierName, setSupplierName] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/portal/davet/logout");
        return;
      }
      const meta = session.user.user_metadata as Record<string, string> | undefined;
      if (meta?.name) setUserName(meta.name);

      const res = await fetch("/api/portal/dashboard", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        router.push("/portal/davet/logout");
        return;
      }
      const d = await res.json();
      setData(d);

      // Get supplier name from first NCR or compliance doc
      if (d.ncrs?.[0]?.supplier_id) {
        // Could fetch supplier name; for now show ID
        setSupplierName(d.ncrs[0].supplier_id.slice(0, 8) + "...");
      }
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div style={{ color: "#6B7280", fontSize: 14 }}>Yükleniyor...</div>
      </div>
    );
  }

  if (!data) return null;

  const openNcrCount = data.ncrs.length;
  const pendingCoaCount = data.pendingCoas.length;
  const expiredDocCount = data.complianceDocs.filter(d => d.status === 'expired' || d.status === 'expiring').length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Welcome */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          Hoş Geldiniz{userName ? `, ${userName}` : ""}
        </h1>
        {supplierName && (
          <p style={{ fontSize: 14, color: "#6B7280" }}>Tedarikçi: {supplierName}</p>
        )}
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { label: "Açık NCR", count: openNcrCount, bg: "#FEE2E2", color: "#DC2626", leftColor: "#DC2626" },
          { label: "Bekleyen COA", count: pendingCoaCount, bg: "#FEF3C7", color: "#D97706", leftColor: "#D97706" },
          { label: "Süresi Dolan Doküman", count: expiredDocCount, bg: "#FFF7ED", color: "#EA580C", leftColor: "#EA580C" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "20px 24px",
              border: "1px solid #E5E7EB",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 4,
                height: "100%",
                background: stat.leftColor,
              }}
            />
            <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              {stat.label}
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 48,
                height: 48,
                background: stat.bg,
                borderRadius: 10,
                fontSize: 28,
                fontWeight: 800,
                color: stat.color,
              }}
            >
              {stat.count}
            </div>
          </div>
        ))}
      </div>

      {/* NCR Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Açık Uygunsuzluklar</h2>
        </div>
        {data.ncrs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13, fontStyle: "italic" }}>
            Açık uygunsuzluk yok
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["NCR No", "Açıklama", "Önem", "Durum", "Tarih", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#9CA3AF",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.ncrs.map((ncr) => {
                const sevBadge = SEVERITY_BADGE[ncr.severity] ?? { bg: "#F3F4F6", color: "#6B7280" };
                const stateBadge = NCR_STATE_BADGE[ncr.state] ?? { bg: "#F3F4F6", color: "#6B7280" };
                return (
                  <tr
                    key={ncr.id}
                    style={{ borderBottom: "1px solid #F3F4F6", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px", fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: "#374151" }}>
                      {ncr.ncr_number}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151", maxWidth: 300 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {ncr.description}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: sevBadge.bg,
                          color: sevBadge.color,
                        }}
                      >
                        {SEVERITY_LABEL[ncr.severity] ?? ncr.severity}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: stateBadge.bg,
                          color: stateBadge.color,
                        }}
                      >
                        {NCR_STATE_LABEL[ncr.state] ?? ncr.state}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#6B7280" }}>
                      {new Date(ncr.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        onClick={() => router.push(`/portal/ncr/${ncr.id}`)}
                        style={{
                          padding: "5px 12px",
                          background: "#3B82F6",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Yanıtla
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Compliance Docs */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Doküman Talepleri</h2>
        </div>
        {data.complianceDocs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13, fontStyle: "italic" }}>
            Süresi dolmuş veya yaklaşan doküman yok
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["Doküman Tipi", "Son Tarih", "Durum"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#9CA3AF",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.complianceDocs.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>
                    {doc.title}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6B7280" }}>
                    {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString("tr-TR") : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        background: doc.status === "expired" ? "#FEE2E2" : "#FEF3C7",
                        color: doc.status === "expired" ? "#DC2626" : "#D97706",
                      }}
                    >
                      {DOC_STATUS_LABEL[doc.status] ?? doc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
