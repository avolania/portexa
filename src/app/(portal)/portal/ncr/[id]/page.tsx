"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { NCR, NcrResponse, SupplierPortalRole } from "@/lib/qms/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

const NCR_STATE_LABEL: Record<string, string> = {
  open: "Açık",
  investigating: "Araştırılıyor",
  disposition_pending: "Karar Bekliyor",
  capa_linked: "CAPA Bağlı",
  closed: "Kapalı",
  rejected: "Reddedildi",
};

const NCR_STATE_BADGE: Record<string, { bg: string; color: string }> = {
  open: { bg: "#DBEAFE", color: "#1D4ED8" },
  investigating: { bg: "#FEF3C7", color: "#D97706" },
  disposition_pending: { bg: "#F3E8FF", color: "#7C3AED" },
  capa_linked: { bg: "#D1FAE5", color: "#059669" },
  closed: { bg: "#E5E7EB", color: "#374151" },
  rejected: { bg: "#FEE2E2", color: "#DC2626" },
};

interface UploadedFile {
  name: string;
  ref: string;
}

export default function NcrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ncr, setNcr] = useState<NCR | null>(null);
  const [responses, setResponses] = useState<NcrResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [role, setRole] = useState<SupplierPortalRole>("viewer");
  const [responseText, setResponseText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/portal/davet/logout");
        return;
      }
      setToken(session.access_token);

      // Get role from supplier user
      const dashRes = await fetch("/api/portal/dashboard", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      // We use this just to verify; role will come from supplier user context
      // For now, we check when submitting

      const res = await fetch(`/api/portal/ncrs/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const d = await res.json();
        setNcr(d.ncr);
        setResponses(d.responses);
      } else {
        setError("NCR yüklenirken hata oluştu");
      }
      setLoading(false);
    });
  }, [id, router]);

  const handleFileUpload = async (file: File) => {
    if (!token) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/portal/ncrs/${id}/response-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      const d = await res.json();
      setUploadedFiles((prev) => [...prev, { name: d.name, ref: d.ref }]);
    } else {
      const d = await res.json();
      setError(d.error ?? "Dosya yüklenirken hata oluştu");
    }
    setUploading(false);
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim() || !token) return;
    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/portal/ncrs/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ response_text: responseText, attachments: uploadedFiles }),
    });

    if (res.ok) {
      const newResponse = await res.json();
      setResponses((prev) => [...prev, newResponse]);
      setResponseText("");
      setUploadedFiles([]);
    } else {
      const d = await res.json();
      setError(d.error ?? "Yanıt gönderilemedi");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div style={{ color: "#6B7280", fontSize: 14 }}>Yükleniyor...</div>
      </div>
    );
  }

  if (!ncr) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#6B7280" }}>
        {error || "NCR bulunamadı"}
      </div>
    );
  }

  const sevBadge = SEVERITY_BADGE[ncr.severity] ?? { bg: "#F3F4F6", color: "#6B7280" };
  const stateBadge = NCR_STATE_BADGE[ncr.state] ?? { bg: "#F3F4F6", color: "#6B7280" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Back + Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: "6px 12px",
            border: "1px solid #E5E7EB",
            borderRadius: 6,
            background: "#fff",
            color: "#6B7280",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Geri
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", fontFamily: "monospace" }}>
          {ncr.ncr_number}
        </h1>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 5,
            fontSize: 11,
            fontWeight: 600,
            background: sevBadge.bg,
            color: sevBadge.color,
          }}
        >
          {SEVERITY_LABEL[ncr.severity] ?? ncr.severity}
        </span>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 5,
            fontSize: 11,
            fontWeight: 600,
            background: stateBadge.bg,
            color: stateBadge.color,
          }}
        >
          {NCR_STATE_LABEL[ncr.state] ?? ncr.state}
        </span>
      </div>

      {/* NCR Info Card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #E5E7EB",
          padding: 24,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Açıklama
            </p>
            <p style={{ fontSize: 13, color: "#374151" }}>{ncr.description}</p>
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Oluşturulma Tarihi
            </p>
            <p style={{ fontSize: 13, color: "#374151" }}>
              {new Date(ncr.created_at).toLocaleDateString("tr-TR")}
            </p>
          </div>
          {ncr.lot_id && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Lot ID
              </p>
              <p style={{ fontSize: 13, color: "#374151", fontFamily: "monospace" }}>{ncr.lot_id}</p>
            </div>
          )}
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Kategori
            </p>
            <p style={{ fontSize: 13, color: "#374151" }}>{ncr.category}</p>
          </div>
        </div>
      </div>

      {/* Responses */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
            Yanıtlar ({responses.length})
          </h2>
        </div>

        {responses.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13, fontStyle: "italic" }}>
            Henüz yanıt eklenmemiş
          </div>
        ) : (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            {responses.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  gap: 12,
                  animation: `slideUp 0.2s ease ${i * 0.03}s both`,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#3B82F6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  T
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      background: "#F9FAFB",
                      borderRadius: 10,
                      border: "1px solid #E5E7EB",
                      padding: "14px 16px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Tedarikçi Yanıtı</span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                        {new Date(r.created_at).toLocaleString("tr-TR")}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{r.response_text}</p>
                    {r.attachments.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {r.attachments.map((a) => (
                          <a
                            key={a.ref}
                            href={`#`}
                            style={{
                              padding: "3px 10px",
                              background: "#DBEAFE",
                              color: "#1D4ED8",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            📎 {a.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Response Form */}
        {role !== "viewer" && (
          <div style={{ padding: 20, borderTop: "1px solid #F3F4F6" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Yanıt Ekle</p>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Yanıtınızı buraya yazın..."
              rows={4}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1.5px solid #E2E8F0",
                borderRadius: 8,
                fontSize: 13,
                resize: "vertical",
                outline: "none",
                fontFamily: "'DM Sans', sans-serif",
                boxSizing: "border-box",
              }}
            />

            {/* Uploaded files */}
            {uploadedFiles.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {uploadedFiles.map((f, fi) => (
                  <span
                    key={f.ref}
                    style={{
                      padding: "3px 10px",
                      background: "#DBEAFE",
                      color: "#1D4ED8",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    📎 {f.name}
                    <button
                      onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== fi))}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#1D4ED8",
                        fontSize: 12,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {error && (
              <div style={{ padding: "8px 12px", background: "#FEE2E2", borderRadius: 6, color: "#DC2626", fontSize: 12, marginTop: 8 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 6,
                  background: "#fff",
                  color: "#6B7280",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: uploading ? "not-allowed" : "pointer",
                }}
              >
                {uploading ? "Yükleniyor..." : "📎 Dosya Ekle"}
              </button>
              <button
                onClick={handleSubmitResponse}
                disabled={submitting || !responseText.trim()}
                style={{
                  padding: "8px 20px",
                  background: submitting || !responseText.trim() ? "#93C5FD" : "#3B82F6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: submitting || !responseText.trim() ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
