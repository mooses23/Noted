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

The web project uses a Vercel **rewrite** (configured in the Vercel dashboard,
see step 4) to forward `/api/*` to the API project, so the browser sees a
single origin. This avoids CORS work and keeps Clerk session cookies on one
host.

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
7. **Add the API rewrite via the Vercel dashboard** (do this *before* the
   first deploy, or redeploy afterwards):
   - **Project Settings → Rewrites → Add Rewrite**
   - **Source**: `/api/:path*`
   - **Destination**: `https://<api-host>/api/:path*` — substitute the host
     from step 3 (e.g. `https://layerstack-api.vercel.app`).
   - This rewrite is intentionally **not** committed to `vercel.json`,
     because the API host is a per-environment value chosen at deploy time.
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
- **404 on `/api/*` from the web project.** The dashboard rewrite from
  step 4.7 hasn't been added yet, or its destination host is wrong.

## Local Replit development

None of the above changes break local dev. The dev workflow still:

- Runs `vite` on `$PORT` with `BASE_PATH` set by Replit.
- Runs the Express server (`artifacts/api-server/src/index.ts`) on `$PORT`,
  bundled by `build.mjs`.
- Connects to Replit Postgres via the local `DATABASE_URL` (no SSL — auto
  detected).
