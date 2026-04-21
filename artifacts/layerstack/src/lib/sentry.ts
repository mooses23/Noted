import * as Sentry from "@sentry/react";

let initialized = false;

/**
 * Initialize Sentry for the React frontend.
 *
 * No-op when `VITE_SENTRY_DSN` is unset (e.g. local Replit dev) so the app
 * keeps running without an account.
 */
export function initSentry(): void {
  if (initialized) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment:
      (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ??
      (import.meta.env.MODE as string | undefined) ??
      "production",
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    tracesSampleRate: Number(
      (import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string | undefined) ?? 0,
    ),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });

  initialized = true;
}

export function setSentryUser(user: { id: string; email?: string | null } | null): void {
  if (!initialized) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, email: user.email ?? undefined });
}

export { Sentry };
