import { logger } from "./logger";

/**
 * Startup validation for environment variables that the API depends on in
 * production. Each rule reports a human-readable problem ("missing",
 * "not a valid URL", etc.) so deploy logs name the offending variable
 * instead of failing later as a mysterious 500 or browser error.
 *
 * Intentionally narrow: only checks vars whose absence/malformation breaks
 * core production behavior (DB, auth, CORS, error reporting). Optional
 * tuning vars (LOG_LEVEL, SENTRY_TRACES_SAMPLE_RATE, FFMPEG_PATH, etc.)
 * are left to the modules that consume them.
 */

type EnvProblem = { name: string; reason: string };

type EnvRule = {
  name: string;
  validate: (value: string | undefined) => string | null;
};

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function requireNonEmpty(value: string | undefined): string | null {
  if (value === undefined || value.trim() === "") return "missing or empty";
  return null;
}

const PRODUCTION_RULES: readonly EnvRule[] = [
  {
    name: "DATABASE_URL",
    validate: (v) => {
      const empty = requireNonEmpty(v);
      if (empty) return empty;
      try {
        const u = new URL(v as string);
        if (!/^postgres(ql)?:$/.test(u.protocol)) {
          return `must be a postgres:// or postgresql:// URL (got ${JSON.stringify(u.protocol)})`;
        }
        return null;
      } catch {
        return "is not a valid URL";
      }
    },
  },
  {
    name: "CLERK_SECRET_KEY",
    validate: (v) => {
      const empty = requireNonEmpty(v);
      if (empty) return empty;
      // Clerk secret keys are prefixed `sk_live_` or `sk_test_`. Reject
      // obviously wrong values (e.g. publishable keys pasted by mistake).
      if (!/^sk_(live|test)_/.test(v as string)) {
        return 'must start with "sk_live_" or "sk_test_" (looks like the wrong key was supplied)';
      }
      return null;
    },
  },
  {
    name: "ALLOWED_ORIGINS",
    validate: (v) => {
      const empty = requireNonEmpty(v);
      if (empty) return empty;
      const entries = (v as string)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (entries.length === 0) return "must contain at least one origin";
      const bad = entries.filter((e) => !isHttpUrl(e));
      if (bad.length > 0) {
        return `contains ${bad.length} invalid entr${bad.length === 1 ? "y" : "ies"}: ${bad
          .map((b) => JSON.stringify(b))
          .join(", ")} (each entry must be a full http(s) URL)`;
      }
      return null;
    },
  },
  {
    name: "SENTRY_DSN",
    validate: (v) => {
      const empty = requireNonEmpty(v);
      if (empty) return empty;
      if (!isHttpUrl(v as string)) return "is not a valid http(s) URL";
      return null;
    },
  },
  {
    name: "GOOGLE_APPLICATION_CREDENTIALS_JSON",
    validate: (v) => {
      const empty = requireNonEmpty(v);
      if (empty) return empty;
      let parsed: unknown;
      try {
        parsed = JSON.parse(v as string);
      } catch {
        return "is not valid JSON (must be the full service-account JSON key)";
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return "must be a JSON object (the full service-account JSON key)";
      }
      const obj = parsed as Record<string, unknown>;
      const missing = ["client_email", "private_key"].filter(
        (k) => typeof obj[k] !== "string" || (obj[k] as string).trim() === "",
      );
      if (missing.length > 0) {
        return `is missing required service-account field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`;
      }
      return null;
    },
  },
  {
    name: "PUBLIC_OBJECT_SEARCH_PATHS",
    validate: (v) => {
      const empty = requireNonEmpty(v);
      if (empty) return empty;
      const entries = (v as string)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (entries.length === 0) {
        return "must contain at least one /<bucket>/<prefix> entry";
      }
      const bad = entries.filter((e) => !e.startsWith("/") || e.length < 2);
      if (bad.length > 0) {
        return `contains ${bad.length} invalid entr${bad.length === 1 ? "y" : "ies"}: ${bad
          .map((b) => JSON.stringify(b))
          .join(", ")} (each entry must start with "/" — e.g. "/your-bucket/public")`;
      }
      return null;
    },
  },
  {
    name: "PRIVATE_OBJECT_DIR",
    validate: (v) => {
      const empty = requireNonEmpty(v);
      if (empty) return empty;
      const trimmed = (v as string).trim();
      if (!trimmed.startsWith("/") || trimmed.length < 2) {
        return 'must be a single "/<bucket>/<prefix>" path (e.g. "/your-bucket/private")';
      }
      if (trimmed.includes(",")) {
        return "must be a single path, not a comma-separated list (use PUBLIC_OBJECT_SEARCH_PATHS for multiple)";
      }
      return null;
    },
  },
];

export function collectProductionEnvProblems(
  env: NodeJS.ProcessEnv = process.env,
  rules: readonly EnvRule[] = PRODUCTION_RULES,
): EnvProblem[] {
  const problems: EnvProblem[] = [];
  for (const rule of rules) {
    const reason = rule.validate(env[rule.name]);
    if (reason) problems.push({ name: rule.name, reason });
  }
  return problems;
}

export function formatEnvProblems(problems: readonly EnvProblem[]): string {
  const summary = problems.map((p) => `  - ${p.name}: ${p.reason}`).join("\n");
  return (
    "*** ENV MISCONFIGURATION: " +
    `${problems.length} required production environment variable${problems.length === 1 ? " is" : "s are"} ` +
    "missing or malformed. The API cannot start safely. Fix the following " +
    `and redeploy:\n${summary} ***`
  );
}

/**
 * Production env problems detected at module-load time. Empty array means
 * everything is OK (or NODE_ENV !== "production"). Consumed by app.ts
 * to install a guard middleware that 500s every request with the
 * formatted message — see notes in validateProductionEnv() below for
 * why we capture instead of throwing.
 */
export const productionEnvProblems: EnvProblem[] = (() => {
  if (process.env.NODE_ENV !== "production") return [];
  const problems = collectProductionEnvProblems();
  if (problems.length > 0) {
    const message = formatEnvProblems(problems);
    logger.error({ problems }, message);
    // Also write directly to stderr so the operator sees the misconfig in
    // Vercel function logs even if pino hasn't flushed yet.
    // eslint-disable-next-line no-console
    console.error(message);
  }
  return problems;
})();

/**
 * Run the production env-var checks. In production, any problem causes a
 * single prominent error log naming every offending variable and then
 * throws (or invokes `onFail`) so the long-running entrypoint can fail
 * fast. In non-production environments this is a no-op.
 *
 * IMPORTANT: this is for the long-running entrypoint (src/index.ts) only.
 * The serverless entrypoint must NOT throw at module-init: Vercel's
 * @vercel/node v5 statically inlines the bundle into the function via
 * ncc, so a throw here kills the function before any request handler
 * runs and the operator only sees an opaque FUNCTION_INVOCATION_FAILED.
 * For serverless, app.ts reads `productionEnvProblems` (above) and
 * installs a guard middleware that returns the formatted message as a
 * readable 500 on every request — so the deployed bundle still loads
 * successfully and the misconfig is visible in the HTTP response body.
 */
export function validateProductionEnv(options?: {
  env?: NodeJS.ProcessEnv;
  onFail?: (problems: EnvProblem[]) => void;
}): void {
  const env = options?.env ?? process.env;
  if (env.NODE_ENV !== "production") return;

  const problems = collectProductionEnvProblems(env);
  if (problems.length === 0) return;

  const message = formatEnvProblems(problems);
  logger.error({ problems }, message);
  // eslint-disable-next-line no-console
  console.error(message);

  if (options?.onFail) {
    options.onFail(problems);
    return;
  }
  throw new Error(message);
}
