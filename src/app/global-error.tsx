"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "IBM Plex Sans, sans-serif",
          background: "#F3F4F6",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: "40px 48px",
            textAlign: "center",
            maxWidth: 440,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 800,
              color: "#fff",
              margin: "0 auto 20px",
            }}
          >
            Px
          </div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 8px",
            }}
          >
            Beklenmedik bir hata oluştu
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#6B7280",
              margin: "0 0 24px",
              lineHeight: 1.6,
            }}
          >
            Ekibimiz otomatik olarak bilgilendirildi. Sayfayı yenilemeyi
            deneyin.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#3B82F6",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tekrar Dene
          </button>
        </div>
      </body>
    </html>
  );
}
