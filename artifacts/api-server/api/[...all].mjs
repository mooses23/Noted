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
// We import the bundle inside a try/catch so that ANY module-init
// error (e.g. ENV MISCONFIGURATION thrown by ./lib/envValidation, or a
// crash inside a workspace dep at top level) is captured and surfaced
// as a 500 response body instead of an opaque FUNCTION_INVOCATION_FAILED.
// On Vercel, module-init errors land in the runtime logs but operators
// often only see the public error page; echoing the message back makes
// the misconfiguration immediately obvious.
let app;
let importError = null;
try {
  ({ default: app } = await import("../dist/handler.mjs"));
} catch (err) {
  importError = err;
  // Also write to stderr so it shows up in Vercel function logs even if
  // the request handler is never reached for a redeploy / cold start.
  console.error("[api/[...all].mjs] Failed to load handler bundle:", err);
}

export default function handler(req, res) {
  if (importError) {
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    // Always include the error message — for ENV MISCONFIGURATION it
    // names the offending variables (no values) and is the whole point
    // of surfacing this in the response. Only include the stack trace
    // when DEBUG_BOOT=true so we don't leak file paths or dependency
    // internals in normal production responses.
    const includeStack = process.env.DEBUG_BOOT === "true";
    const baseMsg =
      importError instanceof Error ? importError.message : String(importError);
    const stack =
      includeStack && importError instanceof Error && importError.stack
        ? `\n\n${importError.stack}`
        : "";
    res.end(`API failed to initialize:\n\n${baseMsg}${stack}`);
    return;
  }
  return app(req, res);
}
