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

  // Default to a 10% trace sample when Sentry is enabled. That gives us a
  // statistically useful view of route latency (p50/p95/p99) without
  // ballooning Sentry quota. Operators can dial it up/down via
  // SENTRY_TRACES_SAMPLE_RATE; setting it to 0 disables performance tracing
  // entirely while leaving error reporting intact.
  const tracesSampleRateRaw = process.env.SENTRY_TRACES_SAMPLE_RATE;
  let tracesSampleRate: number;
  if (tracesSampleRateRaw === undefined || tracesSampleRateRaw === "") {
    tracesSampleRate = 0.1;
  } else {
    const parsed = Number(tracesSampleRateRaw);
    // Clamp to [0,1]; fall back to the default on NaN so a typo can't
    // silently disable tracing or send 100% of requests.
    tracesSampleRate =
      Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.1;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate,
    sendDefaultPii: false,
  });

  initialized = true;
  return true;
}

export { Sentry };
