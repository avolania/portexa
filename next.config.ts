import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jspdf", "pptxgenjs", "fflate"],
};

export default withSentryConfig(nextConfig, {
  org: "dincer-cinar",
  project: "javascript-nextjs",

  // Source map'leri Sentry'ye yükle, bundle'a ekleme (boyutu küçültür)
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Sentry CLI auth token — Vercel'de env var olarak eklenecek
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Build sırasında Sentry bağlantısı yoksa sessizce geç
  silent: !process.env.CI,
  telemetry: false,
});
