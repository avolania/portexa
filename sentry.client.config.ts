import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Production'da hataların %100'ünü, dev'de %0'ını yakala
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0,

  // Session Replay: production'da hataların %100'ünde, normal'de %5'inde kayıt al
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,

  integrations: [
    Sentry.replayIntegration({
      // PII maskeleme — GDPR uyumu için
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],

  // DSN varsa her ortamda çalış
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
