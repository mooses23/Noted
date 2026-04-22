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

console.log("CLERK_PUBLISHABLE_KEY is NOT validated by api-server");
{
  // The api-server doesn't read CLERK_PUBLISHABLE_KEY anywhere; the frontend
  // owns that var. Validating it here would crash deploys whose API project
  // doesn't have it set (which is the correct configuration).
  const probs = collectProductionEnvProblems({
    ...FULLY_VALID,
    CLERK_PUBLISHABLE_KEY: undefined,
  });
  check(
    "absent CLERK_PUBLISHABLE_KEY does not produce a problem",
    !probs.some((p) => p.name === "CLERK_PUBLISHABLE_KEY"),
  );
}

console.log("validateProductionEnv — failure behaviour");
{
  let captured: { name: string; reason: string }[] | null = null;
  validateProductionEnv({
    env: { ...FULLY_VALID, GOOGLE_APPLICATION_CREDENTIALS_JSON: "" },
    onFail: (problems) => {
      captured = problems;
    },
  });
  check(
    "calls onFail with problems when a rule fails",
    captured !== null && captured!.length > 0,
  );
}
{
  let threw = false;
  try {
    validateProductionEnv({
      env: { ...FULLY_VALID, GOOGLE_APPLICATION_CREDENTIALS_JSON: "" },
    });
  } catch {
    threw = true;
  }
  check("throws (does not call process.exit) on failure when no onFail given", threw);
}
{
  let called = false;
  validateProductionEnv({
    env: FULLY_VALID,
    onFail: () => {
      called = true;
    },
  });
  check("does not call onFail when every required var is valid", called === false);
}
{
  let called = false;
  validateProductionEnv({
    env: { ...FULLY_VALID, NODE_ENV: "development", GOOGLE_APPLICATION_CREDENTIALS_JSON: "" },
    onFail: () => {
      called = true;
    },
  });
  check("no-op outside production", called === false);
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log("\nAll tests passed");
}
