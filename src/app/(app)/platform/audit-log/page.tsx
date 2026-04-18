"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { supabase } from "@/lib/supabase";

interface AuditLogRow {
  id: string;
  org_id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  changes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "user.login":                  { label: "Giriş",           color: "#10B981" },
  "user.logout":                 { label: "Çıkış",           color: "#6B7280" },
  "user.invite_accepted":        { label: "Davet Kabul",     color: "#3B82F6" },
  "user.role_changed":           { label: "Rol Değişikliği", color: "#F59E0B" },
  "user.profile_updated":        { label: "Profil Güncelleme", color: "#6B7280" },
  "user.removed":                { label: "Kullanıcı Silindi", color: "#EF4444" },
  "project.created":             { label: "Proje Oluşturuldu", color: "#3B82F6" },
  "project.updated":             { label: "Proje Güncellendi", color: "#6B7280" },
  "project.deleted":             { label: "Proje Silindi",   color: "#EF4444" },
  "task.created":                { label: "Görev Oluşturuldu", color: "#3B82F6" },
  "task.deleted":                { label: "Görev Silindi",   color: "#EF4444" },
  "incident.created":            { label: "INC Oluşturuldu", color: "#DC2626" },
  "incident.state_changed":      { label: "INC Durum Değişti", color: "#D97706" },
  "service_request.created":     { label: "SR Oluşturuldu",  color: "#2563EB" },
  "service_request.state_changed": { label: "SR Durum Değişti", color: "#D97706" },
  "change_request.created":      { label: "CR Oluşturuldu",  color: "#7C3AED" },
  "change_request.state_changed": { label: "CR Durum Değişti", color: "#D97706" },
  "settings.updated":            { label: "Ayar Güncellendi", color: "#6B7280" },
  "org.updated":                 { label: "Org Güncellendi", color: "#6B7280" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AuditLogPage() {
  const user = useAuthStore((s) => s.user);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (user.role !== "system_admin") {
      query = query.eq("org_id", user.orgId);
    }
    if (actionFilter) {
      query = query.eq("action", actionFilter);
    }

    const { data } = await query;
    setLogs((data ?? []) as AuditLogRow[]);
    setLoading(false);
  }, [user, actionFilter]);

  useEffect(() => { load(); }, [load]);

  if (!user || (user.role !== "system_admin" && user.role !== "admin")) {
    return (
      <div style={{ padding: 40, color: "#6B7280", fontFamily: "IBM Plex Sans, sans-serif" }}>
        Bu sayfaya erişim yetkiniz yok.
      </div>
    );
  }

  const filtered = logs.filter((l) =>
    !search ||
    l.user_email.toLowerCase().includes(search.toLowerCase()) ||
    l.resource_name.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase())
  );

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action))).sort();

  return (
    <div style={{ padding: "24px 32px", fontFamily: "IBM Plex Sans, sans-serif", background: "#F3F4F6", minHeight: "100vh" }}>
      {/* Başlık */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>Denetim İzi</h1>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>
          Son 200 kayıt · Değiştirilemez · 1 yıl saklanır
        </p>
      </div>

      {/* Filtreler */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          placeholder="E-posta, kaynak veya işlem ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "8px 12px", border: "1px solid #E5E7EB",
            borderRadius: 8, fontSize: 13, background: "#fff", outline: "none",
          }}
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            padding: "8px 12px", border: "1px solid #E5E7EB",
            borderRadius: 8, fontSize: 13, background: "#fff", color: "#374151", outline: "none",
          }}
        >
          <option value="">Tüm İşlemler</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
          ))}
        </select>
      </div>

      {/* Tablo */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
        {/* Tablo başlığı */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr 140px 180px 120px",
          padding: "10px 16px",
          background: "#F9FAFB",
          borderBottom: "1px solid #E5E7EB",
          fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          <span>Tarih</span>
          <span>Kullanıcı</span>
          <span>İşlem</span>
          <span>Kaynak</span>
          <span>Detay</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            Yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13, fontStyle: "italic" }}>
            Kayıt bulunamadı.
          </div>
        ) : (
          filtered.map((log, i) => {
            const meta = ACTION_LABELS[log.action];
            const isExpanded = expanded === log.id;
            const hasChanges = Object.keys(log.changes).length > 0;
            return (
              <div
                key={log.id}
                style={{
                  borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none",
                  background: isExpanded ? "#F9FAFB" : "#fff",
                }}
              >
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr 140px 180px 120px",
                  padding: "12px 16px",
                  alignItems: "center",
                  fontSize: 13,
                }}>
                  <span style={{ fontSize: 12, color: "#6B7280", fontFamily: "IBM Plex Mono, monospace" }}>
                    {formatDate(log.created_at)}
                  </span>
                  <span style={{ color: "#111827", fontWeight: 500 }}>
                    {log.user_email}
                  </span>
                  <span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                      background: (meta?.color ?? "#6B7280") + "20",
                      color: meta?.color ?? "#6B7280",
                    }}>
                      {meta?.label ?? log.action}
                    </span>
                  </span>
                  <span style={{ color: "#374151", fontSize: 12 }}>
                    {log.resource_name || log.resource_id || "—"}
                  </span>
                  <span>
                    {hasChanges && (
                      <button
                        onClick={() => setExpanded(isExpanded ? null : log.id)}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                          border: "1px solid #E5E7EB", background: "transparent",
                          color: "#6B7280", cursor: "pointer",
                        }}
                      >
                        {isExpanded ? "Kapat" : "Değişiklik"}
                      </button>
                    )}
                  </span>
                </div>

                {isExpanded && hasChanges && (
                  <div style={{ padding: "0 16px 12px", display: "flex", gap: 16 }}>
                    {log.changes.before !== undefined && (
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", marginBottom: 4, textTransform: "uppercase" }}>Önce</div>
                        <pre style={{
                          fontSize: 11, background: "#FEF2F2", border: "1px solid #FECACA",
                          borderRadius: 6, padding: "8px 12px", margin: 0, color: "#991B1B",
                          fontFamily: "IBM Plex Mono, monospace", whiteSpace: "pre-wrap",
                        }}>
                          {JSON.stringify(log.changes.before, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.changes.after !== undefined && (
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#10B981", marginBottom: 4, textTransform: "uppercase" }}>Sonra</div>
                        <pre style={{
                          fontSize: 11, background: "#F0FDF4", border: "1px solid #BBF7D0",
                          borderRadius: 6, padding: "8px 12px", margin: 0, color: "#166534",
                          fontFamily: "IBM Plex Mono, monospace", whiteSpace: "pre-wrap",
                        }}>
                          {JSON.stringify(log.changes.after, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: "#9CA3AF" }}>
        {filtered.length} kayıt gösteriliyor
      </div>
    </div>
  );
}
