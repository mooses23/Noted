import * as Sentry from "@sentry/node";

let initialized = false;

/**
 * Initialize Sentry for the API server.
 *
 * Safe to call multiple times — only the first call has effect. If
 * `SENTRY_DSN` is not set (e.g. local Replit dev) this is a no-op so the API
 * keeps working without an account.
 *
 * Must be called before any application modules that you want auto-instrumented
 * are imported. In practice the entry points (`src/app.ts` and
 * `api/[...all].ts`) call this at the very top.
 */
export function initSentry(): boolean {
  if (initialized) return true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    sendDefaultPii: false,
  });

  initialized = true;
  return true;
}

export { Sentry };
