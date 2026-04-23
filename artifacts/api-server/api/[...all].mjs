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
// IMPORTANT: do not call `app.listen` here -- Vercel invokes the
// exported handler directly. The long-running server entry lives in
// `src/index.ts` and is still used by local Replit dev.
//
// We deliberately do NOT use top-level `await import(...)` here. If the
// bundle's module-init does something that hangs (worker threads, socket
// connects) or calls `process.exit`, top-level await will never resolve
// and Vercel surfaces the generic FUNCTION_INVOCATION_FAILED page,
// hiding our diagnostic. Instead we lazily import on the first request
// inside a try/catch and cache the result. This also lets `?__diag=1`
// always return synchronously, even when the bundle is broken.

let appPromise = null;

async function loadApp() {
  if (!appPromise) {
    appPromise = import("../dist/handler.mjs").then(
      (mod) => ({ ok: true, app: mod.default ?? mod }),
      (err) => {
        console.error("[api/[...all].mjs] Failed to load handler bundle:", err);
        return { ok: false, error: err };
      },
    );
  }
  return appPromise;
}

function sendInitError(res, error) {
  res.statusCode = 500;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  const includeStack = process.env.DEBUG_BOOT === "true";
  const baseMsg = error instanceof Error ? error.message : String(error);
  const stack =
    includeStack && error instanceof Error && error.stack
      ? `\n\n${error.stack}`
      : "";
  res.end(`API failed to initialize:\n\n${baseMsg}${stack}`);
}

export default async function handler(req, res) {
  // Diagnostic ping that bypasses the bundle entirely. Use this to
  // confirm the function itself is being invoked when the bundle is
  // suspected of crashing on cold start.
  // Example: GET /api/anything?__diag=1
  const url = req.url || "";
  if (url.includes("__diag=1")) {
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

  let result;
  try {
    result = await loadApp();
  } catch (err) {
    // Belt-and-suspenders: loadApp itself never throws (we wrap), but
    // if something weird happens, surface it instead of crashing.
    sendInitError(res, err);
    return;
  }

  if (!result.ok) {
    sendInitError(res, result.error);
    return;
  }

  try {
    return result.app(req, res);
  } catch (err) {
    // Synchronous throw from the Express app itself. Express normally
    // routes errors through next(err), but a throw inside app(req,res)
    // before any handler runs would otherwise become a generic 500.
    console.error("[api/[...all].mjs] App threw synchronously:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      const msg = err instanceof Error ? err.message : String(err);
      res.end(`API request failed:\n\n${msg}`);
    }
  }
}
