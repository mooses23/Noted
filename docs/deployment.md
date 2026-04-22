# Deploying LayerStack to Supabase + Vercel

This guide takes you from an empty Supabase project and an empty Vercel
account to a fully running production deployment of LayerStack. Local Replit
development continues to work unchanged after following these steps.

The production topology is **two Vercel projects** sharing the same Git repo:

| Vercel project    | Root directory            | Purpose                                  |
| ----------------- | ------------------------- | ---------------------------------------- |
| `layerstack-web`  | `artifacts/layerstack`    | Vite SPA, served as a static build       |
| `layerstack-api`  | `artifacts/api-server`    | Express API on Node.js serverless funcs  |

…backed by **one Supabase project** providing Postgres and a **Google Cloud
Storage** bucket (with a service account) providing object storage.

The web project uses a Vercel **rewrite** to forward `/api/*` to the API
project, so the browser sees a single origin. This avoids CORS work and
keeps Clerk session cookies on one host. The rewrite is generated at build
time from the `API_REWRITE_TARGET` env var (see step 4.7), so operators set
one env var per environment instead of editing committed config and preview
deployments automatically point at the matching API preview deployment.

---

## Production environment variables (canonical checklist)

This is the single source of truth for what the API and web projects read
from the environment in production. The required list mirrors
`artifacts/api-server/src/lib/envValidation.ts` exactly — at startup the
API runs that validator and **exits non-zero with a single `*** ENV
MISCONFIGURATION ***` error log naming every offending variable** if
anything in the "Required" table below is missing or malformed. The deploy
fails loudly rather than booting into a broken state.

If you're preparing a new deploy, work through these tables top-to-bottom;
once both projects' Required rows are filled in, the rest are tuning knobs
you can leave at their defaults.

### Required on the API project (`layerstack-api`)

Startup will refuse to come up unless every one of these is set and
well-formed.

| Variable            | Format / example                                                                           | Purpose                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `DATABASE_URL`      | `postgres://` or `postgresql://` URL — Supabase transaction pooler (port 6543)             | Postgres connection. See §1 for how to construct it.                    |
| `CLERK_SECRET_KEY`  | Starts with `sk_live_` or `sk_test_` (publishable keys are rejected)                       | Server-side Clerk auth — verifies session tokens on every API request.  |
| `ALLOWED_ORIGINS`   | Comma-separated full `http(s)://…` origins, e.g. `https://layerstack-web.vercel.app`       | CORS allowlist for browser calls with credentials. At least one entry.  |
| `SENTRY_DSN`        | `https://<key>@<org>.ingest.sentry.io/<project>`                                           | Backend error + performance reporting. Required for production deploys. |

Plus these, which the validator does not enforce but the app needs to
function correctly in production:

| Variable                              | Format                                                  | Purpose                                                                    |
| ------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `NODE_ENV`                            | `production`                                            | Enables prod code paths (incl. the env validator above).                   |
| `CLERK_PUBLISHABLE_KEY`               | `pk_live_…` / `pk_test_…`                               | Used by the Clerk SDK on the server side for token issuer verification.    |
| `LAYERSTACK_ADMIN_EMAILS`             | Comma-separated emails (empty = no admins)              | Admin allowlist.                                                           |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Full service-account JSON, single value                 | GCS authentication. See **Object storage setup** below.                    |
| `PUBLIC_OBJECT_SEARCH_PATHS`          | Comma-separated `/<bucket>/<prefix>`                    | Where public assets are read from.                                         |
| `PRIVATE_OBJECT_DIR`                  | Single `/<bucket>/<prefix>`                             | Where private uploads go.                                                  |

### Optional tuning vars on the API project

All of these have safe defaults — set them only when you have a reason.

| Variable                       | Default                                       | Effect                                                                                 |
| ------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `LOG_LEVEL`                    | `info`                                        | pino log verbosity (`trace`/`debug`/`info`/`warn`/`error`).                            |
| `APP_BASE_URL`                 | `REPLIT_DEV_DOMAIN` in dev, otherwise unset   | Absolute base URL used to build links in outbound digest emails.                       |
| `PGPOOL_MAX`                   | `1`                                           | Max pg connections per serverless instance.                                            |
| `PGPOOL_IDLE_TIMEOUT_MS`       | `10000`                                       | Idle-connection eviction timeout for the pg pool.                                      |
| `PGSSL_REJECT_UNAUTHORIZED`    | `true`                                        | **Do not disable for Supabase.** Only for self-hosted Postgres with a private CA.      |
| `GCS_PROJECT_ID`               | `project_id` from the service-account JSON    | Override the GCP project ID used for GCS calls.                                        |
| `FFMPEG_PATH`                  | `ffmpeg` on `$PATH`                           | Absolute path to the ffmpeg binary used for the auto-mix preview.                      |
| `SENTRY_ENVIRONMENT`           | `VERCEL_ENV` → `NODE_ENV` → `development`     | Sentry environment tag.                                                                |
| `SENTRY_RELEASE`               | `VERCEL_GIT_COMMIT_SHA`                       | Sentry release tag.                                                                    |
| `SENTRY_TRACES_SAMPLE_RATE`    | `0.1` (when `SENTRY_DSN` set)                 | Fraction of requests sampled as performance transactions, `0..1`. See §8.6.            |
| `RESEND_API_KEY`               | unset (digest sending disabled)               | Enables the Resend client used to send the contributor digest email.                   |
| `DIGEST_FROM_EMAIL`            | `Noted <notifications@noted.app>`             | `From:` address on digest emails.                                                      |
| `CRON_SECRET`                  | unset                                         | Shared secret required on the digest cron endpoint (`/api/me/...`) when set.           |

### Required on the web project (`layerstack-web`)

| Variable                     | Format                          | Purpose                                                                                 |
| ---------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `NODE_ENV`                   | `production`                    | Enables prod build settings.                                                            |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_…` / `pk_test_…`       | Browser-side Clerk SDK init. Must match the same Clerk instance as `CLERK_SECRET_KEY`.  |
| `API_REWRITE_TARGET`         | Full origin, e.g. `https://layerstack-api.vercel.app` | Build-time rewrite target for `/api/*`. Build fails loudly if unset (see §4.7).         |

### Optional on the web project

| Variable                          | Default                            | Effect                                                                            |
| --------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| `VITE_SENTRY_DSN`                 | unset (frontend Sentry disabled)   | Enables browser error + performance reporting.                                    |
| `VITE_SENTRY_ENVIRONMENT`         | `VERCEL_ENV`                       | Sentry environment tag for browser events.                                        |
| `VITE_SENTRY_RELEASE`             | `VERCEL_GIT_COMMIT_SHA`            | Sentry release tag for browser events.                                            |
| `VITE_SENTRY_TRACES_SAMPLE_RATE`  | `0.1` (when `VITE_SENTRY_DSN` set) | Fraction of sessions sampled for performance. See §8.6.                           |
| `SENTRY_AUTH_TOKEN`               | unset                              | Source-map upload token — when set with `SENTRY_ORG` + `SENTRY_PROJECT`, the build uploads source maps. |
| `SENTRY_ORG`                      | unset                              | Sentry org slug for source-map upload.                                            |
| `SENTRY_PROJECT`                  | `layerstack-web`                   | Sentry project slug for source-map upload.                                        |
| `API_HEALTH_CHECK_TIMEOUT_MS`     | `10000`                            | Timeout for the post-build `/api/healthz` smoke check (§4.7).                     |
| `SKIP_API_HEALTH_CHECK`           | unset                              | Set to `1` to skip the post-build smoke check (offline / not-yet-deployed API).   |

> The API project's per-environment `.env.production.example`
> (`artifacts/api-server/.env.production.example`) and the web project's
> equivalent (`artifacts/layerstack/.env.production.example`) contain the
> same variables annotated inline — copy them into Vercel's env-var UI
> when first wiring up a project. This doc is the human-readable index;
> those files are the copy-paste source.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Pick a region close to your Vercel deployment region (e.g. `us-east-1`).
3. Set a strong database password and save it — you'll need it below.
4. Once the project is provisioned, open **Project Settings → Database →
   Connection string**.
5. Select the **Transaction pooler** mode (port `6543`). This is the only
   mode that survives serverless cold starts cleanly.
6. Copy the URI. It looks like:

   ```
   postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

   Append `?sslmode=require` if it's not already in the URL.

   This is your `DATABASE_URL`.

> **Why the transaction pooler?** Each Vercel function instance opens its own
> short-lived pg pool. The transaction pooler multiplexes those onto a small
> set of physical Postgres connections, preventing connection exhaustion.

> **TLS verification.** The DB client verifies the server certificate by
> default. Supabase serves a valid public certificate so this works out of
> the box. Only set `PGSSL_REJECT_UNAUTHORIZED=false` if you knowingly
> connect to a server with a self-signed cert — never in production.

## 2. Push the schema

From your local machine, with `pnpm install` already run:

```bash
DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require' \
  pnpm --filter @workspace/db push
```

This runs `drizzle-kit push` against Supabase and creates every table defined
in `lib/db/src/schema`. Re-run it any time the schema changes.

If Drizzle warns about destructive changes you didn't intend, abort and fix
the schema. To force a destructive push (only on a database you own), use
`pnpm --filter @workspace/db push-force`.

## 3. Create the API Vercel project

1. <https://vercel.com/new> → import this Git repository.
2. **Project name**: `layerstack-api`.
3. **Root directory**: `artifacts/api-server`.
4. **Framework preset**: *Other* (Vercel auto-detects the `api/` folder and
   reads `vercel.json`).
5. **Install command**: leave as default (`pnpm install --frozen-lockfile`,
   already set in `vercel.json`).
6. **Build command / Output directory**: leave blank — there is no static
   build, only the serverless function under `api/[...all].ts`.
7. Add the environment variables from `artifacts/api-server/.env.production.example`:
   - `NODE_ENV=production`
   - `DATABASE_URL` (from step 1)
   - `ALLOWED_ORIGINS` — set to the eventual web URL once you create it in
     step 4 (you can come back and edit this).
   - `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` (Clerk dashboard → API Keys)
   - `LAYERSTACK_ADMIN_EMAILS` — comma-separated admin email allowlist.
   - Object storage (see **Object storage setup** below):
     - `GOOGLE_APPLICATION_CREDENTIALS_JSON` — full service-account JSON.
     - `PUBLIC_OBJECT_SEARCH_PATHS` — comma-separated public bucket paths
       (e.g. `/your-bucket/public`).
     - `PRIVATE_OBJECT_DIR` — single private bucket path (e.g.
       `/your-bucket/private`).
   - Optional: `LOG_LEVEL`, `PGPOOL_MAX`, `PGPOOL_IDLE_TIMEOUT_MS`,
     `GCS_PROJECT_ID`.
8. **Deploy**. Note the deployed URL — e.g.
   `https://layerstack-api.vercel.app`. Verify with:

   ```bash
   curl https://layerstack-api.vercel.app/api/healthz
   ```

   You should see a JSON `{"status":"ok"}`-style response.

## 4. Create the web Vercel project

1. <https://vercel.com/new> → import the same Git repo again.
2. **Project name**: `layerstack-web`.
3. **Root directory**: `artifacts/layerstack`.
4. **Framework preset**: *Vite* (auto-detected; `vercel.json` overrides the
   build command to use the workspace filter).
5. **Build command / Output directory / Install command**: leave defaults —
   they're set in `vercel.json`.
6. Add the environment variables from
   `artifacts/layerstack/.env.production.example`:
   - `NODE_ENV=production`
   - `VITE_CLERK_PUBLISHABLE_KEY` (same Clerk publishable key as the API
     project)
7. **Set `API_REWRITE_TARGET`** — the API origin the build-time script will
   wire `/api/*` to. The build will fail loudly if this is missing, so set
   it before the first deploy. Configure it **per environment** in
   **Project Settings → Environment Variables**:

   | Environment | Value                                                                                  |
   | ----------- | -------------------------------------------------------------------------------------- |
   | Production  | `https://layerstack-api.vercel.app` (or your custom API domain)                        |
   | Preview     | `https://layerstack-api-git-${VERCEL_GIT_COMMIT_REF}-<team-slug>.vercel.app`           |

   The build script (`scripts/build-vercel-output.mjs`) substitutes
   `${VAR}` placeholders against the build environment, so the Preview
   value above resolves to the matching API preview branch deployment for
   every PR — no manual edits per branch. Find your `<team-slug>` in the
   API project's preview deployment URL (Vercel uses the pattern
   `<project>-git-<branch>-<team>.vercel.app`).

   The script writes `.vercel/output/config.json` via the Vercel Build
   Output API, so the rewrite ships with the deployment artifact itself.
   This is why `vercel.json` no longer needs to declare any rewrites and
   no dashboard rewrite needs to be configured.

   **Post-build smoke check.** Right after resolving `API_REWRITE_TARGET`,
   the build script issues a `GET ${apiOrigin}/api/healthz` and fails the
   deploy if the response isn't 2xx (or the request errors / times out).
   This catches typos in the env var, expired preview URLs, and API
   projects that haven't deployed yet — instead of shipping a "successful"
   web build that 404s on every API call. The failure message includes
   the resolved URL plus the HTTP status or network error.

   - Default request timeout is 10s; override with
     `API_HEALTH_CHECK_TIMEOUT_MS`.
   - To skip the check (offline builds, local experimentation, or a
     deliberately-not-yet-deployed API), set `SKIP_API_HEALTH_CHECK=1`.
8. **Deploy**.
9. Go back to the API project and set `ALLOWED_ORIGINS` to include the web
   project's URL (e.g. `https://layerstack-web.vercel.app`). Redeploy the
   API project so the new env var takes effect.

## 5. Configure Clerk

In the Clerk dashboard:

1. **Domains** → add the web project's production URL (e.g.
   `layerstack-web.vercel.app` and any custom domain).
2. **Allowed origins** for the API key: include the same URLs.
3. If you previously used the Replit dev domain, leave it in place — it only
   affects dev.
4. Because the rewrite means the browser always sees the web origin for both
   the SPA and `/api/*`, you do **not** need Clerk satellite domains.

## 6. Custom domain (optional)

In Vercel, attach the domain to `layerstack-web`. Add the same domain to
`ALLOWED_ORIGINS` on the API project and to Clerk's domain list. The API
project does not need its own custom domain — it's only reached through the
rewrite.

## 7. Smoke test

After both deploys succeed:

- [ ] `https://<web-url>/` loads the SPA.
- [ ] `https://<web-url>/api/healthz` returns JSON via the rewrite —
      confirms the API is reachable from the browser's origin.
- [ ] Sign in with Clerk on the web URL; the Clerk session cookie is set on
      the web origin and authenticated API calls succeed.
- [ ] Browse `/songs` — list page loads with metadata from Supabase.
- [ ] Submit a test commit (if seeded data exists) and confirm DB writes
      hit Supabase (check the Supabase **Table Editor**).
- [ ] An audio file URL like `/api/storage/<path>` streams successfully —
      confirms GCS service-account credentials are working.

## Object storage setup

The API uses Google Cloud Storage with two credential modes, selected
automatically (see `artifacts/api-server/src/lib/objectStorage.ts`):

| Environment | Credentials                                                |
| ----------- | ---------------------------------------------------------- |
| Replit dev  | Replit GCS sidecar (no env var needed)                     |
| Vercel prod | `GOOGLE_APPLICATION_CREDENTIALS_JSON` service-account JSON |

To prepare GCS for the Vercel deployment:

1. In the Google Cloud console, create (or reuse) a bucket. Inside it,
   create two prefixes for public and private assets — e.g. `public/` and
   `private/`.
2. Create a service account with role **Storage Object Admin** (or a
   tighter custom role granting read/write on those bucket prefixes).
3. Generate a JSON key for the service account and download it.
4. In the Vercel `layerstack-api` project, set
   `GOOGLE_APPLICATION_CREDENTIALS_JSON` to the **entire JSON key** as the
   value (Vercel handles multi-line values correctly).
5. Set `PUBLIC_OBJECT_SEARCH_PATHS=/your-bucket/public` and
   `PRIVATE_OBJECT_DIR=/your-bucket/private` (substitute your bucket name
   and prefixes). Multiple public paths can be comma-separated.
6. Optional: set `GCS_PROJECT_ID` if you want to override the
   `project_id` baked into the service-account JSON.
7. Make sure the bucket's **CORS** policy allows uploads from the web
   project's origin (the upload flow uses signed URLs that the browser
   PUTs to directly).

Local Replit dev is unchanged — it continues to use the sidecar
automatically as long as `REPL_ID` is set, which Replit always provides.

## 8. Observability with Sentry (recommended)

The app ships with optional [Sentry](https://sentry.io) integration on both
the React frontend and the Express API. When the relevant DSN env vars are
unset, Sentry is fully disabled and the app behaves exactly as before — so
this section is opt-in but strongly recommended for any real deployment.

### 8.1 Create the Sentry projects

1. Sign up at <https://sentry.io> and create an organization.
2. Create **two** projects in that org so frontend and backend errors don't
   commingle on one dashboard:
   - `layerstack-web` → platform **React**
   - `layerstack-api` → platform **Node.js / Express**
3. From each project's **Settings → Client Keys (DSN)** copy the DSN URL.

### 8.2 Wire env vars

On the **`layerstack-web`** Vercel project add (Production + Preview):

| Variable                          | Value                                              |
| --------------------------------- | -------------------------------------------------- |
| `VITE_SENTRY_DSN`                 | DSN of the `layerstack-web` Sentry project         |
| `VITE_SENTRY_ENVIRONMENT`         | `production` (Vercel sets `VERCEL_ENV` for preview) |
| `VITE_SENTRY_RELEASE`             | `$VERCEL_GIT_COMMIT_SHA`                           |
| `VITE_SENTRY_TRACES_SAMPLE_RATE`  | optional, defaults to `0.1` when DSN is set (see §8.6) |
| `SENTRY_AUTH_TOKEN`               | Internal Integration token with `project:releases` |
| `SENTRY_ORG`                      | Sentry org slug                                    |
| `SENTRY_PROJECT`                  | `layerstack-web`                                   |

When all three of `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`
are present at build time, the Vite plugin uploads the production bundle's
source maps to Sentry, so stack traces resolve to original TS/TSX. Without
those vars the build still succeeds — source maps just don't get uploaded.

On the **`layerstack-api`** Vercel project add (Production + Preview):

| Variable                       | Value                                              |
| ------------------------------ | -------------------------------------------------- |
| `SENTRY_DSN`                   | DSN of the `layerstack-api` Sentry project         |
| `SENTRY_ENVIRONMENT`           | optional, defaults to `VERCEL_ENV`/`NODE_ENV`      |
| `SENTRY_RELEASE`               | optional, defaults to `VERCEL_GIT_COMMIT_SHA`      |
| `SENTRY_TRACES_SAMPLE_RATE`    | optional, defaults to `0.1` when DSN is set (see §8.6) |

The API serverless handler initializes Sentry on cold start, captures any
unhandled Express errors via `Sentry.setupExpressErrorHandler`, and flushes
events at the end of every invocation so nothing is dropped when the
function freezes. The long-lived Replit dev server additionally captures
process-level `unhandledRejection` and `uncaughtException`.

### 8.3 Alerting on error spikes

In each Sentry project: **Alerts → Create Alert Rule → Issue Alerts**.

Recommended rules to start with (tweak thresholds to your traffic):

- **Frontend (`layerstack-web`)**: *"Number of events in an issue is more
  than 25 in 5 minutes"* → notify a Slack channel or PagerDuty.
- **API (`layerstack-api`)**: *"Number of events in an issue is more than
  10 in 5 minutes"* → same on-call destination.
- Add an **Issue Owners** rule so new errors auto-assign by file path.

Issue-count rules above only fire when a *single* issue spikes. To catch a
broad outage where dozens of unique errors appear at once (e.g. Supabase is
down), also add a **Metric Alert** in each project:

- **Frontend**: *"Number of errors is above 100 in 5 minutes"*.
- **API**: *"Number of HTTP 5xx errors (\`event.tag.http_status_code:5xx\`)
  is above 30 in 5 minutes"*. The API error middleware tags Sentry events
  with the response status, so this filter is reliable. Pair it with
  *"% of sessions with errors > 5%"* for user-impact paging.

Connect the destination once via **Settings → Integrations** (Slack,
PagerDuty, Opsgenie, Discord, MS Teams all supported) and reference it in
the alert rule's *Action*.

### 8.4 Long-term log retention via Vercel Log Drains

Vercel keeps function logs for 1 hour on Hobby and 1 day on Pro by default.
For post-incident forensics, configure a log drain so logs flow into a
long-term store:

1. Go to **Vercel Team → Settings → Log Drains → Add Log Drain**.
2. Pick a **Source**: include both `layerstack-web` and `layerstack-api`.
3. Pick a **Destination** — common choices:
   - **Datadog / Logtail / Axiom**: paste the destination URL + token from
     the provider's Vercel integration page.
   - **HTTP**: any endpoint that accepts JSON Lines (e.g. an internal
     Logstash). Use the **Secret** to verify the `x-vercel-signature`
     header on receipt.
4. Save. Logs start streaming within a minute. Verify by triggering a
   request and looking for it in the destination dashboard.

### 8.5 Dashboards to bookmark

After step 8.2 your team should bookmark:

- `https://<org>.sentry.io/projects/layerstack-web/` — frontend errors
- `https://<org>.sentry.io/projects/layerstack-api/` — backend errors
- `https://<org>.sentry.io/performance/?project=layerstack-api` — API
  latency by route (p50/p95/p99). Populated automatically once
  `SENTRY_DSN` is set; see §8.6 to tune the sample rate.
- `https://vercel.com/<team>/layerstack-web/logs` — raw frontend logs
- `https://vercel.com/<team>/layerstack-api/logs` — raw backend logs
- The log-drain destination dashboard (Datadog / Axiom / etc.)

### 8.6 Performance tracing (sampled APM)

Error reporting only catches outright crashes. Slow Postgres queries, slow
GCS reads, sluggish cold starts, and gradual route latency regressions
won't surface in the Issues tab — users feel them long before anything
"breaks". Sentry's performance tracing fills that gap by sampling a
fraction of requests as **transactions**, breaking each one down into
spans (HTTP handler → DB query → GCS call → response).

**Defaults.** When `SENTRY_DSN` / `VITE_SENTRY_DSN` are set, both
artifacts default `tracesSampleRate` to **`0.1`** (10% of
requests/sessions). That is enough volume to populate the Performance tab
with stable p50/p95/p99 per route on low-to-mid traffic, while keeping
transaction usage well inside the Sentry Team plan's monthly quota. Set
`SENTRY_TRACES_SAMPLE_RATE` / `VITE_SENTRY_TRACES_SAMPLE_RATE` to
override.

**Trade-off.**

| Sample rate | What you get                                           | Cost                                         |
| ----------- | ------------------------------------------------------ | -------------------------------------------- |
| `0`         | Errors only. No latency visibility.                    | Free (covered by error quota).               |
| `0.1`       | Stable p50/p95/p99 per route at meaningful traffic.    | ~10% of requests count toward txn quota.     |
| `0.5`+      | Catches rare slow spans (e.g. cold starts, p99 tails). | Halfway to "trace everything" pricing.       |
| `1.0`       | Every request traced; full waterfall always available. | Only feasible on high-volume paid plans.     |

Rule of thumb: start at `0.1`. If the Performance tab feels too sparse
for a low-traffic route, bump to `0.5`. If you're getting close to your
monthly transaction limit (Sentry → Stats → Usage), drop back to `0.05`
or disable the noisier surface (typically the frontend).

**Validating it's on.** After deploying with the env vars set:

1. Hit a few API routes in production.
2. Open Sentry → Performance → filter by `project:layerstack-api`.
   Within a minute or two you should see transactions like
   `GET /api/rounds`, `POST /api/commits`, etc. with duration
   distributions.
3. Click a transaction to inspect spans — you'll see the Express
   handler, downstream `pg.query` calls, and any `gcs.*` operations.
4. From a transaction's "Trace" view, set up an **alert** under
   Performance → Alerts: e.g. *"p95 of `GET /api/rounds` > 1s for 5
   minutes"* → notify the same Slack/PagerDuty destination wired in
   §8.3. This is the bit that makes latency regressions actually wake
   somebody up before users complain.

### 8.7 External uptime monitor (pages on-call when the site is fully down)

Sentry alerts (§8.3) only fire when the application produces an error event.
If the API serverless function fails to **boot** at all — bad env var, an
expired GCS service-account key, Supabase unreachable, a Vercel platform
incident — the function returns a bare `5xx` (or times out) with no Sentry
event ever sent, so the on-call channel stays silent. An external uptime
monitor closes that gap by treating "no response / non-2xx response" as the
page-worthy signal.

Configure a third-party uptime monitor (Better Stack, Pingdom, UptimeRobot,
Checkly, Datadog Synthetics — any of them work) with **two checks**:

| Check name              | URL                                | Expected            |
| ----------------------- | ---------------------------------- | ------------------- |
| `layerstack-api-health` | `https://<web-url>/api/healthz`    | HTTP 200, body contains `"status":"ok"` |
| `layerstack-web-root`   | `https://<web-url>/`               | HTTP 200            |

Settings for both checks:

- **Frequency:** every 1 minute.
- **Regions:** at least two geographically distinct probe regions (e.g.
  `us-east` + `eu-west`). Requiring **2 of N regions to fail** before paging
  suppresses single-region ISP blips.
- **Failure threshold:** 2 consecutive failed checks before alerting (avoids
  paging on a single dropped packet).
- **Timeout:** 10 seconds per request — long enough for a serverless cold
  start, short enough to catch a hung function.

Hit the API check **through the web URL**, not the bare API origin
(`layerstack-api.vercel.app`). That way a single check exercises the SPA's
DNS, the Vercel edge, the `/api/*` rewrite, *and* the API function — exactly
the path real users take. The SPA-root check additionally catches the case
where the API is healthy but the static build is broken or unrouted.

**Wire the alert to the same on-call destination as the Sentry alerts in
§8.3.** Most uptime providers integrate natively with PagerDuty, Opsgenie,
Slack, and Microsoft Teams — pick the same destination so a "site is down"
page lands in the same channel/rotation as an error-rate page and the
on-call doesn't have to watch two inboxes.

**Status page (optional but recommended).** Better Stack, Pingdom, and
UptimeRobot all expose a public status-page URL backed by these checks.
Linking it from the app footer or `/status` redirect lets users
self-serve during an incident.

**Add the monitor to this doc.** Once the monitor is created, paste its
dashboard URL here so future on-calls can find it in one click:

- Uptime monitor dashboard: `<paste URL after creating the monitor>`
- Public status page (if enabled): `<paste URL after creating the monitor>`

## Troubleshooting

- **`ECONNREFUSED` or pooler errors on cold start.** Check that `DATABASE_URL`
  points at the **transaction pooler** (port 6543), not the direct
  connection (port 5432).
- **`SSL/TLS required` errors.** Append `?sslmode=require` to `DATABASE_URL`.
- **`self-signed certificate` / `unable to verify the first certificate`.**
  You're connecting to a server whose cert isn't trusted by Node's CA
  bundle. For Supabase this should never happen; double-check the host. For
  a self-hosted Postgres with a private CA, install the CA into the runtime
  or set `PGSSL_REJECT_UNAUTHORIZED=false` (only as a last resort).
- **`CORS: origin not allowed`.** The browser's `Origin` header isn't in
  `ALLOWED_ORIGINS`. Add it on the API project and redeploy. Remember:
  preview URLs change per deploy.
- **Clerk redirects fail.** Make sure the web URL is listed in Clerk's
  allowed domains and that `VITE_CLERK_PUBLISHABLE_KEY` matches the same
  Clerk instance whose `CLERK_SECRET_KEY` you set on the API project.
- **404 on `/api/*` from the web project.** `API_REWRITE_TARGET` is unset
  or points at the wrong host for this environment. Check the web
  project's build logs — `scripts/build-vercel-output.mjs` prints the
  resolved API origin on every deploy. Update the env var on the affected
  environment and redeploy.
- **Build fails with `API_REWRITE_TARGET is not set`.** Add the env var
  to the failing environment (Production or Preview) per step 4.7, then
  redeploy.
- **Build fails with `API health check failed`.** The post-build smoke
  check in `scripts/build-vercel-output.mjs` couldn't reach
  `${apiOrigin}/api/healthz` (or got a non-2xx response). Open the build
  logs — the message includes the resolved URL plus the HTTP status or
  network error. Common causes: typo in `API_REWRITE_TARGET`, the API
  preview deployment hasn't built yet for this branch, the API is
  returning 5xx (check the API project's logs), or the URL points at a
  custom domain that hasn't finished DNS propagation. Fix and redeploy.
  For an intentional offline / API-not-yet-deployed build, set
  `SKIP_API_HEALTH_CHECK=1` on that environment.
- **Build fails with `references ${VAR} but that environment variable is
  not set`.** You used `${VERCEL_GIT_COMMIT_REF}` (or similar) in the
  Preview value, but the deploy is running in an environment where that
  variable isn't populated. For Vercel previews, `VERCEL_GIT_COMMIT_REF`
  is provided automatically — make sure the env var is scoped to the
  Preview environment only.

## Local Replit development

None of the above changes break local dev. The dev workflow still:

- Runs `vite` on `$PORT` with `BASE_PATH` set by Replit.
- Runs the Express server (`artifacts/api-server/src/index.ts`) on `$PORT`,
  bundled by `build.mjs`.
- Connects to Replit Postgres via the local `DATABASE_URL` (no SSL — auto
  detected).
