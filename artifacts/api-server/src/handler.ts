// Production serverless handler entry. Exports the configured Express
// `app` so the Vercel function in `api/[...all].ts` can re-use the same
// pipeline as local dev. Critically, this file does NOT call
// `app.listen` -- on Vercel the runtime invokes the handler directly.
//
// Sentry is initialized via `app.ts`'s side-effect import; we don't need
// to repeat it here.
// MUST be the first import. Validates required production env vars at
// module load and exits non-zero on misconfiguration before any other
// module is evaluated. See ./lib/envValidation.ts for details.
import "./lib/envValidation";

import app from "./app";

export default app;
