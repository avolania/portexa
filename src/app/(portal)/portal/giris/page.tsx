"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PortalGirisPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error("E-posta veya şifre hatalı.");
      if (!data.session) throw new Error("Giriş yapılamadı, lütfen tekrar deneyin.");

      // Verify this is a valid portal user
      const res = await fetch("/api/portal/dashboard", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });

      if (!res.ok) {
        await supabase.auth.signOut();
        throw new Error("Bu hesap tedarikçi portalına erişim yetkisine sahip değil.");
      }

      router.push("/portal/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 440,
        margin: "80px auto",
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E5E7EB",
        padding: 40,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 800,
            color: "#fff",
            margin: "0 auto 16px",
          }}
        >
          Px
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
          Tedarikçi Portalı
        </h1>
        <p style={{ fontSize: 13, color: "#6B7280" }}>
          Hesabınıza giriş yapın
        </p>
      </div>

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}
          >
            E-posta
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="ornek@tedarikci.com"
            style={{
              width: "100%",
              padding: "9px 14px",
              border: "1.5px solid #E2E8F0",
              borderRadius: 8,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}
          >
            Şifre
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={{
              width: "100%",
              padding: "9px 14px",
              border: "1.5px solid #E2E8F0",
              borderRadius: 8,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "#FEE2E2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              color: "#DC2626",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "11px",
            background: loading ? "#93C5FD" : "#3B82F6",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.2s",
            marginTop: 4,
          }}
        >
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: 12, color: "#9CA3AF", marginTop: 24 }}>
        Hesabınız yok mu?{" "}
        <span style={{ color: "#6B7280" }}>
          Tedarikçi portalına erişim için şirketinizden davet linki talep edin.
        </span>
      </p>
    </div>
  );
}
