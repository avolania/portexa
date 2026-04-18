"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { supabase } from "@/lib/supabase";

const TEST_TAG = "[TEST]";
const TABLES = [
  { key: "projects",              field: "name" },
  { key: "itsm_incidents",        field: "shortDescription" },
  { key: "itsm_service_requests", field: "shortDescription" },
  { key: "itsm_change_requests",  field: "shortDescription" },
] as const;

type TableKey = typeof TABLES[number]["key"];
type OrgCounts = Record<TableKey, number>;

interface TestOrg {
  id: string;
  name: string;
  seeded: boolean;
  counts: OrgCounts | null;  // null = henüz sorgulanmadı
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyCount = (): OrgCounts => ({
  projects: 0, itsm_incidents: 0, itsm_service_requests: 0, itsm_change_requests: 0,
});

async function fetchCountsForOrg(orgId: string): Promise<OrgCounts> {
  const counts = emptyCount();
  await Promise.all(
    TABLES.map(async ({ key, field }) => {
      const { count } = await supabase
        .from(key)
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .like(`data->>${field}`, `${TEST_TAG}%`);
      counts[key] = count ?? 0;
    }),
  );
  return counts;
}

async function fetchTotalCountsForOrg(orgId: string): Promise<OrgCounts> {
  const counts = emptyCount();
  await Promise.all(
    TABLES.map(async ({ key }) => {
      const { count } = await supabase
        .from(key)
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId);
      counts[key] = count ?? 0;
    }),
  );
  return counts;
}

function getToken(): string {
  // Supabase session'dan access token al
  return (supabase as unknown as { supabaseUrl: string; supabaseKey: string; auth: { currentSession: { access_token: string } | null } })
    .auth?.currentSession?.access_token ?? "";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
      background: color, color: "#fff", fontFamily: "monospace",
    }}>
      {label}
    </span>
  );
}

function Btn({
  label, onClick, loading, variant = "primary", small,
}: {
  label: string; onClick: () => void; loading?: boolean;
  variant?: "primary" | "danger" | "secondary" | "ghost"; small?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: "#3B82F6", color: "#fff", border: "none" },
    danger:    { background: "#DC2626", color: "#fff", border: "none" },
    secondary: { background: "#fff", color: "#374151", border: "1px solid #D1D5DB" },
    ghost:     { background: "transparent", color: "#6B7280", border: "1px solid #E5E7EB" },
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        ...styles[variant],
        padding: small ? "5px 12px" : "8px 16px",
        borderRadius: 7, fontSize: small ? 12 : 13,
        fontWeight: 600, cursor: "pointer",
        opacity: loading ? 0.6 : 1, whiteSpace: "nowrap",
      }}
    >
      {loading ? "…" : label}
    </button>
  );
}

function CountCell({ value, expected }: { value: number | null; expected?: number }) {
  if (value === null) return <td style={{ padding: "8px 12px", textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>—</td>;
  const isIsolated = expected !== undefined && value === 0 && expected > 0;
  const isLeaking  = expected !== undefined && value > 0 && expected > 0;
  const bg = isIsolated ? "#D1FAE5" : isLeaking ? "#FEE2E2" : undefined;
  const color = isIsolated ? "#065F46" : isLeaking ? "#991B1B" : "#111827";
  return (
    <td style={{ padding: "8px 12px", textAlign: "center", fontSize: 13, fontWeight: 600, background: bg, color }}>
      {value}
      {isIsolated && <span style={{ marginLeft: 4, fontSize: 11 }}>✓</span>}
      {isLeaking  && <span style={{ marginLeft: 4, fontSize: 11 }}>⚠</span>}
    </td>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DevTestPage() {
  const user = useAuthStore((s) => s.user);

  // M-6: Sadece system_admin ve admin erişebilir
  if (!user || (user.role !== "system_admin" && user.role !== "admin")) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <p style={{ color: "#6B7280", fontSize: 14 }}>Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  const [myOrg, setMyOrg]       = useState<{ counts: OrgCounts; total: OrgCounts } | null>(null);
  const [testOrgs, setTestOrgs] = useState<TestOrg[]>([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [loading, setLoading]   = useState<Record<string, boolean>>({});
  const [log, setLog]           = useState<{ time: string; msg: string; ok: boolean }[]>([]);

  const addLog = (msg: string, ok = true) =>
    setLog((prev) => [{ time: new Date().toLocaleTimeString("tr-TR"), msg, ok }, ...prev].slice(0, 60));

  const setL = (key: string, val: boolean) =>
    setLoading((prev) => ({ ...prev, [key]: val }));

  // ─── Load current org counts ───────────────────────────────────────────────

  const refreshMyOrg = useCallback(async () => {
    if (!user) return;
    const [counts, total] = await Promise.all([
      fetchCountsForOrg(user.orgId),
      fetchTotalCountsForOrg(user.orgId),
    ]);
    setMyOrg({ counts, total });
  }, [user]);

  useEffect(() => { refreshMyOrg(); }, [refreshMyOrg]);

  // ─── Refresh test orgs visibility (client RLS check) ──────────────────────

  const refreshTestOrgCounts = useCallback(async () => {
    setTestOrgs((prev) =>
      prev.map((o) => ({ ...o, counts: null })),
    );
    const updated = await Promise.all(
      testOrgs.map(async (org) => ({
        ...org,
        counts: await fetchCountsForOrg(org.id),
      })),
    );
    setTestOrgs(updated);
  }, [testOrgs]);

  // ─── Get session token ─────────────────────────────────────────────────────

  const getAccessToken = async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  };

  // ─── Add test org slot ─────────────────────────────────────────────────────

  const addTestOrg = () => {
    const name = newOrgName.trim() || `Test Org ${testOrgs.length + 1}`;
    const id = crypto.randomUUID();
    setTestOrgs((prev) => [...prev, { id, name: `${TEST_TAG} ${name}`, seeded: false, counts: null }]);
    setNewOrgName("");
    addLog(`Org slot oluşturuldu: "${TEST_TAG} ${name}" (${id.slice(0, 8)}…)`);
  };

  // ─── Seed a specific test org ──────────────────────────────────────────────

  const seedOrg = async (orgId: string) => {
    setL(`seed-${orgId}`, true);
    try {
      const token = await getAccessToken();
      const org = testOrgs.find((o) => o.id === orgId)!;
      const res = await fetch("/api/dev/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orgs: [{ id: org.id, name: org.name }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Seed failed");

      setTestOrgs((prev) =>
        prev.map((o) => (o.id === orgId ? { ...o, seeded: true } : o)),
      );
      addLog(`✓ "${org.name}" için 2+2+2+2 = 8 kayıt oluşturuldu`);
      await refreshMyOrg();
    } catch (e) {
      addLog(`Seed hatası: ${e}`, false);
    } finally {
      setL(`seed-${orgId}`, false);
    }
  };

  // ─── Seed all pending orgs ─────────────────────────────────────────────────

  const seedAll = async () => {
    setL("seedAll", true);
    try {
      const token = await getAccessToken();
      const pending = testOrgs.filter((o) => !o.seeded);
      if (pending.length === 0) { addLog("Seed edilecek org yok."); return; }

      const res = await fetch("/api/dev/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orgs: pending.map((o) => ({ id: o.id, name: o.name })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Seed failed");

      setTestOrgs((prev) => prev.map((o) => ({ ...o, seeded: true })));
      addLog(`✓ ${pending.length} org için toplu seed tamamlandı`);
      await refreshMyOrg();
    } catch (e) {
      addLog(`Toplu seed hatası: ${e}`, false);
    } finally {
      setL("seedAll", false);
    }
  };

  // ─── Cleanup all test data ─────────────────────────────────────────────────

  const cleanupAll = async () => {
    setL("cleanup", true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/dev/cleanup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Cleanup failed");

      addLog(`✓ Temizlendi — toplam ${data.total} kayıt silindi`);
      setTestOrgs([]);
      await refreshMyOrg();
    } catch (e) {
      addLog(`Temizleme hatası: ${e}`, false);
    } finally {
      setL("cleanup", false);
    }
  };

  if (!user) {
    return <div style={{ padding: 40, color: "#EF4444", fontWeight: 600 }}>Giriş yapmanız gerekiyor.</div>;
  }

  const seededOrgs = testOrgs.filter((o) => o.seeded);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#F3F4F6", padding: 32, fontFamily: "IBM Plex Sans, sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Dev Test Aracı</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
              Test organizasyonları oluştur, veri seed et, RLS izolasyonunu doğrula.
            </p>
          </div>
          <div style={{
            background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8,
            padding: "10px 16px", fontSize: 12, color: "#374151",
            display: "flex", flexDirection: "column", gap: 4, minWidth: 260,
          }}>
            <div><span style={{ color: "#9CA3AF" }}>Kullanıcı: </span><strong>{user.name}</strong></div>
            <div>
              <span style={{ color: "#9CA3AF" }}>Org ID: </span>
              <code style={{ fontSize: 11, background: "#F3F4F6", padding: "1px 4px", borderRadius: 3 }}>
                {user.orgId}
              </code>
            </div>
          </div>
        </div>

        {/* Mevcut org — genel tablo */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
              Kendi Org'um — Genel Durum
            </h2>
            <Btn label="Yenile" onClick={refreshMyOrg} variant="ghost" small />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Proje", key: "projects", color: "#3B82F6" },
              { label: "Incident", key: "itsm_incidents", color: "#DC2626" },
              { label: "SR", key: "itsm_service_requests", color: "#2563EB" },
              { label: "CR", key: "itsm_change_requests", color: "#7C3AED" },
            ].map(({ label, key, color }) => (
              <div key={key} style={{
                background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8,
                padding: "12px 16px", textAlign: "center", borderTop: `3px solid ${color}`,
              }}>
                <div style={{ fontSize: 26, fontWeight: 800, color }}>
                  {myOrg?.total[key as TableKey] ?? "—"}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{label} (toplam)</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {myOrg?.counts[key as TableKey] ?? 0} test
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Test org oluştur */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
            Test Organizasyonları
          </h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTestOrg()}
              placeholder="Org adı (örn: Acme Corp, Beta Şirket…)"
              style={{
                flex: 1, padding: "8px 14px", border: "1.5px solid #E2E8F0",
                borderRadius: 8, fontSize: 13, outline: "none",
              }}
            />
            <Btn label="+ Org Ekle" onClick={addTestOrg} variant="secondary" />
          </div>

          {testOrgs.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>
              Henüz test organizasyonu eklenmedi. Yukarıdan ekle.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {testOrgs.map((org) => (
                <div key={org.id} style={{
                  border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 12, background: "#FAFAFA",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{org.name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace", marginTop: 2 }}>
                      {org.id}
                    </div>
                  </div>
                  {org.seeded ? (
                    <Badge label="Seeded ✓" color="#059669" />
                  ) : (
                    <Badge label="Boş" color="#9CA3AF" />
                  )}
                  <Btn
                    label={org.seeded ? "Tekrar Seed Et" : "Seed Et"}
                    onClick={() => seedOrg(org.id)}
                    loading={loading[`seed-${org.id}`]}
                    variant={org.seeded ? "ghost" : "primary"}
                    small
                  />
                  <Btn
                    label="Kaldır"
                    onClick={() => setTestOrgs((prev) => prev.filter((o) => o.id !== org.id))}
                    variant="ghost"
                    small
                  />
                </div>
              ))}

              {testOrgs.some((o) => !o.seeded) && (
                <Btn
                  label={`Tümünü Seed Et (${testOrgs.filter((o) => !o.seeded).length} org)`}
                  onClick={seedAll}
                  loading={loading.seedAll}
                />
              )}
            </div>
          )}
        </div>

        {/* İzolasyon matrisi */}
        {seededOrgs.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
                  RLS İzolasyon Matrisi
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>
                  Yeşil = RLS çalışıyor (0 kayıt görünüyor) · Kırmızı = Sızıntı var
                </p>
              </div>
              <Btn label="Görünürlüğü Sorgula" onClick={refreshTestOrgCounts} variant="secondary" small />
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Organizasyon</th>
                  <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#3B82F6" }}>Proje</th>
                  <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#DC2626" }}>Incident</th>
                  <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#2563EB" }}>SR</th>
                  <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#7C3AED" }}>CR</th>
                  <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#374151" }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {/* Kendi org'um */}
                <tr style={{ borderBottom: "1px solid #F3F4F6", background: "#F0FDF4" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Kendi Org'um (ben)</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{user.orgId.slice(0, 16)}…</div>
                  </td>
                  <CountCell value={myOrg?.counts.projects ?? 0} />
                  <CountCell value={myOrg?.counts.itsm_incidents ?? 0} />
                  <CountCell value={myOrg?.counts.itsm_service_requests ?? 0} />
                  <CountCell value={myOrg?.counts.itsm_change_requests ?? 0} />
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <Badge label="Kendi verim" color="#3B82F6" />
                  </td>
                </tr>

                {/* Test org'lar */}
                {seededOrgs.map((org) => {
                  const c = org.counts;
                  const allZero = c !== null && Object.values(c).every((v) => v === 0);
                  const hasLeak = c !== null && Object.values(c).some((v) => v > 0);
                  return (
                    <tr key={org.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "8px 12px" }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{org.name}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{org.id.slice(0, 16)}…</div>
                      </td>
                      <CountCell value={c?.projects ?? null} expected={2} />
                      <CountCell value={c?.itsm_incidents ?? null} expected={2} />
                      <CountCell value={c?.itsm_service_requests ?? null} expected={2} />
                      <CountCell value={c?.itsm_change_requests ?? null} expected={2} />
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        {c === null ? (
                          <Badge label="Sorgulanmadı" color="#9CA3AF" />
                        ) : allZero ? (
                          <Badge label="✓ İzole" color="#059669" />
                        ) : hasLeak ? (
                          <Badge label="⚠ Sızıntı!" color="#DC2626" />
                        ) : (
                          <Badge label="?" color="#9CA3AF" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 12, padding: "10px 14px", background: "#F8FAFC", borderRadius: 6, fontSize: 12, color: "#64748B" }}>
              <strong>Nasıl okunur:</strong> "Kendi verim" satırında seed ettiğin test kayıtları görünmeli.
              Diğer satırlarda <strong>0 / ✓ İzole</strong> görünmesi RLS'nin çalıştığını kanıtlar.
              Sayı &gt; 0 ise <strong>⚠ Sızıntı</strong> — RLS politikası eksik veya hatalı demektir.
            </div>
          </div>
        )}

        {/* Temizle */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 24 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#111827" }}>Temizlik</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6B7280" }}>
            Tüm tablolardaki <code style={{ background: "#F3F4F6", padding: "1px 4px", borderRadius: 3 }}>[TEST]</code> etiketli
            kayıtları ve test organizasyonlarını siler. Gerçek verilere dokunmaz.
          </p>
          <Btn
            label="Tüm Test Verilerini Temizle"
            onClick={cleanupAll}
            loading={loading.cleanup}
            variant="danger"
          />
        </div>

        {/* Log */}
        {log.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>İşlem Geçmişi</h2>
              <Btn label="Temizle" onClick={() => setLog([])} variant="ghost" small />
            </div>
            <div style={{
              background: "#0F172A", borderRadius: 8, padding: 16, maxHeight: 240, overflowY: "auto",
              fontFamily: "JetBrains Mono, monospace", fontSize: 12,
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              {log.map((entry, i) => (
                <div key={i} style={{ color: entry.ok ? "#4ADE80" : "#F87171" }}>
                  <span style={{ color: "#64748B", marginRight: 10 }}>{entry.time}</span>
                  {entry.msg}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
