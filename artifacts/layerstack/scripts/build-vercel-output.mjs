#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const viteOutDir = resolve(projectRoot, "dist/public");
const outputDir = resolve(projectRoot, ".vercel/output");
const staticDir = resolve(outputDir, "static");
const configPath = resolve(outputDir, "config.json");

if (!existsSync(viteOutDir)) {
  console.error(
    `[build-vercel-output] Vite build output not found at ${viteOutDir}. ` +
      `Did 'vite build' run first?`,
  );
  process.exit(1);
}

const rawTarget = process.env.API_REWRITE_TARGET?.trim();
if (!rawTarget) {
  console.error(
    "[build-vercel-output] API_REWRITE_TARGET is not set.\n" +
      "  Set it in the Vercel project's Environment Variables to the API\n" +
      "  origin (e.g. https://layerstack-api.vercel.app). For Preview, you\n" +
      "  can use ${VERCEL_GIT_COMMIT_REF} to target the matching API preview\n" +
      "  branch deployment, e.g.\n" +
      "    https://layerstack-api-git-${VERCEL_GIT_COMMIT_REF}-myteam.vercel.app",
  );
  process.exit(1);
}

const interpolated = rawTarget.replace(
  /\$\{([A-Z0-9_]+)\}/gi,
  (_, name) => {
    const value = process.env[name];
    if (value === undefined || value === "") {
      console.error(
        `[build-vercel-output] API_REWRITE_TARGET references \${${name}} ` +
          `but that environment variable is not set at build time.`,
      );
      process.exit(1);
    }
    return value;
  },
);

let apiOrigin;
try {
  const url = new URL(interpolated);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`unsupported protocol "${url.protocol}"`);
  }
  apiOrigin = `${url.protocol}//${url.host}`;
} catch (err) {
  console.error(
    `[build-vercel-output] API_REWRITE_TARGET is not a valid URL: ` +
      `"${interpolated}" (${err instanceof Error ? err.message : err})`,
  );
  process.exit(1);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
cpSync(viteOutDir, staticDir, { recursive: true });

const config = {
  version: 3,
  routes: [
    {
      src: "^/api/(.*)$",
      dest: `${apiOrigin}/api/$1`,
      check: true,
    },
    { handle: "filesystem" },
    { src: "^/.*$", dest: "/index.html" },
  ],
};

writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

console.log(
  `[build-vercel-output] Wrote ${configPath}\n` +
    `  /api/* -> ${apiOrigin}/api/*`,
);
