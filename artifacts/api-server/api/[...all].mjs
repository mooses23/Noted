// Vercel serverless catch-all entry for the Noted API.
//
// This file is plain ESM JavaScript on purpose: @vercel/node v5 leaves
// `.mjs` files in `api/` untouched, whereas `.ts`/`.mts` sources get
// transpiled into a `.js` file with a CommonJS body. With package.json's
// `"type": "module"`, that compiled `.js` is loaded as ESM and the CJS
// `exports` reference throws on cold start.
//
// The Express app + all workspace deps are pre-bundled into
// `../dist/handler.mjs` by `build-vercel.mjs` during the Vercel build.
// We import that bundle (single self-contained ESM file) instead of
// importing from `../src/*` directly, because workspace packages export
// raw `.ts` files that Node cannot load at runtime.
//
// Module-init must not throw here. Vercel's @vercel/node v5 statically
// inlines this file (and the bundle, via ncc) into the function. Any
// throw during module init kills the function before any request is
// dispatched and the operator only sees Vercel's generic 500. The
// bundled app handles env-validation problems by short-circuiting every
// request with a readable 500 (see app.ts guard middleware).
import app from "../dist/handler.mjs";

export default function handler(req, res) {
  // Diagnostic ping that bypasses the bundled app entirely. Useful for
  // confirming the function file itself is being executed when the
  // bundle is suspected of crashing on cold start.
  // Example: GET /api/anything?__diag=1
  if ((req.url || "").includes("__diag=1")) {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        ok: true,
        runtime: "function-entry-reached",
        node: process.version,
        nodeEnv: process.env.NODE_ENV ?? null,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasClerkSecret: Boolean(process.env.CLERK_SECRET_KEY),
        hasAllowedOrigins: Boolean(process.env.ALLOWED_ORIGINS),
        hasSentryDsn: Boolean(process.env.SENTRY_DSN),
        hasGcpJson: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
        hasPublicSearchPaths: Boolean(process.env.PUBLIC_OBJECT_SEARCH_PATHS),
        hasPrivateObjectDir: Boolean(process.env.PRIVATE_OBJECT_DIR),
      }),
    );
    return;
  }
  return app(req, res);
}
