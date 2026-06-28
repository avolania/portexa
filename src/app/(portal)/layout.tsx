"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [supplierName, setSupplierName] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const publicPaths = ["/portal/giris", "/portal/davet"];
    const isPublic = publicPaths.some((p) => window.location.pathname.startsWith(p));

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        if (!isPublic) router.push("/portal/giris");
        return;
      }
      const meta = session.user.user_metadata as Record<string, string> | undefined;
      if (meta?.name) setUserName(meta.name);
    });
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/portal/giris");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F3F4F6",
        fontFamily: "'DM Sans', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#1E293B",
          color: "#fff",
          padding: "0 32px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            Px
          </div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Pixanto Tedarikçi Portalı</span>
          {supplierName && (
            <>
              <span style={{ color: "#64748B", fontSize: 13 }}>›</span>
              <span style={{ color: "#94A3B8", fontSize: 13 }}>{supplierName}</span>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {userName && (
            <span style={{ color: "#94A3B8", fontSize: 13 }}>{userName}</span>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 14px",
              border: "1px solid #334155",
              borderRadius: 6,
              background: "transparent",
              color: "#94A3B8",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Çıkış
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, maxWidth: 1100, width: "100%", margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "16px",
          color: "#9CA3AF",
          fontSize: 12,
          borderTop: "1px solid #E5E7EB",
          background: "#fff",
        }}
      >
        © 2026 Pixanto
      </footer>
    </div>
  );
}
