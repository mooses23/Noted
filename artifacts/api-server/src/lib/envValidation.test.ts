/**
 * Lightweight runnable test for the production env-var validator.
 * Run with:
 *   node --experimental-strip-types --no-warnings \
 *     artifacts/api-server/src/lib/envValidation.test.ts
 */
import {
  collectProductionEnvProblems,
  validateProductionEnv,
} from "./envValidation.ts";

let failed = 0;
function check(name: string, ok: boolean, details?: string) {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}${details ? ` — ${details}` : ""}`);
  }
}

const validSaJson = JSON.stringify({
  type: "service_account",
  project_id: "p",
  client_email: "x@p.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
});

const FULLY_VALID: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://u:p@h:6543/db",
  CLERK_SECRET_KEY: "sk_test_abc",
  CLERK_PUBLISHABLE_KEY: "pk_test_abc",
  ALLOWED_ORIGINS: "https://example.com",
  SENTRY_DSN: "https://abc@o1.ingest.sentry.io/1",
  GOOGLE_APPLICATION_CREDENTIALS_JSON: validSaJson,
  PUBLIC_OBJECT_SEARCH_PATHS: "/my-bucket/public",
  PRIVATE_OBJECT_DIR: "/my-bucket/private",
};

console.log("collectProductionEnvProblems — fully valid env");
check(
  "no problems when every required var is present and well-formed",
  collectProductionEnvProblems(FULLY_VALID).length === 0,
);

console.log("CLERK_PUBLISHABLE_KEY rule");
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    CLERK_PUBLISHABLE_KEY: "",
  });
  check(
    "missing → flagged",
    probs.some((p) => p.name === "CLERK_PUBLISHABLE_KEY" && /missing/.test(p.reason)),
  );
}
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    CLERK_PUBLISHABLE_KEY: "sk_test_oops",
  });
  check(
    "secret-key value rejected",
    probs.some((p) => p.name === "CLERK_PUBLISHABLE_KEY" && /pk_live_|pk_test_/.test(p.reason)),
  );
}

console.log("GOOGLE_APPLICATION_CREDENTIALS_JSON rule");
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    GOOGLE_APPLICATION_CREDENTIALS_JSON: "",
  });
  check(
    "missing → flagged",
    probs.some(
      (p) => p.name === "GOOGLE_APPLICATION_CREDENTIALS_JSON" && /missing/.test(p.reason),
    ),
  );
}
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    GOOGLE_APPLICATION_CREDENTIALS_JSON: "{not json",
  });
  check(
    "invalid JSON → flagged",
    probs.some(
      (p) => p.name === "GOOGLE_APPLICATION_CREDENTIALS_JSON" && /not valid JSON/.test(p.reason),
    ),
  );
}
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    GOOGLE_APPLICATION_CREDENTIALS_JSON: "[1,2,3]",
  });
  check(
    "JSON array → flagged as wrong shape",
    probs.some(
      (p) => p.name === "GOOGLE_APPLICATION_CREDENTIALS_JSON" && /JSON object/.test(p.reason),
    ),
  );
}
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    GOOGLE_APPLICATION_CREDENTIALS_JSON: JSON.stringify({ project_id: "p" }),
  });
  check(
    "JSON missing client_email + private_key → flagged",
    probs.some(
      (p) =>
        p.name === "GOOGLE_APPLICATION_CREDENTIALS_JSON" &&
        /client_email/.test(p.reason) &&
        /private_key/.test(p.reason),
    ),
  );
}

console.log("PUBLIC_OBJECT_SEARCH_PATHS rule");
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    PUBLIC_OBJECT_SEARCH_PATHS: "",
  });
  check(
    "missing → flagged",
    probs.some(
      (p) => p.name === "PUBLIC_OBJECT_SEARCH_PATHS" && /missing/.test(p.reason),
    ),
  );
}
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    PUBLIC_OBJECT_SEARCH_PATHS: "my-bucket/public,/ok/path",
  });
  check(
    "entry without leading slash → flagged",
    probs.some(
      (p) => p.name === "PUBLIC_OBJECT_SEARCH_PATHS" && /invalid entr/.test(p.reason),
    ),
  );
}
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    PUBLIC_OBJECT_SEARCH_PATHS: "/a/public, /b/public",
  });
  check(
    "comma-separated valid entries → OK",
    !probs.some((p) => p.name === "PUBLIC_OBJECT_SEARCH_PATHS"),
  );
}

console.log("PRIVATE_OBJECT_DIR rule");
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    PRIVATE_OBJECT_DIR: "",
  });
  check(
    "missing → flagged",
    probs.some((p) => p.name === "PRIVATE_OBJECT_DIR" && /missing/.test(p.reason)),
  );
}
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    PRIVATE_OBJECT_DIR: "my-bucket/private",
  });
  check(
    "no leading slash → flagged",
    probs.some((p) => p.name === "PRIVATE_OBJECT_DIR" && /\/<bucket>/.test(p.reason)),
  );
}
{
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    PRIVATE_OBJECT_DIR: "/a/private,/b/private",
  });
  check(
    "comma-separated value → flagged",
    probs.some((p) => p.name === "PRIVATE_OBJECT_DIR" && /single path/.test(p.reason)),
  );
}

console.log("validateProductionEnv — exit behaviour");
{
  let exited: number | null = null;
  validateProductionEnv({
    env: { ...FULLY_VALID, CLERK_PUBLISHABLE_KEY: "" },
    exit: ((code: number) => {
      exited = code;
      return undefined as never;
    }),
  });
  check("exits non-zero when a new rule fails", exited === 1);
}
{
  let exited: number | null = null;
  validateProductionEnv({
    env: FULLY_VALID,
    exit: ((code: number) => {
      exited = code;
      return undefined as never;
    }),
  });
  check("does not exit when every required var is valid", exited === null);
}
{
  let exited: number | null = null;
  validateProductionEnv({
    env: { ...FULLY_VALID, NODE_ENV: "development", CLERK_PUBLISHABLE_KEY: "" },
    exit: ((code: number) => {
      exited = code;
      return undefined as never;
    }),
  });
  check("no-op outside production", exited === null);
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log("\nAll tests passed");
}
