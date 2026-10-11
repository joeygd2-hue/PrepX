/**
 * Central access to configuration. Server-only values must never be imported by
 * client components (they are read from process.env at request time on the server).
 */
export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  isProd: process.env.NODE_ENV === "production",
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@prepx.app",
  privacyEmail: process.env.PRIVACY_EMAIL ?? "privacy@prepx.app",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  email: {
    provider: (process.env.EMAIL_PROVIDER ?? "console") as "console" | "resend" | "smtp",
    from: process.env.EMAIL_FROM ?? "PrepX <no-reply@prepx.app>",
    resendKey: process.env.RESEND_API_KEY ?? "",
  },
  ai: {
    provider: (process.env.AI_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "none")) as
      | "anthropic"
      | "mock"
      | "none",
    model: process.env.AI_MODEL ?? "claude-opus-5-5",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 60000),
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    priceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    priceSeasonBoost: process.env.STRIPE_PRICE_SEASON_BOOST ?? "",
  },
  push: {
    vapidPublic: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    vapidPrivate: process.env.VAPID_PRIVATE_KEY ?? "",
  },
  cronSecret: process.env.CRON_SECRET ?? "",
  adminEmails: (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  /** Where the client address comes from (see clientIp in src/server/request.ts). */
  proxy: {
    /** Reverse proxies in front of the app that each append to X-Forwarded-For; 0 reads X-Real-IP instead. */
    trustedProxyCount: /^\d+$/.test(process.env.TRUSTED_PROXY_COUNT?.trim() ?? "") ? Number(process.env.TRUSTED_PROXY_COUNT) : 1,
    // Platform headers are trusted only on the platform that sets them; elsewhere a client could send them.
    vercel: Boolean(process.env.VERCEL),
    fly: Boolean(process.env.FLY_APP_NAME),
    cloudflare: ["1", "true"].includes(process.env.TRUST_CF_CONNECTING_IP?.trim().toLowerCase() ?? ""),
  },
};

export const features = {
  google: () => Boolean(env.google.clientId && env.google.clientSecret),
  ai: () => env.ai.provider !== "none",
  aiIsMock: () => env.ai.provider === "mock",
  billing: () => Boolean(env.stripe.secretKey && env.stripe.webhookSecret && env.stripe.priceProMonthly),
  push: () => Boolean(env.push.vapidPublic && env.push.vapidPrivate),
};
