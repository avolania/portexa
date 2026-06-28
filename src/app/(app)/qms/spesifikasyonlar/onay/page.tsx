"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Specification, SpecType } from "@/lib/qms/types";

const TYPE_LABELS: Record<SpecType, string> = {
  raw_material:  "Ham Madde",
  finished_good: "Bitmiş Ürün",
  packaging:     "Ambalaj",
};

const TYPE_COLORS: Record<SpecType, { bg: string; text: string }> = {
  raw_material:  { bg: "#FEF3C7", text: "#92400E" },
  finished_good: { bg: "#DBEAFE", text: "#1E40AF" },
  packaging:     { bg: "#D1FAE5", text: "#065F46" },
};

export default function OnayKuyruguPage() {
  const [token, setToken] = useState("");
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  const [specs, setSpecs] = useState<Specification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/qms/specifications/approvals", {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) setSpecs(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function doAction(spec: Specification, action: "approve" | "archive") {
    setProcessing(spec.id);
    try {
      const res = await fetch(`/api/qms/specifications/${spec.id}/transition`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setSpecs((prev) => prev.filter((s) => s.id !== spec.id));
      } else {
        const { error } = await res.json();
        alert(error ?? "İşlem hatası");
      }
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "'IBM Plex Sans', sans-serif", minHeight: "100vh", background: "#F3F4F6" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>Onay Bekleyen Spesifikasyonlar</h1>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "4px 0 0" }}>İncelemede olan spesifikasyonları onaylayın veya geri çekin</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 10, background: "#FEF3C7", color: "#D97706" }}>
            {specs.length} bekliyor
          </span>
          <button onClick={() => router.push("/qms/spesifikasyonlar")}
            style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#fff", color: "#374151", cursor: "pointer" }}>
            ← Spesifikasyonlara Dön
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>Yükleniyor…</div>
        ) : specs.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 4 }}>Onay bekleyen spesifikasyon yok</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>Tüm spesifikasyonlar işlendi</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["Spec Adı", "Kod", "Tip", "Versiyon", "Gönderilme Tarihi", "İşlemler"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 600, color: "#6B7280", borderBottom: "1px solid #E5E7EB", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {specs.map((spec, i) => {
                const typeColor = TYPE_COLORS[spec.type];
                const isProcessing = processing === spec.id;
                return (
                  <tr key={spec.id} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        onClick={() => router.push(`/qms/spesifikasyonlar?id=${spec.id}`)}
                        style={{ fontSize: 13, fontWeight: 600, color: "#3B82F6", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                      >
                        {spec.name}
                      </button>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#6B7280" }}>{spec.code}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: typeColor.bg, color: typeColor.text }}>
                        {TYPE_LABELS[spec.type]}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#374151" }}>v{spec.version}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 12, color: "#374151" }}>
                        {spec.submitted_at ? new Date(spec.submitted_at).toLocaleDateString("tr-TR") : "—"}
                      </div>
                      {spec.submitted_by && (
                        <div style={{ fontSize: 10, color: "#9CA3AF", fontFamily: "monospace" }}>{spec.submitted_by}</div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => doAction(spec, "approve")}
                          disabled={isProcessing}
                          style={{ fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 6, border: "none", background: isProcessing ? "#D1FAE5" : "#059669", color: "#fff", cursor: isProcessing ? "not-allowed" : "pointer", transition: "background 0.15s" }}
                        >
                          {isProcessing ? "…" : "Onayla"}
                        </button>
                        <button
                          onClick={() => doAction(spec, "archive")}
                          disabled={isProcessing}
                          style={{ fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#fff", color: "#DC2626", cursor: isProcessing ? "not-allowed" : "pointer" }}
                        >
                          Reddet
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
