// Vercel serverless catch-all entry for the Noted API.
//
// Filesystem routing:
//   * Vercel automatically routes any request matching `/api/*` to this
//     `[...all]` catch-all. The Express app inside the bundle still mounts
//     its router under `/api`, so paths line up with local dev.
//
// Architecture:
//   * The Express app + all of its workspace deps are pre-bundled into
//     `../dist/handler.mjs` by `build-vercel.mjs` during Vercel build.
//     We import that bundle (single self-contained ESM file) instead of
//     importing from `../src/*` directly, because workspace packages
//     export raw `.ts` files that Node cannot load at runtime.
//
// IMPORTANT: do not call `app.listen` here -- Vercel invokes the exported
// handler directly. The long-running server entry lives in `src/index.ts`
// and is still used by local Replit dev (`pnpm run dev`).
import type { IncomingMessage, ServerResponse } from "node:http";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- generated at build time by build-vercel.mjs
import app from "../dist/handler.mjs";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    res.on("close", resolve);
    res.on("finish", resolve);
    res.on("error", reject);
    try {
      (app as unknown as (r: IncomingMessage, s: ServerResponse) => void)(
        req,
        res,
      );
    } catch (err) {
      reject(err);
    }
  });
}
