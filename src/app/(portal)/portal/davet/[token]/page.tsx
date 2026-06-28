"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface InviteInfo {
  email: string;
  name: string;
  role: string;
  supplier_name: string;
  expires_at: string;
  is_expired: boolean;
  is_accepted: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  viewer: "Görüntüleyici",
  uploader: "Yükleyici",
  responder: "Yanıtlayıcı",
};

export default function DavetPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!token || token === "logout") {
      setLoading(false);
      return;
    }
    fetch(`/api/qms/portal/invites/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json();
          setError(d.error ?? "Davet bulunamadı");
          return;
        }
        const data = await res.json();
        setInvite(data);
      })
      .catch(() => setError("Davet yüklenirken hata oluştu"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!invite) return;
    if (password.length < 8) {
      setSubmitError("Şifre en az 8 karakter olmalıdır");
      return;
    }
    if (password !== passwordConfirm) {
      setSubmitError("Şifreler eşleşmiyor");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      // 1. Create Supabase account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: { data: { name: invite.name } },
      });

      if (signUpError) throw new Error(signUpError.message);
      if (!authData.session) throw new Error("Hesap oluşturuldu ancak oturum açılamadı. Lütfen e-postanızı doğrulayın.');");

      // 2. Accept invite
      const acceptRes = await fetch(`/api/qms/portal/invites/${token}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.session.access_token}`,
        },
      });

      if (!acceptRes.ok) {
        const d = await acceptRes.json();
        throw new Error(d.error ?? "Davet kabul edilemedi");
      }

      router.push("/portal/dashboard");
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div style={{ color: "#6B7280", fontSize: 14 }}>Yükleniyor...</div>
      </div>
    );
  }

  if (token === "logout") {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: "80px auto",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #E5E7EB",
          padding: 40,
          textAlign: "center",
        }}
      >
        <p style={{ color: "#374151", fontSize: 16, fontWeight: 600 }}>Çıkış yapıldı.</p>
        <p style={{ color: "#6B7280", fontSize: 13, marginTop: 8 }}>Tedarikçi portalına giriş yapmak için davet bağlantınızı kullanın.</p>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: "80px auto",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #FEE2E2",
          padding: 40,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: "#DC2626", fontSize: 16, fontWeight: 600 }}>Geçersiz Davet</p>
        <p style={{ color: "#6B7280", fontSize: 13, marginTop: 8 }}>{error || "Bu davet bağlantısı geçerli değil."}</p>
      </div>
    );
  }

  if (invite.is_accepted) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: "80px auto",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #E5E7EB",
          padding: 40,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
        <p style={{ color: "#059669", fontSize: 16, fontWeight: 600 }}>Bu Davet Zaten Kabul Edildi</p>
        <p style={{ color: "#6B7280", fontSize: 13, marginTop: 8 }}>Hesabınız oluşturulmuş.</p>
        <a
          href="/portal/giris"
          style={{
            display: "inline-block",
            marginTop: 16,
            padding: "9px 24px",
            background: "#3B82F6",
            color: "#fff",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Giriş Yap
        </a>
      </div>
    );
  }

  if (invite.is_expired) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: "80px auto",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #FEE2E2",
          padding: 40,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏰</div>
        <p style={{ color: "#DC2626", fontSize: 16, fontWeight: 600 }}>Davet Süresi Dolmuş</p>
        <p style={{ color: "#6B7280", fontSize: 13, marginTop: 8 }}>
          Bu davet süresi doldu. Yeni bir davet için şirketinizle iletişime geçin.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "60px auto",
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E5E7EB",
        padding: 40,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 800,
            color: "#fff",
            margin: "0 auto 16px",
          }}
        >
          Px
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
          Pixanto Tedarikçi Portalı&apos;na Davet Edildiniz
        </h1>
        <p style={{ fontSize: 14, color: "#6B7280" }}>
          <strong style={{ color: "#374151" }}>{invite.supplier_name}</strong> adına{" "}
          <span
            style={{
              padding: "2px 8px",
              background: "#DBEAFE",
              color: "#1D4ED8",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {ROLE_LABEL[invite.role] ?? invite.role}
          </span>{" "}
          rolüyle davet edildiniz.
        </p>
      </div>

      {/* Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            E-posta
          </label>
          <input
            type="email"
            value={invite.email}
            readOnly
            style={{
              width: "100%",
              padding: "9px 14px",
              border: "1.5px solid #E2E8F0",
              borderRadius: 8,
              fontSize: 13,
              background: "#F9FAFB",
              color: "#6B7280",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Ad Soyad
          </label>
          <input
            type="text"
            value={invite.name}
            readOnly
            style={{
              width: "100%",
              padding: "9px 14px",
              border: "1.5px solid #E2E8F0",
              borderRadius: 8,
              fontSize: 13,
              background: "#F9FAFB",
              color: "#6B7280",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Şifre *
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="En az 8 karakter"
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
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Şifre Tekrar *
          </label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Şifreyi tekrar girin"
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

        {submitError && (
          <div style={{ padding: "10px 14px", background: "#FEE2E2", borderRadius: 8, color: "#DC2626", fontSize: 13 }}>
            {submitError}
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={submitting || !password || !passwordConfirm}
          style={{
            width: "100%",
            padding: "11px",
            background: submitting ? "#93C5FD" : "#3B82F6",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            transition: "background 0.2s",
          }}
        >
          {submitting ? "Hesap Oluşturuluyor..." : "Hesabı Oluştur ve Giriş Yap"}
        </button>
      </div>

      <p style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", marginTop: 20 }}>
        Davet son tarihi: {new Date(invite.expires_at).toLocaleDateString("tr-TR")}
      </p>
    </div>
  );
}
