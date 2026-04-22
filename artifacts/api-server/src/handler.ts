// Production serverless handler entry. Exports the configured Express
// `app` so the Vercel function in `api/[...all].ts` can re-use the same
// pipeline as local dev. Critically, this file does NOT call
// `app.listen` -- on Vercel the runtime invokes the handler directly.
//
// Sentry is initialized via `app.ts`'s side-effect import; we don't need
// to repeat it here.
import app from "./app";

export default app;
