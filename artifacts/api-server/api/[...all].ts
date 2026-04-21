// Vercel serverless catch-all entry for the Noted API.
//
// Filesystem routing:
//   * Vercel automatically routes any request matching `/api/*` to this
//     `[...all]` catch-all. The original request URL (e.g. `/api/songs/123`)
//     is preserved on `req.url`, so the existing Express app — which mounts
//     its router under `/api` — receives paths exactly the way it does in
//     local dev.
//   * No additional rewrites are required in `vercel.json`; adding them
//     would risk losing the tail of the path.
//
// IMPORTANT: do not start a listener here — Vercel invokes the exported
// handler directly. The long-running server entry lives in `src/index.ts`
// and is still used by local Replit dev (`pnpm run dev`).
//
// Sentry is initialized at the top so cold-start errors (DB connect, env
// validation, etc.) get captured. After every invocation we flush so events
// aren't lost when the function freezes.
import { initSentry, Sentry } from "../src/lib/sentry";

const sentryEnabled = initSentry();

import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../src/app";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      res.on("close", resolve);
      res.on("finish", resolve);
      res.on("error", reject);
      try {
        (app as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    if (sentryEnabled) Sentry.captureException(err);
    throw err;
  } finally {
    if (sentryEnabled) {
      try {
        await Sentry.flush(2000);
      } catch {
        // ignore flush errors
      }
    }
  }
}
