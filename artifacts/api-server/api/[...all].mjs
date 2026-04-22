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
import app from "../dist/handler.mjs";

export default function handler(req, res) {
  return app(req, res);
}
