"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { COA } from "@/lib/qms/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const COA_STATUS_LABEL: Record<string, string> = {
  submitted: "Bekliyor",
  auto_checked: "Otomatik Kontrol",
  conforming: "Uygun",
  nonconforming: "Uygunsuz",
  manual_review: "Manuel İnceleme",
};

const COA_STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  submitted: { bg: "#FEF3C7", color: "#D97706" },
  auto_checked: { bg: "#DBEAFE", color: "#1D4ED8" },
  conforming: { bg: "#D1FAE5", color: "#059669" },
  nonconforming: { bg: "#FEE2E2", color: "#DC2626" },
  manual_review: { bg: "#F3E8FF", color: "#7C3AED" },
};

export default function CoaPortalPage() {
  const router = useRouter();
  const [coas, setCoas] = useState<COA[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetCoaId, setTargetCoaId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/portal/davet/logout");
        return;
      }
      setToken(session.access_token);

      const res = await fetch("/api/portal/coa", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setCoas(await res.json());
      }
      setLoading(false);
    });
  }, [router]);

  const handleUpload = async (coaId: string, file: File) => {
    setUploadingId(coaId);
    setError("");
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/portal/coa/${coaId}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      // Refresh COA list
      const refresh = await fetch("/api/portal/coa", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (refresh.ok) setCoas(await refresh.json());
    } else {
      const d = await res.json();
      setError(d.error ?? "Dosya yüklenirken hata oluştu");
    }
    setUploadingId(null);
  };

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
          COA Yönetimi
        </h1>
        <p style={{ fontSize: 14, color: "#6B7280" }}>
          COA belgelerinizi görüntüleyin ve PDF yükleyin
        </p>
      </div>

      {error && (
        <div style={{ padding: "10px 16px", background: "#FEE2E2", borderRadius: 8, color: "#DC2626", fontSize: 13 }}>
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && targetCoaId) {
            handleUpload(targetCoaId, file);
          }
          e.target.value = "";
        }}
      />

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        {coas.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#9CA3AF", fontSize: 13, fontStyle: "italic" }}>
            Henüz COA kaydı yok
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["Lot ID", "Spec", "Durum", "Dosya", "Tarih", "İşlemler"].map((h) => (
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
              {coas.map((coa) => {
                const badge = COA_STATUS_BADGE[coa.status] ?? { bg: "#F3F4F6", color: "#6B7280" };
                const isUploading = uploadingId === coa.id;
                return (
                  <tr
                    key={coa.id}
                    style={{ borderBottom: "1px solid #F3F4F6" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px", fontSize: 12, fontFamily: "monospace", color: "#374151" }}>
                      {coa.lot_id.slice(0, 8)}...
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#6B7280" }}>
                      {coa.spec_id ? coa.spec_id.slice(0, 8) + "..." : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {COA_STATUS_LABEL[coa.status] ?? coa.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#374151" }}>
                      {coa.file_name ? (
                        <span style={{ color: "#059669" }}>✓ {coa.file_name}</span>
                      ) : (
                        <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>Dosya yok</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#6B7280" }}>
                      {new Date(coa.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {coa.file_ref && (
                          <a
                            href={`#`}
                            style={{
                              padding: "5px 12px",
                              background: "#F0FDF4",
                              color: "#059669",
                              border: "1px solid #BBF7D0",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            Görüntüle
                          </a>
                        )}
                        {coa.status === "submitted" && !coa.file_ref && role !== "viewer" && (
                          <button
                            onClick={() => {
                              setTargetCoaId(coa.id);
                              fileInputRef.current?.click();
                            }}
                            disabled={isUploading}
                            style={{
                              padding: "5px 12px",
                              background: isUploading ? "#93C5FD" : "#3B82F6",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: isUploading ? "not-allowed" : "pointer",
                            }}
                          >
                            {isUploading ? "Yükleniyor..." : "PDF Yükle"}
                          </button>
                        )}
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
