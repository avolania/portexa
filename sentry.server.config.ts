import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // API route ve server action hatalarını yakala
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0,

  // Geliştirme ortamında Sentry'ye gönderme
  enabled: process.env.NODE_ENV === "production",
});
