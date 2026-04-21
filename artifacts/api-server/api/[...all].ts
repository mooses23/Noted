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
import app from "../src/app";

export default app;
