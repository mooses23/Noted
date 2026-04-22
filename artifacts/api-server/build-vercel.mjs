// Pre-bundle the Express app for Vercel serverless deployment.
//
// Why this exists:
//   The workspace packages (`@workspace/db`, `@workspace/api-zod`) export
//   raw `.ts` source files via the "workspace" custom condition. That works
//   for Vite/tsx in dev, but Node at runtime can't load `.ts`. Without
//   bundling, `import "@workspace/db"` from the compiled Vercel function
//   throws ERR_UNKNOWN_FILE_EXTENSION and the function 500s on cold start.
//
// What this does:
//   esbuild bundles `src/handler.ts` (which re-exports the Express app)
//   into a single ESM file at `dist/handler.mjs`. All workspace + npm
//   deps are inlined except native modules listed under `external`. The
//   thin `api/[...all].ts` entry then `import`s that bundle, so @vercel/node
//   never has to resolve workspace conditions itself.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
import { build as esbuild } from "esbuild";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(artifactDir, "dist");

await rm(distDir, { recursive: true, force: true });

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/handler.ts")],
  platform: "node",
  target: "node22",
  bundle: true,
  format: "esm",
  outfile: path.resolve(distDir, "handler.mjs"),
  logLevel: "info",
  // Native or path-traversing packages we cannot safely bundle. They must
  // be present in the deployed function's node_modules (they are, via
  // artifacts/api-server/package.json dependencies).
  external: [
    "*.node",
    "pg-native",
    "@google-cloud/storage",
    "@sentry/node",
    "@sentry/profiling-node",
    "@opentelemetry/api",
  ],
  sourcemap: "linked",
  // CJS shims so bundled CJS modules (express, etc.) can call require/__dirname.
  banner: {
    js: [
      "import { createRequire as __vercelCrReq } from 'node:module';",
      "import __vercelPath from 'node:path';",
      "import __vercelUrl from 'node:url';",
      "globalThis.require = __vercelCrReq(import.meta.url);",
      "globalThis.__filename = __vercelUrl.fileURLToPath(import.meta.url);",
      "globalThis.__dirname = __vercelPath.dirname(globalThis.__filename);",
    ].join("\n"),
  },
});
