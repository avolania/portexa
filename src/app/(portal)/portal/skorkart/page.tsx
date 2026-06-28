"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Scorecard } from "@/lib/qms/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const RATING_BADGE: Record<string, { bg: string; color: string }> = {
  A: { bg: "#D1FAE5", color: "#059669" },
  B: { bg: "#DBEAFE", color: "#1D4ED8" },
  C: { bg: "#FEF3C7", color: "#D97706" },
  D: { bg: "#FEE2E2", color: "#DC2626" },
};

const TREND_ICON: Record<string, string> = {
  up: "↑",
  flat: "→",
  down: "↓",
};

const TREND_COLOR: Record<string, string> = {
  up: "#059669",
  flat: "#6B7280",
  down: "#DC2626",
};

function KpiRow({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
      <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>{label}</td>
      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#111827", textAlign: "right" }}>
        {value !== null ? `${value.toFixed(1)}${unit ?? ""}` : "—"}
      </td>
    </tr>
  );
}

export default function SkorkartPortalPage() {
  const router = useRouter();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/portal/davet/logout");
        return;
      }

      const res = await fetch("/api/portal/scorecard", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const d = await res.json();
        if (d) {
          setScorecard(d);
        } else {
          setNotFound(true);
        }
      } else {
        setNotFound(true);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          Tedarikçi Skorkart
        </h1>
        <p style={{ fontSize: 14, color: "#6B7280" }}>
          En son performans değerlendirmesi
        </p>
      </div>

      {notFound || !scorecard ? (
        <div
          style={{
            padding: 60,
            textAlign: "center",
            background: "#fff",
            borderRadius: 10,
            border: "1px dashed #E5E7EB",
            color: "#9CA3AF",
            fontSize: 13,
            fontStyle: "italic",
          }}
        >
          Henüz skorkart kaydı oluşturulmamış
        </div>
      ) : (
        <>
          {/* Header Card */}
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              padding: 24,
              display: "flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            {scorecard.rating && (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  fontWeight: 800,
                  background: RATING_BADGE[scorecard.rating]?.bg ?? "#F3F4F6",
                  color: RATING_BADGE[scorecard.rating]?.color ?? "#6B7280",
                  flexShrink: 0,
                }}
              >
                {scorecard.rating}
              </div>
            )}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Dönem
              </p>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{scorecard.period}</p>
            </div>
            {scorecard.trend && (
              <div style={{ marginLeft: "auto", textAlign: "center" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Trend
                </p>
                <span style={{ fontSize: 28, color: TREND_COLOR[scorecard.trend] }}>
                  {TREND_ICON[scorecard.trend]}
                </span>
              </div>
            )}
          </div>

          {/* KPI Table */}
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>KPI Detayları</h2>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #E5E7EB" }}>
                    Gösterge
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #E5E7EB" }}>
                    Değer
                  </th>
                </tr>
              </thead>
              <tbody>
                <KpiRow label="Zamanında Teslimat (%)" value={scorecard.on_time_delivery_pct} unit="%" />
                <KpiRow label="Kalite Kabul Oranı (%)" value={scorecard.quality_acceptance_rate} unit="%" />
                <KpiRow label="Doküman Uyumluluk (%)" value={scorecard.doc_compliance_pct} unit="%" />
                <KpiRow label="NCR Sayısı" value={scorecard.ncr_count} />
                <KpiRow label="NCR Oranı (lot başına)" value={scorecard.ncr_rate_per_lot} />
                <KpiRow label="CAPA Zamanında Kapanma (%)" value={scorecard.capa_closure_on_time_pct} unit="%" />
                <KpiRow label="Ort. CAPA Kapanma Süresi (gün)" value={scorecard.avg_capa_close_days} unit=" gün" />
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {scorecard.notes && (
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Notlar
              </p>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{scorecard.notes}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
