type Window = { windowMs: number; max: number };

const buckets = new Map<string, number[]>();

/**
 * Per-key sliding-window rate limit. In-memory only; sufficient for the
 * single-process api-server and zero-dep. If we ever scale horizontally
 * this should move to redis.
 *
 * Returns { ok: true } when the action is allowed, otherwise the smallest
 * retryAfterSec across the failing windows.
 */
export function checkRateLimit(
  key: string,
  windows: Window[],
  now: number = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number } {
  const longest = Math.max(...windows.map((w) => w.windowMs));
  const cutoff = now - longest;
  const existing = (buckets.get(key) ?? []).filter((t) => t >= cutoff);

  let retryAfterMs = 0;
  for (const w of windows) {
    const winCutoff = now - w.windowMs;
    const inWindow = existing.filter((t) => t >= winCutoff);
    if (inWindow.length >= w.max) {
      const oldest = inWindow[0]!;
      retryAfterMs = Math.max(retryAfterMs, oldest + w.windowMs - now);
    }
  }

  if (retryAfterMs > 0) {
    buckets.set(key, existing);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  existing.push(now);
  buckets.set(key, existing);
  return { ok: true };
}

export const COMMENT_POST_LIMITS: Window[] = [
  { windowMs: 60 * 1000, max: 5 },
  { windowMs: 60 * 60 * 1000, max: 30 },
];

export const COMMENT_REPORT_LIMITS: Window[] = [
  { windowMs: 60 * 1000, max: 10 },
  { windowMs: 60 * 60 * 1000, max: 60 },
];
