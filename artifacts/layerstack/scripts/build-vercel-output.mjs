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

const skipHealthCheck = /^(1|true|yes)$/i.test(
  process.env.SKIP_API_HEALTH_CHECK ?? "",
);

if (skipHealthCheck) {
  console.log(
    `[build-vercel-output] Skipping API health check ` +
      `(SKIP_API_HEALTH_CHECK is set).`,
  );
} else {
  const healthUrl = `${apiOrigin}/api/healthz`;
  const DEFAULT_TIMEOUT_MS = 10000;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  const rawTimeout = process.env.API_HEALTH_CHECK_TIMEOUT_MS;
  if (rawTimeout !== undefined && rawTimeout !== "") {
    const parsed = Number(rawTimeout);
    if (Number.isFinite(parsed) && parsed > 0) {
      timeoutMs = Math.floor(parsed);
    } else {
      console.warn(
        `[build-vercel-output] Ignoring invalid ` +
          `API_HEALTH_CHECK_TIMEOUT_MS="${rawTimeout}" ` +
          `(must be a positive number); using default ${DEFAULT_TIMEOUT_MS}ms.`,
      );
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(healthUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const reason =
      err instanceof Error
        ? err.name === "AbortError"
          ? `timed out after ${timeoutMs}ms`
          : `${err.name}: ${err.message}`
        : String(err);
    console.error(
      `[build-vercel-output] API health check failed.\n` +
        `  URL: ${healthUrl}\n` +
        `  Error: ${reason}\n` +
        `  Set SKIP_API_HEALTH_CHECK=1 to bypass for offline/local builds.`,
    );
    process.exit(1);
  }
  clearTimeout(timer);
  if (!response.ok) {
    console.error(
      `[build-vercel-output] API health check failed.\n` +
        `  URL: ${healthUrl}\n` +
        `  HTTP status: ${response.status} ${response.statusText}\n` +
        `  Set SKIP_API_HEALTH_CHECK=1 to bypass for offline/local builds.`,
    );
    process.exit(1);
  }
  console.log(
    `[build-vercel-output] API health check passed (${response.status} ${healthUrl}).`,
  );
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
